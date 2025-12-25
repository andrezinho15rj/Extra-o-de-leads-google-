import React, { useState, useEffect } from 'react';

interface DashboardStats {
  total_leads: number;
  new_leads: number;
  contacted_leads: number;
  qualified_leads: number;
  hot_leads: number;
  avg_icp_score: number;
}

interface PipelineStage {
  id: string;
  name: string;
  leads: any[];
  count: number;
}

export const SDRDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsResponse, pipelineResponse] = await Promise.all([
        fetch('http://localhost:3002/api/crm/dashboard'),
        fetch('http://localhost:3002/api/crm/pipeline')
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.overview);
      }

      if (pipelineResponse.ok) {
        const pipelineData = await pipelineResponse.json();
        setPipeline(pipelineData.stages);
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const qualifyLeads = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/sdr/qualify', {
        method: 'POST'
      });
      
      if (response.ok) {
        alert('Qualificação de leads executada com sucesso!');
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Erro na qualificação:', error);
      alert('Erro na qualificação de leads');
    }
  };

  const executeSequences = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/sdr/sequences/execute', {
        method: 'POST'
      });
      
      if (response.ok) {
        alert('Sequências executadas com sucesso!');
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Erro na execução:', error);
      alert('Erro na execução de sequências');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">🤖 SDR Automatizado</h1>
        <div className="flex gap-3">
          <button
            onClick={qualifyLeads}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            Qualificar Leads
          </button>
          <button
            onClick={executeSequences}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            Executar Sequências
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total de Leads</p>
                <p className="text-2xl font-bold text-white">{stats.total_leads}</p>
              </div>
              <div className="bg-blue-500/20 p-3 rounded-lg">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Leads Quentes</p>
                <p className="text-2xl font-bold text-red-400">{stats.hot_leads}</p>
              </div>
              <div className="bg-red-500/20 p-3 rounded-lg">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Contatados</p>
                <p className="text-2xl font-bold text-green-400">{stats.contacted_leads}</p>
              </div>
              <div className="bg-green-500/20 p-3 rounded-lg">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Score Médio</p>
                <p className="text-2xl font-bold text-yellow-400">{Math.round(stats.avg_icp_score || 0)}</p>
              </div>
              <div className="bg-yellow-500/20 p-3 rounded-lg">
                <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Kanban */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-xl font-bold text-white mb-6">Pipeline de Vendas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {pipeline.map((stage) => (
            <div key={stage.id} className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-white text-sm">{stage.name}</h3>
                <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full">
                  {stage.count}
                </span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {stage.leads.slice(0, 5).map((lead, index) => (
                  <div key={index} className="bg-gray-800 p-3 rounded border border-gray-600">
                    <p className="text-white text-sm font-medium truncate">{lead.name}</p>
                    <p className="text-gray-400 text-xs truncate">{lead.company_name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        lead.temperature === 'hot' ? 'bg-red-500/20 text-red-400' :
                        lead.temperature === 'warm' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {lead.temperature}
                      </span>
                      <span className="text-xs text-gray-400">{lead.icp_score}</span>
                    </div>
                  </div>
                ))}
                {stage.leads.length > 5 && (
                  <p className="text-gray-500 text-xs text-center">
                    +{stage.leads.length - 5} mais
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};