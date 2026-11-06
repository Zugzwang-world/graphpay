// Real explorer links, from the story projection's explorer bases and the team's own labels.
import type { Link } from '@/demo/contract';
import { story } from '@/data/story';
import { copy, fill } from '@/copy';

export function txLink(tx: string): Link {
  return { label: fill(copy.common.viewTxWhitechain, { chain: story.explorers.whitechainLabel }), url: `${story.explorers.whitechain.replace(/\/+$/, '')}/tx/${tx}` };
}
