import { GoogleGenAI, Tool } from "@google/genai";
import { SearchResponse } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const searchLeads = async (
  niche: string, 
  location: string,
  userLat?: number,
  userLng?: number
): Promise<SearchResponse> => {
  
  const modelId = "gemini-2.5-flash"; // Efficient for grounding tasks

  // Configure tools. We use Google Maps for precise location data and Google Search as a fallback/enricher.
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
    Atue como um especialista em extração de dados comerciais (Lead Scraper).
    
    Tarefa: Encontre empresas do nicho "${niche}" localizadas em "${location}".
    
    Objetivo Principal: Extrair o NOME e o NÚMERO DE TELEFONE de cada empresa encontrada.
    
    Instruções de Formatação:
    Liste cada empresa encontrada separada estritamente por uma linha contendo apenas "---".
    Para cada empresa, use o seguinte formato (se a informação não estiver disponível, escreva "N/A"):
    
    Nome: [Nome da Empresa]
    Telefone: [Número de Telefone]
    Endereço: [Endereço Completo]
    Avaliação: [Nota/Rating se houver]
    Site: [Website se houver]
    
    Tente encontrar entre 5 a 10 resultados relevantes. Priorize resultados com números de telefone.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: tools,
        toolConfig: toolConfig,
        temperature: 0.2, // Low temperature for factual extraction
      }
    });

    const rawText = response.text || "Nenhum resultado encontrado.";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return {
      rawText,
      groundingChunks
    };

  } catch (error) {
    console.error("Erro na busca Gemini:", error);
    throw new Error("Falha ao contactar a API de Inteligência Artificial.");
  }
};