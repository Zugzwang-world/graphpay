// A parser for Arkiv's query language as the SDK 1.0.1 renders it (src/query/expression.ts,
// src/query/order.ts): comparisons `name op literal`, `name BETWEEN a AND b`,
// `name STARTSWITH str('…')`, `EXISTS(name)`, `TYPEOF(name) = tag`, AND binding tighter
// than OR, parentheses, and an optional trailing `ORDER BY name:type ASC|DESC`. Literals
// are tagged (`u64(5)`, `str('a''b')`, `key(0x…)`) or bare (`true`, a number as i32, a
// quoted string as str). ArkivSim evaluates the tree; `render` writes it back, so a
// caller can parse untrusted text and re-render it before adding its own filters.

const TAGS = new Set(['bool', 'i32', 'u64', 'u256', 'dec', 'str', 'addr', 'key']);
const SYSTEM = new Set(['$key', '$owner', '$creator', '$expiresAt']);
const NAME = /^[$A-Za-z][A-Za-z0-9._-]*/;
const ORDER = /\s+ORDER\s+BY\s+([$A-Za-z][A-Za-z0-9._-]*):([a-z0-9]+)\s+(ASC|DESC)\s*$/;

function decUnits(text) {
  const m = /^(-)?(\d+)(?:\.(\d{1,18}))?$/.exec(text);
  if (!m) throw new Error(`bad dec literal ${text}`);
  const units = BigInt(m[2]) * 10n ** 18n + BigInt((m[3] ?? '').padEnd(18, '0') || '0');
  return m[1] ? -units : units;
}

function literal(tag, raw) {
  switch (tag) {
    case 'i32': {
      if (!/^-?\d+$/.test(raw)) throw new Error(`bad i32 literal ${raw}`);
      const n = Number(raw);
      if (n < -2147483648 || n > 2147483647) throw new Error(`i32 out of range ${raw}`);
      return { tag, value: n };
    }
    case 'u64':
    case 'u256': {
      if (!/^\d+$/.test(raw)) throw new Error(`bad ${tag} literal ${raw}`);
      const v = BigInt(raw);
      if (tag === 'u64' && v >= 2n ** 64n) throw new Error(`u64 out of range ${raw}`);
      if (v >= 2n ** 256n) throw new Error(`u256 out of range ${raw}`);
      return { tag, value: v };
    }
    case 'dec':
      return { tag, value: decUnits(raw) };
    case 'key':
      if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) throw new Error(`bad key literal ${raw}`);
      return { tag, value: raw.toLowerCase() };
    case 'addr':
      if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) throw new Error(`bad addr literal ${raw}`);
      return { tag, value: raw.toLowerCase() };
    default:
      throw new Error(`bad literal tag ${tag}`);
  }
}

class Parser {
  constructor(text) {
    this.text = text;
    this.i = 0;
  }

  ws() {
    while (this.i < this.text.length && /\s/.test(this.text[this.i])) this.i += 1;
  }

  peekWord() {
    this.ws();
    const m = NAME.exec(this.text.slice(this.i));
    return m ? m[0] : null;
  }

  keyword(word) {
    this.ws();
    const rest = this.text.slice(this.i);
    if (rest.startsWith(word) && !/[A-Za-z0-9._-]/.test(rest[word.length] ?? '')) {
      this.i += word.length;
      return true;
    }
    return false;
  }

  expect(ch) {
    this.ws();
    if (this.text[this.i] !== ch) throw new Error(`expected "${ch}" at ${this.i}`);
    this.i += 1;
  }

  name() {
    const w = this.peekWord();
    if (!w) throw new Error(`expected a name at ${this.i}`);
    if (w.startsWith('$') && !SYSTEM.has(w)) throw new Error(`unknown system attribute ${w}`);
    this.i += w.length;
    return w;
  }

  quoted() {
    if (this.text[this.i] !== "'") throw new Error(`expected ' at ${this.i}`);
    let out = '';
    this.i += 1;
    for (;;) {
      if (this.i >= this.text.length) throw new Error('unterminated string');
      const ch = this.text[this.i];
      if (ch === "'") {
        if (this.text[this.i + 1] === "'") {
          out += "'";
          this.i += 2;
          continue;
        }
        this.i += 1;
        return out;
      }
      out += ch;
      this.i += 1;
    }
  }

  literal() {
    this.ws();
    if (this.keyword('true')) return { tag: 'bool', value: true };
    if (this.keyword('false')) return { tag: 'bool', value: false };
    if (this.text[this.i] === "'") return { tag: 'str', value: this.quoted() };
    const num = /^-?\d+/.exec(this.text.slice(this.i));
    if (num) {
      this.i += num[0].length;
      return literal('i32', num[0]);
    }
    const word = this.peekWord();
    if (!word || !TAGS.has(word) || word === 'bool') throw new Error(`expected a literal at ${this.i}`);
    this.i += word.length;
    this.expect('(');
    this.ws();
    if (word === 'str') {
      const value = this.quoted();
      this.expect(')');
      return { tag: 'str', value };
    }
    const close = this.text.indexOf(')', this.i);
    if (close === -1) throw new Error('unterminated literal');
    const raw = this.text.slice(this.i, close).trim();
    this.i = close + 1;
    return literal(word, raw);
  }

