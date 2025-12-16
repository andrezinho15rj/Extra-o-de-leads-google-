import React from 'react';
import { BusinessLead } from '../types';

interface LeadCardProps {
  lead: BusinessLead;
}

export const LeadCard: React.FC<LeadCardProps> = ({ lead }) => {
  const isPhoneAvailable = lead.phone && lead.phone !== 'N/A' && lead.phone.toLowerCase() !== 'não disponível';

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg hover:border-blue-500 transition-colors duration-200 flex flex-col justify-between">
      <div>
        <h3 className="text-xl font-bold text-white mb-2 truncate" title={lead.name}>
          {lead.name}
        </h3>
        
        <div className="space-y-2 text-sm text-gray-300">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="break-words">{lead.address}</span>
          </div>

          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <span>{lead.rating || 'N/A'}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700 flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-gray-900 p-2 rounded-lg border border-gray-700">
          <svg className={`w-5 h-5 ${isPhoneAvailable ? 'text-green-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <span className={`font-mono text-sm ${isPhoneAvailable ? 'text-white' : 'text-gray-500 italic'}`}>
            {lead.phone}
          </span>
        </div>
        
        {lead.website && lead.website !== 'N/A' && (
           <a 
             href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} 
             target="_blank" 
             rel="noreferrer"
             className="text-center text-sm bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors"
           >
             Visitar Site
           </a>
        )}
      </div>
    </div>
  );
};