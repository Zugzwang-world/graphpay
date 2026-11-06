// The Proofs list of the stage's top bar (final website brief §4): each live feature that is not in
// the demo, labelled by the activity that proved it, with its public records. The hashes are the
// records the streams wrote tonight (docs/thinking-partner/NOW.md and the w1-identity, w3-payments
// and w4-agents relays); the labels name the story's values through the site model, never in code.

import type { SiteModel } from '../site.server.ts';
import { entityUrl, txUrl } from '../explorer.ts';

export interface ProofLinkItem {
  label: string;
  href: string;
}

export interface Proof {
  key: string;
  title: string;
  activity: string;
  links: ProofLinkItem[];
}

const W = 'whitechain' as const;
const S = 'sepolia' as const;

export function proofs(model: SiteModel): Proof[] {
  const x = model.explorers;
  const wc = (label: string, tx: string) => ({ label, href: txUrl(x, W, tx)! });
  const sep = (label: string, tx: string) => ({ label, href: txUrl(x, S, tx)! });
  const ark = (label: string, tx: string) => ({ label, href: txUrl(x, 'rabdi', tx)! });
  const ent = (label: string, key: string) => ({ label, href: entityUrl(x, key)! });
  const list: Proof[] = [
    {
      key: 'kill',
      title: 'The kill: a disposable agent ended for good',
      activity: 'Identity',
      links: [
        sep('Unregistered on ENS', '0x08f116fc2ceebb93e1de209fcbb2f60ac53c094c25b3b06d7da6eb16f194fff5'),
        wc('Pass revoked on Whitechain', '0x40d51ac52b440bc33bb6ec2686fe53c53b77be370a84970a0790a744bbd8233a'),
        ent('Its next payment refused, on Arkiv', '0x057e0e89a1d7da0156bec919b0a1c64f3b2ec09427a33c8fb86e34ea8a6afc14'),
      ],
    },
    {
      key: 'over-pass',
      title: `Over the pass: “${model.order.overPass.request}”`,
      activity: 'Payments',
      links: [ent('Refused, nothing sent, on Arkiv', '0x49163142476bc996134f3a4b0cac473f9698fa0781f39895206b138cfab1dc19')],
    },
    {
      key: 'raise-cap',
      title: 'The agent tries to raise its own cap',
      activity: 'Payments',
      links: [ark('Reverted, recorded on Arkiv', '0xabc41f475312767e363e073ec872c3ff4b3556883901201dca53f1dafd444144')],
    },
    {
      key: 'owner-cap',
      title: 'The owner changes the cap, and back',
      activity: 'Payments',
      links: [
        sep('ENS record changed', '0x88eee4073dd89ca143cb1a155f4443f9810435cbd0522e3dde87102077b06bca'),
        sep('ENS record back', '0x9ede86e263e96dab93b13686c290ced72041da5c2b8b7b0ae76a8774040b0d62'),
        wc('Pass set on Whitechain', '0x9ee983c5b03c6fa183fc5d6ebbcda5e87c1955b04d474ddfc6f40f7a16caeb1c'),
        wc('Pass set back', '0xa8171e53f95808df50d7fcad4820d071b0aa23b83ffcc09b8bb8173bcae6224e'),
        ark('Recorded on Arkiv', '0x0156c13f9a2eefc977e83cd1fac6fec0f4cd06c86f8ef887850f6a6393407a1a'),
      ],
    },
    {
      key: 'subscription',
      title: `The ${model.renewal.item}: subscribe, renew, cancel`,
      activity: 'Payments',
      links: [
        wc('Subscribed', '0xf3f7586090fb37cf4b04963216dabc7b89915f02afb19f71fb81ca138e53c393'),
        wc('Renewed by the clock', '0x8d40d556382f40313dafaf712d3c174d7cc8365176c8813f04e849f93338de83'),
        wc('Cancelled by the payer’s own signature', '0x70ed2b3ffa63b81fa426631c70cb39591f8b80c077455930d05e63de04077b42'),
      ],
    },
    {
      key: 'reorder',
      title: `Re-order: ${model.order.reorder.item}`,
      activity: 'Payments',
      links: [wc('Paid on Whitechain', '0xf1d7cb5654de6cc09ede0a404818a009f7429d9d149e3e564222d4a4d3ae2b4a')],
    },
    ...DECLINE.map((d) => ({ key: 'decline', title: 'A refund request, declined by the shop', activity: 'Payments', links: [ark('Declined, on Arkiv', d)] })),
    {
      key: 'errands',
      title: 'The first errand under the new name, then three in a row',
      activity: 'Identity and agents',
      links: [
        wc('The first, through the new name', '0xcc69b7bb16eb17c9dede32da4765a90ca15a6af18397011efae6a9eb599e5cb5'),
        wc('In a row: one', '0x32bbd598de36731532da5a3d3927d355aab62b27fcd743d1fd62dc0c09c66b5e'),
        wc('Two', '0xdedadeb8be1ee53cc6428a845024fd8052c4e734dcc4e844a227410638f15742'),
        wc('Three', '0x128517cae8acca9ac1cc229ddda5fd0ae1a63065788ad487eac24b0e9d80a238'),
      ],
    },
  ];
  return list.map((p) => ({ ...p, links: p.links.filter((l) => typeof l.href === 'string') }));
}

// The decline's own record on Arkiv, once one is written for the stage (its arkivTx).
const DECLINE: string[] = [];
