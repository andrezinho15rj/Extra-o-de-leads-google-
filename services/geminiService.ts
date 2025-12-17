import { GoogleGenAI, Tool } from "@google/genai";
import { SearchResponse } from "../types";

export const searchLeads = async (
  apiKey: string,
  niche: string, 
  location: string,
  userLat?: number,
  userLng?: number,
  searchFocus: string = "Geral e principais resultados"
): Promise<SearchResponse> => {
  
  // Validação básica
  if (!apiKey) {
    throw new Error("API Key não fornecida. Insira sua chave nas configurações.");
  }

  // Inicialização com a chave fornecida dinamicamente
  const ai = new GoogleGenAI({ apiKey: apiKey });
  const modelId = "gemini-2.5-flash"; 

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

  const prompt = `
    Atue como um Extrator de Leads Segmentado.
    
    OBJETIVO: Listar ENTRE 50 e 60 EMPRESAS do nicho "${niche}" em "${location}".
    
    FOCO DESTA BUSCA ESPECÍFICA: ${searchFocus}
    (Use este foco para variar os termos de busca e encontrar empresas que outras buscas podem ter perdido).

    REGRAS DE EXTRAÇÃO:
    1. Priorize empresas com TELEFONE.
    2. Tente encontrar o EMAIL via busca web se não estiver no Maps.
    3. Seja rápido e direto.
    
    FORMATO OBRIGATÓRIO (para parser):
    ---
    Nome: [Nome da Empresa]
    Telefone: [Número]
    Email: [Email ou N/A]
    Endereço: [Endereço Completo]
    Avaliação: [Nota]
    Site: [URL]
    ---
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: tools,
        toolConfig: toolConfig,
        temperature: 0.6,
      }
    });

    const rawText = response.text || "";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return {
      rawText,
      groundingChunks
    };

  } catch (error) {
    console.error("Erro na busca Gemini:", error);
    return {
      rawText: "Erro na conexão com a IA. Verifique se sua API Key é válida e tem acesso ao modelo gemini-2.5-flash.",
      groundingChunks: []
    };
  }
};