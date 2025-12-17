
import React, { useState, useCallback, useEffect } from 'react';
import { searchLeads } from './services/geminiService';
import { BusinessLead, SearchState, SearchHistoryItem } from './types';
import { LeadCard } from './components/LeadCard';
import { ExportButton } from './components/ExportButton';

export default function App() {
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
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [isDeepScan, setIsDeepScan] = useState(true);
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('winner_search_history');
    if (saved) setHistory(JSON.parse(saved));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.log("Geolocalização não permitida.")
      );
    }
  }, []);

  const saveToHistory = (niche: string, location: string) => {
    const newItem = { niche, location, date: new Date().toISOString() };
    const newHistory = [newItem, ...history.filter(h => h.niche !== niche || h.location !== location)].slice(0, 5);
    setHistory(newHistory);
    localStorage.setItem('winner_search_history', JSON.stringify(newHistory));
  };

  const calculateWinnerScore = (lead: Partial<BusinessLead>): number => {
    let score = 20; 
    const rating = parseFloat(lead.rating || '0');
    if (rating >= 4.5) score += 20;
    if (lead.phone && lead.phone !== 'N/A') score += 15;
    if (lead.cnpj && lead.cnpj !== 'N/A') score += 25;
    if (lead.instagram && lead.instagram !== 'N/A') score += 10;
    if (lead.website && lead.website !== 'N/A') score += 10;
    return Math.min(score, 100);
  };

  const parseLeadsFromText = (text: string): BusinessLead[] => {
    if (!text) return [];
    const chunks = text.split(/---/).map(c => c.trim()).filter(c => c.length > 20); 
    return chunks.map((chunk) => {
      const getField = (keyword: string) => {
        const regex = new RegExp(`${keyword}[:\\*]*\\s*(.*)`, 'i');
        const match = chunk.match(regex);
        return match ? match[1].replace(/\*\*/g, '').trim() : 'N/A';
      };
      const name = getField('Nome');
      if (!name || name === 'N/A') return null;
      const leadData: Partial<BusinessLead> = {
        id: `lead-${Date.now()}-${Math.random()}`, 
        name,
        cnpj: getField('CNPJ'),
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
    }).filter(l => l !== null) as BusinessLead[];
  };

  const handleSearch = useCallback(async (e?: React.FormEvent, hNiche?: string, hLoc?: string) => {
    if (e) e.preventDefault();
    
    const niche = hNiche || searchState.niche;
    const location = hLoc || searchState.location || 'Brasil';

    if (!niche) {
      setError("Digite o nicho.");
      return;
    }

    setLoading(true);
    setLeads([]);
    setProgress(10);
    setError(null);
    setStatusMessage('Minerando em paralelo...');
    saveToHistory(niche, location);

    const strategies = isDeepScan 
      ? ["Busca Geral e Google Maps", "Redes Sociais e CNPJs"] 
      : ["Busca Rápida Expressa"];

    const allLeadsMap = new Map<string, BusinessLead>();

    try {
      // EXECUÇÃO EM PARALELO: Dispara todas as estratégias de uma vez
      const promises = strategies.map(async (strategy) => {
        try {
          const response = await searchLeads(
            "", 
            niche, 
            location, 
            userCoords?.lat, 
            userCoords?.lng, 
            strategy
          );
          const newLeads = parseLeadsFromText(response.rawText);
          return newLeads;
        } catch (err) {
          console.warn("Falha em uma das estratégias paralelas", err);
          return [];
        }
      });

      const results = await Promise.all(promises);
      
      results.flat().forEach(lead => {
        const key = lead.cnpj && lead.cnpj !== 'N/A' ? lead.cnpj : (lead.phone.replace(/\D/g, '') || lead.name.toLowerCase().trim());
        if (!allLeadsMap.has(key)) {
          allLeadsMap.set(key, lead);
        }
      });

      const finalLeads = Array.from(allLeadsMap.values()).sort((a, b) => b.winnerScore - a.winnerScore);
      setLeads(finalLeads);
      setProgress(100);
      setStatusMessage(finalLeads.length > 0 ? 'Extração concluída!' : 'Nenhum lead encontrado.');
      
    } catch (err: any) {
      console.error("Erro geral na busca:", err);
      setError(`Falha: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [searchState.niche, searchState.location, isDeepScan, userCoords]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col selection:bg-yellow-500 selection:text-black">
      <header className="bg-gray-900 border-b border-gray-800 p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center font-black text-black shadow-lg shadow-yellow-900/20 text-xl">W</div>
            <h1 className="text-xl font-black uppercase tracking-tighter">Winner Extractor Gold</h1>
          </div>
          <div className="flex items-center gap-4">
             <label className="flex items-center gap-2 cursor-pointer bg-gray-900/50 px-3 py-1.5 rounded-full border border-gray-800">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Multi-Scanner</span>
                <input 
                  type="checkbox" 
                  checked={isDeepScan} 
                  onChange={() => setIsDeepScan(!isDeepScan)} 
                  className="sr-only peer"
                />
                <div className="relative w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500"></div>
             </label>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1 hidden lg:block">
          <div className="bg-gray-900 p-5 rounded-xl border border-gray-800 shadow-xl">
            <h3 className="text-[10px] font-black text-gray-500 uppercase mb-4 tracking-widest">Buscas Recentes</h3>
            <div className="space-y-3">
              {history.length === 0 ? (
                <p className="text-xs text-gray-600 italic">Vazio.</p>
              ) : (
                history.map((h, i) => (
                  <button key={i} onClick={() => handleSearch(undefined, h.niche, h.location)} className="w-full text-left p-3 text-xs bg-gray-950/50 hover:bg-gray-800 rounded-lg truncate border border-gray-800 transition-all">
                    <span className="text-yellow-500 font-bold block">{h.niche}</span>
                    <span className="text-gray-500">{h.location}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>

        <div className="lg:col-span-3">
          <section className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-2xl mb-8 relative overflow-hidden">
            <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-yellow-500 uppercase ml-1 mb-1 block">Nicho</label>
                <input
                  type="text"
                  placeholder="Ex: Clínicas"
                  value={searchState.niche}
                  onChange={(e) => setSearchState(s => ({ ...s, niche: e.target.value }))}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm outline-none focus:border-yellow-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-yellow-500 uppercase ml-1 mb-1 block">Local</label>
                <input
                  type="text"
                  placeholder="Cidade"
                  value={searchState.location}
                  onChange={(e) => setSearchState(s => ({ ...s, location: e.target.value }))}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm outline-none focus:border-yellow-500"
                />
              </div>
              <div className="flex items-end">
                <button 
                  type="submit"
                  disabled={loading} 
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl p-3 text-sm transition-all disabled:opacity-50"
                >
                  {loading ? 'BUSCANDO...' : 'EXTRAIR'}
                </button>
              </div>
            </form>

            {loading && (
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                   <span className="text-[10px] font-black text-yellow-500 uppercase animate-pulse">{statusMessage}</span>
                   <span className="text-xs font-bold text-white">Isso levará segundos...</span>
                </div>
                <div className="w-full bg-gray-950 h-1.5 rounded-full overflow-hidden border border-gray-800">
                  <div className="bg-yellow-500 h-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            )}
          </section>

          {error && (
            <div className="bg-red-900/20 border border-red-800 p-4 rounded-xl text-red-400 text-xs mb-8">
               <p>{error}</p>
               <button onClick={() => handleSearch()} className="mt-2 underline font-bold">Tentar novamente</button>
            </div>
          )}

          {leads.length > 0 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-gray-900/40 p-4 rounded-xl border border-gray-800">
                <span className="text-xl font-black text-white">{leads.length} Leads</span>
                <ExportButton leads={leads} niche={searchState.niche} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {leads.map(l => <LeadCard key={l.id} lead={l} />)}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
