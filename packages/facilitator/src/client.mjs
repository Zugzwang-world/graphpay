// The payer's side of graphpay-order: signs the Permit2 witness over the order and, when the
// payer has not approved Permit2 yet, a bounded EIP-2612 approval (so it needs no gas and no
// earlier transaction). A SchemeNetworkClient for @x402/core's x402Client.

import { encodeAbiParameters, erc20Abi, getAddress, isAddressEqual, parseAbi } from 'viem';
import { eip2612Types, permit2Domain, permitWitnessTypes, tokenDomain } from '@graphpay/contracts';
import { SCHEME, fromWireOrder, requirementSchema } from './wire.mjs';

// The approval is bounded, never unlimited (the lab used 50 for a 6.00 budget).
export const DEFAULT_APPROVAL_MICRO = 50_000_000n;
const APPROVAL_TTL_SECONDS = 3600;
const noncesAbi = parseAbi(['function nonces(address owner) view returns (uint256)']);

// account: a viem local account (the payer's key never leaves it). publicClient reads the
// payer's allowance and token nonce. token: the config entry ({ address, eip712 }).
// checkout: our contract from the config (a 402 naming another is refused before anything is signed).
// payerName: the paying agent's ENS name ('' for a human); mandateHash: the human's intent.
export function graphPayOrderClient({ account, publicClient, chainId, token, permit2, checkout, payerName, mandateHash, approvalMicro = DEFAULT_APPROVAL_MICRO, now = () => Date.now() }) {
  if (!checkout) throw new Error('graphpay-order: the client needs the configured checkout');
  return {
    scheme: SCHEME,
    // context.maxAmountPerPayment: x402Client's resolved spend cap for this asset (atomic units).
    async createPaymentPayload(x402Version, requirements, context = {}) {
      const req = requirementSchema.parse(requirements);
      if (context.maxAmountPerPayment !== undefined && BigInt(req.amount) > BigInt(context.maxAmountPerPayment)) {
        throw new Error('graphpay-order: the amount is above the spend control for this asset');
      }
      if (!isAddressEqual(req.asset, token.address)) throw new Error('graphpay-order: the requirement asks for another token');
      if (req.network !== `eip155:${chainId}`) throw new Error('graphpay-order: the requirement is for another network');
      const order = fromWireOrder(req.extra.order);
      const amount = BigInt(req.amount);
      if (order.amountMicro !== amount || !isAddressEqual(order.merchant, req.payTo)) {
        throw new Error('graphpay-order: the order does not match the requirement');
      }
      if (!isAddressEqual(req.extra.contract, checkout)) throw new Error('graphpay-order: the requirement names another contract');
      // eth_chainId before signing: the reads below (allowance, token nonce) must be this chain's.
      if ((await publicClient.getChainId()) !== chainId) throw new Error('graphpay-order: the RPC is not on the configured chain');
      const permit = { token: getAddress(req.asset), amount, nonce: BigInt(order.orderId), deadline: order.deadline };
      const signature = await account.signTypedData({
        domain: permit2Domain(chainId, permit2),
        types: permitWitnessTypes,
        primaryType: 'PermitWitnessTransferFrom',
        message: {
          permitted: { token: permit.token, amount },
          spender: getAddress(checkout),
          nonce: permit.nonce,
          deadline: permit.deadline,
          witness: { ...order, mandateHash },
        },
      });

      let approvalPermit = '0x';
      const allowance = await publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'allowance', args: [account.address, permit2] });
      if (allowance < amount) {
        const value = amount > approvalMicro ? amount : approvalMicro;
        const deadline = BigInt(Math.floor(now() / 1000) + APPROVAL_TTL_SECONDS);
        const nonce = await publicClient.readContract({ address: token.address, abi: noncesAbi, functionName: 'nonces', args: [account.address] });
        const approval = await account.signTypedData({
          domain: tokenDomain(chainId, token),
          types: eip2612Types,
          primaryType: 'Permit',
          message: { owner: account.address, spender: permit2, value, nonce, deadline },
        });
        approvalPermit = encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }, { type: 'bytes' }], [value, deadline, approval]);
      }

      return {
        x402Version,
        payload: {
          order: req.extra.order,
          mandateHash,
          payerName,
          payer: account.address,
          permit: { token: permit.token, amount: String(amount), nonce: String(permit.nonce), deadline: String(permit.deadline) },
          signature,
          approvalPermit,
        },
      };
    },
  };
}
