// The records each resolver is seeded with (planning/SPEC/IDENTITY_ENS.md §4–§5, as amended by
// docs/plan/amendments/M5-ens.md §1), encoded as the setter calls PermissionedResolver.initialize
// runs. Seeds always use the name's own DNS encoding; only the wildcard writes the default record.

import { config, network } from '@graphpay/config';
import { encodeFunctionData, getAddress, keccak256, stringToBytes } from 'viem';
import { permissionedResolverAbi } from './abi.generated.mjs';
import { encodeInteropAddress } from './erc7930.mjs';
import { coinTypeOf, dnsEncode } from './names.mjs';

export const KEYS = Object.freeze({ ...config.ens.records });
export const ETH_COIN_TYPE = 60n;
export const WHITECHAIN_COIN_TYPE = BigInt(config.networks.whitechain.ensCoinType);
if (coinTypeOf(network('whitechain').chainId) !== WHITECHAIN_COIN_TYPE) throw new Error('config: whitechain.ensCoinType is not ENSIP-11 of its chain id');

// The DNS encoding of the root name: a setter given it writes the default record (§4 D).
export const DEFAULT_RECORD_NAME = '0x00';

export const mcpUrl = () => `${config.site.url}${config.site.mcpPath}`;
export const webUrl = () => config.site.url;

// The ERC-7930 value of `x-graphpay-accepts`: test USDT on Whitechain Sepolia (ADR-0038).
export function acceptsValue() {
  return encodeInteropAddress({ chainId: network('whitechain').chainId, address: config.whitechain.tokens.usdt.address });
}

const text = (key, value) => ({ type: 'text', key, value: String(value) });
const addr = (coinType, address) => ({ type: 'addr', coinType, value: getAddress(address) });

export function rootRecords(entry) {
  return [text(KEYS.kind, 'root'), text(KEYS.agentContext, entry.context), text(KEYS.agentEndpointMcp, mcpUrl()), text(KEYS.agentEndpointWeb, webUrl())];
}

// owner: a plan entry; wallet: its address (the merchant wallet for a shop).
export function ownerRecords(owner, wallet) {
  const out = [text(KEYS.kind, owner.kind), text(KEYS.status, 'active'), text(KEYS.agentContext, owner.context), addr(ETH_COIN_TYPE, wallet)];
  if (owner.kind === 'shop') out.push(addr(WHITECHAIN_COIN_TYPE, wallet), text(KEYS.acceptsText, acceptsValue()));
  return out;
}

// agent: a plan entry; wallet: the address that holds its token (its own, or its owner's).
export function agentRecords(agent, wallet) {
  return [
    text(KEYS.status, 'active'),
    text(KEYS.capMicro, agent.capMicro.toString()),
    text(KEYS.principal, agent.owner),
    text(KEYS.kind, 'agent'),
    text(KEYS.agentContext, agent.context),
    text(KEYS.agentEndpointMcp, mcpUrl()),
    addr(ETH_COIN_TYPE, wallet),
    addr(WHITECHAIN_COIN_TYPE, wallet),
  ];
}

// The wildcard's default record: never a status or a cap (§4 D, §6 trap 3).
export function wildcardRecords(entry) {
  return [text(KEYS.synthetic, 'true'), text(KEYS.kind, 'agent'), text(KEYS.agentContext, entry.context)];
}

// Encoded setter calls for `records` on `dnsName` (hex).
export function setterCalls(dnsName, records) {
  return records.map((r) =>
    r.type === 'text'
      ? encodeFunctionData({ abi: permissionedResolverAbi, functionName: 'setText', args: [dnsName, r.key, r.value] })
      : encodeFunctionData({ abi: permissionedResolverAbi, functionName: 'setAddress', args: [dnsName, r.coinType, r.value] }),
  );
}

export const seedCalls = (name, records) => setterCalls(dnsEncode(name), records);

// The two setter grants of an agent that holds its own wallet (ADR-0036): its own
// agent-context and its own Whitechain address. Only the selector and the key or coin
// type of each encoded call count; the name argument is ignored by the resolver.
export function agentSetterGrants(agentWallet) {
  const account = getAddress(agentWallet);
  return [
    encodeFunctionData({
      abi: permissionedResolverAbi,
      functionName: 'grantSetterRoles',
      args: [encodeFunctionData({ abi: permissionedResolverAbi, functionName: 'setText', args: ['0x', KEYS.agentContext, ''] }), account],
    }),
    encodeFunctionData({
      abi: permissionedResolverAbi,
      functionName: 'grantSetterRoles',
      args: [encodeFunctionData({ abi: permissionedResolverAbi, functionName: 'setAddress', args: ['0x', WHITECHAIN_COIN_TYPE, '0x'] }), account],
    }),
  ];
}

// The resolver role resources of those grants (PermissionedResolverLib.resource).
export const textResource = (key) => BigInt(keccak256(stringToBytes(key)));
export const coinResource = (coinType) => BigInt(keccak256(`0x${BigInt(coinType).toString(16).padStart(64, '0')}`));

// Deterministic factory salt for a contract of a name.
export const saltOf = (kind, name) => BigInt(keccak256(stringToBytes(`${config.ens.namespace.saltPrefix}:${kind}:${name}`)));
