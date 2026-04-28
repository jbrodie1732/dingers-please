import type { Metadata } from 'next';
import { Bricolage_Grotesque, DM_Mono, Inter } from 'next/font/google';
import './globals.css';
import NavBar from '@/components/NavBar';
import LiveAlerts from '@/components/LiveAlerts';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-bricolage',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Dingers, Please',
  description: 'Fantasy home run derby — post All-Star Break 2026',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={[bricolage.variable, dmMono.variable, inter.variable].join(' ')}
      style={{
        '--font-display': 'var(--font-bricolage)',
        '--font-ui':      '"Geist", var(--font-inter), sans-serif',
        '--font-mono':    'var(--font-dm-mono)',
        '--font-digital': '"Doto", ui-monospace, monospace',
      } as React.CSSProperties}
    >
      <body>
        <NavBar />
        <LiveAlerts />
        <main className="main-pane">
          {children}
        </main>
      </body>
    </html>
  );
}
