import React, { useState } from 'react';

interface ExtractionConfig {
  segment: string;
  location: string;
  limit: number;
  sources: string[];
}

export const AdvancedExtractor: React.FC = () => {
  const [config, setConfig] = useState<ExtractionConfig>({
    segment: '',
    location: '',
    limit: 100,
    sources: ['google_maps']
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleExtraction = async () => {
    if (!config.segment || !config.location) {
      alert('Segmento e localização são obrigatórios');
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const response = await fetch('http://localhost:3002/api/leads/extract/google-maps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          segment: config.segment,
          location: config.location,
          limit: config.limit
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.results);
        alert(`Extração concluída! ${data.results.total_found} leads encontrados`);
      } else {
        const error = await response.json();
        alert(`Erro na extração: ${error.error}`);
      }
    } catch (error) {
      console.error('Erro na extração:', error);
      alert('Erro na extração de leads');
    } finally {
      setLoading(false);
    }
  };

  const toggleSource = (source: string) => {
    setConfig(prev => ({
      ...prev,
      sources: prev.sources.includes(source)
        ? prev.sources.filter(s => s !== source)
        : [...prev.sources, source]
    }));
  };

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      <h2 className="text-2xl font-bold text-white mb-6">🔍 Extração Avançada de Leads</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Configurações */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Segmento/Nicho
            </label>
            <input
              type="text"
              value={config.segment}
              onChange={(e) => setConfig(prev => ({ ...prev, segment: e.target.value }))}
              placeholder="Ex: Restaurantes, Clínicas, Lojas"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:border-yellow-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Localização
            </label>
            <input
              type="text"
              value={config.location}
              onChange={(e) => setConfig(prev => ({ ...prev, location: e.target.value }))}
              placeholder="Ex: São Paulo, Rio de Janeiro"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:border-yellow-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Limite de Leads
            </label>
            <select
              value={config.limit}
              onChange={(e) => setConfig(prev => ({ ...prev, limit: parseInt(e.target.value) }))}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"
            >
              <option value={50}>50 leads</option>
              <option value={100}>100 leads</option>
              <option value={200}>200 leads</option>
              <option value={500}>500 leads</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Fontes de Extração
            </label>
            <div className="space-y-2">
              {[
                { id: 'google_maps', name: 'Google Maps', available: true },
                { id: 'google_search', name: 'Google Search', available: false },
                { id: 'instagram', name: 'Instagram', available: false },
                { id: 'facebook', name: 'Facebook', available: false }
              ].map((source) => (
                <label key={source.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.sources.includes(source.id)}
                    onChange={() => toggleSource(source.id)}
                    disabled={!source.available}
                    className="mr-2 rounded border-gray-600 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
                  />
                  <span className={`text-sm ${source.available ? 'text-white' : 'text-gray-500'}`}>
                    {source.name} {!source.available && '(Em breve)'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-lg p-4">
            <h3 className="text-lg font-medium text-white mb-3">Status da Extração</h3>
            
            {loading && (
              <div className="flex items-center gap-3 text-yellow-500">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Extraindo leads...</span>
              </div>
            )}

            {results && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800 p-3 rounded">
                    <p className="text-gray-400 text-sm">Total Encontrado</p>
                    <p className="text-xl font-bold text-white">{results.total_found}</p>
                  </div>
                  <div className="bg-gray-800 p-3 rounded">
                    <p className="text-gray-400 text-sm">Novos Leads</p>
                    <p className="text-xl font-bold text-green-400">{results.savedCount}</p>
                  </div>
                  <div className="bg-gray-800 p-3 rounded">
                    <p className="text-gray-400 text-sm">Atualizados</p>
                    <p className="text-xl font-bold text-blue-400">{results.updatedCount}</p>
                  </div>
                  <div className="bg-gray-800 p-3 rounded">
                    <p className="text-gray-400 text-sm">Duplicados</p>
                    <p className="text-xl font-bold text-gray-400">{results.duplicatedCount}</p>
                  </div>
                </div>
              </div>
            )}

            {!loading && !results && (
              <p className="text-gray-400">Configure os parâmetros e clique em "Iniciar Extração"</p>
            )}
          </div>

          <button
            onClick={handleExtraction}
            disabled={loading || !config.segment || !config.location}
            className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold py-3 px-4 rounded-lg transition-colors"
          >
            {loading ? 'Extraindo...' : 'Iniciar Extração'}
          </button>
        </div>
      </div>
    </div>
  );
};