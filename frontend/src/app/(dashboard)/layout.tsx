'use client';

import Sidebar from '@/components/dashboard/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#1e5df8] flex overflow-hidden">
      <Sidebar />
      <main className="flex-1 h-screen overflow-y-auto bg-[#f8fafc] rounded-tl-[3rem] rounded-bl-[3rem] shadow-[-10px_0_30px_rgba(0,0,0,0.1)]">
        {children}
      </main>
    </div>
  );
}
