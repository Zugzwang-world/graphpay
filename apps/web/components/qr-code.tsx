// A QR code for an HTTPS link on the production domain (never EIP-681), drawn as
// one SVG path from uqr's module matrix.

import { encode } from 'uqr';

export function QrCode({ url, size = 120, label }: { url: string; size?: number; label: string }) {
  if (!/^https:\/\//.test(url)) throw new Error('QR codes carry HTTPS links only');
  const { data, size: modules } = encode(url, { ecc: 'M', border: 2 });
  let d = '';
  data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) d += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return (
    <svg viewBox={`0 0 ${modules} ${modules}`} width={size} height={size} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={modules} height={modules} fill="#ffffff" rx="1" />
      <path d={d} fill="var(--night)" />
    </svg>
  );
}
