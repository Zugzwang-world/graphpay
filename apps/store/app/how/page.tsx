import type { Metadata } from 'next';
import { integration } from '@/lib/integration';

export const metadata: Metadata = { title: 'How it’s built' };
export const dynamic = 'force-static';

export default function How() {
  const files = integration();
  const count = files.reduce((n, f) => n + f.lines.length, 0);
  return (
    <>
      <h1>How it&rsquo;s built</h1>
      <p>
        This store takes payments with <code>@graphpay/checkout-kit</code>. The whole integration is {count} lines in four files, read from this app&rsquo;s own source at build
        time (blank lines and comments left out):
      </p>
      {files.map((f) => (
        <section key={f.file}>
          <h2>
            <code>{f.file}</code> <span className="small">({f.lines.length} lines)</span>
          </h2>
          <pre>{f.lines.join('\n')}</pre>
        </section>
      ))}
      <h2>What happens when you pay</h2>
      <ol>
        <li>The button connects your wallet and switches it to Whitechain Sepolia (testnet).</li>
        <li>The shop answers with a quote: the amount, the payee and a deadline, priced from its own catalog. The page checks it before showing it to you.</li>
        <li>You sign (the first time also a small gasless approval of exactly the amount). You pay no gas: the facilitator sends the transaction and cannot change the payee or amount.</li>
        <li>The receipt opens on the explorer. The merchant view reads the shop&rsquo;s orders, and the accountant export is built from the chain&rsquo;s own logs.</li>
      </ol>
    </>
  );
}
