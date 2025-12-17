
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

  if (!apiKey) {
    throw new Error("Chave API não configurada.");
  }

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

  const systemInstruction = `Você é o "Winner Extractor Gold".
Sua tarefa é encontrar empresas reais e ATIVAS no Brasil.
Seja extremamente rápido e preciso. 
Retorne o MÁXIMO de leads que conseguir de uma única vez (objetivo: 15 a 20 leads por bloco).
Sempre procure pelo CNPJ em fontes de transparência pública.
Use "---" como separador estrito entre cada lead.`;

  const prompt = `
    ESTRATÉGIA: ${searchFocus}
    LOCALIZAÇÃO: ${location}
    NICHO: ${niche}

    TAREFA: Gere uma lista massiva de leads comerciais.
    
    FORMATO OBRIGATÓRIO POR LEAD:
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

  const maxRetries = 2;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          tools: tools,
          toolConfig: toolConfig,
          temperature: 0.2, // Temperatura levemente maior para fluidez e volume de dados
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
        await delay(10000); // 10s de espera em caso de erro real de cota
        continue;
      }
      throw error;
    }
  }

  throw new Error("Erro de conexão.");
};
