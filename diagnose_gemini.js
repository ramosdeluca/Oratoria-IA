
import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';

async function diagnose() {
    const envPath = 'c:/Oratoria-IA/.env';
    if (!fs.existsSync(envPath)) {
        console.error(".env não encontrado");
        return;
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
    const apiKey = match ? match[1].trim() : null;

    if (!apiKey) {
        console.error("API Key não encontrada no .env");
        return;
    }

    console.log("Iniciando diagnóstico com a chave:", apiKey.substring(0, 5) + "...");

    try {
        const genAI = new GoogleGenAI({ apiKey });

        // Testando modelos comuns via generateContent direto
        const testModels = [
            "gemini-2.0-flash",
            "gemini-2.0-flash-exp",
            "gemini-1.5-flash",
            "gemini-1.5-flash-latest",
            "gemini-1.5-pro",
            "gemini-1.5-pro-latest",
            "gemini-pro"
        ];

        console.log("\n--- Testando Modelos via generateContent ---");
        for (const m of testModels) {
            try {
                const response = await (genAI as any).models.generateContent({
                    model: m,
                    contents: [{ role: 'user', parts: [{ text: 'Respond with OK' }] }]
                });
                console.log(`[PASS] ${m}`);
            } catch (e) {
                console.log(`[FAIL] ${m}: ${e.message.substring(0, 100)}`);
            }
        }

    } catch (err) {
        console.error("Erro fatal no diagnóstico:", err);
    }
}

diagnose();
