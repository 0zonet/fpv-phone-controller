// Design preview outside the app (not shipped): open index.html?demo=<state> in a browser.
const token = 'a'.repeat(48);
const base = { type: 'status', version: '0.4.0-beta.2', virtualController: 'READY', websocket: 'LISTENING', phone: 'DISCONNECTED', port: 8080,
  addresses: [{ name: 'Wi-Fi', address: '192.168.1.20', endpoint: 'ws://192.168.1.20:8080/?token=' + token },
    { name: 'Ethernet 2', address: '192.168.42.10', endpoint: 'ws://192.168.42.10:8080/?token=' + token }],
  health: {}, selectedAddress: '192.168.1.20', pwaUrl: 'https://fpv.brycofre.com', localWebUrl: 'http://192.168.1.20:8080',
  logsDirectory: '', pairingUrl: 'https://fpv.brycofre.com/connect?data=x', qrPngBase64: '', issueCode: '', message: '',
  device: { id: 1, axes: 4, buttons: 8 }, phoneAttempted: false };
const fixtures = {
  qr: {}, connected: { phone: 'CONNECTED' }, lost: { issueCode: 'PHONE_LOST' },
  vjoy: { virtualController: 'NOT AVAILABLE', websocket: 'STOPPED', issueCode: 'DRIVER_MISSING', device: null },
  port: { websocket: 'STOPPED', issueCode: 'PORT_BUSY' }, network: { websocket: 'STOPPED', issueCode: 'NETWORK_MISSING', addresses: [], selectedAddress: '' },
  pairing: { issueCode: 'PAIRING_REJECTED', phoneAttempted: true }, startup: { websocket: 'STOPPED', virtualController: 'NOT AVAILABLE', issueCode: 'STARTUP_FAILED' },
  busy: { websocket: 'STOPPED', virtualController: 'NOT AVAILABLE', issueCode: 'DEVICE_BUSY' },
  firewall: { issueCode: 'CONNECTION_HELP', phoneAttempted: false },
  advanced: { phone: 'CONNECTED', device: { id: 3, axes: 4, buttons: 4 } }
};
export async function runDemo(receive, state) {
  const name = new URLSearchParams(location.search).get('demo') ?? 'qr';
  const qr = await fetch('demo-qr.txt').then(response => response.ok ? response.text() : '').catch(() => '');
  if (name === 'advanced') state.advanced = true;
  receive({ type: 'host', version: '0.4.0-beta.2' });
  if (name === 'firewall') receive({ type: 'host', firewall: { blockRule: true, publicNetwork: false, allowRule: false } });
  receive({ ...base, qrPngBase64: qr.trim(), ...(fixtures[name] ?? {}) });
  if (name === 'advanced') receive({ type: 'metrics', packetsPerSecond: 60, axes: { throttle: .6, yaw: .2, pitch: -.3, roll: .4 }, failsafe: false });
  if (name === 'connected') {
    let t = 0;
    setInterval(() => { t += .07; receive({ type: 'metrics', packetsPerSecond: 60, axes: { throttle: .5 + .4 * Math.sin(t), yaw: .6 * Math.cos(t * 1.3), pitch: .5 * Math.sin(t * .9), roll: .7 * Math.cos(t) }, failsafe: false }); }, 66);
  }
}
