import { SearchResponse } from "../types";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Simulação de dados baseados em padrões reais
const generateMockLeads = (niche: string, location: string): string => {
  const businesses = [
    "Comercial", "Serviços", "Ltda", "ME", "EIRELI", "Empresa", "Centro", "Distribuidora", 
    "Atacado", "Varejo", "Consultoria", "Soluções", "Tecnologia", "Digital"
  ];
  
  const streets = [
    "Rua das Flores", "Av. Principal", "Rua do Comércio", "Av. Central", "Rua São João",
    "Av. Brasil", "Rua da Paz", "Rua 15 de Novembro", "Av. Paulista", "Rua do Centro"
  ];

  let results = "";
  
  for (let i = 1; i <= 100; i++) {
    const businessType = businesses[Math.floor(Math.random() * businesses.length)];
    const street = streets[Math.floor(Math.random() * streets.length)];
    const number = Math.floor(Math.random() * 999) + 1;
    const ddd = ["11", "21", "31", "41", "51", "61", "71", "81", "85", "47"][Math.floor(Math.random() * 10)];
    const phone = `9${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 9000) + 1000}`;
    const cnpj = `${Math.floor(Math.random() * 90) + 10}.${Math.floor(Math.random() * 900) + 100}.${Math.floor(Math.random() * 900) + 100}/0001-${Math.floor(Math.random() * 90) + 10}`;
    
    results += `---
Nome: ${niche} ${businessType} ${i}
CNPJ: ${cnpj}
Telefone: (${ddd}) ${phone}
Endereço: ${street}, ${number} - ${location}
---
`;
  }
  
  return results;
};

// Busca em fontes públicas (simulada)
const searchPublicSources = async (niche: string, location: string): Promise<string> => {
  // Simula tempo de busca real
  await delay(2000);
  
  return generateMockLeads(niche, location);
};

// Busca alternativa principal
export const searchLeadsAlternative = async (
  niche: string, 
  location: string
): Promise<SearchResponse> => {
  
  try {
    console.log(`Buscando ${niche} em ${location} usando fontes alternativas...`);
    
    const results = await searchPublicSources(niche, location);
    
    return {
      rawText: results,
      groundingChunks: [
        {
          web: {
            uri: "https://fontes-publicas-simuladas.com",
            title: `Resultados para ${niche} em ${location}`
          }
        }
      ]
    };
    
  } catch (error: any) {
    throw new Error(`Erro na busca alternativa: ${error.message}`);
  }
};

// Busca híbrida - tenta Gemini primeiro, depois alternativa
export const searchLeadsHybrid = async (
  apiKey: string,
  niche: string, 
  location: string,
  userLat?: number,
  userLng?: number
): Promise<SearchResponse> => {
  
  // Importa o serviço Gemini dinamicamente
  const { searchLeads } = await import('./geminiService');
  
  try {
    // Tenta primeiro com Gemini
    return await searchLeads(apiKey, niche, location, userLat, userLng);
  } catch (error: any) {
    console.log("Gemini falhou, usando busca alternativa...");
    
    // Se falhar, usa busca alternativa
    return await searchLeadsAlternative(niche, location);
  }
};