import type { PublicClient } from 'viem';
import type { ClientNetwork } from '../index.js';

export interface Wallet {
  address: `0x${string}`;
  signTypedData(typedData: Record<string, unknown>): Promise<`0x${string}`>;
}
export interface ConnectedWallet extends Wallet {
  publicClient: PublicClient;
}
export interface Quote {
  paymentRequired: unknown;
  requirement: { payTo: `0x${string}`; amount: string; extra: { shopName: string; order: Record<string, string> } };
  order: Record<string, string>;
  amountMicro: bigint;
  shopName: string;
  deadline: number;
  summary: string;
  item: string;
  qty: number;
  parent?: string;
}
export interface Expect {
  payTo?: string;
  maxAmountMicro?: bigint | number | string;
}
export type PayResult =
  | { status: 'paid'; orderId: string; alreadyPaid: boolean; transaction: string | null; explorer: string | null; amountMicro: bigint }
  | { status: 'failed'; orderId: string; reason: string; transaction: string | null }
  | { status: 'unknown'; orderId: string; signed: unknown; reason: string }
  | { status: 'declined'; orderId: string };

export declare const HEADERS: Readonly<{ required: string; signature: string; response: string }>;
export declare const PAYER_HEADER: string;
export declare const PASSCODE_HEADER: string;
export declare class CheckoutError extends Error {
  code: string;
}
export declare function encodeHeader(value: unknown): string;
export declare function decodeHeader(value: string | null): any;
export declare function getQuote(options: { shopUrl: string; item: string; qty?: number; parent?: string; payer: string; network: ClientNetwork; expect?: Expect; fetch?: typeof fetch; nowSec?: number }): Promise<Quote>;
export declare function payQuote(options: { shopUrl: string; quote: Quote; account: Wallet; publicClient: PublicClient; network: ClientNetwork; passcode?: string; signed?: unknown; approvalMicro?: bigint; fetch?: typeof fetch; nowSec?: number }): Promise<PayResult>;
export declare function graphpayCheckout(options: { shopUrl: string; item: string; qty?: number; parent?: string; wallet: ConnectedWallet; publicClient: PublicClient; network: ClientNetwork; passcode?: string; approve?: (quote: Quote) => boolean | Promise<boolean>; expect?: Expect; fetch?: typeof fetch }): Promise<PayResult>;
export declare function connectWallet(ethereum: { request(args: { method: string; params?: unknown[] }): Promise<any> }, network: ClientNetwork, options?: { rpcUrl?: string; chainName?: string; nativeSymbol?: string }): Promise<ConnectedWallet>;
