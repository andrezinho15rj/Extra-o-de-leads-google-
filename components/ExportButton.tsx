
import React from 'react';
import { BusinessLead } from '../types';

interface ExportButtonProps {
  leads: BusinessLead[];
  niche: string;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ leads, niche }) => {
  const handleExport = () => {
    if (leads.length === 0) return;

    const headers = ['name', 'cnpj', 'number', 'email', 'tags', 'instagram', 'facebook', 'website', 'winner_score', 'rating'];
    
    const csvContent = [
      headers.join(';'), 
      ...leads.map(lead => {
        const sanitize = (str: string = '') => `"${str.replace(/"/g, '""')}"`;
        
        let cleanPhone = lead.phone.replace(/\D/g, '');
        if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
            cleanPhone = '55' + cleanPhone;
        }

        const email = (lead.email && lead.email !== 'N/A') ? lead.email : '';
        const cnpj = (lead.cnpj && lead.cnpj !== 'N/A') ? lead.cnpj : '';
        const insta = (lead.instagram && lead.instagram !== 'N/A') ? lead.instagram : '';
        const fb = (lead.facebook && lead.facebook !== 'N/A') ? lead.facebook : '';
        const web = (lead.website && lead.website !== 'N/A') ? lead.website : '';

        return [
          sanitize(lead.name),
          sanitize(cnpj),
          sanitize(cleanPhone),    
          sanitize(email),         
          sanitize(niche),         
          sanitize(insta),
          sanitize(fb),
          sanitize(web),
          sanitize(lead.winnerScore.toString()),
          sanitize(lead.rating || '')
        ].join(';');
      })
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const safeNiche = niche.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.setAttribute('download', `winner_leads_${safeNiche}_${new Date().toISOString().slice(0, 10)}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button
      onClick={handleExport}
      disabled={leads.length === 0}
      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-700 to-emerald-600 hover:from-green-600 hover:to-emerald-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold shadow-lg shadow-green-900/20 text-sm uppercase tracking-wide"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Exportar CSV
    </button>
  );
};
