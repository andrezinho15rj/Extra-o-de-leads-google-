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
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [isDeepScan, setIsDeepScan] = useState(true);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('winner_search_history');
    if (saved) setHistory(JSON.parse(saved));
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
    if (rating >= 4.5) score += 30;
    else if (rating >= 4.0) score += 15;
    if (lead.phone && lead.phone !== 'N/A') score += 20;
    if (lead.instagram && lead.instagram !== 'N/A') score += 15;
    if (lead.website && lead.website !== 'N/A') score += 15;
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
    const location = hLoc || searchState.location;
    if (!apiKey || !niche || !location) return;

    setLoading(true);
    setProgress(0);
    setError(null);
    setLeads([]);
    setStatusMessage('Iniciando Varredura Winner Gold...');
    saveToHistory(niche, location);

    // Estratégias para buscar 100+ leads (8 lotes x ~15-20 leads)
    const strategies = isDeepScan ? [
      "Top 20 empresas mais bem avaliadas no Google Maps.",
      "Empresas localizadas nas avenidas principais da região.",
      "Empresas com forte presença no Instagram e redes sociais.",
      "Empresas em bairros periféricos e adjacentes.",
      "Resultados gerais de busca orgânica no Google Search.",
      "Empresas recém-abertas ou com menos avaliações.",
      "Empresas que possuem sites oficiais ativos.",
      "Busca por diretórios locais e guias da cidade."
    ] : [
      "Top empresas mais bem avaliadas.",
      "Busca geral no Google Maps."
    ];

    const allLeadsMap = new Map<string, BusinessLead>();
    const allSourcesMap = new Map<string, {title: string, uri: string}>();

    try {
      for (let i = 0; i < strategies.length; i++) {
        const currentProgress = Math.round((i / strategies.length) * 100);
        setProgress(currentProgress);
        setStatusMessage(`Lote ${i + 1}/${strategies.length}: ${strategies[i]}`);

        try {
          const response = await searchLeads(apiKey, niche, location, undefined, undefined, strategies[i]);
          const newLeads = parseLeadsFromText(response.rawText);

          newLeads.forEach(lead => {
            const key = lead.phone.replace(/\D/g, '') || lead.name.toLowerCase();
            if (!allLeadsMap.has(key)) {
              allLeadsMap.set(key, lead);
            }
          });

          response.groundingChunks.forEach(chunk => {
            if (chunk.web?.uri) allSourcesMap.set(chunk.web.uri, { title: chunk.web.title || 'Web', uri: chunk.web.uri });
            if (chunk.maps?.uri) allSourcesMap.set(chunk.maps.uri, { title: chunk.maps.title || 'Maps', uri: chunk.maps.uri });
          });

          // Atualiza a lista em tempo real para o usuário ver
          setLeads(Array.from(allLeadsMap.values()).sort((a, b) => b.winnerScore - a.winnerScore));
          setSources(Array.from(allSourcesMap.values()));

          // Delay de segurança anti-quota (plano gratuito precisa de respiro)
          if (i < strategies.length - 1) {
            setStatusMessage(`Esfriando API por 12s para evitar bloqueio...`);
            await new Promise(r => setTimeout(r, 12000));
          }
        } catch (err) {
          console.error(`Erro no lote ${i}:`, err);
        }
      }
      setProgress(100);
      setStatusMessage(`Extração Finalizada: ${allLeadsMap.size} leads coletados.`);
    } catch (err: any) {
      setError("Erro durante a prospecção profunda.");
    } finally {
      setLoading(false);
    }
  }, [searchState, apiKey, history, isDeepScan]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center font-black text-black">W</div>
            <h1 className="text-xl font-black uppercase winner-gradient tracking-tighter">Winner Extractor Gold</h1>
          </div>
          <div className="flex items-center gap-4">
             <label className="flex items-center gap-2 cursor-pointer bg-gray-800 px-3 py-1.5 rounded-full border border-gray-700">
                <span className="text-xs font-bold text-gray-400">VARREDURA 100+</span>
                <input 
                  type="checkbox" 
                  checked={isDeepScan} 
                  onChange={() => setIsDeepScan(!isDeepScan)} 
                  className="sr-only peer"
                />
                <div className="relative w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500"></div>
             </label>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1 space-y-4">
          <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Histórico de Busca</h3>
            <div className="space-y-2">
              {history.map((h, i) => (
                <button key={i} onClick={() => handleSearch(undefined, h.niche, h.location)} className="w-full text-left p-2 text-xs hover:bg-gray-800 rounded truncate block border border-transparent hover:border-gray-700 transition-all">
                  <span className="text-yellow-500 font-bold">{h.niche}</span> em {h.location}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="lg:col-span-3">
          <section className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-2xl mb-8">
            <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <input
                  type="text"
                  placeholder="O que buscar? (Ex: Pizzarias)"
                  value={searchState.niche}
                  onChange={(e) => setSearchState(s => ({ ...s, niche: e.target.value }))}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm focus:border-yellow-500 outline-none"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <input
                  type="text"
                  placeholder="Onde? (Ex: São Paulo)"
                  value={searchState.location}
                  onChange={(e) => setSearchState(s => ({ ...s, location: e.target.value }))}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm focus:border-yellow-500 outline-none"
                  required
                />
              </div>
              <button disabled={loading} className="bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-lg p-3 text-sm transition-all shadow-lg shadow-yellow-900/20 disabled:opacity-50">
                {loading ? 'BUSCANDO...' : 'EXTRAIR LEADS'}
              </button>
            </form>

            {loading && (
              <div className="mt-6 space-y-2">
                <div className="flex justify-between text-xs font-bold text-yellow-500 uppercase">
                  <span>{statusMessage}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-950 h-3 rounded-full border border-gray-800 overflow-hidden">
                  <div className="bg-yellow-500 h-full transition-all duration-1000 shadow-[0_0_15px_rgba(234,179,8,0.4)]" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="text-[10px] text-gray-500 text-center animate-pulse">A extração profunda de 100 leads pode levar até 3 minutos devido aos limites da API gratuita.</p>
              </div>
            )}
          </section>

          {error && <div className="bg-red-900/20 border border-red-800 p-4 rounded-xl text-red-400 text-xs mb-8">{error}</div>}

          {leads.length > 0 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                <div>
                  <span className="text-3xl font-black text-white">{leads.length}</span>
                  <span className="text-xs text-gray-500 ml-2 uppercase font-bold tracking-widest">Leads Minerados</span>
                </div>
                <ExportButton leads={leads} niche={searchState.niche} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {leads.map(l => <LeadCard key={l.id} lead={l} />)}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}