  primary() {
    this.ws();
    if (this.text[this.i] === '(') {
      this.i += 1;
      const inner = this.or();
      this.expect(')');
      return inner;
    }
    if (this.keyword('EXISTS')) {
      this.expect('(');
      const name = this.name();
      this.expect(')');
      return { kind: 'exists', name };
    }
    if (this.keyword('TYPEOF')) {
      this.expect('(');
      const name = this.name();
      this.expect(')');
      this.expect('=');
      const tag = this.peekWord();
      if (!tag || !TAGS.has(tag)) throw new Error(`bad type tag at ${this.i}`);
      this.i += tag.length;
      return { kind: 'typeOf', name, tag };
    }
    const name = this.name();
    if (this.keyword('BETWEEN')) {
      const low = this.literal();
      if (!this.keyword('AND')) throw new Error(`expected AND in BETWEEN at ${this.i}`);
      const high = this.literal();
      if (low.tag !== high.tag) throw new Error('BETWEEN bounds of different types');
      return { kind: 'between', name, value: low, high };
    }
    if (this.keyword('STARTSWITH')) {
      const value = this.literal();
      if (value.tag !== 'str') throw new Error('STARTSWITH takes a str');
      return { kind: 'startsWith', name, value };
    }
    this.ws();
    const op = /^(<=|>=|=|<|>)/.exec(this.text.slice(this.i));
    if (!op) throw new Error(`expected an operator at ${this.i}`);
    this.i += op[0].length;
    return { kind: 'comparison', name, operator: op[0], value: this.literal() };
  }

  and() {
    const items = [this.primary()];
    while (this.keyword('AND')) items.push(this.primary());
    return items.length === 1 ? items[0] : { kind: 'and', items };
  }

  or() {
    const items = [this.and()];
    while (this.keyword('OR')) items.push(this.and());
    return items.length === 1 ? items[0] : { kind: 'or', items };
  }
}

function leaves(node) {
  return node.kind === 'and' || node.kind === 'or' ? node.items.reduce((n, x) => n + leaves(x), 0) : 1;
}

function depth(node) {
  return node.kind === 'and' || node.kind === 'or' ? 1 + Math.max(...node.items.map(depth)) : 0;
}

export function parseQuery(text) {
  let body = text;
  let orderBy = null;
  const m = ORDER.exec(text);
  if (m) {
    if (!TAGS.has(m[2])) throw new Error(`bad sort type ${m[2]}`);
    orderBy = { name: m[1], tag: m[2], direction: m[3] };
    body = text.slice(0, m.index);
  }
  const p = new Parser(body);
  const where = p.or();
  p.ws();
  if (p.i !== body.length) throw new Error(`unexpected text at ${p.i}`);
  return { where, orderBy, leaves: leaves(where), depth: depth(where) };
}

function renderLiteral({ tag, value }) {
  switch (tag) {
    case 'bool':
      return value ? 'true' : 'false';
    case 'str':
      return `str('${String(value).replaceAll("'", "''")}')`;
    case 'dec': {
      const neg = value < 0n;
      const abs = neg ? -value : value;
      const frac = (abs % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
      return `dec(${neg ? '-' : ''}${abs / 10n ** 18n}${frac ? `.${frac}` : ''})`;
    }
    default:
      return `${tag}(${value})`;
  }
}

const PRECEDENCE = { or: 1, and: 2 };

function nested(node, minimum) {
  const text = render(node);
  const p = PRECEDENCE[node.kind] ?? 3;
  return p < minimum ? `(${text})` : text;
}

// Renders a parsed tree as the SDK would, tagged literals and minimal parentheses.
export function render(node) {
  switch (node.kind) {
    case 'comparison':
      return `${node.name} ${node.operator} ${renderLiteral(node.value)}`;
    case 'between':
      return `${node.name} BETWEEN ${renderLiteral(node.value)} AND ${renderLiteral(node.high)}`;
    case 'startsWith':
      return `${node.name} STARTSWITH ${renderLiteral(node.value)}`;
    case 'exists':
      return `EXISTS(${node.name})`;
    case 'typeOf':
      return `TYPEOF(${node.name}) = ${node.tag}`;
    case 'and':
      return node.items.map((x) => nested(x, PRECEDENCE.and)).join(' AND ');
    case 'or':
      return node.items.map((x) => nested(x, PRECEDENCE.or)).join(' OR ');
    default:
      throw new Error(`cannot render ${node.kind}`);
  }
}
