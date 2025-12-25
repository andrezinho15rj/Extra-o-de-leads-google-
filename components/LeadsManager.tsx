import React, { useState, useEffect } from 'react';

interface Lead {
  id: string;
  name: string;
  company_name: string;
  phone: string;
  email: string;
  city: string;
  segment: string;
  stage: string;
  temperature: string;
  icp_score: number;
  created_at: string;
  last_contact_date?: string;
}

export const LeadsManager: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    stage: '',
    temperature: '',
    segment: '',
    search: ''
  });
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  useEffect(() => {
    fetchLeads();
  }, [filters]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`http://localhost:3002/api/leads?${params}`);
      if (response.ok) {
        const data = await response.json();
        setLeads(data.leads);
      }
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateLeadStage = async (leadId: string, newStage: string) => {
    try {
      const response = await fetch(`http://localhost:3002/api/leads/${leadId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stage: newStage })
      });

      if (response.ok) {
        fetchLeads();
        alert('Lead atualizado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao atualizar lead:', error);
      alert('Erro ao atualizar lead');
    }
  };

  const startSequence = async (leadId: string) => {
    try {
      const response = await fetch('http://localhost:3002/api/sdr/sequences/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ leadId })
      });

      if (response.ok) {
        alert('Sequência de contato iniciada!');
        fetchLeads();
      }
    } catch (error) {
      console.error('Erro ao iniciar sequência:', error);
      alert('Erro ao iniciar sequência');
    }
  };

  const getStageColor = (stage: string) => {
    const colors = {
      'new': 'bg-blue-500/20 text-blue-400',
      'contacted': 'bg-yellow-500/20 text-yellow-400',
      'qualified': 'bg-green-500/20 text-green-400',
      'opportunity': 'bg-purple-500/20 text-purple-400',
      'customer': 'bg-emerald-500/20 text-emerald-400',
      'lost': 'bg-red-500/20 text-red-400'
    };
    return colors[stage as keyof typeof colors] || 'bg-gray-500/20 text-gray-400';
  };

  const getTemperatureColor = (temperature: string) => {
    const colors = {
      'hot': 'text-red-400',
      'warm': 'text-yellow-400',
      'cold': 'text-blue-400'
    };
    return colors[temperature as keyof typeof colors] || 'text-gray-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">📋 Gestão de Leads</h1>
        <div className="text-sm text-gray-400">
          {leads.length} leads encontrados
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-medium text-white mb-4">Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Buscar</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder="Nome ou empresa..."
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-300 mb-1">Estágio</label>
            <select
              value={filters.stage}
              onChange={(e) => setFilters(prev => ({ ...prev, stage: e.target.value }))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            >
              <option value="">Todos</option>
              <option value="new">Novo</option>
              <option value="contacted">Contatado</option>
              <option value="qualified">Qualificado</option>
              <option value="opportunity">Oportunidade</option>
              <option value="customer">Cliente</option>
              <option value="lost">Perdido</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Temperatura</label>
            <select
              value={filters.temperature}
              onChange={(e) => setFilters(prev => ({ ...prev, temperature: e.target.value }))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            >
              <option value="">Todas</option>
              <option value="hot">Quente</option>
              <option value="warm">Morno</option>
              <option value="cold">Frio</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Segmento</label>
            <input
              type="text"
              value={filters.segment}
              onChange={(e) => setFilters(prev => ({ ...prev, segment: e.target.value }))}
              placeholder="Segmento..."
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            />
          </div>
        </div>
      </div>

      {/* Lista de Leads */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="text-left p-4 text-gray-300 font-medium">Lead</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Empresa</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Contato</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Estágio</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Temp.</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Score</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-t border-gray-700 hover:bg-gray-750">
                    <td className="p-4">
                      <div>
                        <p className="text-white font-medium">{lead.name}</p>
                        <p className="text-gray-400 text-sm">{lead.city}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="text-white">{lead.company_name}</p>
                        <p className="text-gray-400 text-sm">{lead.segment}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        {lead.phone && <p className="text-white">{lead.phone}</p>}
                        {lead.email && <p className="text-gray-400">{lead.email}</p>}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStageColor(lead.stage)}`}>
                        {lead.stage}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`font-medium ${getTemperatureColor(lead.temperature)}`}>
                        {lead.temperature}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{lead.icp_score}</span>
                        <div className="w-16 bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-yellow-500 h-2 rounded-full" 
                            style={{ width: `${lead.icp_score}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => startSequence(lead.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs"
                        >
                          Sequência
                        </button>
                        <select
                          value={lead.stage}
                          onChange={(e) => updateLeadStage(lead.id, e.target.value)}
                          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs"
                        >
                          <option value="new">Novo</option>
                          <option value="contacted">Contatado</option>
                          <option value="qualified">Qualificado</option>
                          <option value="opportunity">Oportunidade</option>
                          <option value="customer">Cliente</option>
                          <option value="lost">Perdido</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};