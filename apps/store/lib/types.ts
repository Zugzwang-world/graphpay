// What the kit's networkForClient returns, as the client components receive it.
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
