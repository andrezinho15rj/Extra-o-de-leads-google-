import React, { useState, useCallback, useEffect } from 'react';
import { searchLeads } from './services/geminiService';
import { BusinessLead, SearchState } from './types';
import { LeadCard } from './components/LeadCard';
import { ExportButton } from './components/ExportButton';

export default function App() {
  // ==============================================================================
  // ÁREA DE CONFIGURAÇÃO RÁPIDA
  // Se você não quiser digitar a chave na tela toda vez, cole ela dentro das aspas abaixo:
  const HARDCODED_KEY = ""; // Exemplo: "AIzaSyD..."
  // ==============================================================================

  // Tenta pegar da variável fixa acima, ou do ambiente (.env), senão inicia vazio
  const [apiKey, setApiKey] = useState(HARDCODED_KEY || process.env.API_KEY || '');
  const [showKeyInput, setShowKeyInput] = useState(!HARDCODED_KEY && !process.env.API_KEY);

  const [searchState, setSearchState] = useState<SearchState>({
    niche: '',
    location: '',
    isLocating: false
  });
  
  // State
  const [leads, setLeads] = useState<BusinessLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<{title: string, uri: string}[]>([]);
  const [rawResponseDebug, setRawResponseDebug] = useState<string>('');

  const handleLocate = () => {
    setSearchState(prev => ({ ...prev, isLocating: true }));
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setSearchState(prev => ({ 
            ...prev, 
            location: 'Minha localização atual', 
            isLocating: false 
          }));
        },
        (err) => {
          console.error(err);
          setError("Não foi possível obter sua localização.");
          setSearchState(prev => ({ ...prev, isLocating: false }));
        }
      );
    } else {
      setError("Geolocalização não suportada pelo navegador.");
      setSearchState(prev => ({ ...prev, isLocating: false }));
    }
  };

  const parseLeadsFromText = (text: string): BusinessLead[] => {
    if (!text) return [];
    const chunks = text.split('---').map(c => c.trim()).filter(c => c.length > 20); 
    
    const parsed = chunks.map((chunk) => {
      const getField = (keyword: string) => {
        const regex = new RegExp(`${keyword}:\\s*(.*)`, 'i');
        const match = chunk.match(regex);
        return match ? match[1].trim() : 'N/A';
      };

      const name = getField('Nome');
      if (!name || name === 'N/A' || name.length < 2) return null;

      return {
        id: `lead-${Date.now()}-${Math.random()}`, 
        name: name,
        phone: getField('Telefone'),
        email: getField('Email'),
        address: getField('Endereço'),
        rating: getField('Avaliação'),
        website: getField('Site')
      } as BusinessLead;
    });

    return parsed.filter((lead) => lead !== null) as BusinessLead[];
  };

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const currentKey = apiKey || HARDCODED_KEY;
    
    if (!currentKey) {
      setError("Por favor, insira sua API Key do Google Gemini para continuar.");
      setShowKeyInput(true);
      return;
    }
    if (!searchState.niche || !searchState.location) return;

    setLoading(true);
    setProgress(5);
    setError(null);
    setLeads([]);
    setSources([]);
    setRawResponseDebug('');
    setStatusMessage('Iniciando agentes de busca...');

    try {
      let lat: number | undefined;
      let lng: number | undefined;

      if (searchState.location.toLowerCase().includes('minha localização')) {
        try {
           const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
             navigator.geolocation.getCurrentPosition(resolve, reject);
           });
           lat = pos.coords.latitude;
           lng = pos.coords.longitude;
        } catch (e) {
           // ignore
        }
      }

      const batches = [
        "Foque nas empresas MAIS BEM AVALIADAS e POPULARES na região central.",
        "Foque em empresas em BAIRROS PERIFÉRICOS, ZONA NORTE ou SUL (varie a região).",
        "Foque em NOVAS empresas, PRESTADORES DE SERVIÇO e PEQUENOS NEGÓCIOS (long tail)."
      ];

      let completedBatches = 0;
      const totalBatches = batches.length;
      
      const allLeadsMap = new Map<string, BusinessLead>();
      const allSourcesMap = new Map<string, {title: string, uri: string}>();

      setStatusMessage(`Disparando ${totalBatches} agentes de busca paralelos...`);

      const promises = batches.map(async (focus, index) => {
        try {
          // Passamos a apiKey explicitamente aqui
          const response = await searchLeads(currentKey, searchState.niche, searchState.location, lat, lng, focus);
          
          completedBatches++;
          const percent = Math.round((completedBatches / totalBatches) * 100);
          setProgress(percent);
          setStatusMessage(`Processando lote ${completedBatches}/${totalBatches}...`);

          setRawResponseDebug(prev => prev + `\n\n=== LOTE ${index + 1} ===\n` + response.rawText);

          const newLeads = parseLeadsFromText(response.rawText);
          
          newLeads.forEach(lead => {
            const phoneKey = lead.phone.replace(/\D/g, '');
            const key = phoneKey.length > 5 ? phoneKey : lead.name.toLowerCase().trim();
            
            if (!allLeadsMap.has(key)) {
              allLeadsMap.set(key, lead);
            }
          });

          response.groundingChunks.forEach(chunk => {
             if (chunk.web?.uri) {
                allSourcesMap.set(chunk.web.uri, { title: chunk.web.title || chunk.web.uri, uri: chunk.web.uri });
             }
             if (chunk.maps?.uri) {
                allSourcesMap.set(chunk.maps.uri, { title: chunk.maps.title || 'Google Maps', uri: chunk.maps.uri });
             }
          });

          setLeads(Array.from(allLeadsMap.values()));
          setSources(Array.from(allSourcesMap.values()));

        } catch (err) {
          console.error(`Batch ${index} failed`, err);
        }
      });

      await Promise.all(promises);
      
      setStatusMessage('Finalizado!');
      if (allLeadsMap.size === 0) {
        setError("Nenhum lead encontrado. Verifique sua API Key, ou tente simplificar os termos.");
      }

    } catch (err: any) {
      setError(err.message || "Ocorreu um erro crítico na busca.");
    } finally {
      setLoading(false);
    }
  }, [searchState, apiKey]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight">Extractor de Leads <span className="text-blue-500">Massivo</span></h1>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="text-xs text-gray-400 hover:text-white underline"
            >
              {showKeyInput ? 'Ocultar API Key' : 'Configurar API Key'}
            </button>
          </div>
        </div>
        
        {/* API Key Input Section (Collapsible) */}
        {showKeyInput && (
          <div className="bg-gray-800 border-b border-gray-700 p-4 animate-fade-in">
            <div className="max-w-3xl mx-auto">
               <label className="block text-xs font-semibold text-blue-400 mb-1 uppercase tracking-wider">
                 Google Gemini API Key
               </label>
               <div className="flex gap-2">
                 <input 
                   type="password" 
                   value={apiKey}
                   onChange={(e) => setApiKey(e.target.value)}
                   placeholder="Cole sua chave aqui (começa com AIza...)"
                   className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                 />
               </div>
               <p className="text-xs text-gray-500 mt-1">
                 A chave é usada apenas localmente no seu navegador para buscar os dados.
               </p>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
        
        {/* Search Section */}
        <section className="bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-700 mb-8">
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* Niche Input */}
            <div className="md:col-span-5 space-y-2">
              <label htmlFor="niche" className="block text-sm font-medium text-gray-300">Nicho / Categoria</label>
              <input
                id="niche"
                type="text"
                value={searchState.niche}
                onChange={(e) => setSearchState(s => ({ ...s, niche: e.target.value }))}
                placeholder="Ex: Dentistas, Pizzaria, Encanador"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:opacity-50"
                required
                disabled={loading}
              />
            </div>

            {/* Location Input */}
            <div className="md:col-span-5 space-y-2">
              <label htmlFor="location" className="block text-sm font-medium text-gray-300">Localização</label>
              <div className="relative">
                <input
                  id="location"
                  type="text"
                  value={searchState.location}
                  onChange={(e) => setSearchState(s => ({ ...s, location: e.target.value }))}
                  placeholder="Ex: Rio de Janeiro, SP, Centro"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 pr-10 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:opacity-50"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={handleLocate}
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-400 transition-colors disabled:opacity-50"
                  title="Usar minha localização"
                >
                  {searchState.isLocating ? (
                     <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="md:col-span-2 flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                   <>
                     <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                   </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>Extrair</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Progress Bar */}
          {loading && (
            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-xs text-gray-400 uppercase tracking-wide font-semibold">
                <span>{statusMessage}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-blue-500 h-3 rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-center text-sm text-gray-500 pt-2 animate-pulse">
                Os leads aparecerão abaixo assim que cada lote for concluído.
              </p>
            </div>
          )}
        </section>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-900/50 border border-red-700 text-red-200 rounded-lg flex items-center gap-3 animate-fade-in">
             <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
             {error}
          </div>
        )}

        {/* Results Area */}
        {(leads.length > 0 || loading) && (
          <div className="space-y-6">
            {leads.length > 0 && (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 animate-fade-in">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  Resultados Coletados
                  <span className="bg-blue-600 text-white text-sm py-1 px-3 rounded-full">
                    {leads.length}
                  </span>
                </h2>
                <ExportButton leads={leads} niche={searchState.niche} />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
              
              {/* Skeleton Loaders if still loading */}
              {loading && progress < 100 && Array.from({length: 3}).map((_, i) => (
                <div key={i} className="bg-gray-800 border border-gray-700 rounded-xl p-5 h-48 animate-pulse flex flex-col justify-between">
                   <div className="space-y-3">
                     <div className="h-6 bg-gray-700 rounded w-3/4"></div>
                     <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                     <div className="h-4 bg-gray-700 rounded w-full"></div>
                   </div>
                   <div className="h-8 bg-gray-700 rounded w-full mt-4"></div>
                </div>
              ))}
            </div>

            {/* Sources / Attribution */}
            {!loading && sources.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-800">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Fontes de Dados (Grounding)</h3>
                <div className="flex flex-wrap gap-2">
                  {sources.map((src, idx) => (
                    <a 
                      key={idx}
                      href={src.uri}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-blue-400 px-3 py-1 rounded-full border border-gray-700 transition-colors truncate max-w-xs block"
                    >
                      {src.title || src.uri}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Empty State */}
        {!loading && leads.length === 0 && !error && (
          <div className="text-center py-20 opacity-50">
            <svg className="w-20 h-20 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-xl font-medium text-gray-400">Digite um nicho e local para começar a extrair leads.</p>
            <p className="text-sm text-gray-500 mt-2">Certifique-se de configurar sua API Key no topo.</p>
          </div>
        )}

      </main>
    </div>
  );
}