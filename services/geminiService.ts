
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
  
  // A chave DEVE ser process.env.API_KEY conforme diretriz obrigatória
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    throw new Error("Chave API (process.env.API_KEY) não encontrada no ambiente de execução.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Utilizando o modelo gemini-3-flash-preview conforme recomendado para tarefas de texto/busca
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
Sua tarefa é encontrar empresas reais no Brasil para o nicho e localização fornecidos.
Foco principal: Nome, Telefone, CNPJ e Redes Sociais.
Use o Google Maps para localizar os estabelecimentos e o Google Search para encontrar o CNPJ em sites como 'Casa dos Dados', 'CNPJ.biz' ou 'Transparência'.
Retorne os dados em blocos separados por "---".`;

  const prompt = `
    ESTRATÉGIA: ${searchFocus}
    LOCALIZAÇÃO: ${location}
    NICHO: ${niche}

    Extraia uma lista de 5 a 10 empresas.
    Formato obrigatório por lead:
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

  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
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
      const errorMsg = error?.message || "";
      if (attempt < maxRetries && (errorMsg.includes("429") || errorMsg.includes("Quota"))) {
        await delay(15000 * attempt);
        continue;
      }
      throw error;
    }
  }

  throw new Error("Falha na comunicação com a inteligência artificial após tentativas.");
};
