import React, { useState, useCallback, useEffect } from 'react';
import { searchLeads } from './services/geminiService';
import { BusinessLead, SearchState, SearchHistoryItem } from './types';
import { LeadCard } from './components/LeadCard';
import { ExportButton } from './components/ExportButton';

export default function App() {
  const envKey = (import.meta as any).env?.VITE_API_KEY;
  const processKey = typeof process !== 'undefined' ? process.env?.VITE_API_KEY : undefined;
  const apiKey = envKey || processKey || '';

  const [searchState, setSearchState] = useState<SearchState>({
    niche: '',
    location: '',
    isLocating: false
  });
  
  const [leads, setLeads] = useState<BusinessLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0); 
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<{title: string, uri: string}[]>([]);
  const [rawResponseDebug, setRawResponseDebug] = useState<string>('');
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  
  // New States
  const [filterHighScore, setFilterHighScore] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('winner_search_history');
    if (saved) {
      setHistory(JSON.parse(saved));
    }
  }, []);

  const saveToHistory = (niche: string, location: string) => {
    const newItem = { niche, location, date: new Date().toISOString() };
    const newHistory = [newItem, ...history.filter(h => h.niche !== niche || h.location !== location)].slice(0, 5);
    setHistory(newHistory);
    localStorage.setItem('winner_search_history', JSON.stringify(newHistory));
  };

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

  const handleCopy = (lead: BusinessLead) => {
    const text = `
Empresa: ${lead.name}
Tel: ${lead.phone}
Email: ${lead.email}
Endereço: ${lead.address}
Site: ${lead.website}
    `.trim();
    navigator.clipboard.writeText(text);
    setCopiedId(lead.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const calculateWinnerScore = (lead: Partial<BusinessLead>): number => {
    let score = 30; // Base score
    
    // Rating boost
    const rating = parseFloat(lead.rating || '0');
    if (rating >= 4.5) score += 25;
    else if (rating >= 4.0) score += 15;
    else if (rating > 0) score += 5;

    // Contact info boost
    if (lead.phone && lead.phone !== 'N/A') score += 15;
    if (lead.email && lead.email !== 'N/A') score += 10;
    
    // Digital presence boost
    if (lead.website && lead.website !== 'N/A') score += 10;
    if (lead.instagram && lead.instagram !== 'N/A') score += 5;
    if (lead.facebook && lead.facebook !== 'N/A') score += 5;

    return Math.min(score, 100);
  };

  const parseLeadsFromText = (text: string): BusinessLead[] => {
    if (!text) return [];
    const chunks = text.split(/---|___|\*\*\*/).map(c => c.trim()).filter(c => c.length > 20); 
    
    const parsed = chunks.map((chunk) => {
      const getField = (keyword: string) => {
        const regex = new RegExp(`${keyword}[:\\*]*\\s*(.*)`, 'i');
        const match = chunk.match(regex);
        return match ? match[1].replace(/\*\*/g, '').trim() : 'N/A';
      };

      const name = getField('Nome');
      if (!name || name === 'N/A' || name.length < 2 || name.toLowerCase().includes('exemplo')) return null;

      const leadData: Partial<BusinessLead> = {
        id: `lead-${Date.now()}-${Math.random()}`, 
        name: name,
        phone: getField('Telefone'),
        email: getField('Email'),
        address: getField('Endereço'),
        rating: getField('Avaliação'),
        website: getField('Site'),
        instagram: getField('Instagram'),
        facebook: getField('Facebook')
      };

      leadData.winnerScore = calculateWinnerScore(leadData);

      return leadData as BusinessLead;
    });

    return parsed.filter((lead) => lead !== null) as BusinessLead[];
  };

  const handleSearch = useCallback(async (e?: React.FormEvent, historyNiche?: string, historyLocation?: string) => {
    if (e) e.preventDefault();
    
    const nicheToUse = historyNiche || searchState.niche;
    const locationToUse = historyLocation || searchState.location;

    if (!apiKey) {
      setError("ERRO CRÍTICO: Chave API não detectada no ambiente.");
      return;
    }
    if (!nicheToUse || !locationToUse) return;

    // Update state if coming from history
    if (historyNiche) setSearchState({ niche: nicheToUse, location: locationToUse, isLocating: false });

    setLoading(true);
    setProgress(5);
    setError(null);
    setLeads([]);
    setSources([]);
    setRawResponseDebug('');
    setStatusMessage('Inicializando Agente Winner...');

    // Save to history
    saveToHistory(nicheToUse, locationToUse);

    try {
      let lat: number | undefined;
      let lng: number | undefined;

      if (locationToUse.toLowerCase().includes('minha localização')) {
        try {
           const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
             navigator.geolocation.getCurrentPosition(resolve, reject);
           });
           lat = pos.coords.latitude;
           lng = pos.coords.longitude;
        } catch (e) { }
      }

      const batches = [
        "Foque em empresas MAIS BEM AVALIADAS e consolidadas.",
        "Foque em empresas com presença digital (Instagram/Site)."
      ];

      let completedBatches = 0;
      const totalBatches = batches.length;
      
      const allLeadsMap = new Map<string, BusinessLead>();
      const allSourcesMap = new Map<string, {title: string, uri: string}>();

      setStatusMessage(`Mapeando região via Google Maps...`);

      // Execução SEQUENCIAL
      for (let index = 0; index < batches.length; index++) {
        const focus = batches[index];
        
        try {
          const response = await searchLeads(apiKey, nicheToUse, locationToUse, lat, lng, focus);
          
          completedBatches++;
          const percent = Math.round((completedBatches / totalBatches) * 100);
          setProgress(percent);
          setStatusMessage(`Processando inteligência de dados (${completedBatches}/${totalBatches})...`);

          setRawResponseDebug(prev => prev + `\n\n=== LOTE ${index + 1} ===\n` + response.rawText);

          const newLeads = parseLeadsFromText(response.rawText);
          
          newLeads.forEach(lead => {
            const phoneKey = lead.phone.replace(/\D/g, '');
            const key = phoneKey.length > 5 ? phoneKey : lead.name.toLowerCase().trim();
            
            // Merge de dados (mantém o que tiver mais info)
            if (allLeadsMap.has(key)) {
               const existing = allLeadsMap.get(key)!;
               if (lead.winnerScore > existing.winnerScore) {
                  allLeadsMap.set(key, lead);
               } else if ((!existing.instagram || existing.instagram === 'N/A') && (lead.instagram && lead.instagram !== 'N/A')) {
                  existing.instagram = lead.instagram;
                  existing.winnerScore = calculateWinnerScore(existing);
               }
            } else {
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

          setLeads(Array.from(allLeadsMap.values()).sort((a, b) => b.winnerScore - a.winnerScore));
          setSources(Array.from(allSourcesMap.values()));

          if (index < batches.length - 1) {
             setStatusMessage(`Otimizando resultados (5s)...`);
             await new Promise(resolve => setTimeout(resolve, 5000));
          }

        } catch (err) {
          console.error(`Batch ${index} failed`, err);
        }
      }
      
      setStatusMessage('Extração Concluída!');
      
      if (allLeadsMap.size === 0) {
        setError("Nenhum lead estruturado encontrado. A IA pode estar sobrecarregada ou não encontrou dados públicos.");
      }

    } catch (err: any) {
      setError(err.message || "Erro fatal na execução.");
    } finally {
      setLoading(false);
    }
  }, [searchState, apiKey, history]);

  // Se não houver API Key, mostre a tela de configuração
  if (!apiKey) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 text-center font-sans">
        <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-red-900/50 animate-bounce">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-3xl font-black text-white mb-2 tracking-tight">SISTEMA BLOQUEADO</h1>
        <p className="text-gray-400 max-w-md mb-8">
          A chave de API não foi detectada. Para liberar o <strong>Winner Extractor</strong>, você precisa configurar o ambiente.
        </p>
        
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-lg w-full text-left">
          <h3 className="text-yellow-500 font-bold uppercase text-xs tracking-wider mb-3">Instruções de Desbloqueio</h3>
          <ol className="space-y-4 text-sm text-gray-300 list-decimal list-inside">
            <li>Crie um arquivo chamado <code className="bg-black px-2 py-1 rounded text-green-400 font-mono">.env</code> na raiz do projeto.</li>
            <li>Adicione a seguinte linha dentro do arquivo:</li>
          </ol>
          <div className="mt-4 bg-black p-4 rounded-lg border border-gray-800 font-mono text-xs text-gray-400 break-all">
            VITE_API_KEY=AIzaSy... (Sua Chave)
          </div>
          <p className="mt-4 text-xs text-gray-500">
            * Após criar o arquivo, reinicie o servidor de desenvolvimento.
          </p>
        </div>
      </div>
    );
  }

  const filteredLeads = filterHighScore ? leads.filter(l => l.winnerScore >= 50) : leads;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50 backdrop-blur-md bg-opacity-80">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-amber-700 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-900/20">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
                <h1 className="text-2xl font-black tracking-tight winner-gradient uppercase">Winner Extractor</h1>
                <p className="text-xs text-gray-500 font-medium tracking-widest">INTELLIGENCE SYSTEM</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="text-xs flex items-center gap-2 px-3 py-1 rounded-full bg-gray-900 border border-gray-800">
               <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
               <span className="text-gray-400 font-mono">ONLINE</span>
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Sidebar History */}
        <aside className="lg:col-span-3 space-y-4">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Buscas Recentes</h3>
                {history.length === 0 ? (
                    <p className="text-xs text-gray-600">Nenhum histórico recente.</p>
                ) : (
                    <ul className="space-y-2">
                        {history.map((item, idx) => (
                            <li key={idx}>
                                <button 
                                    onClick={() => handleSearch(undefined, item.niche, item.location)}
                                    disabled={loading}
                                    className="w-full text-left p-2 rounded hover:bg-gray-800 transition-colors text-xs group"
                                >
                                    <div className="text-yellow-500 font-medium group-hover:text-yellow-400 truncate">{item.niche}</div>
                                    <div className="text-gray-500 truncate">{item.location}</div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </aside>

        <div className="lg:col-span-9">
            {/* Search Section */}
            <section className="bg-gray-900 rounded-2xl p-6 shadow-2xl border border-gray-800 mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <svg className="w-32 h-32 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.8L19.2 19H4.8L12 5.8z"/></svg>
            </div>
            
            <form onSubmit={(e) => handleSearch(e)} className="grid grid-cols-1 md:grid-cols-12 gap-4 relative z-10">
                
                {/* Niche Input */}
                <div className="md:col-span-5 space-y-2">
                <label htmlFor="niche" className="block text-xs font-bold text-yellow-500 uppercase tracking-wider">Nicho / Alvo</label>
                <input
                    id="niche"
                    type="text"
                    value={searchState.niche}
                    onChange={(e) => setSearchState(s => ({ ...s, niche: e.target.value }))}
                    placeholder="Ex: Clínicas de Estética, Construtoras"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition-all disabled:opacity-50 placeholder-gray-600"
                    required
                    disabled={loading}
                />
                </div>

                {/* Location Input */}
                <div className="md:col-span-5 space-y-2">
                <label htmlFor="location" className="block text-xs font-bold text-yellow-500 uppercase tracking-wider">Localização</label>
                <div className="relative">
                    <input
                    id="location"
                    type="text"
                    value={searchState.location}
                    onChange={(e) => setSearchState(s => ({ ...s, location: e.target.value }))}
                    placeholder="Ex: Jardins SP, Copacabana"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 pr-10 text-white focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition-all disabled:opacity-50 placeholder-gray-600"
                    required
                    disabled={loading}
                    />
                    <button
                    type="button"
                    onClick={handleLocate}
                    disabled={loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-yellow-500 transition-colors disabled:opacity-50"
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
                    className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-900/30 border border-amber-600/50"
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
                        <span>EXTRAIR</span>
                    </>
                    )}
                </button>
                </div>
            </form>

            {/* Progress Bar */}
            {loading && (
                <div className="mt-6 space-y-2 relative z-10">
                <div className="flex justify-between text-xs text-yellow-500 uppercase tracking-wide font-bold">
                    <span>{statusMessage}</span>
                    <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-950 rounded-full h-2 overflow-hidden border border-gray-800">
                    <div 
                    className="bg-gradient-to-r from-yellow-600 to-yellow-400 h-2 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(234,179,8,0.5)]" 
                    style={{ width: `${progress}%` }}
                    ></div>
                </div>
                </div>
            )}
            </section>

            {/* Error Message */}
            {error && (
            <div className="mb-8 p-4 bg-red-950/50 border border-red-800 text-red-200 rounded-lg flex flex-col gap-2 animate-fade-in">
                <div className="flex items-center gap-2 font-bold text-red-400">
                    <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>FALHA NO SISTEMA</span>
                </div>
                <p className="font-mono text-sm">{error}</p>
            </div>
            )}
            
            {/* RAW DEBUG LOG */}
            {rawResponseDebug && leads.length === 0 && !loading && (
            <div className="mb-8 border border-amber-900/50 bg-amber-950/20 p-4 rounded-xl">
                <h3 className="text-amber-500 font-bold mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Relatório de Diagnóstico
                </h3>
                <details>
                <summary className="cursor-pointer text-blue-400 hover:text-blue-300 text-sm font-mono">Ver log da inteligência</summary>
                <pre className="mt-2 p-3 bg-black rounded text-xs text-green-500 overflow-x-auto whitespace-pre-wrap font-mono border border-gray-800">
                    {rawResponseDebug}
                </pre>
                </details>
            </div>
            )}

            {/* Results Area */}
            {(leads.length > 0) && (
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 animate-fade-in bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 uppercase font-bold">Leads</span>
                        <span className="text-3xl font-black text-white">{filteredLeads.length}</span>
                    </div>
                    <div className="h-10 w-px bg-gray-800"></div>
                    
                    <button 
                      onClick={() => setFilterHighScore(!filterHighScore)}
                      className={`flex flex-col px-3 py-1 rounded transition-colors ${filterHighScore ? 'bg-yellow-500/10 border border-yellow-500/50' : 'hover:bg-gray-800'}`}
                    >
                        <span className="text-xs text-gray-500 uppercase font-bold">Winner Mode</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xl font-bold ${filterHighScore ? 'text-yellow-400' : 'text-gray-400'}`}>
                              &gt; 50 Score
                          </span>
                          {filterHighScore && <span className="flex h-2 w-2 rounded-full bg-yellow-500"></span>}
                        </div>
                    </button>
                </div>
                <ExportButton leads={filteredLeads} niche={searchState.niche} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredLeads.map((lead) => (
                    <div key={lead.id} className="relative group">
                      <LeadCard lead={lead} />
                      <button 
                        onClick={() => handleCopy(lead)}
                        className="absolute top-2 right-2 p-2 bg-gray-900/90 text-gray-400 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity border border-gray-700 shadow-xl"
                        title="Copiar dados"
                      >
                        {copiedId === lead.id ? (
                          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                        )}
                      </button>
                    </div>
                ))}
                </div>

                {/* Sources / Attribution */}
                {sources.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-800">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Fontes de Inteligência</h3>
                    <div className="flex flex-wrap gap-2">
                    {sources.map((src, idx) => (
                        <a 
                        key={idx}
                        href={src.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white px-2 py-1 rounded border border-gray-800 transition-colors truncate max-w-xs block font-mono"
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
            {!loading && leads.length === 0 && !error && !rawResponseDebug && (
            <div className="text-center py-20 opacity-30 flex flex-col items-center">
                <svg className="w-24 h-24 text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-2xl font-black text-gray-400 uppercase tracking-tight">Aguardando Comando</p>
                <p className="text-sm text-gray-500 mt-2 font-mono">Inicie uma nova extração para visualizar dados.</p>
            </div>
            )}
        </div>

      </main>
    </div>
  );
}