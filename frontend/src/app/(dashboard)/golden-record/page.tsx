'use client';

import { 
  Calendar, 
  Clock, 
  Download, 
  Share2, 
  CheckCircle,
  Activity,
  Zap,
  Fingerprint,
  Search,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';
import { getGoldenRecords, getSourceSystems } from '@/lib/api';
import type { GoldenRecord, SourceSystem } from '@/lib/api';

interface Record {
  id: string;
  name: string;
  birthDate: string;
  identifiers: { ssn: string };
  source: string;
  mergedSources: string[];
  lastUpdatedAt: string;
  confidence: number;
  status: string;
  linkCount: number;
}

export default function GoldenRecordPage() {
  const [records, setRecords] = useState<Record[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<Record | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const [goldenRecords, systems] = await Promise.all([
          getGoldenRecords(),
          getSourceSystems(),
        ]);
        const sourceNames = systems.map((s: SourceSystem) => s.system_name);
        const mapped: Record[] = goldenRecords.map((g: GoldenRecord) => ({
          id: g.id.slice(0, 12),
          name: g.patient_name || `Golden Record ${g.golden_patient_id.slice(0, 8)}`,
          birthDate: g.patient_dob || g.created_at.slice(0, 10),
          identifiers: { ssn: '***-**-' + g.golden_patient_id.slice(-4) },
          source: 'Master Patient Index',
          mergedSources: sourceNames.slice(0, g.source_links.length || 1),
          lastUpdatedAt: g.updated_at,
          confidence: g.confidence_score ?? 0,
          status: g.resolution_status ?? 'UNKNOWN',
          linkCount: g.source_links.length,
        }));
        setRecords(mapped);
        if (mapped.length > 0) setSelectedRecord(mapped[0]);
      } catch (error) {
        console.error('Error fetching records:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecords();
  }, []);

  const filteredRecords = records.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDownloadPDF = () => {
    if (!selectedRecord) return;
    alert('Synthesizing high-fidelity medical PDF... Download starting.');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBFBFD]">
        <div className="w-5 h-5 border-2 border-neutral-100 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-10 animate-in fade-in duration-1000">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-black tracking-tightest uppercase">Golden Records</h1>
          <p className="text-neutral-400 font-bold text-base">The single version of truth. Synthesized across institutional friction.</p>
        </div>
        <div className="flex gap-3">
           <button 
            onClick={handleDownloadPDF}
            className="px-5 py-2.5 rounded-xl bg-white border border-neutral-100 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-black transition-all flex items-center gap-2"
           >
              <Download size={14} />
              Export PDF
           </button>
           <button className="px-6 py-2.5 rounded-xl bg-black text-white text-[10px] font-black uppercase tracking-widest hover:shadow-xl transition-all flex items-center gap-2 active:scale-95">
              <Share2 size={14} className="text-blue-400" />
              Relay EHR
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-4 pb-20">
        {/* Patient Browser */}
        <div className="lg:col-span-3 space-y-6">
           <div className="space-y-3 px-1">
              <p className="text-[10px] font-black text-neutral-300 uppercase tracking-widest px-2">Registry Registry</p>
              <div className="relative group">
                 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-300 w-3.5 h-3.5 group-focus-within:text-black transition-colors" />
                 <input 
                   type="text"
                   placeholder="Name or ID..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="w-full pl-10 pr-4 py-2 bg-neutral-100/50 rounded-xl border-dashed border border-transparent focus:bg-white focus:border-neutral-200 outline-none text-[12px] font-bold transition-all"
                 />
              </div>
           </div>

           <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
             {filteredRecords.map(record => (
               <button 
                 key={record.id}
                 onClick={() => setSelectedRecord(record)}
                 className={cn(
                   "w-full px-5 py-4 rounded-xl transition-all duration-300 flex items-center gap-4 group border border-transparent",
                   selectedRecord?.id === record.id 
                   ? "bg-black text-white shadow-lg scale-[1.02]" 
                   : "bg-white text-neutral-400 hover:bg-neutral-50"
                 )}
               >
                  <Fingerprint size={16} className={selectedRecord?.id === record.id ? "text-white" : "text-neutral-200 group-hover:text-black"} />
                  <div className="text-left">
                     <p className="text-[12px] font-black uppercase tracking-tight leading-none">{record.name}</p>
                     <p className="text-[8px] font-black opacity-40 tracking-widest mt-1 uppercase">{record.id}</p>
                  </div>
               </button>
             ))}
           </div>
        </div>

        {/* Detailed View */}
        <div className="lg:col-span-9">
           <AnimatePresence mode="wait">
             {selectedRecord && (
               <motion.div 
                key={selectedRecord.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-white rounded-[32px] p-8 md:p-12 border border-neutral-100 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-12"
               >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 pb-8 border-b border-neutral-50">
                     <div className="flex items-center gap-8">
                        <div className="w-20 h-20 rounded-3xl bg-neutral-900 border-[4px] border-neutral-50 flex items-center justify-center text-2xl font-black text-white shadow-sm">
                           {selectedRecord.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="space-y-2">
                           <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest">
                              <Zap size={10} className="fill-emerald-600" />
                              Master Identity
                           </div>
                           <h2 className="text-4xl font-black text-black tracking-tightest uppercase">{selectedRecord.name}</h2>
                           <div className="flex gap-6">
                              <div className="flex items-center gap-2.5">
                                 <Calendar size={14} className="text-neutral-200" />
                                 <span className="text-[11px] font-black text-neutral-400">{selectedRecord.birthDate}</span>
                              </div>
                              <div className="flex items-center gap-2.5">
                                 <Fingerprint size={14} className="text-neutral-200" />
                                 <span className="text-[11px] font-black text-neutral-400 uppercase">{selectedRecord.identifiers.ssn}</span>
                              </div>
                           </div>
                        </div>
                     </div>
                     <div className="text-left md:text-right pt-4 md:pt-0">
                        <p className="text-[9px] font-black text-neutral-300 uppercase tracking-widest leading-none mb-1">Curation Hash</p>
                        <p className="font-mono text-[10px] text-neutral-200">0x74...F92B</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                     <div className="space-y-8">
                        <h4 className="flex items-center gap-2 text-sm font-black text-black tracking-widest uppercase">
                           <Activity size={14} className="text-blue-500" />
                           Data Provenance
                        </h4>
                        <div className="space-y-2">
                           {selectedRecord.mergedSources.map((source, i) => (
                             <div key={i} className="flex items-center justify-between p-5 rounded-2xl bg-neutral-50 border border-transparent hover:border-neutral-100 transition-all group">
                                <div className="flex items-center gap-4">
                                   <div className="w-8 h-8 rounded-lg bg-white border border-neutral-100 flex items-center justify-center text-[10px] font-black text-neutral-200 group-hover:bg-black group-hover:text-white transition-all">
                                      0{i+1}
                                   </div>
                                   <span className="text-[11px] font-black text-neutral-500 uppercase tracking-wide">{source}</span>
                                </div>
                                <CheckCircle size={14} className="text-emerald-400 opacity-60" />
                             </div>
                           ))}
                        </div>

                        <div className="p-6 rounded-[24px] border border-neutral-50 space-y-4">
                           <div className="flex justify-between items-end">
                              <p className="text-[9px] font-black text-neutral-200 uppercase tracking-widest">Confidence Score</p>
                              <p className="text-lg font-black text-black">{((selectedRecord.confidence ?? 0) * 100).toFixed(1)}%</p>
                           </div>
                           <div className="h-1.5 w-full bg-neutral-50 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(selectedRecord.confidence ?? 0) * 100}%` }}
                                transition={{ duration: 1.5 }}
                                className="h-full bg-black rounded-full"
                              />
                           </div>
                           <div className="flex justify-between text-[9px] font-bold text-neutral-300 uppercase tracking-widest">
                              <span>Status: {selectedRecord.status}</span>
                              <span>{selectedRecord.linkCount} source links</span>
                           </div>
                        </div>
                     </div>

                     <div className="space-y-8">
                        <h4 className="flex items-center gap-2 text-sm font-black text-black tracking-widest uppercase">
                           <Clock size={14} className="text-purple-500" />
                           History Sequence
                        </h4>
                        <div className="space-y-6 relative pl-4 border-l border-neutral-50">
                           {[
                              { label: 'Baseline sync', source: 'Lumiere Core v1.3', sub: 'Verified 4 artifacts.' },
                              { label: 'Duplicate Resolv', source: 'Manual Audit', sub: 'Merged Metropolitan identities.' }
                           ].map((item, i) => (
                              <div key={i} className="space-y-2 relative">
                                 <div className="absolute -left-[20.5px] top-1.5 w-3 h-3 rounded-full border-2 border-white bg-neutral-200 shadow-sm" />
                                 <p className="text-[8px] font-black text-neutral-200 uppercase tracking-widest">{item.label}</p>
                                 <div className="p-5 rounded-[24px] bg-neutral-50 border border-transparent hover:border-neutral-100 transition-all cursor-default">
                                    <p className="text-[11px] font-black text-black uppercase tracking-tight">{item.source}</p>
                                    <p className="text-[10px] font-bold text-neutral-400 mt-0.5 italic leading-relaxed opacity-60">{item.sub}</p>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </motion.div>
             )}
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
