// Secret-shaped samples for the tests, built at run time so that no
// key-shaped literal ever sits in the repository (SPEC/SECURITY_AND_OPS.md §4).

export const hex = (n, c = 'a') => c.repeat(n);

export const SAMPLES = {
  'anthropic-api-key': ['sk', 'ant', 'api03', 'x'.repeat(40)].join('-'),
  'xai-api-key': ['xai', 'Q'.repeat(30)].join('-'),
  'kimi-api-key': ['sk', 'K'.repeat(48)].join('-'),
  jwt: [`eyJ${'h'.repeat(10)}`, `eyJ${'p'.repeat(12)}`, 's'.repeat(20)].join('.'),
  'hex-private-key': ['FUNDER', 'PRIVATE', 'KEY'].join('_') + '=0x' + hex(64, 'b'),
  'pem-private-key': ['-----BEGIN', 'PRIVATE', 'KEY-----'].join(' '),
  'arkiv-access-key-in-url': ['https://rpc.rabdi.db-chain.testnet.arkiv.network', 'k'.repeat(24)].join('/'),
  'ankr-api-key-in-url': ['https://rpc.ankr.com/whitechain_testnet', hex(64, 'c')].join('/'),
  'github-token': ['ghp', 'A'.repeat(36)].join('_'),
  'github-fine-grained-token': ['github', 'pat', 'B'.repeat(30)].join('_'),
  'database-url-password': ['postgres://user', 'hunter2@db.example.com/app'].join(':'),
};

// Twelve real BIP-39 words (the first twelve of the list), joined at run time.
export async function twelveWords() {
  const { english } = await import('viem/accounts');
  return english.slice(0, 12);
}
