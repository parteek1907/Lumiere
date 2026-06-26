'use client';

import Link from 'next/link';
import { NeonButton } from '@/components/ui/neon-button';
import { Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ShimmerText from '@/components/ui/shimmer-text';
import { cn } from '@/lib/cn';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleScroll = () => {
      if (window.scrollY > 60) {
        setIsScrolled(true);
        setIsActive(true);
        
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setIsActive(false);
        }, 2500);
      } else {
        setIsScrolled(false);
        setIsActive(true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <>
      <nav 
        className={cn(
          "fixed top-0 inset-x-0 z-50 h-20 transition-all duration-400 ease-in-out",
          isScrolled 
            ? "bg-neutral-100/80 backdrop-blur-md border-b border-neutral-200/60 shadow-sm" 
            : "bg-transparent border-transparent shadow-none",
          isScrolled && !isActive ? "opacity-80" : "opacity-100"
        )}
      >
        <div className="max-w-7xl mx-auto px-8 h-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 transition-all duration-300 group-hover:scale-110 flex items-center justify-center overflow-hidden">
              <img 
                src="/assets/logo.png" 
                alt="Lumiere Logo" 
                className="w-full h-full object-contain" 
              />
            </div>
            <ShimmerText
              className="text-xl font-semibold tracking-tight"
              variant="slate"
              duration={2.5}
              delay={0.5}
            >
              Lumiere
            </ShimmerText>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <NeonButton size="sm" variant="primary">
                Log In
              </NeonButton>
            </Link>
            <Link href="/login">
              <NeonButton size="sm" variant="outline">
                Sign Up
              </NeonButton>
            </Link>
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="ml-2 w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
            >
              {isMenuOpen ? <X size={20} className="text-black" /> : <Menu size={20} className="text-black" />}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="fixed top-20 left-0 w-full z-40 bg-white/95 border-b border-neutral-200 shadow-xl overflow-hidden backdrop-blur-xl"
          >
            <div className="max-w-7xl mx-auto px-8 py-10 flex items-center justify-center gap-16">
              <Link href="/" onClick={() => setIsMenuOpen(false)} className="text-sm font-light text-neutral-500 hover:text-black transition-colors uppercase tracking-[0.2em]">
                Home
              </Link>
              <Link href="/#features" onClick={() => setIsMenuOpen(false)} className="text-sm font-light text-neutral-500 hover:text-black transition-colors uppercase tracking-[0.2em]">
                Features
              </Link>
              <Link href="/#contact" onClick={() => setIsMenuOpen(false)} className="text-sm font-light text-neutral-500 hover:text-black transition-colors uppercase tracking-[0.2em]">
                Contact
              </Link>
              <Link href="/login" onClick={() => setIsMenuOpen(false)} className="text-sm font-light text-neutral-500 hover:text-black transition-colors uppercase tracking-[0.2em]">
                Login
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
