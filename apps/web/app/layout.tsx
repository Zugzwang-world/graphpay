import type { Metadata, Viewport } from 'next';
import { Baloo_2, Mukta } from 'next/font/google';
import type { ReactNode } from 'react';
import { PasscodeDialog } from '@/components/passcode-dialog';
import { SiteProvider } from '@/components/site-context';
import { TopBar } from '@/components/top-bar';
import { siteModel } from '@/lib/site.server';
import './globals.css';
import './site.css';
import './stage.css';

const baloo = Baloo_2({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-baloo', display: 'swap' });
const mukta = Mukta({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-mukta', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(siteModel().siteUrl),
  title: { default: 'GraphPay', template: '%s, GraphPay' },
  description:
    'AI agents with ENS names pay shops over x402 on Whitechain; every payment joins a money graph on Arkiv that any agent can ask, with every read shown, before it pays. Testnets only.',
};

export const viewport: Viewport = {
  themeColor: '#17143d',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const model = siteModel();
  return (
    <html lang="en" className={`${baloo.variable} ${mukta.variable}`}>
      <body>
        <SiteProvider model={model}>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <TopBar />
          <main id="main">{children}</main>
          <PasscodeDialog />
        </SiteProvider>
      </body>
    </html>
  );
}
