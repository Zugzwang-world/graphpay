// One phone of the team's design on its own page, on live data: the page's `data-app` picks
// the customer’s phone or the shop’s. The /live stage frames each page in an iframe and drives what it
// shows; on a phone-width screen the page is the phone itself.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './phones.css';
import { FRAME_H, FRAME_W, PHONE_H, PHONE_W, PhoneFrame } from '@/components/stage/PhoneFrame';
import { useViewport } from '@/lib/useViewport';
import { story } from '@/data/story';
import { products, shops } from './cast';
import { CustomerPhone } from './customer';
import { MerchantPhone } from './merchant';

// At or below this width the page is a real phone: no bezel (the team's Stage uses the same rule).
const PHONE_WIDTH = 500;
// The stage may draw the phone a little larger than life on a big screen.
const MAX_SCALE = 1.3;

const app = document.body.dataset.app === 'merchant' ? 'merchant' : 'customer';

// Every photo and figurine the stage will show, fetched once at load so no card waits for one.
for (const url of [
  ...products.flatMap((p) => [p.image, p.swarm]),
  ...shops.flatMap((s) => [s.image, s.swarm]),
  ...[...story.agents, ...story.shop.agents].flatMap((a) => (a.avatar ? ['idle', 'thinking', 'talking', 'success', 'refused'].map((st) => `${a.avatar}-${st}.png`) : [])),
]) {
  if (url) new Image().src = url;
}

function Phone() {
  const vp = useViewport();
  const bare = vp.width <= PHONE_WIDTH;
  const label = app === 'customer' ? `${story.customer.name}’s phone` : `${story.shop.name}’s phone`;
  const scale = bare ? Math.min(1, vp.width / PHONE_W, vp.height / PHONE_H) : Math.min(MAX_SCALE, vp.width / FRAME_W, vp.height / FRAME_H);
  const screen = app === 'customer' ? <CustomerPhone /> : <MerchantPhone />;
  return (
    <div className="flex h-full items-start justify-center overflow-hidden">
        {bare ? (
          <div style={{ width: PHONE_W * scale, height: PHONE_H * scale }}>
            <div className="origin-top-left" style={{ transform: `scale(${scale})` }}>
              <PhoneFrame label={label} scale={1} bare>
                {screen}
              </PhoneFrame>
            </div>
          </div>
        ) : (
          <PhoneFrame label={label} scale={scale}>
            {screen}
          </PhoneFrame>
        )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Phone />
  </StrictMode>,
);
