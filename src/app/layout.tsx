import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Hanken_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import BottomNav from '@/components/BottomNav';
import { Anchor } from '@/components/icons';

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});
const body = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'yacht·tinder — swipe your charter',
  description: 'Discover and shortlist luxury yacht charters by swiping, or search in plain English.',
};

export const viewport: Viewport = {
  themeColor: '#06141d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <div className="app">
          <header className="masthead">
            <div className="brand">
              <span className="brand__mark">
                <Anchor width={22} height={22} />
              </span>
              <span className="brand__name">
                yacht<b>·</b>tinder
              </span>
            </div>
            <div className="masthead__tag">
              crewed charters
              <br />
              swipe · search · shortlist
            </div>
          </header>
          {children}
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
