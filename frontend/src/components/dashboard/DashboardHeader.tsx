'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { 
  Search, 
  User, 
  LayoutDashboard, 
  Users, 
  GitMerge, 
  Settings,
  LogOut,
  FileText
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';

const clinicianNavItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/patients', label: 'Patient Registry', icon: Users },
  { href: '/matches', label: 'Match Queue', icon: GitMerge },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const patientNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/records', label: 'My Records', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function DashboardHeader() {
  const pathname = usePathname();
  const [userName, setUserName] = useState('John Doe');
  const [role, setRole] = useState<string | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  useEffect(() => {
    const savedRole = localStorage.getItem('role');
    const savedProfile = localStorage.getItem('userProfile');
    
    setRole(savedRole);

    if (savedProfile) {
      const profile = JSON.parse(savedProfile);
      setUserName(profile.fullName || (savedRole === 'patient' ? 'John Doe' : 'Dr. Parteek'));
    } else {
      setUserName(savedRole === 'patient' ? 'John Doe' : 'Dr. Parteek');
    }
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  const navItems = role === 'patient' ? patientNavItems : clinicianNavItems;
  const isPatient = role === 'patient';

  return (
    <header className="sticky top-0 z-50 w-full glass border-b border-neutral-200/50 px-6 h-16 flex items-center justify-between gap-8">
      {/* Brand & Logo */}
      <Link href="/dashboard" className="flex items-center gap-2.5 group transition-all duration-300">
        <div className="w-9 h-9 rounded-xl overflow-hidden group-hover:scale-105 transition-transform duration-300 flex items-center justify-center">
          <Image src="/assets/logo.png" alt="Lumiere" width={36} height={36} className="object-contain" />
        </div>
        <span className="text-[17px] font-bold tracking-tight text-black hidden md:block">Lumiere</span>
      </Link>

      {/* Navigation - Centered */}
      <nav className="hidden lg:flex items-center gap-1 bg-neutral-100/50 p-1 rounded-xl">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href === '/patients' && pathname.startsWith('/patients'));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={() => setHoveredTab(item.href)}
              onMouseLeave={() => setHoveredTab(null)}
              className={cn(
                'relative px-4 py-2 rounded-lg text-[14px] font-medium transition-colors duration-200 flex items-center gap-2',
                isActive ? 'text-black' : 'text-neutral-500 hover:text-black'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-white shadow-sm rounded-lg"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              
              <AnimatePresence>
                {hoveredTab === item.href && !isActive && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute inset-0 bg-white/60 rounded-lg -z-10"
                  />
                )}
              </AnimatePresence>

              <Icon size={16} className={cn('relative z-10 transition-colors', isActive ? 'text-black' : 'text-neutral-400 group-hover:text-black')} />
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Search & Actions */}
      <div className="flex-1 flex items-center justify-end gap-6 max-w-[600px]">
        {/* Search Bar — hidden on settings and non-list pages */}
        {!pathname.startsWith('/settings') && (
          <div className={cn(
            "relative flex-1 transition-all duration-300 ease-out",
            isSearchFocused ? "max-w-[400px]" : "max-w-[240px]"
          )}>
            <Search className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200",
              isSearchFocused ? "text-black" : "text-neutral-400"
            )} size={16} />
            <input
              type="text"
              placeholder={isPatient ? "Search your records..." : "Search patients..."}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-neutral-100/80 border-none text-[14px] placeholder:text-neutral-400 outline-none ring-0 focus:ring-2 focus:ring-black/5 transition-all"
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* User Profile */}
          <div className="flex items-center gap-3 pl-1">
            <div className="hidden sm:block text-right">
              <p className="text-[14px] font-semibold text-black leading-none">{userName}</p>
              <p className="text-[10px] font-bold uppercase text-neutral-400 mt-1 tracking-wider">{isPatient ? 'Patient' : 'Clinician'}</p>
            </div>
            <div className="group relative">
              <button className="w-10 h-10 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden hover:border-black transition-colors">
                <User size={18} className="text-neutral-500 group-hover:text-black transition-colors" />
              </button>
              
              {/* Simple Tooltip/Dropdown Placeholder */}
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-neutral-100 p-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all translate-y-2 group-hover:translate-y-0">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-neutral-600 hover:text-red-600 hover:bg-red-50 transition-all text-[14px]"
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}


