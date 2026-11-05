// The shop's view of Whitechain: order state reads (alreadyPaid, the re-order's parent) and the
// merchant's own actions (markDelivered, refund) with the merchant key, when configured. The
// shop API only talks to these, so the offline tests replace them with fakes.

import { checkoutAbi } from '@graphpay/contracts';

export function viemOrders({ publicClient, checkout }) {
  return {
    async readOrder(orderId) {
      const s = await publicClient.readContract({ address: checkout, abi: checkoutAbi, functionName: 'orders', args: [orderId] });
      return { status: Number(s.status), termsHash: s.termsHash, buyerNode: s.buyerNode.toLowerCase(), shopNode: s.shopNode.toLowerCase(), merchant: s.merchant };
    },
  };
}

// walletClients: shop key -> a viem wallet client holding that shop's merchant key (or absent).
// deliver() sends markDelivered and waits up to waitMs for the receipt: 'delivered' once it
// lands, 'pending' if it is still on its way, 'not_configured' without a key.
export function merchantActions({ publicClient, walletClients, checkout, chain, waitMs = 8_000 }) {
  const c = { address: checkout, abi: checkoutAbi };
  const send = async (shopKey, functionName, args) => {
    const wallet = walletClients[shopKey];
    if (!wallet) return null;
    const { request } = await publicClient.simulateContract({ ...c, functionName, args, account: wallet.account, chain });
    return wallet.writeContract(request);
  };
  return {
    async deliver(shopKey, orderId) {
      if (!walletClients[shopKey]) return 'not_configured';
      const hash = await send(shopKey, 'markDelivered', [orderId]);
      try {
        const r = await publicClient.waitForTransactionReceipt({ hash, timeout: waitMs });
        return r.status === 'success' ? 'delivered' : 'pending';
      } catch {
        return 'pending';
      }
    },
    // A partial or full refund from the merchant's float (it approved the checkout at M2).
    async refund(shopKey, orderId, amountMicro, reason = 0) {
      const hash = await send(shopKey, 'refund', [orderId, BigInt(amountMicro), reason]);
      if (!hash) throw new Error('refund: no merchant key for this shop');
      const r = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
      return { hash, status: r.status, gasUsed: r.gasUsed };
    },
  };
}
