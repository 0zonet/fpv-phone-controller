export function validEndpoint(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (!['ws:', 'wss:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.hash) return null;
    return url.href;
  } catch { return null; }
}
/** Public editor value never contains query parameters, credentials or fragments. */
export function publicEndpoint(value: string): string {
  const safe = value.trim().split(/[?#]/, 1)[0];
  try { const url = new URL(safe); url.username = ''; url.password = ''; return url.href; }
  catch { return safe.replace(/\/\/[^/@]*@/, '//'); }
}
export function editEndpoint(input: string, previous: string): string {
  const parsed = validEndpoint(input);
  if (!parsed) return publicEndpoint(input);
  const next = new URL(parsed);
  if (!next.search && publicEndpoint(previous) === publicEndpoint(parsed)) {
    const old = validEndpoint(previous); if (old) next.search = new URL(old).search;
  }
  return next.href;
}
