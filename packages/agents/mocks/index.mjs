// @graphpay/agents/mocks: the mock services and the scripted mock models, for CI
// and for AGENT_MODE=mock runs. Nothing here signs, pays or reads a network.

import { teamCast } from '../src/cast.mjs';
import { runErrand } from '../src/errand.mjs';
import { createScriptedModels } from './models.mjs';
import { createMockHooks, createMockMcp, mockGraphRows } from './services.mjs';

export { createScriptedModels, readPrompt } from './models.mjs';
export { createMockActivity, createMockHooks, createMockMcp, createMockShopSurface, MOCK_CONTRACT, MOCK_HOST, MOCK_SDL, mockAddress, mockGraphRows, mockNode, mockTx } from './services.mjs';

// A whole mock world: the graph, the shops, ENS, the quote store and the models.
// options: { cast, now, play, faults, ens, payee, accepts, shops, graph }.
export function createMockWorld(options = {}) {
  const cast = options.cast ?? teamCast();
  const clock = () => options.now ?? Date.now();
  const mcp = createMockMcp({ cast, rows: mockGraphRows(cast, options.graph ?? {}) });
  const hooks = createMockHooks({ cast, mcp, clock, ens: options.ens, payee: options.payee, accepts: options.accepts, shops: options.shops });
  const mockModels = createScriptedModels({ cast, play: options.play, faults: options.faults });
  return { cast, mcp, hooks, mockModels };
}

// One errand on the mock world, never a paid call: the mode is fixed to mock.
export async function runMockErrand(options = {}) {
  const world = createMockWorld(options);
  const out = await runErrand({ ...options, mode: 'mock', cast: world.cast, hooks: world.hooks, mcp: world.mcp, mockModels: world.mockModels });
  return { ...out, world };
}
