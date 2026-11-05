import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mcpUrl, parseToolResult } from '../src/mcp.mjs';

const result = (text, isError = false) => ({ content: [{ type: 'text', text }], isError });

test('the hosted MCP is the production domain plus the configured path', () => {
  assert.match(mcpUrl(), /^https:\/\/[a-z0-9.-]+\/api\/mcp$/);
});

test('tool results: ask is text, the others JSON; a JSON error body is returned, a bare error throws', () => {
  assert.deepEqual(parseToolResult('ask', result('ens\torders\nexplain=abc calls=2')), { text: 'ens\torders\nexplain=abc calls=2' });
  assert.deepEqual(parseToolResult('schema', result('{"sdl":"type Query { today: Int! }"}')), { sdl: 'type Query { today: Int! }' });
  assert.deepEqual(parseToolResult('graphql', result('{"data":null,"errors":[{"message":"bad"}]}', true)), { data: null, errors: [{ message: 'bad' }] });
  assert.throws(() => parseToolResult('explain', result('no trace for 0123456789ab on this instance', true)), { code: 'MCP_TOOL_ERROR' });
});
