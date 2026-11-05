import type { ReactElement } from 'react';
import type { ClientNetwork } from '../index.js';
import type { Expect } from './client.js';

export interface GraphPayButtonProps {
  shopUrl: string;
  item: string;
  qty?: number;
  parent?: string;
  network: ClientNetwork;
  onPaid?: (result: { orderId: string; transaction: string | null; explorer: string | null; amountMicro: bigint; alreadyPaid: boolean }) => void;
  label?: string;
  rpcUrl?: string;
  passcode?: string | (() => string | undefined | Promise<string | undefined>);
  ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<any> };
  expect?: Expect;
  className?: string;
}
export declare function GraphPayButton(props: GraphPayButtonProps): ReactElement;
