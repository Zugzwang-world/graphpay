import type { ReactNode } from 'react';

export const metadata = {
  title: 'GraphPay',
  description: 'Ask before you pay: agents with ENS names pay shops on Whitechain, and every payment joins a money graph on Arkiv.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
