/** Modern Chromium local-network opt-in; older engines receive the standard constructor fallback. */
export function openLocalWebSocket(url: string): WebSocket {
  const address = new URL(url);
  if (address.protocol === 'ws:' && (location.protocol === 'https:')) {
    const Constructor = WebSocket as unknown as {
      new (url: string, options: { protocols: string[]; targetAddressSpace: 'local' }): WebSocket;
    };
    try { return new Constructor(url, { protocols: [], targetAddressSpace: 'local' }); }
    catch { return new WebSocket(url); }
  }
  return new WebSocket(url);
}
