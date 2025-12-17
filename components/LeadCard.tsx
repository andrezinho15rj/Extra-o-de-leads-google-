import React from 'react';
import { BusinessLead } from '../types';

interface LeadCardProps {
  lead: BusinessLead;
}

export const LeadCard: React.FC<LeadCardProps> = ({ lead }) => {
  const isPhoneAvailable = lead.phone && lead.phone !== 'N/A' && lead.phone.toLowerCase() !== 'não disponível';
  
  // Limpa o telefone para o link do WhatsApp
  const cleanPhone = lead.phone.replace(/\D/g, '');
  const whatsappUrl = isPhoneAvailable 
    ? `https://wa.me/55${cleanPhone.length >= 10 && !cleanPhone.startsWith('55') ? '55' + cleanPhone : cleanPhone}?text=Olá, encontrei a ${encodeURIComponent(lead.name)} no Google e gostaria de mais informações.` 
    : null;

  // Cor do Score
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400 border-green-500/50 bg-green-500/10';
    if (score >= 50) return 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10';
    return 'text-red-400 border-red-500/50 bg-red-500/10';
  };

  return (
    <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700 rounded-xl p-5 shadow-lg hover:border-yellow-500/50 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
      
      {/* Glow Effect on Hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>

      <div>
        <div className="flex justify-between items-start mb-3">
            <h3 className="text-xl font-bold text-white truncate pr-2 flex-1" title={lead.name}>
            {lead.name}
            </h3>
            <div className={`flex flex-col items-center justify-center px-2 py-1 rounded border ${getScoreColor(lead.winnerScore)}`}>
                <span className="text-xs font-bold uppercase tracking-wider opacity-80">Score</span>
                <span className="text-lg font-black leading-none">{lead.winnerScore}</span>
            </div>
        </div>
        
        <div className="space-y-2 text-sm text-gray-300">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-gray-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="break-words line-clamp-2 text-xs">{lead.address}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex text-yellow-400">
               {[...Array(5)].map((_, i) => (
                   <svg key={i} className={`w-3 h-3 ${i < Math.round(parseFloat(lead.rating || '0')) ? 'fill-current' : 'text-gray-600'}`} viewBox="0 0 20 20" fill="currentColor">
                       <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                   </svg>
               ))}
            </div>
            <span className="text-xs text-gray-400">({lead.rating || 'N/A'})</span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700/50 flex flex-col gap-2">
        {/* Contact Info Row */}
        <div className="flex items-center justify-between gap-2">
             <div className="flex items-center gap-2 overflow-hidden">
                <svg className={`w-4 h-4 ${isPhoneAvailable ? 'text-green-400' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className={`font-mono text-xs ${isPhoneAvailable ? 'text-gray-200' : 'text-gray-600'}`}>
                    {lead.phone}
                </span>
             </div>
             
             {/* Social Icons */}
             <div className="flex items-center gap-2 shrink-0">
                {lead.instagram && lead.instagram !== 'N/A' && (
                    <a href={lead.instagram} target="_blank" rel="noreferrer" className="text-pink-500 hover:text-pink-400 transition-colors" title="Instagram">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                    </a>
                )}
                {lead.facebook && lead.facebook !== 'N/A' && (
                    <a href={lead.facebook} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-400 transition-colors" title="Facebook">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>
                    </a>
                )}
                {lead.website && lead.website !== 'N/A' && (
                    <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="text-blue-300 hover:text-white transition-colors" title="Website">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                    </a>
                )}
             </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-2">
            {whatsappUrl ? (
                <a 
                    href={whatsappUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg transition-colors text-sm font-medium shadow-lg shadow-green-900/20"
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-8.68-2.031-.967-.272-.099-.47-.149-.669.198-.198.347-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.173.198-.297.298-.495.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/></svg>
                    WhatsApp
                </a>
            ) : (
                <button disabled className="flex items-center justify-center gap-2 bg-gray-700 text-gray-500 py-2 rounded-lg text-sm font-medium cursor-not-allowed">
                    Sem Zap
                </button>
            )}

            <a 
                href={`mailto:${lead.email && lead.email !== 'N/A' ? lead.email : ''}`}
                className={`flex items-center justify-center gap-2 border ${lead.email && lead.email !== 'N/A' ? 'border-gray-500 hover:bg-gray-700 text-gray-300' : 'border-gray-800 text-gray-600 cursor-not-allowed'} py-2 rounded-lg transition-colors text-sm font-medium`}
            >
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                 Email
            </a>
        </div>
      </div>
    </div>
  );
};