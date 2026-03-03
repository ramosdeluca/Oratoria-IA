
import { GoogleGenAI } from "@google/genai";
import { SessionResult, DetailedFeedback } from "../types";

/**
 * Detecção dinâmica de chave de API - Alinhada com useLiveAvatar.ts
 */
const getApiKey = () => {
  const key = (process as any).env?.GEMINI_API_KEY ||
    (process as any).env?.API_KEY ||
    (process as any).env?.VITE_GEMINI_API_KEY ||
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    (typeof window !== 'undefined' && (window as any).VITE_GEMINI_API_KEY) ||
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
  // Apenas modelos Flash para custo mínimo absoluto
  EVAL: ["gemini-2.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-flash"],
  DETAILED: ["gemini-2.5-flash", "gemini-1.5-flash-latest"]
};

export const evaluateSession = async (transcript: string): Promise<Omit<SessionResult, 'durationSeconds' | 'date' | 'avatarName'>> => {
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
        contents: [{
          role: 'user', parts: [{
            text: `Aja como Consultor Especialista de Oratória e Comunicação. Analise o transcript e forneça o feedback no formato JSON.
                        REGRAS DE FEEDBACK:
                        1. LINGUAGEM OBRIGATÓRIA: Português (pt-BR).
                        2. ESCALA DE NOTAS: Use 0 a 100 para todas as métricas.
                        3. SEJA ULTRACONCISO. Use no MÁXIMO 40 palavras no feedback.
                        4. Use tópicos curtos.
                        5. Avalie a ORATÓRIA (confiança, clareza, persuasão, e indicativos textuais de postura percebida pela firmeza dita).
                        6. Dê 1 dica prática curta.
                        7. IMPORTANTE: Se o diálogo for curto, dê notas BAIXAS e mencione a falta de aprofundamento.
                        8. CONCLUSÃO: Avalie se o aluno cumpriu o exercício proposto até o final e se você o instruiu a clicar no botão para encerrar. Se ele saiu no meio, retorne false em isCompleted.
                        
                        Transcript: ${prunedTranscript}
                        
                        JSON schema:
                        {
                          "overallScore": number,
                          "confidenceScore": number,
                          "clarityScore": number,
                          "persuasionScore": number,
                          "postureScore": number,
                          "feedback": "string",
                          "isCompleted": boolean
                        }`
          }]
        }],
        generationConfig: {
          maxOutputTokens: 250, // Reduzido para economia extrema
          temperature: 0.7,
          responseMimeType: "application/json"
        },
        systemInstruction: {
          parts: [{ text: "Mentor rigoroso. Seja direto e ultraconciso. Nunca seja prolixo. Use escala 0-100." }]
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
          feedback: r.feedback || "Excelente apresentação! Continue assim.",
          isCompleted: r.isCompleted ?? true,
          transcript
        };
      }
    } catch (error: any) {
      if (!error.message.includes('404')) console.error(`[Gemini Eval] Erro em ${modelName}:`, error.message);
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
        contents: [{
          role: 'user',
          parts: [{
            text: `Gere um relatório JSON de evolução baseado no histórico e transcript.
                    Transcript: ${trans}
                    Histórico: ${JSON.stringify(hist)}
                    
                    REGRAS:
                    1. Preencha TODAS as métricas.
                    2. Notas técnicas reais de ORATÓRIA.
                    3. Feedbacks e resumo DEVEM ser EXTREMAMENTE curtos, diretos e em pt-BR.
                    4. Economize tokens ao máximo (máx 15 palavras por métrica).
                    
                    JSON: {
                      "metricas_atuais": { "[fluencia, confianca, clareza, persuasao, postura, coerencia]": {"score":0, "tendencia":"evoluindo"|"estavel"|"regredindo"} },
                      "feedbacks": { "[fluencia, confianca, clareza, persuasao, postura, coerencia]": "texto curto e direto" },
                      "resumo_geral": "resumo de 1 frase",
                      "dados_grafico_historico": { "[fluencia, confianca, clareza, persuasao, postura, coerencia]": [{"data":"...", "score":0}] }
                    }` }]
        }],
        generationConfig: {
          maxOutputTokens: 500, // Otimizado para economia extrema
          temperature: 0.1,
          responseMimeType: "application/json"
        },
        systemInstruction: {
          parts: [{ text: "Consultor Pedagógico. Gere relatórios ultraconcisos. Nunca seja prolixo. Garanta integridade total do JSON." }]
        }
      });

      const text = response.text || (response.response && response.response.text && (typeof response.response.text === 'function' ? response.response.text() : response.response.text));
      const parsed = safeJsonParse(text);
      if (parsed && parsed.metricas_atuais) {
        console.log(`[Gemini Feedback] Sucesso com ${modelName}`);
        return parsed;
      }
    } catch (e: any) {
      if (!e.message.includes('404')) console.error(`[Gemini Feedback] Erro em ${modelName}:`, e.message);
    }
  }
  return null;
};
