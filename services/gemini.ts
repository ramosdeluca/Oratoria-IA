
import { GoogleGenAI } from "@google/genai";
import { SessionResult, DetailedFeedback } from "../types";

/**
 * Detecção dinâmica de chave de API - Alinhada com useLiveAvatar.ts
 */
const getApiKey = () => {
  // Em projetos Vite, o acesso deve ser via import.meta.env
  const key = (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    (typeof window !== 'undefined' && (window as any).VITE_GEMINI_API_KEY) ||
    (process as any).env?.VITE_GEMINI_API_KEY ||
    (process as any).env?.GEMINI_API_KEY ||
    "";
  return key;
};

/**
 * Utilitário avançado para reparo de JSON truncado.
 */
const safeJsonParse = (text: string): any => {
  if (!text) return null;
  let cleaned = text.trim();
  if (cleaned.includes("```json")) {
    cleaned = cleaned.split("```json")[1].split("```")[0];
  } else if (cleaned.includes("```")) {
    cleaned = cleaned.split("```")[1].split("```")[0];
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.log("[Gemini Service] Iniciando reparo estrutural do JSON...");
    let repaired = cleaned;
    let inString = false;
    for (let i = 0; i < repaired.length; i++) {
      if (repaired[i] === '"' && (i === 0 || repaired[i - 1] !== '\\')) inString = !inString;
    }
    if (inString) repaired += '"';

    const stack: string[] = [];
    let inStrRep = false;
    for (let i = 0; i < repaired.length; i++) {
      const char = repaired[i];
      if (inStrRep) {
        if (char === '"' && (i === 0 || repaired[i - 1] !== '\\')) inStrRep = false;
        continue;
      }
      if (char === '"' && (i === 0 || repaired[i - 1] !== '\\')) inStrRep = true;
      else if (char === '{') stack.push('}');
      else if (char === '[') stack.push(']');
      else if (char === '}') { if (stack[stack.length - 1] === '}') stack.pop(); }
      else if (char === ']') { if (stack[stack.length - 1] === ']') stack.pop(); }
    }
    repaired = repaired.replace(/,\s*$/, "");
    while (stack.length > 0) repaired += stack.pop();

    try {
      return JSON.parse(repaired);
    } catch (e2) {
      console.error("[Gemini Service] Falha crítica de reparo.");
      return null;
    }
  }
};

// Modelos priorizando o menor custo (Flash é mais barato que Pro)
const MODELS = {
  // Modelos disponíveis confirmados via inventário da API (Junho 2025+)
  EVAL: ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"],
  DETAILED: ["gemini-flash-latest", "gemini-2.5-flash"]
};

export const evaluateSession = async (transcript: string, userName: string): Promise<Omit<SessionResult, 'durationSeconds' | 'date' | 'avatarName'>> => {
  // Validação mais rigorosa para conversas muito curtas
  const textLength = transcript ? transcript.trim().length : 0;
  const wordCount = transcript ? transcript.trim().split(/\s+/).length : 0;

  if (textLength < 50 || wordCount < 10) {
    return {
      overallScore: 10,
      confidenceScore: 10,
      clarityScore: 10,
      persuasionScore: 10,
      postureScore: 10,
      feedback: "Diálogo muito curto para uma avaliação precisa. Tente se expressar mais na próxima vez!",
      transcript
    };
  }

  const apiKey = getApiKey();
  if (!apiKey) return { overallScore: 50, confidenceScore: 50, clarityScore: 50, persuasionScore: 50, postureScore: 50, feedback: "Erro: Chave de API ausente.", transcript };

  const genAI = new GoogleGenAI({ apiKey });
  const prunedTranscript = transcript.split('\n').filter(l => l.trim()).slice(-10).join('\n');

  for (const modelName of MODELS.EVAL) {
    try {
      const response = await (genAI as any).models.generateContent({
        model: modelName,
        systemInstruction: "Mentor rigoroso. Seja direto e ultraconciso. Nunca seja prolixo. Use escala 0-100.",
        contents: [{
          role: 'user', parts: [{
            text: `Aja como Avaliador de Oratória extremamente rigoroso. \n\nO nome do aluno é: "${userName}". Trate o aluno pelo nome no início do feedback.\n\nAvalie a seguinte transcrição da fala do aluno.\nTranscript:\n"${prunedTranscript}"\n\nRETORNE EM JSON:\n{ "overallScore":number, "confidenceScore":number, "clarityScore":number, "persuasionScore":number, "postureScore":number, "feedback":"string", "isCompleted":boolean }\nMáx 25 palavras no feedback.`
          }]
        }],
        generationConfig: {
          maxOutputTokens: 250,
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      });

      const text = response.text || (response.response && response.response.text && (typeof response.response.text === 'function' ? response.response.text() : response.response.text));
      const r = safeJsonParse(text);

      if (r) {
        // Normalização defensiva: Se a IA retornar na escala 0-10, converte para 0-100
        const normalize = (val: any) => {
          let n = Number(val);
          if (isNaN(n)) return 50;
          return (n > 0 && n <= 10) ? n * 10 : n;
        };

        console.log(`[Gemini Eval] Sucesso com ${modelName}`);
        return {
          overallScore: normalize(r.overallScore),
          confidenceScore: normalize(r.confidenceScore),
          clarityScore: normalize(r.clarityScore),
          persuasionScore: normalize(r.persuasionScore),
          postureScore: normalize(r.postureScore),
          feedback: r.feedback ? r.feedback.replace(/\*/g, '') : "Excelente apresentação! Continue assim.",
          isCompleted: r.isCompleted ?? true,
          transcript
        };
      }
    } catch (error: any) {
      if (!error.message.includes('404')) console.error(`[Gemini Eval] Erro em ${modelName}: `, error.message);
    }
  }

  return { overallScore: 50, confidenceScore: 50, clarityScore: 50, persuasionScore: 50, postureScore: 50, feedback: "Sua prática foi interrompida.", isCompleted: false, transcript };
};

export const generateDetailedFeedback = async (currentTranscript: string, history: SessionResult[]): Promise<DetailedFeedback | null> => {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const genAI = new GoogleGenAI({ apiKey });
  const trans = currentTranscript.split('\n').filter(l => l.trim()).slice(-10).join('\n');
  const hist = history.slice(0, 5).map(s => ({
    d: s.date.split('T')[0],
    s: {
      fluencia: s.overallScore, // Usando overallScore como base de fluência
      confianca: s.confidenceScore,
      clareza: s.clarityScore,
      persuasao: s.persuasionScore,
      postura: s.postureScore,
      coerencia: s.overallScore // Fallback
    }
  }));

  for (const modelName of MODELS.DETAILED) {
    try {
      const response = await (genAI as any).models.generateContent({
        model: modelName,
        systemInstruction: "Consultor Pedagógico. Gere relatórios ultraconcisos. Nunca seja prolixo. Garanta integridade total do JSON.",
        contents: [{
          role: 'user',
          parts: [{
            text: `Gere um relatório JSON de evolução baseado no histórico e transcript.
        Transcript: ${trans}
                    Histórico: ${JSON.stringify(hist)}
                    
                    REGRAS:
        1. Preencha TODAS as métricas.
                    2. Notas técnicas reais de ORATÓRIA.
                    3. Feedbacks e resumo DEVEM ser EXTREMAMENTE curtos, diretos e em pt - BR.
                    4. Economize tokens ao máximo(máx 15 palavras por métrica).

        JSON: {
          "metricas_atuais": { "[fluencia, confianca, clareza, persuasao, postura, coerencia]": { "score": 0, "tendencia": "evoluindo" | "estavel" | "regredindo" } },
          "feedbacks": { "[fluencia, confianca, clareza, persuasao, postura, coerencia]": "texto curto e direto" },
          "resumo_geral": "resumo de 1 frase",
          "dados_grafico_historico": { "[fluencia, confianca, clareza, persuasao, postura, coerencia]": [{ "data": "...", "score": 0 }] }
        }` }]
        }],
        generationConfig: {
          maxOutputTokens: 500, // Otimizado para economia extrema
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      });

      const text = response.text || (response.response && response.response.text && (typeof response.response.text === 'function' ? response.response.text() : response.response.text));
      const parsed = safeJsonParse(text);
      if (parsed && parsed.metricas_atuais) {
        console.log(`[Gemini Feedback]Sucesso com ${modelName}`);
        return parsed;
      }
    } catch (e: any) {
      if (!e.message.includes('404')) console.error(`[Gemini Feedback]Erro em ${modelName}: `, e.message);
    }
  }
  return null;
};

/**
 * MODO 2: Dúvida Rápida (Custo Otimizado)
 * Responde dúvidas baseadas apenas no contexto da lição atual, sem histórico.
 */
export const askQuickQuestion = async (studentQuestion: string, lessonContext: string, avatarSystemInstruction: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) return "Não consegui me conectar para tirar sua dúvida agora.";

  const genAI = new GoogleGenAI({ apiKey });

  for (const modelName of MODELS.EVAL) {
    try {
      const response = await (genAI as any).models.generateContent({
        model: modelName,
        systemInstruction: `### REGRA ABSOLUTA: BLOQUEIO TOTAL DE ESCOPO ###
        1. VOCÊ É EXCLUSIVAMENTE UM MENTOR DE ORATÓRIA. É ESTRITAMENTE PROIBIDO falar sobre: Esportes, Flamengo, Placares, Notícias ou qualquer assunto aleatório.
        2. Se o aluno perguntar algo fora de oratória, sua resposta DEVE ser: "Como sua mentora de oratória, meu papel é focar no seu desenvolvimento. Não tenho informações sobre outros temas. Vamos voltar para a aula?".
        3. Nunca mencione resultados de jogos ou nomes de times.
        
        BIO DO AVATAR: ${avatarSystemInstruction}`,
        contents: [{
          role: 'user', parts: [{ text: `AULA ATUAL: \n"${lessonContext}"\n\nDÚVIDA DO ALUNO: "${studentQuestion}"\n\nResponda APENAS à dúvida de forma direta.Não re - explique a aula.` }]
        }],
        generationConfig: {
          maxOutputTokens: 60,  // Reduzido para forçar respostas muito curtas
          temperature: 0.1,     // Quase nenhuma variatividade
        }
      });
      let text = response.text || (response.response && response.response.text && (typeof response.response.text === 'function' ? response.response.text() : response.response.text));
      if (text) {
        text = text.replace(/\*/g, ''); // Remove asteriscos para o TTS não ler
        return text;
      }
    } catch (e) {
      console.error(`[Quick Question] Erro em ${modelName} `, e);
    }
  }
  return "Desculpe, tive um problema de comunicação. Tente perguntar de novo!";
};

/**
 * MODO 3: Avaliar Exercício Estruturado (Custo Otimizado)
 * Avalia de forma única a transcrição de um exercício de gravação curta.
 */
export const evaluateStructuredExercise = async (transcript: string, exerciseInstruction: string, userName: string): Promise<Omit<SessionResult, 'durationSeconds' | 'date' | 'avatarName' | 'isCompleted'>> => {
  const apiKey = getApiKey();
  if (!apiKey) return { overallScore: 50, confidenceScore: 50, clarityScore: 50, persuasionScore: 50, postureScore: 50, feedback: "Erro: API Key.", transcript };

  const genAI = new GoogleGenAI({ apiKey });

  for (const modelName of MODELS.EVAL) {
    try {
      const response = await (genAI as any).models.generateContent({
        model: modelName,
        contents: [{
          role: 'user', parts: [{
            text: `Aja como um Professor de Oratória encorajador. Avalie o desempenho do aluno no exercício a seguir.

EXERCÍCIO: "${exerciseInstruction}"
NOME DO ALUNO: "${userName}"
TRANSCRIÇÃO DO ÁUDIO: "${transcript}"

DIRETRIZES:
1. Se o exercício for uma atividade prática de "sala de aula" (ex: gravar vídeo, fazer um discurso agora), peça explicitamente no feedback para o aluno detalhar como foi a experiência, o que sentiu e como avalia sua postura.
2. Use o nome do aluno no feedback.
3. Seja motivador e construtivo.

RETORNE APENAS JSON:
{ 
  "overallScore": number, 
  "confidenceScore": number, 
  "clarityScore": number, 
  "persuasionScore": number, 
  "postureScore": number, 
  "feedback": "string (máximo 60 palavras)" 
}`
          }]
        }],
        generationConfig: {
          maxOutputTokens: 200,
          temperature: 0.3,
          responseMimeType: "application/json"
        }
      });
      const text = response.text || (response.response && response.response.text && (typeof response.response.text === 'function' ? response.response.text() : response.response.text));
      const r = safeJsonParse(text);
      if (r) {
        const normalize = (val: any) => { let n = Number(val); if (isNaN(n)) return 50; return (n > 0 && n <= 10) ? n * 10 : n; };
        return {
          overallScore: normalize(r.overallScore),
          confidenceScore: normalize(r.confidenceScore),
          clarityScore: normalize(r.clarityScore),
          persuasionScore: normalize(r.persuasionScore),
          postureScore: normalize(r.postureScore),
          feedback: r.feedback ? r.feedback.replace(/\*/g, '') : "Avaliação concluída.",
          transcript
        };
      }
    } catch (e) {
      console.error(`[Evaluate Exercise] Erro em ${modelName} `, e);
    }
  }
  return { overallScore: 50, confidenceScore: 50, clarityScore: 50, persuasionScore: 50, postureScore: 50, feedback: "Falha na avaliação do seu áudio.", transcript };
};

/**
 * MODO 1: Enriquecimento Dinâmico de Aula
 * Recebe o texto original da aula e gera um script que inclui a leitura e uma breve explicação contextual.
 */
export const generateEnhancedLessonScript = async (lessonContent: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) return lessonContent;

  const genAI = new GoogleGenAI({ apiKey });

  for (const modelName of MODELS.EVAL) {
    try {
      const response = await (genAI as any).models.generateContent({
        model: modelName,
        systemInstruction: "Você é um Instrutor de Oratória Prestativo. Sua função é receber o texto de uma aula e transformá-lo em um script envolvente. O script DEVE conter o texto original seguido OBRIGATORIAMENTE de uma breve explicação prática com suas próprias palavras para facilitar o aprendizado. Não use markdown ou asteriscos.",
        contents: [{
          role: 'user',
          parts: [{
            text: `Roteiro para transformar:
"${lessonContent}"

INSTRUÇÕES:
1. Comece lendo exatamente o texto acima.
2. Adicione uma transição como "Na prática, isso quer dizer que..." ou "Em resumo...".
3. Finalize com 2 frases explicando o conceito com suas próprias palavras de forma dinâmica.
4. Retorne apenas o texto final contínuo para leitura de voz.

SCRIPT PARA O AVATAR:`
          }]
        }],
        generationConfig: {
          maxOutputTokens: 1200,
          temperature: 0.75,
        }
      });
      const text = response.text || (response.response && response.response.text && (typeof response.response.text === 'function' ? response.response.text() : response.response.text));
      if (text) {
        const finalScript = text.trim()
          .replace(/[*#]/g, '')
          .replace(/\[.*?\]/g, '')
          .replace(/PASSO \d:?/gi, '')
          .replace(/Script para o avatar:?/gi, '');
        console.log(`[Enhanced Script][DEBUG] Texto Gerado:\n"${finalScript}"`);
        return finalScript;
      }
    } catch (e) {
      console.error(`[Enhanced Script] Erro em ${modelName} `, e);
    }
  }
  return lessonContent;
};

/**
 * MODO 1 e 3: Geração de Áudio Dinâmica (TTS)
 */
export const generateTTS = async (text: string, voiceName: string): Promise<Blob | null> => {
  const apiKey = getApiKey();
  console.log(`[Cloud TTS] Iniciando síntese para: ${voiceName}. Chave presente: ${!!apiKey}`);

  if (!apiKey) {
    console.error("[Cloud TTS] API Key ausente para TTS.");
    return null;
  }

  try {
    const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

    let googleVoiceName = 'pt-BR-Neural2-B';
    let ssmlGender = 'MALE';

    const normalizedVoice = voiceName.toLowerCase();

    // Mapeamento Robusto: Sarah/Sophia/Maya/Kore -> Feminino (Neural2-C)
    // Leo/Charon/Puck -> Masculino (Neural2-B)
    const isFemale = normalizedVoice.includes('kore') ||
      normalizedVoice.includes('sarah') ||
      normalizedVoice.includes('sophia') ||
      normalizedVoice.includes('maya');

    if (isFemale) {
      googleVoiceName = 'pt-BR-Neural2-C';
      ssmlGender = 'FEMALE';
    } else {
      googleVoiceName = 'pt-BR-Neural2-B';
      ssmlGender = 'MALE';
    }

    const payload = {
      input: { text },
      voice: { languageCode: 'pt-BR', name: googleVoiceName, ssmlGender },
      audioConfig: { audioEncoding: 'MP3', pitch: 0, speakingRate: 1.05 } // Levemente mais rápido para naturalidade
    };

    const response = await fetch(ttsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log(`[Cloud TTS API] Status da Resposta: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Cloud TTS API] Erro na requisição:", errorText);
      return null;
    }

    const json = await response.json();
    if (json.audioContent) {
      console.log(`[Cloud TTS API] Áudio recebido (Base64). Tamanho: ${json.audioContent.length} chars. Primeiros 20: ${json.audioContent.substring(0, 20)}`);
      // Decode base64 to Blob
      const byteCharacters = atob(json.audioContent);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mpeg' });
      console.log(`[Cloud TTS API] Blob gerado com sucesso: ${blob.size} bytes`);
      return blob;
    }

    console.warn("[Cloud TTS API] Nenhum audioContent retornado no JSON.");
    return null;
  } catch (e) {
    console.error(`[TTS Service] Erro disparado ao gerar áudio:`, e);
    return null;
  }
};

/**
 * Utilitário: Transcrever Áudio local via Gemini Flash
 * Recebe o Blob do gravador e converte em String usando o Gemini Flash (multimodal)
 */
export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key ausente");

  const genAI = new GoogleGenAI({ apiKey });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
      try {
        const base64Audio = (reader.result as string).split(',')[1];
        for (const modelName of MODELS.EVAL) {
          try {
            const response = await (genAI as any).models.generateContent({
              model: modelName,
              contents: [{
                role: 'user',
                parts: [
                  { text: 'Por favor, transcreva o áudio a seguir exatamente como foi falado. Retorne APENAS a transcrição em texto contínuo, sem adicionar comentários ou marcações extras.' },
                  { inlineData: { data: base64Audio, mimeType: audioBlob.type } }
                ]
              }],
              generationConfig: {
                maxOutputTokens: 300,
                temperature: 0.1,
              }
            });
            const text = response.text || (response.response && response.response.text && (typeof response.response.text === 'function' ? response.response.text() : response.response.text));
            if (text) {
              resolve(text.trim());
              return;
            }
          } catch (modelErr) {
            console.warn(`[STT] Falha com modelo ${modelName}`, modelErr);
          }
        }
        resolve(""); // Se todos falharem
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
  });
};
