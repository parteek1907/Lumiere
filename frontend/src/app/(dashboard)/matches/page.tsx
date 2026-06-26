'use client';

import { useState } from 'react';
import { CheckCircle, Sparkles, AlertTriangle, Search } from 'lucide-react';
import { identifyRecords, resolveMergeRecord, type LumiereIdentifyResult } from '@/lib/api';

export default function MatchesPage() {
  const [lumiereQuery, setLumiereQuery] = useState('');
  const [lumiereResult, setLumiereLResult] = useState<LumiereIdentifyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleLumiereSearch = async () => {
    if (!lumiereQuery.trim()) return;
    setIsLoading(true);
    try {
      const res = await identifyRecords(lumiereQuery);
      setLumiereLResult(res);
    } catch (error) {
      console.error('Lumiere Search Failed:', error);
      setToast('Lumiere Search Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolve = async (pairId: string, action: 'merge' | 'separate') => {
    try {
      // Backend creates the MasterPatientIndex golden record + source links on merge
      await resolveMergeRecord(pairId, action);

      // Remove from local UI state
      if (lumiereResult?.action_report) {
         setLumiereLResult({
           ...lumiereResult,
           action_report: {
             ...lumiereResult.action_report,
             pending_human_review: lumiereResult.action_report.pending_human_review.filter(p => p.pair_id !== pairId),
             auto_merges_completed: lumiereResult.action_report.auto_merges_completed.filter(p => p.pair_id !== pairId),
           }
         });
      }
      setToast(action === 'merge' ? 'Records merged & added to patient registry' : 'Records confirmed separate');
    } catch (error) {
      setToast('Resolution failed');
    }
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="max-w-[1100px] mx-auto space-y-8 page-enter">
      {/* Lumiere Search Header */}
      <div className="relative group">
        <div className="absolute inset-0 bg-black/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <div className="relative bg-white border border-black/5 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 w-full relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input
              type="text"
              value={lumiereQuery}
              onChange={(e) => setLumiereQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLumiereSearch()}
              placeholder="Deep Search Identity resolution by name, phone, or email... For ex- John"
              className="w-full bg-neutral-50 border border-black/5 rounded-xl py-3 pl-12 pr-4 text-sm font-medium focus:bg-white focus:border-black/20 transition-all outline-none"
            />
          </div>
          <button
            onClick={handleLumiereSearch}
            disabled={isLoading || !lumiereQuery.trim()}
            className="w-full md:w-auto px-6 py-3 bg-black text-white rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all disabled:opacity-50"
          >
            {isLoading ? 'Synthesizing...' : 'Lumiere Search'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {lumiereResult ? (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-purple-500" />
              <h2 className="text-lg font-bold text-black">Lumiere Results</h2>
              <span className="text-xs text-neutral-400 font-medium ml-auto">{lumiereResult.summary}</span>
              <button 
                onClick={() => setLumiereLResult(null)}
                className="text-xs font-bold text-neutral-400 hover:text-black uppercase tracking-widest"
              >
                Clear
              </button>
            </div>

            {/* Render Pending Review */}
            {lumiereResult.action_report?.pending_human_review.map((pair) => (
              <div key={pair.pair_id} className="bg-white border-2 border-amber-100 rounded-2xl overflow-hidden shadow-lg transition-all hover:border-amber-200">
                <div className="bg-amber-50 px-6 py-3 border-b border-amber-100 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <AlertTriangle size={14} className="text-amber-600" />
                      <span className="text-[11px] font-black uppercase tracking-widest text-amber-700">High Stakes Review</span>
                   </div>
                   <span className="text-xs font-bold text-amber-600">Confidence: {(pair.ai_analysis.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="p-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                      {pair.records.map((rec: any, idx) => (
                        <div key={idx} className="space-y-2">
                           <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{rec.source_system}</p>
                           <h3 className="text-xl font-bold text-black">{rec.name}</h3>
                           <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600">
                              <div><span className="text-neutral-400">DOB:</span> {rec.birth_date}</div>
                              <div><span className="text-neutral-400">SSN:</span> {rec.ssn}</div>
                           </div>
                        </div>
                      ))}
                   </div>
                   <div className="p-4 bg-neutral-50 rounded-xl border border-black/5 mb-6">
                      <p className="text-xs text-neutral-500 font-medium leading-relaxed italic">
                        "{pair.ai_analysis.reasoning}"
                      </p>
                   </div>
                   <div className="flex gap-3">
                      <button 
                        onClick={() => handleResolve(pair.pair_id, 'merge')}
                        className="flex-1 bg-black text-white py-3 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all border border-black"
                      >
                        Confirm & Merge
                      </button>
                      <button 
                         onClick={() => handleResolve(pair.pair_id, 'separate')}
                         className="flex-1 bg-white text-neutral-900 border border-black/10 py-3 rounded-xl font-bold text-sm hover:bg-neutral-50 transition-all"
                      >
                        Reject Match
                      </button>
                   </div>
                </div>
              </div>
            ))}

            {/* Render Auto Merges for Transparency */}
            {lumiereResult.action_report?.auto_merges_completed.map((pair) => (
               <div key={pair.pair_id} className="bg-white border border-black/5 rounded-xl p-4 opacity-60">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <CheckCircle size={14} className="text-emerald-500" />
                       <span className="text-sm font-bold text-black">{pair.records[0].name}</span>
                       <span className="text-xs text-neutral-400">merged with</span>
                       <span className="text-sm font-bold text-black">{pair.records[1].name}</span>
                    </div>
                    <span className="text-xs font-medium text-emerald-600">Auto Resolved</span>
                 </div>
               </div>
            ))}

            {(!lumiereResult.action_report?.pending_human_review.length && !lumiereResult.action_report?.auto_merges_completed.length) && (
               <div className="py-20 text-center text-neutral-400">
                  <p className="text-sm font-medium">No active merges found for this search.</p>
               </div>
            )}
          </>
        ) : (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-black/5 transition-all group hover:scale-110">
               <Search size={24} className="text-neutral-300 group-hover:text-black" />
            </div>
            <h3 className="text-black font-bold">Start an AI Synthesis</h3>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto mt-2 leading-relaxed">
              Use Lumiere Search above to find cross-institutional records and resolve identities with high-confidence AI analysis.
            </p>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] toast-enter bg-black text-white rounded-xl px-6 py-4 shadow-2xl font-bold text-sm flex items-center gap-3 animate-in slide-in-from-right-4">
          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
          {toast}
        </div>
      )}
    </div>
  );
}

