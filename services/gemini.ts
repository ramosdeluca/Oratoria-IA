
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
      vocabularyScore: 10,
      grammarScore: 10,
      pronunciationScore: 10,
      coherenceScore: 10,
      confidenceScore: 10,
      feedback: "Diálogo muito curto para uma avaliação precisa. Tente conversar mais tópicos na próxima vez!",
      fluencyRating: 'Beginner',
      transcript
    };
  }

  const apiKey = getApiKey();
  if (!apiKey) return { overallScore: 50, vocabularyScore: 50, grammarScore: 50, pronunciationScore: 50, coherenceScore: 50, confidenceScore: 50, fluencyRating: 'Beginner', feedback: "Erro: Chave de API ausente.", transcript };

  const genAI = new GoogleGenAI({ apiKey });
  const prunedTranscript = transcript.split('\n').filter(l => l.trim()).slice(-10).join('\n');

  for (const modelName of MODELS.EVAL) {
    try {
      const response = await (genAI as any).models.generateContent({
        model: modelName,
        contents: [{
          role: 'user', parts: [{
            text: `Aja como Native English Teacher. Analise o transcript e forneça o feedback no formato JSON.
                        REGRAS DE FEEDBACK:
                        1. LINGUAGEM OBRIGATÓRIA: Português (pt-BR).
                        2. ESCALA DE NOTAS: Use 0 a 100.
                        3. SEJA ULTRACONCISO. Use no MÁXIMO 40 palavras no feedback.
                        4. Use tópicos curtos.
                        5. Cite 1 acerto e 1 correção rápidos.
                        6. Dê 1 dica prática curta.
                        7. IMPORTANTE: Se o diálogo for curto, dê notas BAIXAS e mencione a falta de profundidade. Avalie a CAPACIDADE.
                        
                        Transcript: ${prunedTranscript}
                        
                        JSON schema:
                        {
                          "overallScore": number,
                          "vocabularyScore": number,
                          "grammarScore": number,
                          "pronunciationScore": number,
                          "coherenceScore": number,
                          "confidenceScore": number,
                          "fluencyRating": "Beginner"|"Intermediate"|"Advanced"|"Native",
                          "feedback": "string"
                        }`
          }]
        }],
        generationConfig: {
          maxOutputTokens: 200, // Reduzido para economia extrema
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
          vocabularyScore: normalize(r.vocabularyScore),
          grammarScore: normalize(r.grammarScore),
          pronunciationScore: normalize(r.pronunciationScore),
          coherenceScore: normalize(r.coherenceScore),
          confidenceScore: normalize(r.confidenceScore),
          fluencyRating: r.fluencyRating || 'Beginner',
          feedback: r.feedback || "Excelente prática! Continue assim.",
          transcript
        };
      }
    } catch (error: any) {
      if (!error.message.includes('404')) console.error(`[Gemini Eval] Erro em ${modelName}:`, error.message);
    }
  }

  return { overallScore: 50, vocabularyScore: 50, grammarScore: 50, pronunciationScore: 50, coherenceScore: 50, confidenceScore: 50, fluencyRating: 'Beginner', feedback: "Sua prática foi concluída! Continue conversando para expandir seu inglês.", transcript };
};

export const generateDetailedFeedback = async (currentTranscript: string, history: SessionResult[]): Promise<DetailedFeedback | null> => {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const genAI = new GoogleGenAI({ apiKey });
  const trans = currentTranscript.split('\n').filter(l => l.trim()).slice(-10).join('\n');
  const hist = history.slice(0, 5).map(s => ({
    d: s.date.split('T')[0],
    s: {
      fluencia: s.overallScore,
      vocabulario: s.vocabularyScore,
      precisao_gramatical: s.grammarScore,
      clareza_pronuncia: s.pronunciationScore,
      coerencia: s.coherenceScore || s.overallScore, // Fallback para registros antigos
      confianca: s.confidenceScore || s.overallScore
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
                    2. Notas técnicas reais.
                    3. Feedbacks e resumo DEVEM ser EXTREMAMENTE curtos, diretos e em pt-BR.
                    4. Economize tokens ao máximo (máx 15 palavras por métrica).
                    
                    JSON: {
                      "metricas_atuais": { "[fluencia, vocabulario, precisao_gramatical, clareza_pronuncia, coerencia, confianca]": {"score":0, "tendencia":"evoluindo"|"estavel"|"regredindo"} },
                      "feedbacks": { "[fluencia, vocabulario, precisao_gramatical, clareza_pronuncia, coerencia, confianca]": "texto curto e direto" },
                      "resumo_geral": "resumo de 1 frase",
                      "dados_grafico_historico": { "[fluencia, vocabulario, precisao_gramatical, clareza_pronuncia, coerencia, confianca]": [{"data":"...", "score":0}] }
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
