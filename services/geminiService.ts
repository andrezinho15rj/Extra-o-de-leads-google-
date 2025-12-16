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
    Atue como um sistema de Extração de Leads em Massa (Bulk Lead Scraper).
    
    OBJETIVO: Gerar uma lista sólida de até 100 empresas do nicho "${niche}" localizadas em "${location}".
    
    INSTRUÇÕES CRÍTICAS:
    1. QUANTIDADE: Busque profundamente nos dados do Google Maps e Busca para listar entre 50 a 100 resultados relevantes. Não tente exceder 100 para garantir a integridade dos dados.
    2. PRIORIDADE: Foque estritamente em empresas que possuam NÚMERO DE TELEFONE listado.
    3. FORMATO: Mantenha estritamente o formato abaixo para facilitar a importação.
    
    Separador entre empresas: "---"
    
    Formato de cada item:
    Nome: [Nome da Empresa]
    Telefone: [Número de Telefone]
    Email: [Email se disponível, senão N/A]
    Endereço: [Endereço Completo]
    Avaliação: [Nota/Rating]
    Site: [Website]
    
    Exemplo de saída esperada:
    
    Nome: Padaria A
    Telefone: (11) 9999-9999
    Email: contato@padariaa.com.br
    Endereço: Rua X, 123
    Avaliação: 4.5
    Site: www.padariaa.com.br
    ---
    Nome: Padaria B
    ...
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: tools,
        toolConfig: toolConfig,
        temperature: 0.4, 
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