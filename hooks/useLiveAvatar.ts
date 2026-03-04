
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audio';
import { AvatarConfig } from '../types';
import { searchAllKnowledgeChunks } from '../services/ragService';

interface UseLiveAvatarProps {
  avatarConfig: AvatarConfig;
  userName?: string;
  previousContext?: string;
  lessonContext?: string; // NOVO: Contexto da aula atual
  onTranscriptUpdate: (text: string, isUser: boolean) => void;
}

export const useLiveAvatar = ({ avatarConfig, userName, previousContext, lessonContext, onTranscriptUpdate }: UseLiveAvatarProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Refs para Buffering de Resgate (Solução 1)
  const preRollBufferRef = useRef<AudioBuffer[]>([]);
  const preRollDurationRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const isConnectingRef = useRef(false);
  const isActiveRef = useRef(false);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 5;

  const disconnect = useCallback(async (isManual = true) => {
    setIsConnected(false); // Seta como desconectado IMEDIATAMENTE para parar emissões
    isActiveRef.current = false;
    isPlayingRef.current = false;
    preRollBufferRef.current = [];
    preRollDurationRef.current = 0;

    if (isManual) {
      retryCountRef.current = 0;
    }

    if (sessionPromiseRef.current) {
      const sessionToClose = sessionPromiseRef.current;
      sessionPromiseRef.current = null;
      try {
        const session = await sessionToClose;
        (session as any)._alive = false; // Flag customizada para parar emissões imediatamente
        session.close();
      } catch (e) {
        console.warn("[Live] Error closing session:", e);
      }
    }

    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) { }
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }

    // Solução 2: Não fecha o AudioContext, apenas suspende
    if (isManual) {
      if (inputAudioContextRef.current?.state !== 'closed') {
        inputAudioContextRef.current?.suspend().catch(() => { });
      }
      if (outputAudioContextRef.current?.state !== 'closed') {
        outputAudioContextRef.current?.suspend().catch(() => { });
      }
    }

    setIsConnected(false);
    setIsTalking(false);
    isConnectingRef.current = false;
  }, []);

  const isTalkingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptBufferRef = useRef<{ text: string, isUser: boolean }[]>([]);

  // Throttle de transcrição para reduzir carga de UI em mobile
  useEffect(() => {
    const interval = setInterval(() => {
      if (transcriptBufferRef.current.length > 0) {
        // Agrupa textos do mesmo tipo
        const groups: { text: string, isUser: boolean }[] = [];
        transcriptBufferRef.current.forEach(item => {
          const last = groups[groups.length - 1];
          if (last && last.isUser === item.isUser) {
            last.text += item.text;
          } else {
            groups.push({ ...item });
          }
        });

        groups.forEach(group => onTranscriptUpdate(group.text, group.isUser));
        transcriptBufferRef.current = [];
      }
    }, 150); // 150ms é um bom balanço entre tempo real e performance
    return () => clearInterval(interval);
  }, [onTranscriptUpdate]);

  const connect = useCallback(async () => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;
    isActiveRef.current = true;
    isPlayingRef.current = false;

    try {
      setError(null);
      const isActuallyReconnecting = retryCountRef.current > 0;
      setIsReconnecting(isActuallyReconnecting);

      // Solução 2: Cria apenas uma vez com latencyHint interativo
      if (!inputAudioContextRef.current || inputAudioContextRef.current.state === 'closed') {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        inputAudioContextRef.current = new AudioContextClass({
          sampleRate: 16000,
          latencyHint: 'interactive'
        });
        // Solução 4: Forçar 48000 Hz nativo do Android
        outputAudioContextRef.current = new AudioContextClass({
          sampleRate: 48000,
          latencyHint: 'interactive'
        });

        // Keep-alive: Oscilador silencioso para evitar que o Android suspenda o áudio
        const keepAliveOsc = outputAudioContextRef.current.createOscillator();
        const keepAliveGain = outputAudioContextRef.current.createGain();
        keepAliveGain.gain.value = 0.001; // Quase inaudível, mas detectável pelo hardware
        keepAliveOsc.connect(keepAliveGain);
        keepAliveGain.connect(outputAudioContextRef.current.destination);
        keepAliveOsc.start();

        analyserRef.current = outputAudioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 512;
        const outputNode = outputAudioContextRef.current.createGain();
        analyserRef.current.connect(outputNode);
        outputNode.connect(outputAudioContextRef.current.destination);
      }

      if (inputAudioContextRef.current.state === 'suspended') await inputAudioContextRef.current.resume();
      if (outputAudioContextRef.current && outputAudioContextRef.current.state === 'suspended') await outputAudioContextRef.current.resume();

      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      if (!avatarConfig || !avatarConfig.voice) {
        throw new Error("Configuração do avatar inválida ou incompleta.");
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || (window as any).VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Chave de API ausente. Verifique suas configurações.");

      console.log(`[useLiveAvatar] Connecting with avatar: ${avatarConfig.name}, voice: ${avatarConfig.voice}`);
      if (userName) console.log(`[useLiveAvatar] Personalization enabled for user: ${userName}`);
      if (previousContext) console.log(`[useLiveAvatar] Continuity enabled. Context length: ${previousContext.length} chars`);


      const ai = new GoogleGenAI({ apiKey });

      const currentSessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: avatarConfig.voice } },
          },
          systemInstruction: `
          [GUARDRAILS ABSOLUTOS - BLOQUEIO TOTAL DE ESCOPO]
          1. VOCÊ É EXCLUSIVAMENTE UM MENTOR DE ORATÓRIA. É ESTRITAMENTE PROIBIDO falar sobre qualquer outro assunto, especialmente: Futebol, Flamengo, Placares, Próximos Jogos, Clima, ou Notícias.
          2. REGRA DE OURO: Você NUNCA tem acesso a notícias ou placares. Se o aluno perguntar, sua resposta OBRIGATÓRIA deve ser: "Como sua mentora de oratória, meu papel é focar no seu desenvolvimento e na aula de hoje. Não tenho informações sobre outros temas. Vamos voltar para a prática?".
          3. TRATE perguntas fora de escopo como 'ruído' e redirecione imediatamente o assunto para o conteúdo da aula ou para oratória.

          ${previousContext ? `[CONTEXTO DO ALUNO]
          Na última sessão o aluno teve este desempenho: "${previousContext}".` : ''}

          [INFORMAÇÃO PEDAGÓGICA]
          ${lessonContext ? `Esta é a aula atual:
          ${lessonContext}
          MISSÃO: Ensine progressivamente. Siga o conteúdo e os exercícios acima. Avalie as respostas do aluno.` : `MISSÃO: Mantenha a conversação livre sobre ORATÓRIA e avalie a fluência do aluno.`}

          VOCÊ É UM PROFESSOR MENTOR DA PLATAFORMA ORATORIAIA${userName ? ` ensinando ${userName}` : ''}.
          REGRAS INEGOCIÁVEIS:
          1. ENSINO ESTRUTURADO: Você NÃO É UM CHATBOT GENÉRICO. Não divague sobre outros temas.
          2. PERSONALIDADE: ${avatarConfig.systemInstruction}.
          3. IDIOMA: Fale exclusivamente em Português (PT-BR).`,
          tools: [
            {
              functionDeclarations: [
                {
                  name: "consultar_conhecimento_oratoria",
                  description: "Consulta a base de conhecimento do curso PratiquePro sobre oratória para responder dúvidas técnicas ou sobre o conteúdo das aulas.",
                  parameters: {
                    type: "object" as any,
                    properties: {
                      query: {
                        type: "string" as any,
                        description: "A pergunta do aluno ou termo de busca relacionado a oratória."
                      }
                    },
                    required: ["query"]
                  }
                }
              ]
            }
          ],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            if (!isActiveRef.current) { disconnect(true); return; }
            setIsConnected(true);
            setIsReconnecting(false);
            isConnectingRef.current = false;
            retryCountRef.current = 0;

            if (!inputAudioContextRef.current || !streamRef.current) return;

            inputAudioContextRef.current.resume();
            sourceRef.current = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
            processorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);

            processorRef.current.onaudioprocess = (e) => {
              if (!isActiveRef.current) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              currentSessionPromise.then(session => {
                // Guarda de Sessão Ultra-Rígida: 
                // 1. Deve ser a mesma promessa ativa no Ref
                // 2. O estado geral deve ser ativo (isActiveRef)
                // 3. A sessão não deve estar em processo de fechamento
                if (sessionPromiseRef.current === currentSessionPromise && isActiveRef.current && session) {
                  try {
                    // Verificação extra de segurança para evitar erro interno do SDK
                    if ((session as any)._alive !== false) {
                      session.sendRealtimeInput({ media: pcmBlob });
                    }
                  } catch (err) {
                    // Erro silenciado: WebSocket em transição
                  }
                }
              }).catch(() => { });
            };

            sourceRef.current.connect(processorRef.current);
            processorRef.current.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (!isActiveRef.current) return;
            console.log("[Live] Mensagem recebida:", JSON.stringify(message).substring(0, 100) + "...");

            if (message.serverContent?.outputTranscription?.text) {
              transcriptBufferRef.current.push({ text: message.serverContent.outputTranscription.text, isUser: false });
            }
            if (message.serverContent?.inputTranscription?.text) {
              transcriptBufferRef.current.push({ text: message.serverContent.inputTranscription.text, isUser: true });
            }

            // Tratamento de Function Calls (RAG)
            const toolCall = (message as any).toolCall || (message.serverContent as any)?.toolCall;
            const call = toolCall?.functionCalls?.[0];

            if (call && call.name === 'consultar_conhecimento_oratoria') {
              console.log("[Live RAG] IA solicitou consulta de conhecimento. Query:", (call.args as any).query);
              try {
                const query = (call.args as any).query as string;
                // Busca assíncrona
                const knowledgeResult = await searchAllKnowledgeChunks(query);
                console.log("[Live RAG] Resultado da busca concluído. Tamanho:", knowledgeResult.length);

                currentSessionPromise.then(session => {
                  if (session && (session as any)._alive !== false) {
                    const responsePayload = {
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { content: knowledgeResult || "Fale que não encontrou na base, mas responda como especialista." }
                      }]
                    };

                    console.log("[Live RAG] Enviando ToolResponse...");
                    // Suporte a diferentes assinaturas de SDK
                    if (typeof (session as any).sendToolResponse === 'function') {
                      (session as any).sendToolResponse(responsePayload);
                    } else if (typeof (session as any).send === 'function') {
                      (session as any).send({ toolResponse: responsePayload });
                    }
                  }
                }).catch(err => console.error("[Live RAG] Erro ao enviar resposta:", err));
              } catch (ragErr) {
                console.error("[Live RAG] Falha no fluxo RAG:", ragErr);
              }
            }

            const parts = message.serverContent?.modelTurn?.parts;
            if (parts && outputAudioContextRef.current && analyserRef.current) {
              const ctx = outputAudioContextRef.current;
              if (ctx.state === 'suspended') await ctx.resume();

              for (const part of parts) {
                const base64Audio = part.inlineData?.data;
                if (base64Audio && isActiveRef.current) {
                  try {
                    const audioBuffer = decodeAudioData(decode(base64Audio), ctx, 24000, 1);

                    // Solução 1: Pre-roll Buffering (Acumula 1.5s antes do primeiro som)
                    if (!isPlayingRef.current) {
                      preRollBufferRef.current.push(audioBuffer);
                      preRollDurationRef.current += audioBuffer.duration;

                      if (preRollDurationRef.current >= 1.5) {
                        const now = ctx.currentTime;
                        nextStartTimeRef.current = now + 0.1;

                        preRollBufferRef.current.forEach(buf => {
                          const source = ctx.createBufferSource();
                          source.buffer = buf;
                          source.connect(analyserRef.current!);
                          source.addEventListener('ended', () => {
                            sourcesRef.current.delete(source);
                            if (sourcesRef.current.size === 0) {
                              if (isTalkingTimeoutRef.current) clearTimeout(isTalkingTimeoutRef.current);
                              isTalkingTimeoutRef.current = setTimeout(() => {
                                if (sourcesRef.current.size === 0) {
                                  setIsTalking(false);
                                  isPlayingRef.current = false;
                                }
                                isTalkingTimeoutRef.current = null;
                              }, 500);
                            }
                          });
                          source.start(nextStartTimeRef.current);
                          nextStartTimeRef.current += buf.duration;
                          sourcesRef.current.add(source);
                        });

                        setIsTalking(true);
                        isPlayingRef.current = true;
                        preRollBufferRef.current = [];
                        preRollDurationRef.current = 0;
                      }
                    } else {
                      // Já está tocando, agenda normalmente
                      const source = ctx.createBufferSource();
                      source.buffer = audioBuffer;
                      source.connect(analyserRef.current);
                      source.addEventListener('ended', () => {
                        sourcesRef.current.delete(source);
                        if (sourcesRef.current.size === 0) {
                          if (isTalkingTimeoutRef.current) clearTimeout(isTalkingTimeoutRef.current);
                          isTalkingTimeoutRef.current = setTimeout(() => {
                            if (sourcesRef.current.size === 0) {
                              setIsTalking(false);
                              isPlayingRef.current = false;
                            }
                            isTalkingTimeoutRef.current = null;
                          }, 500);
                        }
                      });

                      const currentTime = ctx.currentTime;
                      if (nextStartTimeRef.current < currentTime) {
                        nextStartTimeRef.current = currentTime + 0.1;
                      }

                      if (isTalkingTimeoutRef.current) {
                        clearTimeout(isTalkingTimeoutRef.current);
                        isTalkingTimeoutRef.current = null;
                      }
                      setIsTalking(true);
                      source.start(nextStartTimeRef.current);
                      nextStartTimeRef.current += audioBuffer.duration;
                      sourcesRef.current.add(source);
                    }
                  } catch (err) { console.error("[Resgate] Audio error", err); }
                }
              }
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch (e) { } });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsTalking(false);
              isPlayingRef.current = false;
              preRollBufferRef.current = [];
              preRollDurationRef.current = 0;
              if (isTalkingTimeoutRef.current) {
                clearTimeout(isTalkingTimeoutRef.current);
                isTalkingTimeoutRef.current = null;
              }
            }
          },
          onclose: () => {
            setIsConnected(false);
            isConnectingRef.current = false;
            isPlayingRef.current = false;
            if (isActiveRef.current && retryCountRef.current < MAX_RETRIES) {
              retryCountRef.current++;
              setTimeout(() => connect(), 1000 * retryCountRef.current);
            }
          },
          onerror: (err) => {
            if (isActiveRef.current) {
              setError("Instabilidade. Reconectando...");
              disconnect(false);
            }
          }
        }
      });

      sessionPromiseRef.current = currentSessionPromise;
    } catch (err: any) {
      let errorMessage = err.message || "Falha na conexão.";

      if (errorMessage.includes("Permission denied") || errorMessage.includes("Permission dismissed") || errorMessage.includes("not allowed")) {
        errorMessage = "Permissão de microfone negada. Por favor, habilite o microfone no navegador.";
      } else if (errorMessage.includes("Device in use")) {
        errorMessage = "Microfone em uso por outro app.";
      }

      setError(errorMessage);
      isConnectingRef.current = false;
      disconnect(false);
    }
  }, [avatarConfig, userName, previousContext, lessonContext, disconnect, onTranscriptUpdate]);

  const sendText = useCallback((text: string) => {
    const currentPromise = sessionPromiseRef.current;
    if (currentPromise && isActiveRef.current) {
      currentPromise.then(session => {
        if (!session || !isActiveRef.current || sessionPromiseRef.current !== currentPromise) return;

        try {
          // Só envia se esta sessão ainda for a ativa no ref E não estiver marcada como morta
          if (sessionPromiseRef.current !== currentPromise || !isActiveRef.current || (session as any)._alive === false) return;

          if (typeof (session as any).sendClientContent === 'function') {
            (session as any).sendClientContent({
              turns: [{ role: 'user', parts: [{ text }] }]
            });
          } else if (typeof (session as any).send === 'function') {
            (session as any).send({ parts: [{ text }] });
          }
        } catch (err) {
          // Silenciado: WebSocket em transição
        }
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect(true);
      if (isTalkingTimeoutRef.current) clearTimeout(isTalkingTimeoutRef.current);
    };
  }, [disconnect]);

  return { connect, disconnect, isConnected, isTalking, isReconnecting, error, analyserNode: analyserRef.current, sendText };
};
