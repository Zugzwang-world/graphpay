// A fake JSON-RPC chain on 127.0.0.1 for the funding tests: just enough eth_* to
// pin a block, read balances, nonces and an ERC-20, estimate gas, take a signed
// transaction and answer its receipt (with the Transfer log a token emits). Every
// request is appended to `journal` in order, so a test sees exactly what was asked
// of the RPC and when. Nothing here reaches a real network.

import { createServer } from 'node:http';
import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionResult,
  erc20Abi,
  keccak256,
  numberToHex,
  parseTransaction,
  recoverTransactionAddress,
} from 'viem';

const word = (n) => numberToHex(n, { size: 32 });
const lower = (balances = {}) => new Map(Object.entries(balances).map(([address, value]) => [address.toLowerCase(), value]));

// options: chainId; block, baseFee, tip (wei); confirmed and pending (FUNDER's nonces);
// gas and tokenGas (the estimates); balances { address: wei }; token { address, decimals,
// balances { address: units } }; tamper { receiptHash: true } answers every receipt with
// another transaction's hash, tamper { transferDelta } shifts the logged Transfer amount.
export async function fakeChain(options) {
  const s = { block: 1000n, baseFee: 5_000_000_000n, tip: 1_000_000n, confirmed: 7, gas: 21_000n, tokenGas: 52_000n, tamper: {}, ...options };
  s.pending ??= s.confirmed;
  const balances = lower(s.balances);
  const tokenBalances = lower(s.token?.balances);
  const journal = options.journal ?? [];
  const sent = [];
  const receipts = new Map();

  function receiptOf(tx) {
    const mined = s.block + 1n;
    const logs = [];
    if (s.token && tx.to?.toLowerCase() === s.token.address.toLowerCase()) {
      const { args } = decodeFunctionData({ abi: erc20Abi, data: tx.data });
      logs.push({
        address: s.token.address,
        topics: encodeEventTopics({ abi: erc20Abi, eventName: 'Transfer', args: { from: tx.from, to: args[0] } }),
        data: encodeAbiParameters([{ type: 'uint256' }], [args[1] + (s.tamper.transferDelta ?? 0n)]),
        blockNumber: numberToHex(mined),
        blockHash: word(mined),
        transactionHash: tx.hash,
        transactionIndex: '0x0',
        logIndex: '0x0',
        removed: false,
      });
    }
    return {
      transactionHash: s.tamper.receiptHash ? keccak256(tx.hash) : tx.hash,
      blockNumber: numberToHex(mined),
      blockHash: word(mined),
      transactionIndex: '0x0',
      from: tx.from,
      to: tx.to,
      status: '0x1',
      type: '0x2',
      gasUsed: numberToHex(tx.data ? s.tokenGas : s.gas),
      cumulativeGasUsed: numberToHex(tx.data ? s.tokenGas : s.gas),
      effectiveGasPrice: numberToHex(s.baseFee + s.tip),
      contractAddress: null,
      logs,
    };
  }

  async function answer(method, params) {
    switch (method) {
      case 'eth_chainId':
        return numberToHex(s.chainId);
      case 'eth_blockNumber':
        return numberToHex(s.block);
      case 'eth_getBlockByNumber':
        return {
          number: numberToHex(s.block),
          hash: word(s.block),
          parentHash: word(s.block - 1n),
          timestamp: '0x1',
          gasLimit: numberToHex(30_000_000n),
          gasUsed: '0x0',
          baseFeePerGas: numberToHex(s.baseFee),
          transactions: [],
        };
      case 'eth_maxPriorityFeePerGas':
        return numberToHex(s.tip);
      case 'eth_getTransactionCount':
        return numberToHex(params[1] === 'pending' ? s.pending : s.confirmed);
      case 'eth_getBalance':
        return numberToHex(balances.get(params[0].toLowerCase()) ?? 0n);
      case 'eth_estimateGas':
        return numberToHex(params[0].data ? s.tokenGas : s.gas);
      case 'eth_call': {
        const { functionName, args } = decodeFunctionData({ abi: erc20Abi, data: params[0].data });
        const result = functionName === 'decimals' ? s.token.decimals : (tokenBalances.get(args[0].toLowerCase()) ?? 0n);
        return encodeFunctionResult({ abi: erc20Abi, functionName, result });
      }
      case 'eth_sendRawTransaction': {
        const raw = params[0];
        const tx = { ...parseTransaction(raw), from: await recoverTransactionAddress({ serializedTransaction: raw }), hash: keccak256(raw) };
        sent.push(tx);
        receipts.set(tx.hash, receiptOf(tx));
        return tx.hash;
      }
      case 'eth_getTransactionReceipt':
        return receipts.get(params[0]) ?? null;
      default:
        throw Object.assign(new Error(`the fake chain has no ${method}`), { code: -32601 });
    }
  }

  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      const one = async ({ id, method, params = [] }) => {
        journal.push({ rpc: method, params });
        try {
          return { jsonrpc: '2.0', id, result: await answer(method, params) };
        } catch (error) {
          return { jsonrpc: '2.0', id, error: { code: error.code ?? -32000, message: error.message } };
        }
      };
      const request = JSON.parse(body);
      const reply = Array.isArray(request) ? await Promise.all(request.map(one)) : await one(request);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(reply));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    journal,
    sent,
    close: () => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    },
  };
}
