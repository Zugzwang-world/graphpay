// Our own avatars (WEBSITE_SPEC.md §9): a "tiffin-bot" is a stacked steel tiffin
// head with two dot eyes and an antenna, ringed Gulab (buyer team) or Pista (shop
// team), with a role badge. People are a plain silhouette in a Varq circle.

export type BotRole = 'concierge' | 'scout' | 'analyst' | 'payer' | 'storefront' | 'risk' | 'dispatch';
export type Team = 'buyer' | 'shop';

const ROLE_TEAM: Record<BotRole, Team> = {
  concierge: 'buyer',
  scout: 'buyer',
  analyst: 'buyer',
  payer: 'buyer',
  storefront: 'shop',
  risk: 'shop',
  dispatch: 'shop',
};

export function isBotRole(value: string): value is BotRole {
  return Object.hasOwn(ROLE_TEAM, value);
}

function Badge({ role }: { role: BotRole }) {
  const ink = 'var(--night)';
  switch (role) {
    case 'concierge': // sparkle
      return <path d="M0-4.2 1.1-1.1 4.2 0 1.1 1.1 0 4.2-1.1 1.1-4.2 0-1.1-1.1Z" fill={ink} />;
    case 'scout': // magnifier
      return (
        <g fill="none" stroke={ink} strokeWidth="1.5" strokeLinecap="round">
          <circle cx="-0.8" cy="-0.8" r="2.3" />
          <path d="M0.9 0.9 3.2 3.2" />
        </g>
      );
    case 'analyst': // bars
      return (
        <g fill={ink}>
          <rect x="-3.4" y="0" width="1.8" height="3" rx="0.4" />
          <rect x="-0.9" y="-1.8" width="1.8" height="4.8" rx="0.4" />
          <rect x="1.6" y="-3.6" width="1.8" height="6.6" rx="0.4" />
        </g>
      );
    case 'payer': // coin
      return (
        <g>
          <circle r="3.4" fill="none" stroke={ink} strokeWidth="1.4" />
          <path d="M0-1.8V1.8" stroke={ink} strokeWidth="1.4" strokeLinecap="round" />
        </g>
      );
    case 'storefront': // awning
      return (
        <g fill={ink}>
          <path d="M-3.8-2.6h7.6l0.6 2.2h-8.8Z" />
          <path d="M-3.4 0.4h6.8v2.8h-6.8Z" opacity="0.65" />
        </g>
      );
    case 'risk': // shield
      return <path d="M0-3.9 3.3-2.6v2.2C3.3 1.9 1.8 3.4 0 4 -1.8 3.4-3.3 1.9-3.3-0.4v-2.2Z" fill={ink} />;
    case 'dispatch': // box
      return (
        <g fill="none" stroke={ink} strokeWidth="1.3" strokeLinejoin="round">
          <path d="M-3.4-1.6 0-3.3 3.4-1.6V2.2L0 3.9-3.4 2.2Z" />
          <path d="M-3.4-1.6 0 0 3.4-1.6M0 0V3.9" />
        </g>
      );
  }
}

export function TiffinBot({ role, size = 40, title, idle = false, dimmed = false }: { role: BotRole; size?: number; title?: string; idle?: boolean; dimmed?: boolean }) {
  const team = ROLE_TEAM[role];
  const ring = team === 'buyer' ? 'var(--gulab)' : 'var(--pista)';
  const id = `steel-${role}`;
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role="img"
      aria-label={title ?? `${role} agent`}
      className={idle ? 'bob' : undefined}
      style={{ flex: 'none', opacity: dimmed ? 0.45 : 1, filter: dimmed ? 'grayscale(1)' : undefined }}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="1">
          <stop offset="0" stopColor="#eef0f6" />
          <stop offset="0.55" stopColor="#c3c7d6" />
          <stop offset="1" stopColor="#9aa0b6" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="var(--surface-raised)" stroke={ring} strokeWidth="2.5" />
      {/* antenna */}
      <path d="M24 13V8.5" stroke="#c3c7d6" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="24" cy="7.5" r="2" fill="var(--kesar)" />
      {/* lid with its handle */}
      <rect x="14.5" y="13" width="19" height="4.2" rx="2.1" fill={`url(#${id})`} />
      {/* top tier, face tier, bottom tier */}
      <rect x="13" y="17.6" width="22" height="6" rx="2" fill={`url(#${id})`} />
      <rect x="13" y="24.2" width="22" height="7.6" rx="2" fill={`url(#${id})`} />
      <rect x="13" y="32.4" width="22" height="5.6" rx="2" fill={`url(#${id})`} />
      {/* clasps */}
      <path d="M13.6 21h-1.4v14h1.4M34.4 21h1.4v14h-1.4" fill="none" stroke="#8c92a9" strokeWidth="1.1" />
      {/* eyes */}
      <circle cx="20" cy="28" r="1.7" fill="var(--night)" />
      <circle cx="28" cy="28" r="1.7" fill="var(--night)" />
      {/* role badge */}
      <g transform="translate(38.5 38.5)">
        <circle r="7.2" fill={ring} stroke="var(--night)" strokeWidth="1.6" />
        <Badge role={role} />
      </g>
    </svg>
  );
}

export function Person({ size = 40, title }: { size?: number; title: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} role="img" aria-label={title} style={{ flex: 'none' }}>
      <circle cx="24" cy="24" r="22" fill="var(--varq)" />
      <circle cx="24" cy="19" r="7.5" fill="var(--surface)" />
      <path d="M10.5 39.5c1.8-7.2 7-11 13.5-11s11.7 3.8 13.5 11a22 22 0 0 1-27 0Z" fill="var(--surface)" />
    </svg>
  );
}
