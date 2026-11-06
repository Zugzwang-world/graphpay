import { useState } from 'react';
import { story } from '@/data/story';

/** The shop's first product photo (Grok's dish), or nothing when the story names none. */
export function dishPhoto(shopEns: string): string | null {
  return story.products.find((p) => p.shop === shopEns && p.image)?.image ?? null;
}

/** The shop's storefront photo, or nothing. */
export function shopPhoto(shopEns: string): string | null {
  return story.shops.find((s) => s.ens === shopEns)?.image ?? null;
}

/** A photo that quietly disappears when it cannot load. */
export function Photo({ src, className }: { src: string | null; className: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return null;
  return <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className={className} />;
}
