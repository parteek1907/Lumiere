import type { Metadata } from 'next';
import '../styles/globals.css';
import { BeamsBackground } from '@/components/ui/beams-background';

export const metadata: Metadata = {
  title: 'Lumiere — Medical Intelligence Platform',
  description: 'Unified Golden Record platform for patient data',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body className="bg-[#F8FBFF] text-neutral-900 antialiased font-sans">
        <BeamsBackground intensity="subtle">
          {children}
        </BeamsBackground>
      </body>
    </html>
  );
}
