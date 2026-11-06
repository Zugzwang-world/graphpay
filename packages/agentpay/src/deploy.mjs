// deployCheckout: a developer's own GraphPayCheckout on Whitechain Sepolia. The shared demo
// deployment lets only its own relayers settle, so a developer who wants real settlements deploys
// their own and names their own relayer. The deployer becomes the checkout's admin (owner).

import { getAddress, isAddressEqual } from 'viem';
import { AgentPayError, assertChain, assertClientChain, whitechainNetwork } from './network.mjs';
import { checkoutAbi } from './vendor/abi.mjs';
import { checkoutCreationCode } from './vendor/bytecode.mjs';

// walletClient: the admin's wallet (pays the deployment gas in WBT). relayer: the address that
// will settle payments (gas only, never USDT). policyWriter: the address allowed to write agent
// spending policies (the pass); it may be the same key your buyer-side tooling uses to issue
// passes, but it must differ from both the admin and the relayer (the contract enforces this).
export async function deployCheckout({ walletClient, publicClient, relayer, policyWriter, network = whitechainNetwork() }) {
  const admin = walletClient?.account?.address;
  if (!admin) throw new Error('deployCheckout needs a wallet client with an account');
  if (!relayer || !policyWriter) throw new Error('deployCheckout needs a relayer and a policyWriter address');
  const roles = [admin, relayer, policyWriter].map((a) => getAddress(a));
  if (isAddressEqual(roles[0], roles[1]) || isAddressEqual(roles[0], roles[2]) || isAddressEqual(roles[1], roles[2])) {
    throw new AgentPayError('BAD_ROLES', 'the admin, the relayer and the policy writer must be three different addresses');
  }
  assertClientChain(publicClient, network);
  await assertChain(publicClient, network);
  const hash = await walletClient.deployContract({
    abi: checkoutAbi,
    bytecode: checkoutCreationCode,
    args: [network.token.address, network.permit2, roles[0], roles[1], roles[2]],
    chain: walletClient.chain ?? publicClient.chain,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success' || !receipt.contractAddress) throw new AgentPayError('DEPLOY_FAILED', `the deployment ${hash} did not succeed`);
  const address = getAddress(receipt.contractAddress);
  return Object.freeze({
    address,
    transactionHash: hash,
    deployBlock: receipt.blockNumber,
    network: whitechainNetwork({ checkout: address, deployBlock: receipt.blockNumber }),
  });
}
