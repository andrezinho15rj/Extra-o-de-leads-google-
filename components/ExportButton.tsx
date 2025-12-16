import React from 'react';
import { BusinessLead } from '../types';

interface ExportButtonProps {
  leads: BusinessLead[];
  niche: string;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ leads, niche }) => {
  const handleExport = () => {
    if (leads.length === 0) return;

    // Colunas exatas solicitadas: name, number, email, tags, carteira
    const headers = ['name', 'number', 'email', 'tags', 'carteira'];
    
    const csvContent = [
      headers.join(';'), // Ponto e vírgula é recomendado para Excel em Português
      ...leads.map(lead => {
        // Função auxiliar para escapar aspas duplas dentro do conteúdo
        const sanitize = (str: string = '') => `"${str.replace(/"/g, '""')}"`;
        
        // Formatar telefone: remover tudo que não for dígito
        let cleanPhone = lead.phone.replace(/\D/g, '');
        // Adicionar 55 se o número tiver tamanho de celular/fixo BR (10 ou 11 dígitos) e não começar com 55 (simples heurística)
        if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
            cleanPhone = '55' + cleanPhone;
        }

        const email = (lead.email && lead.email !== 'N/A') ? lead.email : '';

        return [
          sanitize(lead.name),
          sanitize(cleanPhone),    // number: formatado
          sanitize(email),         // email
          sanitize(niche),         // tags: preenchido com o nicho
          sanitize('')             // carteira: deixado vazio conforme solicitação (usuário pode preencher depois)
        ].join(';');
      })
    ].join('\n');

    // Adiciona BOM (\uFEFF) para garantir que o Excel reconheça os acentos (UTF-8)
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    // Nome do arquivo limpo e com data
    const safeNiche = niche.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.setAttribute('download', `leads_${safeNiche}_${new Date().toISOString().slice(0, 10)}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button
      onClick={handleExport}
      disabled={leads.length === 0}
      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Exportar para Importação
    </button>
  );
};