// The graph's MCP tools for the agents (McpLike in packages/agents/index.d.ts): the
// hosted endpoint on the production domain (config site.url + site.mcpPath) over
// Streamable HTTP, through @ai-sdk/mcp. The model gets the server's own tools; code's
// own calls come back parsed: { sdl } | { text } | { data, errors?, extensions } | a trace.

import { createMCPClient } from '@ai-sdk/mcp';
import { config } from '@graphpay/config';

export const mcpUrl = () => `${config.site.url}${config.site.mcpPath}`;

// A tool result as the agents read it. `ask` answers a TSV table (text); the others
// answer JSON. A tool error with a JSON body (a GraphQL error) is returned, not thrown.
export function parseToolResult(name, result) {
  const text = (result?.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
  let json;
  try {
    json = name === 'ask' ? undefined : JSON.parse(text);
  } catch {
    json = undefined;
  }
  if (result?.isError && json === undefined) {
    const err = new Error(`mcp ${name}: ${text.slice(0, 300)}`);
    err.code = 'MCP_TOOL_ERROR';
    throw err;
  }
  return json ?? { text };
}

// transport: an MCPTransport (the tests) or the hosted URL by default.
export async function connectMcp({ url = mcpUrl(), transport } = {}) {
  const client = await createMCPClient({ transport: transport ?? { type: 'http', url } });
  return {
    url: transport ? null : url,
    tools: () => client.tools(),
    async call(name, args) {
      return parseToolResult(name, await client.callTool({ name, arguments: args ?? {} }));
    },
    close: () => client.close(),
  };
}
