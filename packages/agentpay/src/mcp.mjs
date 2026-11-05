// The same tool definitions as MCP tools (@modelcontextprotocol/sdk McpServer).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { buyerToolDefinitions, merchantToolDefinitions } from './tools.mjs';

const asText = (result) => ({ content: [{ type: 'text', text: JSON.stringify(result) }], isError: result?.ok === false });

export function registerTools(server, definitions, { prefix = '' } = {}) {
  for (const d of definitions) server.registerTool(`${prefix}${d.name}`, { description: d.description, inputSchema: d.shape }, async (args) => asText(await d.run(args ?? {})));
  return server;
}

export const registerBuyerTools = (server, buyer, options) => registerTools(server, buyerToolDefinitions(buyer, options));
export const registerMerchantTools = (server, merchant, options) => registerTools(server, merchantToolDefinitions(merchant, options));

// One MCP server for a buyer agent, a merchant agent, or both (merchant tools get a "merchant_" prefix then).
export function createAgentPayMcpServer({ buyer, merchant, buyerOptions, merchantOptions, name = 'agentpay', version = '0.1.0' }) {
  const server = new McpServer({ name, version });
  if (buyer) registerTools(server, buyerToolDefinitions(buyer, buyerOptions));
  if (merchant) registerTools(server, merchantToolDefinitions(merchant, merchantOptions), { prefix: buyer ? 'merchant_' : '' });
  return server;
}
