'use client';

import { useState, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { identifyRecords, type LumiereIdentifyResult } from '@/lib/api';

export default function QueryPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<LumiereIdentifyResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      handleIdentify(q);
    }
  }, [searchParams]);

  const suggestions = [
    'Sarah Jenkins',
    'John Doe',
    'Robert Miller',
    'hello',
  ];

  const handleIdentify = async (q: string) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await identifyRecords(q);
      setResult(res);
    } catch (error) {
      console.error('Lumiere Query Failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = () => {
    if (!query.trim()) return;
    handleIdentify(query);
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-semibold text-black mb-3 tracking-tight">
            Ask Lumiere
          </h1>
          <p className="text-neutral-600 text-lg">
            Query patient records in natural language powered by AI
          </p>
        </div>

        <div className="mb-12">
          <div className="relative group">
            <div className="absolute inset-0 bg-black/10 opacity-20 rounded-xl blur-xl group-hover:opacity-35 transition-opacity"></div>
            <div className="relative p-6 rounded-xl bg-white border border-black/10 backdrop-blur shadow-sm">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleQuery();
                  }
                }}
                placeholder="e.g., What are the patient's current medications? When was the last visit?"
                className="w-full bg-transparent text-black placeholder-neutral-500 outline-none resize-none text-lg"
                rows={4}
              />
              <button
                onClick={handleQuery}
                disabled={loading || !query.trim()}
                className="absolute bottom-6 right-6 w-12 h-12 rounded-lg bg-black text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center hover:bg-neutral-800"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>

        {!result && !loading && (
          <div className="mb-12">
            <p className="text-neutral-500 text-sm font-semibold mb-4 text-center uppercase tracking-widest">Try a Search</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setQuery(suggestion);
                  }}
                  className="p-4 text-left rounded-xl bg-white border border-black/5 text-neutral-500 hover:border-black/20 hover:text-black transition-all duration-300 hover:shadow-xl text-sm font-medium"
                >
                  "{suggestion}"
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="p-12 rounded-2xl bg-white/50 border border-black/5 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
            <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
            <span className="text-neutral-900 font-medium tracking-tight">Lumiere is synthesizing records...</span>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
            {/* Main Verdict Card */}
            <div className="relative group">
               <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-10 rounded-2xl blur-2xl group-hover:opacity-20 transition-opacity"></div>
               <div className="relative p-8 rounded-2xl bg-white border border-black/5 shadow-2xl">
                 <div className="flex items-center gap-3 mb-4">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Intelligence Verdict</span>
                 </div>
                 <p className="text-neutral-900 leading-relaxed text-2xl font-medium tracking-tight">
                   {result.summary}
                 </p>
               </div>
            </div>

            {result.status === 'success' && result.action_report && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 rounded-2xl bg-white border border-black/5 shadow-sm">
                  <p className="text-xs font-bold text-neutral-400 mb-1 uppercase tracking-widest">Auto Merges</p>
                  <p className="text-4xl font-black text-black">{result.action_report.auto_merges_completed.length}</p>
                </div>
                <div className="p-6 rounded-2xl bg-white border border-black/5 shadow-sm">
                  <p className="text-xs font-bold text-neutral-400 mb-1 uppercase tracking-widest">Manual Review</p>
                  <p className="text-4xl font-black text-amber-500">{result.action_report.pending_human_review.length}</p>
                </div>
                <div className="p-6 rounded-2xl bg-white border border-black/5 shadow-sm">
                  <p className="text-xs font-bold text-neutral-400 mb-1 uppercase tracking-widest">Confirmed Distinct</p>
                  <p className="text-4xl font-black text-blue-500">{result.action_report.confirmed_duplicates_ignored.length}</p>
                </div>
              </div>
            )}

            {result.status === 'success' && result.action_report && result.action_report.auto_merges_completed.length > 0 && (
              <div className="p-6 rounded-2xl bg-white border border-black/5">
                <p className="text-xs font-bold text-neutral-400 mb-4 uppercase tracking-widest">Merged Records</p>
                <div className="space-y-3">
                  {result.action_report.auto_merges_completed.map((merge) => (
                    <div key={merge.pair_id} className="flex items-center justify-between p-4 rounded-xl bg-neutral-50 border border-black/5">
                      <div className="flex items-center gap-4">
                        <div className="px-2 py-1 rounded bg-black text-white text-[10px] font-bold uppercase tracking-tighter">Golden</div>
                        <span className="text-sm font-semibold text-black">{merge.pair_id}</span>
                      </div>
                      <div className="text-xs font-medium text-neutral-500">
                        Confidence: <span className="text-black font-bold">{(merge.ai_analysis.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setQuery('');
                setResult(null);
              }}
              className="w-full px-8 py-4 rounded-xl bg-black text-white font-bold hover:bg-neutral-800 transition-all duration-300 shadow-xl active:scale-[0.98]"
            >
              Start New Analysis
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
