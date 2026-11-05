import type { Metadata } from 'next';
import { ExplorerChip } from '@/components/explorer-chip';
import { tokenUrl } from '@/lib/explorer';
import { SITE_ROUTES } from '@/lib/routes';
import { siteModel } from '@/lib/site.server';

export const metadata: Metadata = { title: 'How it works' };

const SOURCE = 'https://github.com/Zugzwang-world/graphpay';

export default function HowPage() {
  const model = siteModel();
  return (
    <div className="page how">
      <h1>How it works</h1>
      <p className="lede">
        Agents that can pay, can be trusted and can be stopped. Each one is identified by ENS, remembered on Arkiv and paid on Whitechain: decentralized,
        secure and verifiable, on testnets only.
      </p>

      <section className="pillars">
        <article className="card">
          <h2>Identify</h2>
          <p className="muted small">ENS on {model.networks.sepolia.name}</p>
          <p>
            Every person, agent and shop has a name under <code>{model.root}</code>, for example <code>{model.payer.ens}</code>. The owner can pause an agent
            with one text record or unregister it, and every payment checks the name first. A shop’s address record says where its money goes.
          </p>
        </article>
        <article className="card">
          <h2>Pay</h2>
          <p className="muted small">x402 on {model.networks.whitechain.name}</p>
          <p>
            The shop asks for payment with HTTP 402. The payer agent signs the order’s terms and pays no gas; our own facilitator checks the signature and
            the ENS name, and its relayer settles in test {model.token.symbol} and pays the gas. An on-chain policy caps what each agent can spend in a day.
          </p>
          <p>
            <ExplorerChip href={tokenUrl(model.explorers, model.token.address)} label={`${model.token.symbol} token`} value={model.token.address} />
          </p>
        </article>
        <article className="card">
          <h2>Remember</h2>
          <p className="muted small">Graph Arkiv on {model.networks.rabdi.name}</p>
          <p>
            Every payment, refund and delivery becomes a line between two ENS names, with running tallies per name. The receipts cannot be edited. Any agent
            can ask the graph in one GraphQL query and see every Arkiv read behind the answer before it pays.
          </p>
        </article>
      </section>

      <section>
        <h2>No database of our own</h2>
        <p>
          State lives on the Whitechain contract and on Arkiv; the website only runs code. No personal data is collected and nothing identifies a visitor.
          The city of shops around the demo is synthetic and labelled as such.
        </p>
      </section>

      <section>
        <h2>The website’s routes</h2>
        <p className="muted">Every route that makes anyone sign runs on the server behind the demo passcode, sent in a header and never in a URL.</p>
        <div className="table-wrap">
          <table className="routes">
            <thead>
              <tr>
                <th scope="col">Route</th>
                <th scope="col">Gate</th>
                <th scope="col">What it does</th>
                <th scope="col">Who signs</th>
              </tr>
            </thead>
            <tbody>
              {SITE_ROUTES.map((r) => (
                <tr key={`${r.method} ${r.path}`}>
                  <td className="mono">
                    {r.method} {r.path}
                  </td>
                  <td>{r.gate}</td>
                  <td>{r.does}</td>
                  <td className="muted">{r.signs ?? 'nobody'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>For other shops</h2>
        <p>A short drop-in checkout lets any shop take these payments; the demo store adds it in about 20 lines. It is shown here when it ships.</p>
      </section>

      <p>
        <a href={SOURCE} target="_blank" rel="noopener noreferrer">
          Source code on GitHub
        </a>
      </p>
    </div>
  );
}
