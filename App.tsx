
import React, { useState, useCallback, useEffect } from 'react';
import { searchLeadsHybrid } from './services/alternativeService';
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
  const [searchMode, setSearchMode] = useState<'hybrid' | 'alternative'>('hybrid');

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
      // Score simples
      leadData.winnerScore = (leadData.cnpj !== 'N/A' ? 50 : 0) + (leadData.phone !== 'N/A' ? 50 : 0);
      return leadData as BusinessLead;
    }).filter(l => l !== null) as BusinessLead[];
  };

  const handleSearch = useCallback(async (e?: React.FormEvent, hNiche?: string, hLoc?: string) => {
    if (e) e.preventDefault();
    
    const niche = hNiche || searchState.niche;
    const location = hLoc || searchState.location || 'Brasil';

    if (!niche) {
      setError("Por favor, digite o nicho.");
      return;
    }

    setLoading(true);
    setLeads([]);
    setError(null);
    setStatusMessage('Buscando dados (pode levar 10-20 segundos)...');
    saveToHistory(niche, location);

    try {
      if (searchMode === 'alternative') {
        const { searchLeadsAlternative } = await import('./services/alternativeService');
        const response = await searchLeadsAlternative(niche, location);
        const parsed = parseLeadsFromText(response.rawText);
        
        if (parsed.length === 0) {
          throw new Error("Nenhum dado formatado encontrado. Tente pesquisar de forma diferente.");
        }

        setLeads(parsed.sort((a, b) => b.winnerScore - a.winnerScore));
        setStatusMessage('Sucesso! (Busca sem API)');
      } else {
        const response = await searchLeadsHybrid("", niche, location);
        const parsed = parseLeadsFromText(response.rawText);
        
        if (parsed.length === 0) {
          throw new Error("Nenhum dado formatado encontrado. Tente pesquisar de forma diferente.");
        }

        setLeads(parsed.sort((a, b) => b.winnerScore - a.winnerScore));
        setStatusMessage('Sucesso!');
      }
      
    } catch (err: any) {
      console.error("Erro:", err);
      if (err.message.includes("429") || err.message.includes("quota")) {
        setError("Limite de cota excedido! A API gratuita do Google tem um limite de buscas por minuto. Por favor, aguarde 60 segundos e tente novamente.");
      } else {
        setError(`Falha: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [searchState.niche, searchState.location]);

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
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setSearchMode('hybrid')}
              className={`px-4 py-2 rounded-lg font-bold text-sm ${
                searchMode === 'hybrid' 
                  ? 'bg-yellow-500 text-black' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Busca Híbrida (API + Alternativa)
            </button>
            <button
              onClick={() => setSearchMode('alternative')}
              className={`px-4 py-2 rounded-lg font-bold text-sm ${
                searchMode === 'alternative' 
                  ? 'bg-yellow-500 text-black' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Busca Sem API (Ilimitada)
            </button>
          </div>
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Nicho (ex: Pizzarias)"
              value={searchState.niche}
              onChange={(e) => setSearchState(s => ({ ...s, niche: e.target.value }))}
              className="bg-gray-800 border border-gray-700 rounded-xl p-3 outline-none focus:border-yellow-500"
            />
            <input
              type="text"
              placeholder="Cidade (ex: Curitiba)"
              value={searchState.location}
              onChange={(e) => setSearchState(s => ({ ...s, location: e.target.value }))}
              className="bg-gray-800 border border-gray-700 rounded-xl p-3 outline-none focus:border-yellow-500"
            />
            <button 
              type="submit"
              disabled={loading}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl p-3 disabled:opacity-50 transition-all uppercase"
            >
              {loading ? 'Processando...' : 'Extrair Leads'}
            </button>
          </form>

          {loading && (
            <div className="mt-6 flex items-center gap-3 text-yellow-500">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="font-bold">{statusMessage}</span>
            </div>
          )}
        </section>

        {error && (
          <div className="bg-amber-900/40 border border-amber-800 p-4 rounded-xl text-amber-200 text-sm mb-8">
            <p className="font-bold flex items-center gap-2 mb-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Atenção:
            </p>
            <p>{error}</p>
          </div>
        )}

        {leads.length > 0 ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black">{leads.length} Resultados</h2>
              <ExportButton leads={leads} niche={searchState.niche} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leads.map(l => <LeadCard key={l.id} lead={l} />)}
            </div>
          </div>
        ) : !loading && (
          <div className="py-20 text-center opacity-30">
            <p>Os resultados aparecerão aqui.</p>
          </div>
        )}
      </main>
    </div>
  );
}
