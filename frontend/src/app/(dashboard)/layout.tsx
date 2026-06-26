'use client';

import DashboardHeader from '@/components/dashboard/DashboardHeader';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <DashboardHeader />
      <main className="px-8 py-6">
        {children}
      </main>
    </div>
  );
}
