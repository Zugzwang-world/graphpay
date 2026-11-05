// The kit integration, as it stands in this app's own files: the lines between the
// graphpay:begin and graphpay:end markers, comments and blank lines left out. The "How it's
// built" page shows them and a test holds the count to 20 or fewer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const INTEGRATION_FILES = ['lib/store.ts', 'app/api/catalog/route.ts', 'app/api/order/route.ts', 'components/buy.tsx'] as const;

export function integrationOf(source: string): string[] {
  const lines: string[] = [];
  let inside = false;
  for (const raw of source.split('\n')) {
    if (/graphpay:begin/.test(raw)) inside = true;
    else if (/graphpay:end/.test(raw)) inside = false;
    else if (inside && raw.trim() !== '' && !raw.trim().startsWith('//')) lines.push(raw.replace(/\s+\/\/ .*$/, '').trimEnd());
  }
  return lines;
}

export function integration(root = process.cwd()): { file: string; lines: string[] }[] {
  return INTEGRATION_FILES.map((file) => ({ file, lines: integrationOf(readFileSync(join(root, file), 'utf8')) }));
}
