// arkiv-graph: a graph layer over Arkiv. The developer defines node types,
// edge types and totals (which edge kinds move which counters, per window); the
// package applies the project/type/schema_v conventions, writes events as atomic
// batches with a safe writer, scopes every read to a trusted owner, and runs the
// stock Arkiv SDK against an in-memory node (ArkivSim) for tests.

export { LIMITS, parseColumns, defineEntity, checkDefinition, checkIndexes } from './src/schema.mjs';
export { defineGraph } from './src/graph.mjs';
export { typed, entityValues, patchValues, plainRow, nodeKeyOf, jsonBytes, fromJsonBytes, dayOf } from './src/values.mjs';
export { checkedOwner, scope, trustedRows, readAll, findOne, countRows } from './src/read.mjs';
export { createWriter, operationBytes, WriteRevertedError, WriteUncertainError, WriteNonceTakenError } from './src/writer.mjs';
export { arkivTransport, arkivChain, arkivClients, assertChain, newStats, parseRateLimit, redactError, isRequestTooLarge } from './src/transport.mjs';
export { ArkivSim, EXECUTE_ABI, EVENTS_ABI } from './src/sim/arkivsim.mjs';
export { parseQuery, render as renderQuery } from './src/sim/query.mjs';
export { createEngine, createExplainStore, explainIdOf } from './src/engine.mjs';
export { compileFilter } from './src/filter.mjs';
export { connect, ENTITY_ADDRESS } from './src/connect.mjs';
export { createStore } from './src/store.mjs';
export { ExpirationTime } from '@arkiv-network/sdk';
