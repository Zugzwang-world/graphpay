// @graphpay/contracts: the GraphPayCheckout ABI and the EIP-712 shapes its signers use.
// Deployed addresses live only in @graphpay/config (whitechain.contracts).


// A JSON import (not a file read), so a bundler carries the ABI with the code.
import checkoutAbiJson from './abi/GraphPayCheckout.json' with { type: 'json' };

export const checkoutAbi = checkoutAbiJson;
export * from './typed-data.mjs';
