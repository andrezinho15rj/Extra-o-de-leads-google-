
import { GoogleGenAI, Tool, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { SearchResponse } from "../types";

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
  // Usando gemini-3-flash-preview que é o mais rápido para ferramentas
  const modelId = "gemini-3-flash-preview"; 

  const tools: Tool[] = [
    { googleSearch: {} },
    { googleMaps: {} }
  ];

  const toolConfig = (userLat && userLng) ? {
    retrievalConfig: {
      latLng: {
        latitude: userLat,
        longitude: userLng
      }
    }
  } : undefined;

  // Instrução extremamente curta para não confundir o modelo
  const systemInstruction = `Você é um extrator de leads ultra-rápido. 
Localize empresas de "${niche}" em "${location}". 
Retorne imediatamente os 8 primeiros resultados encontrados com Telefone e CNPJ. 
Use o formato:
---
Nome: [Nome]
CNPJ: [CNPJ]
Telefone: [DDD + Número]
Endereço: [Endereço]
---`;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Extraia 8 leads de ${niche} em ${location} agora.`,
      config: {
        systemInstruction: systemInstruction,
        tools: tools,
        toolConfig: toolConfig,
        temperature: 0.1,
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
      }
    });

    return {
      rawText: response.text || "",
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };

  } catch (error: any) {
    console.error("Erro na API Gemini:", error);
    throw new Error(error.message || "Erro desconhecido na extração.");
  }
};
