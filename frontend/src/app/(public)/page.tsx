'use client';

import Link from 'next/link';
import { Users, Sparkles, Stethoscope } from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import { InteractiveImageAccordion } from '@/components/ui/interactive-image-accordion';
import { NeonButton } from '@/components/ui/neon-button';

export default function Home() {
  const popLayerVariants: Variants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0, 
      transition: { duration: 0.5, ease: "easeOut" } 
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-transparent font-sans selection:bg-black selection:text-white overflow-x-hidden">

      <div className="relative z-10">
        {/* Hero Section */}
        <section className="flex flex-col items-center justify-center min-h-[80vh] px-6 pt-12 pb-24 text-center max-w-7xl mx-auto border-none">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={popLayerVariants}
            className="flex flex-col items-center space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neutral-50 border border-neutral-100 text-neutral-500 text-xs font-semibold tracking-wider uppercase">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-20"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-black"></span>
              </span>
              Clinical Intelligence platform
            </div>

            <h1 className="text-8xl md:text-[140px] font-bold tracking-tightest leading-[0.85] text-black mx-auto max-w-5xl">
              Lumiere
              <span className="block text-4xl md:text-[64px] font-light text-slate-400 tracking-[-0.02em] mt-8">
                Unified Patient Intelligence
              </span>
            </h1>

            <p className="max-w-2xl mx-auto text-xl md:text-[22px] text-slate-500 font-light leading-[1.8] tracking-[0.02em] text-balance">
              Merge fragmented patient data into a trusted golden record. Built for
              hospitals and care teams that need clean, fast, and auditable intelligence.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
              <Link href="/login">
                <NeonButton size="lg">
                  Get Started
                </NeonButton>
              </Link>
              <Link href="#features">
                <NeonButton variant="outline" size="lg">
                  Explore Features
                </NeonButton>
              </Link>
            </div>
          </motion.div>

          {/* Stats Bar */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={popLayerVariants}
            className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-32 mt-40 w-full max-w-5xl mx-auto pt-20 border-t border-neutral-100/50"
          >
            {[
              { label: 'Patients Unified', value: '50K+', icon: Users },
              { label: 'Matches Found', value: '12.5K', icon: Sparkles },
              { label: 'Query Speed', value: '<100ms', icon: Stethoscope },
            ].map((stat, i) => (
              <motion.div 
                key={i} 
                whileHover={{ y: -5, scale: 1.02 }}
                className="flex flex-col items-center space-y-4 p-8 rounded-3xl bg-neutral-100/90 border border-neutral-200 shadow-[0_10px_30px_rgba(0,0,0,0.03),0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_rgba(14,165,233,0.1)] hover:border-sky-200 transition-all duration-300 group relative overflow-hidden"
              >
                {/* 3D "Glass" Light Effect */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-50"></div>
                
                <div className="p-4 rounded-2xl bg-neutral-200/60 text-neutral-500 group-hover:text-black group-hover:bg-neutral-200 transition-all duration-300 shadow-inner">
                  <stat.icon size={28} />
                </div>
                <div className="space-y-1 text-center">
                  <span className="block text-5xl font-bold text-black tracking-tight transition-colors group-hover:text-neutral-600">{stat.value}</span>
                  <span className="block text-neutral-400 text-sm font-bold uppercase tracking-widest">{stat.label}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Interactive Features Section */}
        <section id="features" className="py-40 px-6 bg-[#F1F5F9] overflow-hidden">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-7xl mx-auto"
          >
            <div className="grid lg:grid-cols-[1fr,2fr] gap-20 items-center">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-neutral-100 text-neutral-500 text-xs font-bold tracking-widest uppercase">
                  Intelligent Capabilities
                </div>
                <h2 className="text-6xl font-bold text-black tracking-tighter leading-[1.1]">
                  Powering <br />
                  <span className="text-neutral-400">Intelligent</span> <br />
                  Healthcare
                </h2>
                <p className="text-neutral-500 text-xl font-medium leading-relaxed max-w-md">
                  Explore how Lumiere transforms fragmented medical data into actionable intelligence through a unified golden record.
                </p>
                <div className="pt-4">
                  <Link href="/login">
                    <NeonButton variant="outline">
                      Start Now
                    </NeonButton>
                  </Link>
                </div>
              </div>

              <div className="relative">
                <InteractiveImageAccordion />
              </div>
            </div>
          </motion.div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-24 px-6 bg-neutral-50">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-col items-center text-center space-y-4 mb-16">
              <h2 className="text-3xl font-bold text-black tracking-tight">Queries? Contact Us</h2>
              <p className="max-w-lg text-lg text-neutral-500 leading-relaxed font-medium">
                Have questions about Lumiere? Reach out and we'll be in touch shortly.
              </p>
            </div>

            <div className="bg-transparent border-t border-b border-neutral-200 py-10">
              <form className="max-w-xl mx-auto space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-neutral-400 ml-1">Name</label>
                    <input 
                      type="text" 
                      placeholder="John Doe"
                      className="w-full px-6 py-4 rounded-xl bg-neutral-100 border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-300 transition-all text-black font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-neutral-400 ml-1">Email</label>
                    <input 
                      type="email" 
                      placeholder="john@example.com"
                      className="w-full px-6 py-4 rounded-xl bg-neutral-100 border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-300 transition-all text-black font-medium"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-neutral-400 ml-1">Message</label>
                  <textarea 
                    rows={4}
                    placeholder="How can we help you?"
                    className="w-full px-6 py-4 rounded-xl bg-neutral-100 border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-300 transition-all text-black font-medium resize-none"
                  />
                </div>

                <div className="flex justify-center pt-6">
                  <NeonButton size="md" className="w-full md:w-auto">
                    Send Message
                  </NeonButton>
                </div>
              </form>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-20 px-6 border-t border-neutral-50 relative z-10 bg-white">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tightest">Lumiere</span>
              <span className="text-neutral-300 ml-2">© {new Date().getFullYear()}</span>
            </div>
            <div className="flex gap-10 text-sm font-semibold text-neutral-400 uppercase tracking-widest">
              <Link href="/privacy" className="hover:text-black transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-black transition-colors">Terms</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
