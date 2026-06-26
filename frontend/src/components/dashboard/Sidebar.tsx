'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Calendar, MessageSquare, PieChart, Settings, LogOut } from 'lucide-react';

const clinicianNavItems = [
  { href: '/dashboard', icon: LayoutDashboard },
  { href: '/patients', icon: Calendar },
  { href: '/messages', icon: MessageSquare },
  { href: '/analytics', icon: PieChart },
  { href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-20 h-screen flex flex-col items-center py-6 shrink-0 hidden md:flex bg-transparent sticky top-0 z-50">
      {/* Navigation */}
      <nav className="flex-1 flex flex-col items-center gap-6 mt-8 w-full">
        {clinicianNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href === '/patients' && pathname.startsWith('/patients'));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ${
                isActive 
                  ? 'bg-white/20 text-white' 
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto">
        <button className="w-12 h-12 flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300">
           <LogOut size={24} />
        </button>
      </div>
    </aside>
  );
}
