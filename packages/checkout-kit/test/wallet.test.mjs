// A browser wallet is an EIP-1193 provider: `connectWallet` must work through
// eth_requestAccounts, eth_chainId, eth_call and eth_signTypedData_v4 exactly as MetaMask serves
// them. This provider is backed by a local key, so the typed data a wallet would receive is
// parsed from JSON and signed, and the whole payment runs through it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { recoverTypedDataAddress } from 'viem';
import { config } from '@graphpay/config';
import { permit2Domain, permitWitnessTypes } from '@graphpay/contracts';
import { whitechainNetwork } from '@graphpay_ethglobal/agentpay';
import { fakeChain, fakeFacilitator } from './fakes.mjs';
import { createGraphPayShop, networkForClient } from '../index.mjs';
import { connectWallet, graphpayCheckout } from '../src/client.mjs';

const ZERO_WORD = `0x${'0'.repeat(64)}`;

function provider({ chainId = 1874, account }) {
  const seen = [];
  let current = chainId;
  return {
    seen,
    async request({ method, params = [] }) {
      seen.push(method);
      switch (method) {
        case 'eth_requestAccounts':
          return [account.address.toLowerCase()];
        case 'eth_chainId':
          return `0x${current.toString(16)}`;
        case 'wallet_switchEthereumChain':
          current = Number.parseInt(params[0].chainId, 16);
          return null;
        case 'eth_call':
          return ZERO_WORD; // allowance 0, nonces 0
        case 'eth_signTypedData_v4': {
          const typed = JSON.parse(params[1]);
          const { EIP712Domain: _domain, ...types } = typed.types;
          seen.push(`sign:${typed.primaryType}`);
          return account.signTypedData({ domain: typed.domain, types, primaryType: typed.primaryType, message: typed.message });
        }
        default:
          throw new Error(`mock wallet: ${method} is not served`);
      }
    },
  };
}

test('a person pays through a real EIP-1193 provider: connect, switch chain, sign the two typed messages, pay', async () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const ethereum = provider({ chainId: 1, account }); // the wallet starts on another chain
  const chain = fakeChain();
  const facilitator = fakeFacilitator();
  const merchant = privateKeyToAccount(generatePrivateKey()).address;
  const shop = createGraphPayShop({ shopEns: `shop.${config.root.ens}`, merchant, catalog: [{ sku: 'box', name: 'box', unitPriceMicro: 2_000_000 }], facilitator, publicClient: chain.publicClient, open: true });
  const network = networkForClient(shop.network);
  const wallet = await connectWallet(ethereum, network);
  assert.equal(wallet.address, account.address);
  assert.ok(ethereum.seen.includes('wallet_switchEthereumChain'), 'the wallet was asked to switch to the shop chain');
  const result = await graphpayCheckout({ shopUrl: 'https://shop.test/api', item: 'box', qty: 1, wallet, publicClient: wallet.publicClient, network, fetch: async (url, init) => shop.order(new Request(url, init)) });
  assert.equal(result.status, 'paid');
  assert.deepEqual(ethereum.seen.filter((m) => m.startsWith('sign:')), ['sign:Permit', 'sign:PermitWitnessTransferFrom']);
  const payload = facilitator.calls.find((c) => c[0] === 'settle')[1].payload;
  const recovered = await recoverTypedDataAddress({
    domain: permit2Domain(network.chainId, network.permit2),
    types: permitWitnessTypes,
    primaryType: 'PermitWitnessTransferFrom',
    message: { permitted: { token: payload.permit.token, amount: BigInt(payload.permit.amount) }, spender: network.checkout, nonce: BigInt(payload.permit.nonce), deadline: BigInt(payload.permit.deadline), witness: { ...payload.order, amountMicro: BigInt(payload.order.amountMicro), deadline: BigInt(payload.order.deadline), kind: Number(payload.order.kind), mandateHash: payload.mandateHash } },
    signature: payload.signature,
  });
  assert.equal(recovered, account.address, 'the signature a wallet produced from the JSON typed data verifies');
});

test('a wallet that will not switch to the shop chain signs nothing', async () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const ethereum = provider({ chainId: 1, account });
  const stubborn = { ...ethereum, request: async (args) => (args.method === 'wallet_switchEthereumChain' ? Promise.reject(Object.assign(new Error('user rejected'), { code: 4001 })) : ethereum.request(args)) };
  await assert.rejects(connectWallet(stubborn, networkForClient(whitechainNetwork())), /switch the wallet to chain/);
  assert.ok(!ethereum.seen.some((m) => m.startsWith('sign:')));
});
