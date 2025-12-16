import React, { useState, useCallback } from 'react';
import { searchLeads } from './services/geminiService';
import { BusinessLead, SearchState } from './types';
import { LeadCard } from './components/LeadCard';
import { ExportButton } from './components/ExportButton';

export default function App() {
  const [searchState, setSearchState] = useState<SearchState>({
    niche: '',
    location: '',
    isLocating: false
  });
  const [leads, setLeads] = useState<BusinessLead[]>([]);
  const [rawResponse, setRawResponse] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<{title: string, uri: string}[]>([]);

  const handleLocate = () => {
    setSearchState(prev => ({ ...prev, isLocating: true }));
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Use coordinates in search if strictly needed, 
          // or just autofill a generic "Minha Localização" text which we will process in the service 
          // by passing coords to toolConfig. 
          // For UX, we stick to text, but we save coords in a ref if we wanted to be more complex.
          // Here we just put "Minha Localização Atual" and the service will check coords availability.
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
    // Split by the delimiter defined in the prompt
    const chunks = text.split('---').map(c => c.trim()).filter(c => c.length > 10);
    
    return chunks.map((chunk, index) => {
      const getField = (keyword: string) => {
        const regex = new RegExp(`${keyword}:\\s*(.*)`, 'i');
        const match = chunk.match(regex);
        return match ? match[1].trim() : 'N/A';
      };

      return {
        id: `lead-${index}-${Date.now()}`,
        name: getField('Nome'),
        phone: getField('Telefone'),
        address: getField('Endereço'),
        rating: getField('Avaliação'),
        website: getField('Site')
      };
    }).filter(lead => lead.name !== 'N/A');
  };

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchState.niche || !searchState.location) return;

    setLoading(true);
    setError(null);
    setLeads([]);
    setSources([]);

    try {
      let lat: number | undefined;
      let lng: number | undefined;

      // Simple geolocation check if user typed "Minha localização" or similar
      if (searchState.location.toLowerCase().includes('minha localização')) {
        try {
           const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
             navigator.geolocation.getCurrentPosition(resolve, reject);
           });
           lat = pos.coords.latitude;
           lng = pos.coords.longitude;
        } catch (e) {
          // Ignore location error, fallback to text search (Gemini handles it gracefully usually)
        }
      }

      const response = await searchLeads(searchState.niche, searchState.location, lat, lng);
      
      setRawResponse(response.rawText);
      const parsedLeads = parseLeadsFromText(response.rawText);
      setLeads(parsedLeads);

      // Extract unique sources
      const extractedSources: {title: string, uri: string}[] = [];
      response.groundingChunks.forEach(chunk => {
        if (chunk.web) {
          extractedSources.push({ title: chunk.web.title, uri: chunk.web.uri });
        }
        if (chunk.maps && chunk.maps.uri) {
           extractedSources.push({ title: chunk.maps.title || 'Google Maps', uri: chunk.maps.uri });
        }
      });
      // Remove duplicates
      const uniqueSources = extractedSources.filter((v,i,a)=>a.findIndex(v2=>(v2.uri===v.uri))===i);
      setSources(uniqueSources);

      if (parsedLeads.length === 0) {
        setError("Nenhum lead estruturado foi encontrado, mas veja os dados brutos abaixo.");
      }

    } catch (err: any) {
      setError(err.message || "Ocorreu um erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }, [searchState]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight">Extractor de Leads <span className="text-blue-500">AI</span></h1>
          </div>
          <div className="text-sm text-gray-400 hidden sm:block">
            Powered by Gemini
          </div>
        </div>
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
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                required
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
                  placeholder="Ex: São Paulo, Centro, RJ"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 pr-10 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={handleLocate}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-400 transition-colors"
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
                     <span>Buscando...</span>
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
        </section>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-900/50 border border-red-700 text-red-200 rounded-lg flex items-center gap-3">
             <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
             {error}
          </div>
        )}

        {/* Results Area */}
        {leads.length > 0 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <h2 className="text-2xl font-bold text-white">
                Resultados Encontrados ({leads.length})
              </h2>
              <ExportButton leads={leads} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
            </div>

            {/* Sources / Attribution */}
            {sources.length > 0 && (
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

        {/* Fallback for raw text if parsing failed but we have text */}
        {leads.length === 0 && rawResponse && !loading && (
           <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mt-6">
             <h3 className="text-lg font-bold mb-4 text-yellow-400">Resposta Bruta da IA</h3>
             <pre className="whitespace-pre-wrap text-sm text-gray-300 font-mono overflow-x-auto">
               {rawResponse}
             </pre>
           </div>
        )}
        
        {/* Empty State / Initial Instructions */}
        {!loading && leads.length === 0 && !rawResponse && !error && (
          <div className="text-center py-20 opacity-50">
            <svg className="w-20 h-20 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-xl font-medium text-gray-400">Digite um nicho e local para começar a extrair leads.</p>
            <p className="text-sm text-gray-500 mt-2">O sistema usará Google Maps e Busca para encontrar números atualizados.</p>
          </div>
        )}

      </main>
    </div>
  );
}