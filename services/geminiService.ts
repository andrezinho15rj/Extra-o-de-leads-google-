
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
  
  // Inicialização estritamente conforme as diretrizes
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // "Maps grounding is only supported in Gemini 2.5 series models."
  const modelId = "gemini-2.5-flash"; 

  const tools: Tool[] = [
    { googleMaps: {} }, 
    { googleSearch: {} }
  ];

  // Configuração de localização para o Google Maps se disponível
  const toolConfig = (userLat && userLng) ? {
    retrievalConfig: {
      latLng: {
        latitude: userLat,
        longitude: userLng
      }
    }
  } : undefined;

  const systemInstruction = `Você é o "Winner Extractor Gold + CNPJ Expert". 
  Sua missão é localizar empresas e extrair dados comerciais completos, incluindo o CNPJ, usando o Google Maps e Google Search.
  Sempre tente validar o CNPJ em diretórios públicos como Casa dos Dados ou similares através das ferramentas de busca.
  Retorne os dados estritamente no formato de blocos separado por "---".`;

  const prompt = `
    ESTRATÉGIA DE BUSCA: ${searchFocus}
    LOCALIZAÇÃO ALVO: ${location}
    NICHO OU EMPRESA: ${niche}

    TAREFA: Gere uma lista de pelo menos 5 leads reais.
    
    FORMATO DE RESPOSTA (OBRIGATÓRIO):
    ---
    Nome: [Nome da Empresa]
    CNPJ: [Número do CNPJ ou N/A]
    Telefone: [Telefone com DDD]
    Email: [Email de contato ou N/A]
    Endereço: [Endereço Completo]
    Avaliação: [Nota média no Maps]
    Site: [URL do site ou N/A]
    Instagram: [URL do perfil ou N/A]
    Facebook: [URL da página ou N/A]
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
          temperature: 0.1, // Temperatura baixa para maior precisão nos dados
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          ]
        }
      });

      // Extração de texto segura
      const responseText = response.text || "";
      
      return {
        rawText: responseText,
        groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
      };

    } catch (error: any) {
      console.error(`Tentativa ${attempt} falhou:`, error);
      
      const errorMsg = error?.message || "";
      const isQuotaError = errorMsg.includes("429") || errorMsg.includes("Quota");
      
      if (attempt < maxRetries && isQuotaError) {
        // Espera exponencial em caso de erro de cota
        await delay(20000 * attempt);
        continue;
      }
      
      // Lança o erro para ser tratado pela UI
      throw new Error(errorMsg || "Erro desconhecido ao chamar a API do Gemini");
    }
  }

  throw new Error("Não foi possível obter resposta após várias tentativas.");
};
