// @graphpay/contracts: the GraphPayCheckout ABI and the EIP-712 shapes its signers use.
// Deployed addresses live only in @graphpay/config (whitechain.contracts).

import { readFileSync } from 'node:fs';

export const checkoutAbi = JSON.parse(readFileSync(new URL('./abi/GraphPayCheckout.json', import.meta.url), 'utf8'));
export * from './typed-data.mjs';
