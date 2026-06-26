'use client';

import { useState, useEffect } from 'react';
import { 
  Mic, 
  FileUp, 
  Search, 
  User, 
  Volume2, 
  FileText, 
  CheckCircle2, 
  Sparkles,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';

interface Patient {
  id: string;
  name: string;
}

export default function CommunicationPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeMode, setActiveMode] = useState<'voice' | 'pdf'>('voice');
  const [isRecording, setIsRecording] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [history, setHistory] = useState<{id: string, type: 'voice' | 'pdf', patientName: string, date: string}[]>([]);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const { fetchPatients: fp } = await import('@/lib/api');
        const data = await fp();
        setPatients(data.map(p => ({ id: p.id, name: `${p.given_name ?? ''} ${p.family_name ?? ''}`.trim() })));
      } catch (e) {
        console.error('Failed to fetch patients', e);
      }
    };
    fetchPatients();
  }, []);

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDispatch = () => {
    if (!selectedPatient) return;
    setIsDispatching(true);
    setTimeout(() => {
      setIsDispatching(false);
      const entry = {
        id: Math.random().toString(36).substr(2, 9),
        type: activeMode,
        patientName: selectedPatient.name,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setHistory([entry, ...history]);
      setSelectedPatient(null);
      setSearchQuery('');
    }, 1500);
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-12 animate-in fade-in duration-1000 px-4">
      <div className="flex flex-col space-y-1 text-center items-center">
        <h1 className="text-3xl font-black text-black tracking-tightest uppercase">Clinical Command</h1>
        <p className="text-neutral-400 font-bold text-base max-w-2xl">Broadcast intelligence, artifacts, and instructions to the patient edge.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start pb-20">
        {/* Patient Selection - Minimal */}
        <div className="lg:col-span-3 space-y-6">
           <div className="space-y-4">
              <div className="space-y-2 px-1">
                 <p className="text-[10px] font-black text-neutral-300 uppercase tracking-widest px-2">Discovery</p>
                 <div className="relative group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-300 w-3.5 h-3.5 group-focus-within:text-black transition-colors" />
                    <input 
                      type="text"
                      placeholder="Identify patient..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-neutral-100/50 rounded-xl border border-transparent focus:bg-white focus:border-neutral-200 outline-none text-[12px] font-bold transition-all"
                    />
                 </div>
              </div>

              <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                {filteredPatients.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => {
                      setSelectedPatient(p);
                      setSearchQuery(p.name);
                    }}
                    className={cn(
                      "w-full px-5 py-3.5 rounded-xl transition-all duration-300 flex items-center gap-3 group border border-transparent",
                      selectedPatient?.id === p.id 
                      ? "bg-black text-white shadow-xl scale-[1.02]" 
                      : "bg-white text-neutral-400 hover:bg-neutral-50"
                    )}
                  >
                     <User size={14} className={selectedPatient?.id === p.id ? "text-white" : "text-neutral-200 group-hover:text-black"} />
                     <span className="text-[11px] font-black uppercase tracking-tight">{p.name}</span>
                     {selectedPatient?.id === p.id && <CheckCircle2 size={12} className="ml-auto text-emerald-400" />}
                  </button>
                ))}
              </div>
           </div>
        </div>

        {/* Action Column - Minimal/Plain Page */}
        <div className="lg:col-span-9 space-y-10">
           <div className="flex gap-1.5 p-1 bg-neutral-100/50 rounded-xl w-fit mx-auto border border-neutral-100">
              <button 
                onClick={() => setActiveMode('voice')}
                className={cn(
                  "px-8 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  activeMode === 'voice' ? "bg-white text-black shadow-sm border border-neutral-100" : "text-neutral-300 hover:text-black"
                )}
              >
                Voice Capture
              </button>
              <button 
                onClick={() => setActiveMode('pdf')}
                className={cn(
                  "px-8 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  activeMode === 'pdf' ? "bg-white text-black shadow-sm border border-neutral-100" : "text-neutral-300 hover:text-black"
                )}
              >
                PDF
              </button>
           </div>

           <AnimatePresence mode="wait">
              {activeMode === 'voice' ? (
                <motion.div 
                  key="voice"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="flex flex-col items-center text-center space-y-8 py-10"
                >
                    <div className={cn(
                      "w-24 h-24 rounded-[32px] flex items-center justify-center transition-all duration-700 relative",
                      isRecording ? "bg-rose-500 shadow-2xl scale-110" : "bg-neutral-900 shadow-xl"
                    )}>
                       <Mic size={24} className="text-white" />
                       {isRecording && (
                         <motion.div 
                            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="absolute inset-0 bg-rose-500 rounded-[32px] -z-10"
                         />
                       )}
                    </div>
                    <div className="space-y-1">
                       <h2 className="text-2xl font-black text-black tracking-tightest uppercase">Consensus Recording</h2>
                       <p className="text-neutral-400 font-bold max-w-sm mx-auto text-sm opacity-60">
                          Speak clinical context. Lumiere AI will fragment and relay intelligence.
                       </p>
                    </div>
                    <button 
                      onClick={() => setIsRecording(!isRecording)}
                      className={cn(
                        "px-8 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 shadow-sm",
                        isRecording ? "bg-black text-white" : "bg-rose-500 text-white hover:bg-rose-600 shadow-rose-200 shadow-lg"
                      )}
                    >
                      {isRecording ? 'Deactivate Capture' : 'Initiate Capture'}
                    </button>
                </motion.div>
              ) : (
                <motion.div 
                  key="pdf"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="py-20 flex flex-col items-center text-center space-y-6 border border-dashed border-neutral-100 rounded-[40px] hover:border-black/10 transition-colors"
                >
                    <div className="w-16 h-16 rounded-2xl bg-neutral-50 flex items-center justify-center text-neutral-200 group-hover:bg-black group-hover:text-white transition-all">
                       <FileUp size={24} />
                    </div>
                    <div className="space-y-1">
                       <h2 className="text-xl font-black text-black tracking-tightest uppercase">PDF Gateway</h2>
                       <p className="text-neutral-400 font-bold text-xs opacity-60">FHIR-compliant fragments or clinical evidence.</p>
                    </div>
                    <button className="px-8 py-3 rounded-xl bg-black text-white font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">Select Artifact Portfolio</button>
                </motion.div>
              )}
           </AnimatePresence>

           {selectedPatient && (
             <div className="flex flex-col items-center gap-4 pt-10 border-t border-neutral-50">
                <button 
                  onClick={handleDispatch}
                  disabled={isDispatching}
                  className="w-full max-w-sm py-5 rounded-2xl bg-black text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
                >
                   {isDispatching ? 'Synthesizing Relay...' : `Dispatch to ${selectedPatient.name.split(' ')[0]}`}
                </button>
                <div className="flex items-center gap-2 text-[8px] font-black text-neutral-300 uppercase tracking-widest">
                   <Clock size={10} /> Latency: 42ms
                </div>
             </div>
           )}

           <div className="space-y-6 pt-10">
              <div className="flex items-center justify-between px-2">
                 <h3 className="text-[10px] font-black text-neutral-300 uppercase tracking-[0.2em]">Relay Ledger</h3>
                 <Sparkles size={12} className="text-neutral-100" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-10">
                 {history.length === 0 && (
                   <div className="md:col-span-2 py-20 bg-neutral-50/30 rounded-[32px] border border-dashed border-neutral-50 flex flex-col items-center justify-center text-center space-y-2">
                      <MessageSquare size={16} className="text-neutral-200" />
                      <p className="text-[10px] font-black text-neutral-200 uppercase tracking-widest">ledger empty</p>
                   </div>
                 )}
                 {history.map(item => (
                   <motion.div 
                     key={item.id}
                     initial={{ opacity: 0, x: -5 }}
                     animate={{ opacity: 1, x: 0 }}
                     className="p-5 rounded-[24px] bg-white border border-neutral-100 flex items-center justify-between group hover:border-black transition-all shadow-sm"
                   >
                      <div className="flex items-center gap-4">
                         <div className="w-8 h-8 rounded-lg bg-neutral-50 flex items-center justify-center text-neutral-300 group-hover:bg-black group-hover:text-white transition-all">
                            {item.type === 'voice' ? <Volume2 size={12} /> : <FileText size={12} />}
                         </div>
                         <div>
                            <p className="text-[11px] font-black text-black uppercase tracking-tight">{item.patientName}</p>
                            <p className="text-[8px] font-bold text-neutral-400 tracking-widest uppercase">{item.type} • {item.date}</p>
                         </div>
                      </div>
                      <CheckCircle2 size={12} className="text-emerald-400 opacity-60" />
                   </motion.div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
