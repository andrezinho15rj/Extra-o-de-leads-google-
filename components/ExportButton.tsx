import React from 'react';
import { BusinessLead } from '../types';

interface ExportButtonProps {
  leads: BusinessLead[];
}

export const ExportButton: React.FC<ExportButtonProps> = ({ leads }) => {
  const handleExport = () => {
    if (leads.length === 0) return;

    const headers = ['Nome', 'Telefone', 'Endereço', 'Avaliação', 'Site'];
    const csvContent = [
      headers.join(','),
      ...leads.map(lead => {
        return [
          `"${lead.name}"`,
          `"${lead.phone}"`,
          `"${lead.address}"`,
          `"${lead.rating}"`,
          `"${lead.website}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button
      onClick={handleExport}
      disabled={leads.length === 0}
      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Exportar CSV
    </button>
  );
};