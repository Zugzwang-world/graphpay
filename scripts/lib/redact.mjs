// Redaction for every script (SPEC/SECURITY_AND_OPS.md §8). viem errors quote
// the RPC URL, and keyed URLs carry secrets, so every uncaught error passes
// through here: .env values first, then the secret shapes. Redact before any
// truncation.

import { maskSecrets } from './secret-shapes.mjs';

const SECRET_NAME = /(?:_PRIVATE_KEY|_API_KEY|_ACCESS_KEY|_TOKEN|_SECRET|_PASSCODE|_RPC_URL)$/;

export function redactor(values) {
  const secrets = new Set();
  for (const [name, value] of values ?? []) {
    if (!value) continue;
    if (SECRET_NAME.test(name) || value.length >= 8) {
      secrets.add(value);
      if (/^0x[0-9a-fA-F]+$/.test(value)) secrets.add(value.slice(2));
    }
  }
  const list = [...secrets].sort((a, b) => b.length - a.length);
  return (text) => {
    let out = String(text);
    for (const secret of list) {
      out = out.split(secret).join('<redacted>');
      out = out.split(secret.toLowerCase()).join('<redacted>');
    }
    return maskSecrets(out);
  };
}

// Prints one redacted line for any uncaught error and exits 1.
export function installErrorBoundary(getValues) {
  const handler = (error) => {
    let redact;
    try {
      redact = redactor(getValues());
    } catch {
      redact = (text) => maskSecrets(String(text));
    }
    const message = error instanceof Error ? (error.shortMessage ?? error.message) : String(error);
    process.stderr.write(`error: ${redact(message)}\n`);
    process.exit(1);
  };
  process.on('uncaughtException', handler);
  process.on('unhandledRejection', handler);
}
