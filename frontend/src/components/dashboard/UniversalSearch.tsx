'use client';

import { useState, useEffect } from 'react';
import { Search, User, Building, FileText } from 'lucide-react';

export default function UniversalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Handle Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-32 bg-black/20 backdrop-blur-sm">
      
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={() => setIsOpen(false)}></div>
      
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-float border border-clinical-border overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
         
         {/* Search Input */}
         <div className="flex items-center px-4 py-4 border-b border-clinical-border">
            <Search className="text-clinical-muted mr-3" size={20} />
            <input 
              autoFocus
              type="text" 
              placeholder="Search patients, hospitals, ABHA numbers..."
              className="flex-1 bg-transparent border-none outline-none text-lg text-clinical-text placeholder-gray-400"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded text-xs font-medium text-gray-500">
               ESC
            </kbd>
         </div>

         {/* Results Area */}
         <div className="max-h-[60vh] overflow-y-auto p-2">
            
            <div className="px-3 py-2 text-xs font-semibold text-clinical-muted uppercase tracking-wider">
               Patients
            </div>
            <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left group">
               <div className="w-8 h-8 rounded-full bg-blue-50 text-clinical-blue flex items-center justify-center">
                 <User size={14} />
               </div>
               <div className="flex-1">
                 <p className="text-sm font-medium text-clinical-text group-hover:text-clinical-blue transition-colors">Eleanor Vance</p>
                 <p className="text-xs text-clinical-muted">ABHA: 91-4924-1924-8842</p>
               </div>
            </button>

            <div className="px-3 py-2 mt-2 text-xs font-semibold text-clinical-muted uppercase tracking-wider">
               Hospitals
            </div>
            <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left group">
               <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                 <Building size={14} />
               </div>
               <div className="flex-1">
                 <p className="text-sm font-medium text-clinical-text group-hover:text-emerald-600 transition-colors">General Hospital</p>
                 <p className="text-xs text-clinical-muted">ID: HOSP-1029 • Seattle, WA</p>
               </div>
            </button>
            
            <div className="px-3 py-2 mt-2 text-xs font-semibold text-clinical-muted uppercase tracking-wider">
               Audit Logs
            </div>
            <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left group">
               <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
                 <FileText size={14} />
               </div>
               <div className="flex-1">
                 <p className="text-sm font-medium text-clinical-text group-hover:text-gray-900 transition-colors">Merge Record AL-9021</p>
                 <p className="text-xs text-clinical-muted">Approved by Dr. Kim</p>
               </div>
            </button>

         </div>
      </div>
    </div>
  );
}
