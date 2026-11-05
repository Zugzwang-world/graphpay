import type { PublicClient, WalletClient } from 'viem';

export interface CatalogItem {
  sku: string;
  name: string;
  unit?: string | null;
  unitPriceMicro: number | bigint | string;
}

export interface ClientNetwork {
  chainId: number;
  caip2: string;
  name: string;
  nativeSymbol: string;
  explorer: string;
  checkout: string;
  permit2: string;
  token: { address: string; symbol: string; decimals: number; eip712: { name: string; version: string } };
}

export interface GraphPayShopConfig {
  shopEns: string;
  merchant: `0x${string}`;
  catalog: CatalogItem[];
  publicClient: PublicClient;
  facilitatorUrl?: string;
  facilitatorToken?: string;
  facilitator?: { verify: (...args: unknown[]) => Promise<unknown>; settle: (...args: unknown[]) => Promise<unknown> };
  token?: { address: `0x${string}`; name: string; version: string; symbol?: string };
  passcode?: string;
  open?: boolean;
  walletClient?: WalletClient;
  resourceBase?: string;
  network?: unknown;
  riskCheck?: unknown;
  log?: (line: string) => void;
}

type Handler = (request: Request, context?: unknown) => Response | Promise<Response>;

export interface GraphPayShop {
  shopEns: string;
  // The @graphpay/agentpay merchant: refunds, delivery marks, subscriptions, exportCsv.
  merchant: {
    deliver(orderId: string): Promise<{ transaction: string }>;
    refund(orderId: string, amountMicro: bigint | string, options?: { reasonCode?: number; note?: string }): Promise<{ transaction: string; amountMicro: bigint; full: boolean }>;
    exportCsv(options?: { fromBlock?: bigint; toBlock?: bigint }): Promise<string>;
    [key: string]: unknown;
  };
  network: { chainId: number; caip2: string; name: string; nativeSymbol: string; explorer: string; checkout: string; permit2: string; token: { address: string; symbol: string; decimals: number; eip712: { name: string; version: string } } };
  catalog: Handler;
  order: Handler;
  quote: Handler;
  pay: Handler;
  reorder: Handler;
}

export declare const MAX_QUANTITY: number;
export declare class CatalogError extends Error {}
export declare class ParentError extends Error {}
export declare function createGraphPayShop(config: GraphPayShopConfig): GraphPayShop;
export declare function networkForClient(network: GraphPayShop['network']): ClientNetwork;
