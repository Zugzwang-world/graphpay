import type { Metadata } from 'next';
import Link from 'next/link';
import { MiddleSwitch } from '@/components/middle-switch';
import { LiveRunBridge } from '@/components/live-run-bridge';
import { QrCode } from '@/components/qr-code';
import { siteModel } from '@/lib/site.server';

export const metadata: Metadata = { title: 'Live' };

// The stage with the team's two phones (integration audit, option A): each phone is
// its own page under /phones/, built from frontend/ on live data, framed here around
// the explainer. It becomes the home page once the errand runs through it.
export default function LiveStagePage() {
  const model = siteModel();
  const customerLabel = `${model.persona.displayName}’s phone`;
  const merchantLabel = `${model.merchant.displayName}’s phone`;
  return (
    <>
      <LiveRunBridge />
      <div className="stage">
        <div className="stage-customer">
          <p className="stage-label">
            <span className="dot" data-tone="buyer" aria-hidden="true" /> {customerLabel}
          </p>
          <iframe className="live-phone" src="/phones/customer.html" title={customerLabel} />
        </div>
        <div className="stage-middle">
          <MiddleSwitch />
          <aside className="phone-links" aria-label="Open the phone views on your own phone">
            <figure>
              <QrCode url={`${model.siteUrl}/phones/customer.html`} size={56} label={`QR code for ${customerLabel}`} />
              <figcaption className="small">{customerLabel}</figcaption>
            </figure>
            <figure>
              <QrCode url={`${model.siteUrl}/phones/merchant.html`} size={56} label={`QR code for ${merchantLabel}`} />
              <figcaption className="small">{merchantLabel}</figcaption>
            </figure>
            <p className="small muted">Scan to follow along on your own phone. Testnets only; no personal data collected.</p>
          </aside>
        </div>
        <div className="stage-merchant">
          <p className="stage-label">
            <span className="dot" data-tone="shop" aria-hidden="true" /> {merchantLabel}
          </p>
          <iframe className="live-phone" src="/phones/merchant.html" title={merchantLabel} />
        </div>
      </div>

      <nav className="home-menu" aria-label="Screens">
        <h1>Ask before you pay</h1>
        <p className="muted">AI agents with ENS names pay shops on Whitechain, and every payment joins a money graph on Arkiv that any agent can ask first.</p>
        <a className="home-card" href="/phones/customer.html" data-tone="buyer">
          <strong>{customerLabel}</strong>
          <span className="muted">Ask the agents, watch them choose and pay.</span>
        </a>
        <a className="home-card" href="/phones/merchant.html" data-tone="shop">
          <strong>{merchantLabel}</strong>
          <span className="muted">Orders ring in with the buyer agent’s name and record.</span>
        </a>
        <Link className="home-card" href="/explain">
          <strong>What just happened</strong>
          <span className="muted">Each step of the payment with its real data and links.</span>
        </Link>
      </nav>
    </>
  );
}
