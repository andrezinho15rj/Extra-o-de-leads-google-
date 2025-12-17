
import { GoogleGenAI, Tool, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { SearchResponse } from "../types";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const searchLeads = async (
  _ignoredApiKey: string, 
  niche: string, 
  location: string,
  userLat?: number,
  userLng?: number
): Promise<SearchResponse> => {
  
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("Chave API não configurada.");

  const ai = new GoogleGenAI({ apiKey });
  const modelId = "gemini-3-flash-preview"; 

  // Simplificamos para usar apenas busca para ser mais leve na cota
  const tools: Tool[] = [{ googleSearch: {} }];

  const systemInstruction = `Você é um extrator de leads. Localize empresas de "${niche}" em "${location}". 
Retorne 8 resultados. Use o formato:
---
Nome: [Nome]
CNPJ: [CNPJ ou N/A]
Telefone: [DDD + Número]
Endereço: [Endereço]
---`;

  let lastError = "";
  // Tenta até 3 vezes com esperas crescentes se bater no limite
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: `Lista de empresas: ${niche} em ${location}`,
        config: {
          systemInstruction: systemInstruction,
          tools: tools,
          temperature: 0.1,
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          ]
        }
      });

      return {
        rawText: response.text || "",
        groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
      };

    } catch (error: any) {
      lastError = error.message || "Erro desconhecido";
      
      // Se for erro de cota (429), esperamos e tentamos de novo
      if (lastError.includes("429") || lastError.includes("quota")) {
        console.log(`Cota atingida. Tentativa ${attempt} de 3. Aguardando...`);
        await delay(attempt * 5000); // Espera 5s, depois 10s...
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Limite de uso da API atingido. Aguarde 1 minuto e tente novamente. Detalhes: ${lastError}`);
};
