'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, UserCheck, BrainCircuit, Activity, Settings, LogOut } from 'lucide-react';

const clinicianNavItems = [
  { href: '/dashboard', label: 'Clinical Brief', icon: LayoutDashboard },
  { href: '/registry', label: 'Patient Registry', icon: Users },
  { href: '/resolution', label: 'Identity Resolution', icon: UserCheck },
  { href: '/intelligence', label: 'Clinical Intelligence', icon: BrainCircuit },
  { href: '/audit', label: 'Audit Trail', icon: Activity },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-20 h-screen flex flex-col items-center py-6 shrink-0 hidden md:flex bg-transparent sticky top-0 z-50">
      
      {/* Beautiful White Logo */}
      <div className="mb-10 flex items-center justify-center">
         <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
           <span className="font-extrabold text-white text-2xl tracking-tighter" style={{ textShadow: '0 2px 10px rgba(255,255,255,0.5)' }}>L</span>
         </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col items-center gap-6 mt-2 w-full">
        {clinicianNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ${
                isActive 
                  ? 'bg-white/20 text-white shadow-sm' 
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className="pointer-events-none" />
              
              {/* Tooltip */}
              <div className="absolute left-14 px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-md opacity-0 pointer-events-none translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 whitespace-nowrap z-50 shadow-lg">
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto flex flex-col gap-2 relative z-50">
        <Link 
          href="/settings"
          className={`group relative w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ${
            pathname.startsWith('/settings')
              ? 'bg-white/20 text-white shadow-sm' 
              : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
           <Settings size={24} strokeWidth={pathname.startsWith('/settings') ? 2.5 : 2} className="pointer-events-none" />
           
           {/* Tooltip */}
           <div className="absolute left-14 px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-md opacity-0 pointer-events-none translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 whitespace-nowrap z-50 shadow-lg">
             Settings
           </div>
        </Link>
        <button 
          className="group relative w-12 h-12 flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300"
        >
           <LogOut size={24} className="pointer-events-none" />
           
           {/* Tooltip */}
           <div className="absolute left-14 px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-md opacity-0 pointer-events-none translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 whitespace-nowrap z-50 shadow-lg">
             Log Out
           </div>
        </button>
      </div>
    </aside>
  );
}
