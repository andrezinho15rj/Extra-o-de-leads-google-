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

  const systemInstruction = `Você é o Winner Extractor AI, um especialista em inteligência comercial e OSINT (Open Source Intelligence). 
  Sua missão é localizar empresas reais, verificar sua existência no Google Maps e extrair contatos comerciais públicos com precisão cirúrgica.`;

  const prompt = `
    TAREFA: Encontre 15 EMPRESAS DO NICHO "${niche}" localizadas em "${location}".
    
    CONTEXTO DA BUSCA: ${searchFocus}
    
    INSTRUÇÕES CRÍTICAS:
    1. Use o Google Maps para validar o endereço e a existência.
    2. Busque links de Instagram e Facebook ativamente.
    3. NÃO invente dados. Se não houver telefone, escreva "N/A".
    4. Priorize empresas com telefone e avaliação visível.
    
    FORMATO DE RESPOSTA OBRIGATÓRIO (Mantenha estritamente este layout):
    ---
    Nome: [Nome da Empresa]
    Telefone: [Telefone Comercial]
    Email: [Email ou N/A]
    Endereço: [Endereço Completo]
    Avaliação: [Nota ex: 4.8]
    Site: [URL ou N/A]
    Instagram: [URL ou N/A]
    Facebook: [URL ou N/A]
    ---
  `;

  // Lógica de Retry Agressiva (Backoff Exponencial)
  const maxRetries = 5;
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
      
      // Lógica específica para erros de servidor ou cota
      if (errorStr.includes("503") || errorStr.includes("overloaded") || errorStr.includes("429")) {
        if (attempt < maxRetries) {
          // Backoff Exponencial: 2s, 4s, 8s, 16s...
          const waitTime = Math.pow(2, attempt) * 1000; 
          console.log(`Erro de servidor (${errorStr}). Aguardando ${waitTime}ms...`);
          await delay(waitTime);
          continue;
        }
      } else {
        // Erros de permissão ou chave inválida não adiantam tentar de novo
        break; 
      }
    }
  }

  // Tratamento de Erro Final
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
      friendlyError = "SUA CHAVE É INVÁLIDA OU EXPIROU. Verifique o arquivo .env";
  } else if (technicalDetails.includes("SERVICE_DISABLED")) {
      friendlyError = "API NÃO ATIVADA. Ative a 'Generative Language API' no Google Cloud Console.";
  } else if (technicalDetails.includes("403") || technicalDetails.includes("PERMISSION_DENIED")) {
      friendlyError = "ACESSO NEGADO (403). Sua chave não tem permissão.";
  } else if (technicalDetails.includes("503") || technicalDetails.includes("overloaded")) {
      friendlyError = "SERVIÇO SOBRECARREGADO (503). O Google Gemini está instável no momento. Tente novamente em 2 minutos.";
  }

  return {
    rawText: `ERRO DE SISTEMA:\n${friendlyError}\n\nDetalhes Técnicos: ${technicalDetails}`,
    groundingChunks: []
  };
};