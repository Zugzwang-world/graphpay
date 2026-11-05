// The facilitator's view of Whitechain through viem: the reads that predict a payment, the
// relayer's send, and the receipt's verdict. The pipeline only talks to this adapter, so the
// offline tests replace it with a fake.

import { decodeEventLog, erc20Abi, isAddressEqual, parseAbi } from 'viem';
import { network } from '@graphpay/config';
import { checkoutAbi } from '@graphpay/contracts';

const permit2Abi = parseAbi(['function nonceBitmap(address owner, uint256 wordPos) view returns (uint256)']);
const noncesAbi = parseAbi(['function nonces(address owner) view returns (uint256)']);
const erc1271Abi = parseAbi(['function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)']);
const ERC1271_MAGIC = '0x1626ba7e';

// publicClient, walletClient (the relayer's), account (the relayer's local account).
// chain: the viem chain the relayer signs for; it must be Whitechain's, and the RPC is asked
// eth_chainId again before every send.
export function viemChain({ publicClient, walletClient, account, checkout, token, permit2, chain }) {
  const expected = network('whitechain').chainId;
  if (chain?.id !== expected) throw new Error(`viemChain: the relayer signs for chain ${expected} only`);
  const c = { address: checkout, abi: checkoutAbi };
  const chainOk = async () => (await publicClient.getChainId()) === expected;
  return {
    relayerAddress: account.address,
    chainOk,

    // Permit2 branches on the payer's code: none → ecrecover; any (a contract, or an EOA with an
    // EIP-7702 delegation) → isValidSignature with the bytes as they are.
    getCode(address) {
      return publicClient.getCode({ address });
    },

    async isValidSignature(address, hash, signature) {
      try {
        // Called from Permit2, as the transfer will be: a wallet that answers differently by
        // caller cannot pass here and fail on-chain.
        const magic = await publicClient.readContract({ address, abi: erc1271Abi, functionName: 'isValidSignature', args: [hash, signature], account: permit2 });
        return magic.toLowerCase() === ERC1271_MAGIC;
      } catch {
        return false;
      }
    },

    async readState({ order, payer }) {
      const nonce = BigInt(order.orderId);
      const [block, state, bitmap, balance, allowance, tokenNonce, bound, policy] = await Promise.all([
        publicClient.getBlock({ blockTag: 'latest' }),
        publicClient.readContract({ ...c, functionName: 'orders', args: [order.orderId] }),
        publicClient.readContract({ address: permit2, abi: permit2Abi, functionName: 'nonceBitmap', args: [payer, nonce >> 8n] }),
        publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [payer] }),
        publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'allowance', args: [payer, permit2] }),
        publicClient.readContract({ address: token.address, abi: noncesAbi, functionName: 'nonces', args: [payer] }),
        publicClient.readContract({ ...c, functionName: 'nodeOfWallet', args: [payer] }),
        publicClient.readContract({ ...c, functionName: 'policies', args: [order.payerNode] }),
      ]);
      const spentToday = await publicClient.readContract({ ...c, functionName: 'spentToday', args: [order.payerNode] });
      return {
        nowSec: block.timestamp,
        order: { status: Number(state.status), termsHash: state.termsHash },
        nonceUsed: ((bitmap >> (nonce & 0xffn)) & 1n) === 1n,
        balance,
        allowance,
        tokenNonce,
        bound,
        policy: {
          wallet: policy.wallet,
          revoked: policy.revoked,
          dailyCapMicro: BigInt(policy.dailyCapMicro),
          expiry: BigInt(policy.expiry),
          epoch: Number(policy.epoch),
        },
        spentToday: BigInt(spentToday),
      };
    },

    nodeOfWallet(wallet) {
      return publicClient.readContract({ ...c, functionName: 'nodeOfWallet', args: [wallet] });
    },

    // estimateGas succeeds for doomed payments too (failures are events): never a verdict.
    estimateSettle(args) {
      return publicClient.estimateContractGas({ ...c, functionName: 'settleOrder', args, account });
    },

    gasPrice() {
      return publicClient.getGasPrice();
    },

    relayerBalance() {
      return publicClient.getBalance({ address: account.address });
    },

    async sendSettle(args, gas) {
      if (!(await chainOk())) throw new Error('sendSettle: the RPC is not on the relayer chain');
      return walletClient.writeContract({ ...c, functionName: 'settleOrder', args, account, chain, gas });
    },

    async waitReceipt(hash, timeoutMs) {
      try {
        const r = await publicClient.waitForTransactionReceipt({ hash, timeout: timeoutMs });
        return { ...r, fee: r.gasUsed * r.effectiveGasPrice };
      } catch {
        return null; // unsettled: the caller must not claim success or failure
      }
    },

    outcomeOf(receipt, orderId) {
      if (receipt.status !== 'success') return { settled: false };
      for (const log of receipt.logs) {
        if (!isAddressEqual(log.address, checkout)) continue;
        try {
          const ev = decodeEventLog({ abi: checkoutAbi, data: log.data, topics: log.topics });
          if (ev.args.orderId?.toLowerCase() !== orderId.toLowerCase()) continue;
          if (ev.eventName === 'PaymentSettled') return { settled: true };
          if (ev.eventName === 'PaymentFailed') return { settled: false, failReason: Number(ev.args.reason) };
        } catch {
          // another event of ours
        }
      }
      return { settled: false };
    },
  };
}
