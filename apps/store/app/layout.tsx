import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { PasscodeProvider } from '@/components/passcode';
import { shopName } from '@/lib/store';
import './globals.css';

export const metadata: Metadata = { title: { default: 'Demo store', template: '%s · Demo store' }, description: 'A demo store paying with GraphPay: test USDT on Whitechain Sepolia, no gas for the buyer. Testnet only; synthetic goods.' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <p className="brand">{shopName} <span className="small">(demo store, testnet, synthetic goods)</span></p>
          <nav aria-label="Pages">
            <Link href="/">Shop</Link>
            <Link href="/merchant">Merchant</Link>
            <Link href="/how">How it&rsquo;s built</Link>
          </nav>
        </header>
        <main>
          <PasscodeProvider>{children}</PasscodeProvider>
        </main>
      </body>
    </html>
  );
}
