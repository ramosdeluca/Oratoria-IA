import { GoogleGenAI } from '@google/genai';
import { supabase } from './supabase';

const getApiKey = () => {
    return (process as any).env?.GEMINI_API_KEY ||
        (process as any).env?.API_KEY ||
        (process as any).env?.VITE_GEMINI_API_KEY ||
        (import.meta as any).env?.VITE_GEMINI_API_KEY ||
        (typeof window !== 'undefined' && (window as any).VITE_GEMINI_API_KEY) ||
        "";
};

export const generateEmbedding = async (text: string): Promise<number[] | null> => {
    const apiKey = getApiKey();
    if (!apiKey) return null;

    try {
        const ai = new GoogleGenAI({ apiKey });
        // Usando gemini-text-embedding para pt-BR
        const model = 'text-embedding-004';
        const response = await ai.models.embedContent({
            model: model,
            contents: text,
        });

        // As in latest genai sdk
        const embedding = response?.embeddings?.[0]?.values;
        return embedding ? Array.from(embedding) : null;
    } catch (error) {
        console.error('Error generating embedding:', error);
        return null;
    }
};

export const searchLessonChunks = async (query: string, lessonId: string, limit = 3): Promise<string> => {
    const embedding = await generateEmbedding(query);
    if (!embedding) return "";

    try {
        const { data, error } = await supabase.rpc('match_lesson_chunks', {
            query_embedding: embedding,
            match_threshold: 0.6,
            match_count: limit,
            filter_lesson_id: lessonId
        });

        if (error) {
            console.error('Error calling match_lesson_chunks:', error);
            return "";
        }

        if (!data || data.length === 0) return "";

        const chunks = data.map((d: any) => d.content as string);
        return chunks.join('\n\n---\n\n');
    } catch (e) {
        console.warn("RPC match_lesson_chunks not available or configured. Trying to fallback to raw lesson fetch...", e);
        // If the rpc fails, we can just return the lesson content itself as fallback if it fits in context
        const { data } = await supabase.from('lessons').select('content').eq('id', lessonId).single();
        if (data) return data.content;
        return "";
    }
};
export const searchAllKnowledgeChunks = async (query: string, limit = 5): Promise<string> => {
    console.log("[RAG Service] Iniciando busca global por:", query);
    const embedding = await generateEmbedding(query);
    if (!embedding) {
        console.warn("[RAG Service] Falha ao gerar embedding para busca global.");
        return "";
    }

    try {
        const { data, error } = await supabase.rpc('match_lesson_chunks', {
            query_embedding: embedding,
            match_threshold: 0.5,
            match_count: limit
        });

        if (error) {
            console.error('[RAG Service] Erro RPC match_lesson_chunks (global):', error);
            return "";
        }

        if (!data || data.length === 0) {
            console.log("[RAG Service] Nenhum chunk encontrado para:", query);
            return "";
        }

        console.log(`[RAG Service] ${data.length} chunks encontrados.`);
        return data.map((d: any) => d.content as string).join('\n\n---\n\n');
    } catch (e) {
        console.error("[RAG Service] Exceção na busca global RAG:", e);
        return "";
    }
};
