// One phone of the team's design on its own page, on live data: the page's
// `data-app` picks the customer or the merchant app. The /live stage frames each
// page in an iframe; on a phone-width screen the page is the phone itself.
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './phones.css';
import { DemoProvider } from '@/demo/DemoProvider';
import { AppPlaceholder } from '@/apps/AppPlaceholder';
import { SoundPreference } from '@/components/shared/SoundPreference';
import { FRAME_H, FRAME_W, PHONE_H, PHONE_W, PhoneFrame } from '@/components/stage/PhoneFrame';
import { useViewport } from '@/lib/useViewport';
import { copy } from '@/copy';
import { LiveAdapter } from './live-adapter';

// At or below this width the page is a real phone: no bezel (the team's Stage uses the same rule).
const PHONE_WIDTH = 500;

const app = document.body.dataset.app === 'merchant' ? 'merchant' : 'customer';

function Phone() {
  const [adapter] = useState(() => new LiveAdapter());
  const vp = useViewport();
  const bare = vp.width <= PHONE_WIDTH;
  const label = app === 'customer' ? copy.stage.customerCaption : copy.stage.merchantCaption;
  const scale = bare ? Math.min(1, vp.width / PHONE_W, vp.height / PHONE_H) : Math.min(1, vp.width / FRAME_W, vp.height / FRAME_H);
  return (
    <DemoProvider adapter={adapter}>
      <SoundPreference>
        <div className="flex h-full items-start justify-center overflow-hidden">
          {bare ? (
            <div style={{ width: PHONE_W * scale, height: PHONE_H * scale }}>
              <div className="origin-top-left" style={{ transform: `scale(${scale})` }}>
                <PhoneFrame label={label} scale={1} bare>
                  <AppPlaceholder app={app} />
                </PhoneFrame>
              </div>
            </div>
          ) : (
            <PhoneFrame label={label} scale={scale}>
              <AppPlaceholder app={app} />
            </PhoneFrame>
          )}
        </div>
      </SoundPreference>
    </DemoProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Phone />
  </StrictMode>,
);
