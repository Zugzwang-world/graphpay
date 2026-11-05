// @graphpay/city ships JavaScript without types; only what the race route uses is declared.
declare module '@graphpay/city' {
  export function generateCity(options: { story: unknown; size: 'S' | 'M'; end: string; root?: string }): unknown;
  export function truthOf(city: unknown): unknown;
  export function benchParams(city: unknown, options?: { today?: number }): unknown;
  export function benchTruth(city: unknown, truth: unknown, params: unknown): unknown;
}
// Seeding the sim city in tests (the same calls as packages/city/test).
declare module '@graphpay/city' {
  export function newManifest(options: { size: string; store: string; owner: string | null; dataset: string; backend: string }): unknown;
  export function seedGraph(city: unknown, arkiv: unknown, options: { manifest: unknown }): Promise<unknown>;
  export function seedPlain(city: unknown, arkiv: unknown, options: { manifest: unknown }): Promise<unknown>;
}
