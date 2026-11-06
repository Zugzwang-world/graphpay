// A leaderboard: players, games and points. A "win" edge runs from a game to a player and
// carries the points as its value; totals add them up on both ends, so the player and the
// game each get a row, and the board is one sorted read filtered to players.
import { connect, createStore, defineGraph, nodeKeyOf } from '@graphpay_ethglobal/arkiv-graph';

const graph = defineGraph({
  project: 'leaderboard',
  node: { columns: ['name:str'] },
  edge: { columns: ['game:str/i'] },
  totals: {
    counters: ['wins', 'points'],
    rules: { win: { wins: 'count', points: 'value' } },
  },
});

const arkiv = await connect();
const store = createStore({ graph, arkiv, stream: 'matches' });

const player = (name) => ({ node: nodeKeyOf(name), epoch: 0, kind: 'player', columns: { name } });
const game = (name) => ({ node: nodeKeyOf(`game:${name}`), epoch: 0, kind: 'game', columns: { name } });
const ts = Math.floor(Date.now() / 1000);
const matches = [
  ['ada', 'chess', 30n],
  ['grace', 'chess', 20n],
  ['ada', 'go', 25n],
  ['linus', 'go', 40n],
  ['grace', 'go', 15n],
];
await store.write(matches.map(([who, game_, points], i) => ({ ref: `m${i + 1}`, kind: 'win', from: game(game_), to: player(who), value: points, ts, columns: { game: game_ } })));

// The board: one read, sorted by points, all-time window.
const { rows, explain } = await store.query('totals', { filter: { window: { eq: 'all' }, kind: { eq: 'player' } }, orderBy: { field: 'points', direction: 'desc' }, limit: 3 });
const names = new Map(matches.map(([who]) => [nodeKeyOf(who), who]));
rows.forEach((r, i) => console.log(`${i + 1}. ${names.get(r.node)}  ${r.points} points in ${r.wins} win(s)`));
console.log(`(${explain.calls} read, explain ${explain.explainId})`);
