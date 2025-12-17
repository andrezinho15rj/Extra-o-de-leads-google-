
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
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('winner_search_history');
    if (saved) setHistory(JSON.parse(saved));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.log("Geolocalização não disponível.")
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
    let score = 30; 
    if (lead.phone && lead.phone !== 'N/A') score += 20;
    if (lead.cnpj && lead.cnpj !== 'N/A') score += 50;
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
        id: `lead-${Math.random()}`, 
        name,
        cnpj: getField('CNPJ'),
        phone: getField('Telefone'),
        address: getField('Endereço'),
        rating: '4.0',
        winnerScore: 0
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
      setError("Por favor, preencha o nicho.");
      return;
    }

    setLoading(true);
    setLeads([]);
    setError(null);
    setStatusMessage('Iniciando Blitz Scan (Extração Direta)...');
    saveToHistory(niche, location);

    try {
      const response = await searchLeads(
        "", 
        niche, 
        location, 
        userCoords?.lat, 
        userCoords?.lng
      );
      
      const parsed = parseLeadsFromText(response.rawText);
      
      if (parsed.length === 0) {
        throw new Error("A IA não conseguiu formatar os dados. Tente um nicho mais genérico ou verifique sua conexão.");
      }

      setLeads(parsed.sort((a, b) => b.winnerScore - a.winnerScore));
      setStatusMessage('Extração concluída com sucesso!');
      
    } catch (err: any) {
      console.error("Erro na busca:", err);
      setError(`Falha na extração: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [searchState.niche, searchState.location, userCoords]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col font-sans">
      <header className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="bg-yellow-500 text-black px-3 py-1 rounded font-black">W</div>
          <h1 className="text-xl font-bold uppercase tracking-tight">Winner Extractor Gold</h1>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-4 lg:p-8">
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8 shadow-2xl">
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="O que busca? (ex: Academias)"
              value={searchState.niche}
              onChange={(e) => setSearchState(s => ({ ...s, niche: e.target.value }))}
              className="bg-gray-800 border border-gray-700 rounded-xl p-3 outline-none focus:border-yellow-500 transition-all"
            />
            <input
              type="text"
              placeholder="Onde? (ex: São Paulo)"
              value={searchState.location}
              onChange={(e) => setSearchState(s => ({ ...s, location: e.target.value }))}
              className="bg-gray-800 border border-gray-700 rounded-xl p-3 outline-none focus:border-yellow-500 transition-all"
            />
            <button 
              type="submit"
              disabled={loading}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl p-3 disabled:opacity-50 transition-all uppercase"
            >
              {loading ? 'Extraindo...' : 'Iniciar Extração'}
            </button>
          </form>

          {loading && (
            <div className="mt-6 animate-pulse">
              <div className="flex items-center gap-3 text-yellow-500">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="font-bold">{statusMessage}</span>
              </div>
            </div>
          )}
        </section>

        {error && (
          <div className="bg-red-900/30 border border-red-800 p-4 rounded-xl text-red-200 text-sm mb-8">
            <p className="font-bold mb-1">Erro Detectado:</p>
            <p>{error}</p>
          </div>
        )}

        {leads.length > 0 ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black">{leads.length} Leads Encontrados</h2>
              <ExportButton leads={leads} niche={searchState.niche} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leads.map(l => <LeadCard key={l.id} lead={l} />)}
            </div>
          </div>
        ) : !loading && (
          <div className="py-20 text-center opacity-30">
            <p>Nenhum resultado para exibir. Digite acima e clique em Extrair.</p>
          </div>
        )}
      </main>
    </div>
  );
}
