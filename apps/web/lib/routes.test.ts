// Acceptance F2 for the website's own routes: every route that can make anyone
// sign answers 401 without the passcode and with a wrong one, before it does
// anything else. The route files themselves are imported and called.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MIN_PASSCODE_LENGTH, PASSCODE_HEADER, publicAccess } from './passcode.ts';
import { PASSCODE_ROUTES, SITE_ROUTES } from './routes.ts';

// These tests check the gated mode; public access (ADR-0069) is tested on its own.
process.env.GRAPHPAY_PUBLIC_ACCESS = '0';

const appDir = fileURLToPath(new URL('../app/', import.meta.url));
const apiDir = join(appDir, 'api');
// Routes other tracks own, each with its own gate (MASTER_PLAN.md §2).
const OWNED_ELSEWHERE = /^\/api\/(shop|facilitator|recorder|graphql|explain|mcp|cron)(\/|$)/;

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return name === 'route.ts' ? [full] : [];
  });
}

const urlPathOf = (file: string) =>
  `/${relative(appDir, file).split(sep).slice(0, -1).join('/')}`.replace(/\[(\w+)\]/g, ':$1');

const fileOf = (path: string) => join(appDir, ...path.slice(1).replace(/:(\w+)/g, '[$1]').split('/'), 'route.ts');

const passcode = 'q'.repeat(MIN_PASSCODE_LENGTH + 4);

async function post(path: string, headers: Record<string, string>): Promise<Response> {
  const mod = (await import(fileOf(path))) as { POST?: (r: Request) => Promise<Response> };
  assert.ok(mod.POST, `${path} has no POST handler`);
  return mod.POST(new Request(`https://example.test${path}`, { method: 'POST', headers, body: JSON.stringify({ request: 'a valid request' }) }));
}

test('every route file is in the route table with its method', () => {
  const listed = new Set(SITE_ROUTES.map((r) => `${r.method} ${r.path}`));
  for (const file of routeFiles(apiDir)) {
    const path = urlPathOf(file);
    // Other tracks' routes (each with its own gate) live in their own files; if one
    // is merged here, this test must be told how it is gated, so it never passes unseen.
    if (OWNED_ELSEWHERE.test(path)) continue;
    const source = readFileSync(file, 'utf8');
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      const exported = new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b|export\\s+(const|let|var)\\s+${method}\\b|export\\s*\\{[^}]*\\b${method}\\b[^}]*\\}`);
      if (exported.test(source)) {
        assert.ok(listed.has(`${method} ${path}`), `${method} ${path} is not in SITE_ROUTES`);
      }
    }
  }
});

test('every other method a website route exports is a read (GET) or listed', () => {
  for (const file of routeFiles(apiDir)) {
    if (OWNED_ELSEWHERE.test(urlPathOf(file))) continue;
    assert.ok(!/\b(PUT|PATCH|DELETE)\b/.test(readFileSync(file, 'utf8')), `${urlPathOf(file)} exports a method the table does not list`);
  }
});

test('every POST route of the website is passcode-gated', () => {
  for (const route of SITE_ROUTES.filter((r) => r.method === 'POST')) assert.equal(route.gate, 'passcode', route.path);
});

for (const route of PASSCODE_ROUTES) {
  test(`${route.path} answers 401 without the passcode and with a wrong one`, async () => {
    process.env.DEMO_PASSCODE = passcode;
    const none = await post(route.path, {});
    assert.equal(none.status, 401);
    assert.equal(none.headers.get('cache-control'), 'no-store');
    const wrong = await post(route.path, { [PASSCODE_HEADER]: `${passcode}x` });
    assert.equal(wrong.status, 401);
  });

  test(`${route.path} refuses everyone when no passcode is configured`, async () => {
    delete process.env.DEMO_PASSCODE;
    const response = await post(route.path, { [PASSCODE_HEADER]: passcode });
    assert.equal(response.status, 503);
  });

  test(`${route.path} with the passcode reaches the route`, async () => {
    process.env.DEMO_PASSCODE = passcode;
    const response = await post(route.path, { [PASSCODE_HEADER]: passcode });
    assert.ok(response.status === 204 || response.status === 503, `${route.path}: ${response.status}`);
    if (response.status === 503) assert.deepEqual(await response.json(), { error: 'not live yet', waitingFor: route.waitingFor });
  });
}

// Public access (ADR-0069): with the config's switch on, a visitor's request without a
// passcode reaches the route, exactly as one with the passcode does in the gated mode.
for (const route of PASSCODE_ROUTES) {
  test(`${route.path} under public access reaches the route without a passcode`, { skip: !publicAccess({}) && 'the config switch is off' }, async () => {
    delete process.env.GRAPHPAY_PUBLIC_ACCESS;
    delete process.env.DEMO_PASSCODE;
    try {
      const response = await post(route.path, {});
      assert.ok(response.status === 204 || response.status === 503, `${route.path}: ${response.status}`);
      if (response.status === 503) assert.deepEqual(await response.json(), { error: 'not live yet', waitingFor: route.waitingFor });
    } finally {
      process.env.GRAPHPAY_PUBLIC_ACCESS = '0';
    }
  });
}
