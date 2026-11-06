import type { Link } from './contract';
import { story } from '@/data/story';
import { fill, copy } from '@/copy';

/**
 * Mock explorer links. They carry `mock: true` and a fake hash, and the
 * ExplorerLink component shows them as mock instead of opening a page that
 * does not exist (FRONTEND_HANDOVER.md rule 4: never present a fake link as real).
 */

let counter = 0;

function fakeHash(seed: string): string {
  let h = 0x811c9dc5;
  const s = `${seed}:${counter++}`;
  let out = '';
  for (let round = 0; round < 8; round++) {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i) + round;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += h.toString(16).padStart(8, '0');
  }
  return `0x${out.slice(0, 64)}`;
}

export function whitechainTx(seed: string, label?: string): Link {
  return {
    label: label ?? fill(copy.common.viewTxWhitechain, { chain: story.explorers.whitechainLabel }),
    url: `${story.explorers.whitechain}/tx/${fakeHash(seed)}`,
    mock: true,
  };
}

export function ensRecord(name: string, label?: string): Link {
  return {
    label: label ?? fill(copy.common.viewOnEns, { chain: story.explorers.ensLabel }),
    url: `${story.explorers.ens}/${name}?tx=${fakeHash(name)}`,
    mock: true,
  };
}

export function arkivEntity(seed: string): Link {
  return {
    label: `View record on ${story.explorers.arkivLabel}`,
    url: `${story.explorers.arkiv}/entity/${fakeHash(seed)}`,
    mock: true,
  };
}

export function resetLinkCounter(): void {
  counter = 0;
}
