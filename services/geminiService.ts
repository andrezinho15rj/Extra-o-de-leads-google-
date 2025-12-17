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
  searchFocus: string = "Geral e principais resultados"
): Promise<SearchResponse> => {
  
  // Validação básica
  if (!apiKey) {
    throw new Error("API Key não fornecida. Insira sua chave nas configurações.");
  }

  // Inicialização
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
  `;

  // Lógica de Retry (Tentativas em caso de erro 503/429)
  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          tools: tools,
          toolConfig: toolConfig,
          temperature: 0.4,
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          ]
        }
      });

      const rawText = response.text || "";
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      if (rawText.length < 50) {
        console.warn("Resposta da IA muito curta:", rawText);
      }

      return {
        rawText,
        groundingChunks
      };

    } catch (error: any) {
      console.error(`Tentativa ${attempt} falhou:`, error);
      lastError = error;
      
      const errorStr = String(error?.message || error);
      // Se for sobrecarga (503) ou muitas requisições (429), espera e tenta de novo
      if (errorStr.includes("503") || errorStr.includes("overloaded") || errorStr.includes("429")) {
        if (attempt < maxRetries) {
          const waitTime = attempt * 2000; // 2s, 4s, 6s...
          console.log(`Aguardando ${waitTime}ms para tentar novamente...`);
          await delay(waitTime);
          continue;
        }
      } else {
        // Se for outro erro (ex: chave inválida), não adianta tentar de novo
        break; 
      }
    }
  }

  // Se chegou aqui, falhou todas as tentativas
  let friendlyError = "Erro desconhecido na conexão com a IA.";
  let technicalDetails = lastError?.message || String(lastError);

  try {
      if (technicalDetails.includes('{')) {
          const jsonPart = technicalDetails.substring(technicalDetails.indexOf('{'));
          const parsed = JSON.parse(jsonPart);
          if (parsed.error && parsed.error.message) {
              technicalDetails = parsed.error.message;
          }
      }
  } catch (e) { }

  if (technicalDetails.includes("API key expired") || technicalDetails.includes("API_KEY_INVALID")) {
      friendlyError = "SUA CHAVE EXPIROU. A API Key informada no .env é antiga ou inválida.";
  } else if (technicalDetails.includes("SERVICE_DISABLED")) {
      friendlyError = "API NÃO ATIVADA. O projeto Google Cloud não tem a 'Generative Language API' ativa.";
  } else if (technicalDetails.includes("403") || technicalDetails.includes("PERMISSION_DENIED")) {
      friendlyError = "ACESSO NEGADO (403). Verifique restrições da chave.";
  } else if (technicalDetails.includes("503") || technicalDetails.includes("overloaded")) {
      friendlyError = "SERVIÇO SOBRECARREGADO (503). O Google Gemini está com instabilidade temporária. Tente novamente em alguns minutos.";
  }

  return {
    rawText: `ERRO DE CONFIGURAÇÃO:\n${friendlyError}\n\nDetalhes Técnicos: ${technicalDetails}`,
    groundingChunks: []
  };
};