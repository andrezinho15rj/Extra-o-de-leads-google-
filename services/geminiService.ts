import { GoogleGenAI, Tool, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { SearchResponse } from "../types";

// Função auxiliar para espera (delay)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const searchLeads = async (
  apiKey: string,
  niche: string, 
  location: string,
  userLat?: number,
  userLng?: number,
  searchFocus: string = "Geral"
): Promise<SearchResponse> => {
  
  if (!apiKey) {
    throw new Error("API Key não fornecida.");
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  // Atualizado para gemini-3-flash-preview para maior velocidade e janelas de contexto melhores
  const modelId = "gemini-3-flash-preview"; 

  const tools: Tool[] = [
    { googleMaps: {} }, 
    { googleSearch: {} }
  ];

  const toolConfig = (userLat && userLng) ? {
    retrievalConfig: {
      latLng: {
        latitude: userLat,
        longitude: userLng
      }
    }
  } : undefined;

  const systemInstruction = `Você é o "Winner Extractor Gold", a IA de prospecção mais avançada do mercado.
  Seu objetivo é extrair listas massivas de leads comerciais B2B. 
  Seja agressivo na busca: use o Google Maps para localizar empresas e o Google Search para encontrar redes sociais e sites.`;

  const prompt = `
    ESTRATÉGIA DE VARREDURA: ${searchFocus}
    LOCALIZAÇÃO: ${location}
    NICHO: ${niche}

    TAREFA: Extraia uma lista de 20 EMPRESAS DIFERENTES seguindo a estratégia acima.
    
    REQUISITOS DE DADOS:
    - Tente obter o Telefone (prioridade máxima).
    - Busque o Instagram (prioridade alta).
    - Obtenha a Avaliação (ex: 4.5).
    - Se não encontrar o dado, use "N/A".

    FORMATO DE RESPOSTA (ESTRITAMENTE ESTE PADRÃO):
    ---
    Nome: [Nome]
    Telefone: [Telefone]
    Email: [Email ou N/A]
    Endereço: [Endereço]
    Avaliação: [Nota]
    Site: [URL ou N/A]
    Instagram: [URL ou N/A]
    Facebook: [URL ou N/A]
    ---
  `;

  const maxRetries = 6;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          tools: tools,
          toolConfig: toolConfig,
          temperature: 0.5,
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
      const errorStr = String(error?.message || error);
      const isQuota = errorStr.includes("429") || errorStr.includes("Quota") || errorStr.includes("quota");
      
      if (isQuota && attempt < maxRetries) {
        // Se bater a cota, esperamos o tempo necessário (geralmente 30-60s no plano free)
        const waitTime = 15000 * attempt; 
        console.warn(`Cota atingida. Tentativa ${attempt}. Aguardando ${waitTime/1000}s...`);
        await delay(waitTime);
        continue;
      }
      lastError = error;
      break;
    }
  }

  return {
    rawText: `ERRO FINAL:\n${lastError?.message || "Falha na conexão"}`,
    groundingChunks: []
  };
};