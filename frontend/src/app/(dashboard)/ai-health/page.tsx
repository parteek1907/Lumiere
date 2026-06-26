'use client';

import { Sparkles, ArrowRight } from 'lucide-react';
import { useState } from 'react';

export default function HealthAIPage() {
  const [messages, setMessages] = useState<{ role: 'ai' | 'user', text: string }[]>([
    { role: 'ai', text: 'Hello! I am Lumiere, your personal medical intelligence assistant. I can explain your labs, summarize your visit history, or answer questions about your medications.' }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text: input }, { role: 'ai', text: 'This is a simulated AI response. In production, this would query your Golden Record via an LLM.' }]);
    setInput('');
  };

  return (
    <div className="max-w-[800px] mx-auto space-y-8 page-enter h-[calc(100vh-140px)] flex flex-col">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-black">Health AI Assistant</h1>
        <p className="text-[13px] text-neutral-500 mt-1">Ask questions about your health, test results, and records seamlessly.</p>
      </div>

      <div className="flex-1 bg-white border border-[#EBEBEB] rounded-xl flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-5 py-3 ${m.role === 'user' ? 'bg-black text-white' : 'bg-neutral-100/80 text-black'}`}>
                {m.role === 'ai' && (
                  <div className="flex items-center gap-2 mb-1.5 opacity-60">
                    <Sparkles size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Lumiere AI</span>
                  </div>
                )}
                <p className="text-[14px] leading-relaxed">{m.text}</p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t border-neutral-100 bg-neutral-50/50">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about your test results or history..."
              className="w-full h-12 pl-4 pr-12 rounded-xl bg-white border border-neutral-200 outline-none focus:ring-2 focus:ring-black/5 focus:border-[#C8C8C8] transition-all text-[14px]"
            />
            <button
              onClick={handleSend}
              className="absolute right-2 top-2 w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center hover:bg-neutral-800 transition-colors"
            >
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
