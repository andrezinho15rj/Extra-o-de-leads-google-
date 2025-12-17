import { GoogleGenAI, Tool, HarmCategory, HarmBlockThreshold } from "@google/genai";
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

  // Inicialização
  const ai = new GoogleGenAI({ apiKey: apiKey });
  // Usando o modelo flash que é rápido e suporta tools
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

  // Reduzimos para 15 por lote para garantir qualidade e evitar cortes na resposta
  const prompt = `
    Atue como um Assistente de Pesquisa de Mercado focado em DADOS PÚBLICOS DE EMPRESAS (Business Directory).
    
    TAREFA: Encontre 15 EMPRESAS DO NICHO "${niche}" localizadas em "${location}".
    
    CONTEXTO DA BUSCA: ${searchFocus}
    
    INSTRUÇÕES CRÍTICAS:
    1. Utilize o Google Maps para verificar a existência real da empresa.
    2. Extraia APENAS dados comerciais públicos (Nome, Telefone Comercial, Endereço Público).
    3. Se não encontrar 15, liste quantas encontrar.
    4. NÃO invente dados. Se não tiver telefone, coloque "N/A".
    
    FORMATO DE RESPOSTA OBRIGATÓRIO (Use estritamente este padrão para que meu sistema consiga ler):
    ---
    Nome: [Nome da Empresa]
    Telefone: [Telefone Comercial]
    Email: [Email ou N/A]
    Endereço: [Endereço Completo]
    Avaliação: [Nota ex: 4.8]
    Site: [URL ou N/A]
    ---
    
    Exemplo:
    ---
    Nome: Padaria do João
    Telefone: (11) 9999-9999
    Email: contato@padaria.com
    Endereço: Rua das Flores, 123, SP
    Avaliação: 4.5
    Site: www.padaria.com
    ---
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: tools,
        toolConfig: toolConfig,
        temperature: 0.4, // Temperatura mais baixa para ser mais fiel aos dados
        safetySettings: [
          // Permite conteúdo que a IA pode confundir com dados sensíveis, mas são dados públicos de empresas
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
      }
    });

    const rawText = response.text || "";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    // Se a resposta for muito curta, pode ser um erro da IA
    if (rawText.length < 50) {
      console.warn("Resposta da IA muito curta:", rawText);
    }

    return {
      rawText,
      groundingChunks
    };

  } catch (error: any) {
    console.error("Erro na busca Gemini:", error);
    let errorMsg = "Erro na conexão com a IA.";
    
    if (error.message?.includes("403")) {
      errorMsg = "Erro 403: Acesso Negado. Verifique se a API Key tem permissões ou se o faturamento está ativado no Google Cloud.";
    } else if (error.message?.includes("429")) {
      errorMsg = "Erro 429: Cota excedida. Você fez muitas requisições rápidas.";
    }

    return {
      rawText: `ERRO DE SISTEMA: ${errorMsg}\nDetalhes: ${error.message}`,
      groundingChunks: []
    };
  }
};