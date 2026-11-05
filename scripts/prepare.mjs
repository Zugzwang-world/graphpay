// `prepare` (runs on every pnpm install): point git at .githooks for the
// pre-commit secret scan. Outside a git checkout (a Vercel CLI upload) there
// is nothing to configure, so it does nothing and never fails the install.

import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' });
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
} catch {
  // not a git checkout
}
