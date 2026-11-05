// The checkout button. `GraphPayButton` connects a browser wallet on the shop's chain, shows
// the exact quote (what, how much, to whom, "no gas"), and signs only after the person
// confirms; then it shows the receipt with its explorer link. A payment that cannot be
// confirmed is never re-quoted: the same signature is re-sent ("Check again") until the order
// is resolved or its deadline has passed, so a person cannot pay twice for one cart.
// React is a peer dependency; no JSX, so it needs no build step.
import { createElement as h, useCallback, useRef, useState } from 'react';
import { connectWallet, getQuote, payQuote } from './client.mjs';

const usdt = (micro) => {
  const whole = micro / 1_000_000n;
  const frac = (micro % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '').padEnd(2, '0');
  return `${whole}.${frac}`;
};
const short = (address) => `${address.slice(0, 6)}…${address.slice(-4)}`;

// props: { shopUrl, item, qty, network, onPaid, label, rpcUrl, passcode, ethereum, parent, expect, className }
//   network   from networkForClient(shop.network), passed down as plain JSON
//   expect    { payTo, maxAmountMicro }: pin the payee and the largest amount this page accepts
//   passcode  a string, or an async function that returns one (a demo shop gates its relayer)
export function GraphPayButton({ shopUrl, item, qty = 1, parent, network, onPaid, label = 'Pay with GraphPay', rpcUrl, passcode, ethereum, expect, className }) {
  const [state, setState] = useState({ step: 'idle' });
  const busy = useRef(false);
  const provider = ethereum ?? (typeof window === 'undefined' ? undefined : window.ethereum);
  const code = useCallback(async () => (typeof passcode === 'function' ? passcode() : passcode), [passcode]);

  const start = useCallback(async () => {
    if (!provider) return setState({ step: 'error', message: 'No browser wallet found. Install one to pay.' });
    try {
      setState({ step: 'connecting' });
      const wallet = await connectWallet(provider, network, { rpcUrl, chainName: network.name, nativeSymbol: network.nativeSymbol });
      const quote = await getQuote({ shopUrl, item, qty, parent, payer: wallet.address, network, expect });
      setState({ step: 'quoted', wallet, quote });
    } catch (error) {
      setState({ step: 'error', message: error?.message ?? 'Could not connect.' });
    }
  }, [provider, network, rpcUrl, shopUrl, item, qty, parent, expect]);

  // Sends (or re-sends) the payment for `quote`. `signed` is the signature from an earlier,
  // unconfirmed attempt: it is sent again as it is, never replaced by a new one.
  const pay = useCallback(
    async (wallet, quote, signed) => {
      if (busy.current) return;
      busy.current = true;
      setState({ step: 'signing', wallet, quote, signed });
      try {
        const result = await payQuote({ shopUrl, quote, account: wallet, publicClient: wallet.publicClient, network, passcode: await code(), signed });
        if (result.status === 'paid') {
          setState({ step: 'paid', result });
          onPaid?.(result);
        } else if (result.status === 'unknown') setState({ step: 'pending', wallet, quote, signed: result.signed });
        else setState({ step: 'error', message: `Not paid: ${result.reason}.` });
      } catch (error) {
        setState({ step: 'error', message: error?.shortMessage ?? error?.message ?? 'Not signed.' });
      } finally {
        busy.current = false;
      }
    },
    [shopUrl, network, code, onPaid],
  );

  const { step } = state;
  if (step === 'quoted' || step === 'signing') {
    const { quote, wallet } = state;
    return h(
      'div',
      { className, role: 'group', 'aria-label': 'Confirm payment' },
      h('p', null, `Pay ${usdt(quote.amountMicro)} ${network.token.symbol} to ${quote.shopName} (${short(quote.requirement.payTo)})`),
      h('p', null, `${qty} x ${item}. You pay no gas. Your wallet asks you to sign: the first time, a small approval of exactly this amount, then the payment itself.`),
      h('button', { type: 'button', onClick: () => pay(wallet, quote, state.signed), disabled: step === 'signing' }, step === 'signing' ? 'Confirm in your wallet…' : 'Confirm and sign'),
      h('button', { type: 'button', onClick: () => setState({ step: 'idle' }), disabled: step === 'signing' }, 'Cancel'),
    );
  }
  if (step === 'pending') {
    const { quote, wallet, signed } = state;
    const expired = Math.floor(Date.now() / 1000) > quote.deadline + 60;
    return h(
      'div',
      { className, role: 'status' },
      h('p', null, 'The payment may still settle. Do not pay again: check again and this same payment is confirmed or refused.'),
      h('button', { type: 'button', onClick: () => pay(wallet, quote, signed) }, 'Check again'),
      expired ? h('button', { type: 'button', onClick: () => setState({ step: 'idle' }) }, 'It did not go through: start over') : null,
    );
  }
  if (step === 'paid') {
    const { result } = state;
    return h(
      'p',
      { className, role: 'status' },
      `Paid ${usdt(result.amountMicro)} ${network.token.symbol}. `,
      result.explorer ? h('a', { href: result.explorer, target: '_blank', rel: 'noopener noreferrer' }, 'Open the receipt on the explorer') : 'The receipt link follows once the transaction is indexed.',
    );
  }
  return h(
    'div',
    { className },
    h('button', { type: 'button', onClick: start, disabled: step === 'connecting' }, step === 'connecting' ? 'Connecting…' : label),
    step === 'error' ? h('p', { role: 'alert' }, state.message) : null,
  );
}
