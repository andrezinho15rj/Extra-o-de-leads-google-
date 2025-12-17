
import { GoogleGenAI, Tool, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { SearchResponse } from "../types";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const searchLeads = async (
  _ignoredApiKey: string, 
  niche: string, 
  location: string,
  userLat?: number,
  userLng?: number,
  searchFocus: string = "Geral"
): Promise<SearchResponse> => {
  
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("Chave API não configurada.");

  const ai = new GoogleGenAI({ apiKey });
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

  const systemInstruction = `Você é o "Winner Extractor Gold". Extraia empresas ATIVAS no Brasil. 
Seja direto. Retorne até 10 leads de alta qualidade com CNPJ. Use "---" como separador.`;

  const prompt = `
    ESTRATÉGIA: ${searchFocus}
    LOCALIZAÇÃO: ${location}
    NICHO: ${niche}

    FORMATO:
    ---
    Nome: [Nome]
    CNPJ: [CNPJ ou N/A]
    Telefone: [DDD + Número]
    Email: [Email ou N/A]
    Endereço: [Endereço]
    Avaliação: [Nota]
    Site: [URL ou N/A]
    Instagram: [URL ou N/A]
    Facebook: [URL ou N/A]
    ---
  `;

  // Apenas 1 retentativa rápida para evitar esperas longas
  const maxRetries = 1;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          tools: tools,
          toolConfig: toolConfig,
          temperature: 0.1,
          thinkingConfig: { thinkingBudget: 0 }, // VELOCIDADE MÁXIMA: desativa o raciocínio estendido
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
      const errorMsg = error?.message || "";
      if (attempt < maxRetries && (errorMsg.includes("429") || errorMsg.includes("Quota"))) {
        await delay(5000); // Espera curta de 5s se bater no limite
        continue;
      }
      throw error;
    }
  }

  throw new Error("Erro de conexão.");
};
