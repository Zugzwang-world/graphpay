import Link from 'next/link';
import { CustomerScreen } from '@/components/customer-screen';
import { Explainer } from '@/components/explainer';
import { MerchantScreen } from '@/components/merchant-screen';
import { PhoneFrame } from '@/components/phone-frame';
import { QrCode } from '@/components/qr-code';
import { siteModel } from '@/lib/site.server';

// The stage (WEBSITE_SPEC.md §2): the customer's phone, the explainer, the
// merchant's phone. On a phone, the home page offers each screen on its own.
export default function StagePage() {
  const model = siteModel();
  const customerLabel = `${model.persona.displayName}’s phone`;
  const merchantLabel = `${model.merchant.displayName}’s phone`;
  return (
    <>
      <div className="stage">
        <div className="stage-customer">
          <p className="stage-label">
            <span className="dot" data-tone="buyer" aria-hidden="true" /> {customerLabel}
          </p>
          <PhoneFrame label={customerLabel} tone="buyer">
            <CustomerScreen />
          </PhoneFrame>
        </div>
        <div className="stage-middle">
          <Explainer />
          <aside className="phone-links" aria-label="Open the phone views on your own phone">
            <figure>
              <QrCode url={`${model.siteUrl}/customer`} size={88} label={`QR code for ${customerLabel}`} />
              <figcaption className="small">{customerLabel}</figcaption>
            </figure>
            <figure>
              <QrCode url={`${model.siteUrl}/merchant`} size={88} label={`QR code for ${merchantLabel}`} />
              <figcaption className="small">{merchantLabel}</figcaption>
            </figure>
            <p className="small muted">Scan to follow along on your own phone. Testnets only; no personal data collected.</p>
          </aside>
        </div>
        <div className="stage-merchant">
          <p className="stage-label">
            <span className="dot" data-tone="shop" aria-hidden="true" /> {merchantLabel}
          </p>
          <PhoneFrame label={merchantLabel} tone="shop">
            <MerchantScreen />
          </PhoneFrame>
        </div>
      </div>

      <nav className="home-menu" aria-label="Screens">
        <h1>Ask before you pay</h1>
        <p className="muted">AI agents with ENS names pay shops on Whitechain, and every payment joins a money graph on Arkiv that any agent can ask first.</p>
        <Link className="home-card" href="/customer" data-tone="buyer">
          <strong>{customerLabel}</strong>
          <span className="muted">Ask the agents, watch them choose and pay, pause them.</span>
        </Link>
        <Link className="home-card" href="/merchant" data-tone="shop">
          <strong>{merchantLabel}</strong>
          <span className="muted">Orders ring in with the buyer agent’s name and reputation.</span>
        </Link>
        <Link className="home-card" href="/explain">
          <strong>What just happened</strong>
          <span className="muted">Each step of the payment with its real data and links.</span>
        </Link>
        <Link className="home-card" href="/race">
          <strong>Race mode</strong>
          <span className="muted">Plain Arkiv against Graph Arkiv: the reads each one needs.</span>
        </Link>
      </nav>
    </>
  );
}
