import type { Metadata } from 'next';
import './globals.css';
import NavBar from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'Dinger Tracker',
  description: 'Fantasy home run tracker — post All-Star Break',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0d0d0d] text-[#e8e8e8] min-h-screen">
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 py-3">
          {children}
        </main>
      </body>
    </html>
  );
}
