import { createRegistry } from './run-registry.server.ts';

// One registry per server process; globalThis keeps it across hot reloads in development.
const holder = globalThis as unknown as { __graphpayRuns?: ReturnType<typeof createRegistry> };
export const runs = (holder.__graphpayRuns ??= createRegistry());
