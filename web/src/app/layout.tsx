import type { Metadata } from 'next';
import './globals.css';
import WalletProviders from '@/components/WalletProviders';
import { Instrument_Sans, Press_Start_2P, VT323 } from 'next/font/google';

const sans = Instrument_Sans({ subsets:['latin'], variable:'--font-instrument', display:'swap' });
const arcade = Press_Start_2P({ weight:'400', subsets:['latin'], variable:'--font-arcade-g', display:'swap' });
const term = VT323({ weight:'400', subsets:['latin'], variable:'--font-term-g', display:'swap' });

export const metadata: Metadata = {
  title: 'ClawRena AI',
  description: 'Live AI agents that play, talk, and get bet on.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${arcade.variable} ${term.variable}`}>
      <body style={{ margin: 0, background: '#0a0a0f', color: '#f1ebe0',
        fontFamily: 'system-ui, sans-serif' }}>
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
