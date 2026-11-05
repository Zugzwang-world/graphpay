// "View on explorer" chips (WEBSITE_SPEC.md §1 rule 1): every on-chain value
// opens its explorer page in a new tab. No link without a well-formed value.

import { shortHex } from '@/lib/explorer';

export function ExplorerChip({ href, label, value, tone }: { href: string | null; label: string; value?: string | null; tone?: 'kesar' | 'pista' | 'gulab' | 'chilli' }) {
  const text = value ? `${label} ${value.startsWith('0x') ? shortHex(value) : value}` : label;
  if (!href) {
    return (
      <span className="chip" data-tone={tone}>
        {text}
      </span>
    );
  }
  return (
    <a className="chip" data-tone={tone} href={href} target="_blank" rel="noopener noreferrer" title={value ?? undefined}>
      {text}
      <span aria-hidden="true">↗</span>
      <span className="visually-hidden">(opens the explorer in a new tab)</span>
    </a>
  );
}
