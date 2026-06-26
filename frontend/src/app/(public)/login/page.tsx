'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const email = emailRef.current?.value || '';
    // Persist email so Settings page can read it
    const existing = JSON.parse(localStorage.getItem('userProfile') || '{}');
    localStorage.setItem('userProfile', JSON.stringify({ ...existing, email }));
    router.push('/role-select');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-black">Welcome back</h1>
          <p className="text-neutral-500 font-medium">Log in to your Lumiere account</p>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-xl space-y-6">
          <form className="space-y-4" onSubmit={handleLogin}>
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest px-1">Email</label>
              <input
                ref={emailRef}
                type="email"
                placeholder="dr.smith@hospital.com"
                required
                className="w-full px-5 py-3.5 rounded-xl bg-neutral-50 border border-transparent focus:bg-white focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all font-medium"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Password</label>
                <a href="#" className="text-xs font-bold text-black hover:underline underline-offset-4">Forgot?</a>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                required
                className="w-full px-5 py-3.5 rounded-xl bg-neutral-50 border border-transparent focus:bg-white focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all font-medium"
              />
            </div>
            
            <button 
              type="submit"
              className="w-full mt-6 py-4 rounded-xl bg-black text-white font-bold text-sm tracking-wide border border-transparent hover:bg-white hover:text-black hover:border-black hover:scale-[1.03] hover:shadow-xl transition-all duration-300 active:scale-[0.98]"
            >
              Sign In
            </button>
          </form>

          <div className="text-center text-sm font-medium text-neutral-500 pt-2 border-t border-neutral-100">
            Don&apos;t have an account?{' '}
            <a href="/#contact" className="text-black font-bold hover:underline underline-offset-4">
              Contact Sales
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
