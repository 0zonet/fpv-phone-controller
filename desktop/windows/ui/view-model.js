// Pure mapping from the backend status line to what the window shows.
// Texts come from issueCode, never from the free-form `message` (no raw errors in the UI).

const CHIP = {
  ready: value => ({ tone: 'ok', value }),
  waiting: value => ({ tone: 'wait', value }),
  paused: () => ({ tone: 'off', value: 'Paused' }),
  warn: value => ({ tone: 'warn', value }),
  error: value => ({ tone: 'error', value }),
  connected: () => ({ tone: 'live', value: 'Connected' })
};

const REPAIR_CODES = ['DRIVER_MISSING', 'DRIVER_MISMATCH', 'DEVICE_UNAVAILABLE'];

/** Problem screens (docs/design/DeskDriver.dc.html template). `primary`/`secondary` are command ids. */
export const PROBLEMS = {
  vjoy: { tone: 'warn', icon: 'joystick', eyebrow: 'VIRTUAL CONTROLLER', title: 'Virtual controller needs repair',
    body: 'FPV Phone Controller uses the included vJoy driver to show your phone to Windows as a joystick. Repair reinstalls it and sets up the device.',
    primary: ['repair', 'Repair driver'], secondary: ['check-again', 'Check again'], foot: 'Windows will ask for permission' },
  device: { tone: 'error', icon: 'joystick', eyebrow: 'VIRTUAL CONTROLLER BUSY', title: 'Another app is using the joystick',
    body: 'Close other joystick feeders or other copies of FPV Phone Controller, then check again.',
    primary: ['check-again', 'Check again'], secondary: ['open-logs', 'Open logs folder'], foot: 'Details are in Logs' },
  port: { tone: 'error', icon: 'plug', eyebrow: 'SERVER COULDN’T START', title: 'Another app is using the port',
    body: 'Close other copies of FPV Phone Controller, or let us pick a free port automatically.',
    primary: ['use-port', 'Use another port'], secondary: ['retry', 'Try again'], foot: 'Details are in Logs' },
  network: { tone: 'warn', icon: 'wifi', eyebrow: 'NO LOCAL NETWORK', title: 'Connect this PC to Wi‑Fi or Ethernet',
    body: 'Your phone reaches the PC over your home network. We couldn’t find one. USB tethering also works.',
    primary: ['network-settings', 'Open network settings'], secondary: ['retry', 'Check again'], foot: 'Phone and PC must share the same network' },
  permission: { tone: 'error', icon: 'shield', eyebrow: 'SERVER COULDN’T START', title: 'Windows blocked the connection server',
    body: 'Windows denied network access to the app. Try again; if it keeps happening, use another port or check the logs.',
    primary: ['retry', 'Try again'], secondary: ['use-port', 'Use another port'], foot: 'Details are in Logs' },
  startup: { tone: 'error', icon: 'alert', eyebrow: 'SOMETHING WENT WRONG', title: 'The app couldn’t start',
    body: 'Try again. If it keeps happening, open the logs folder and share the logs with support.',
    primary: ['retry', 'Try again'], secondary: ['open-logs', 'Open logs folder'], foot: 'Details are in Logs' },
  pairing: { tone: 'warn', icon: 'qr', eyebrow: 'OLD QR CODE', title: 'Your phone used an old QR',
    body: 'The pairing code changes every time the app restarts. Scan the current QR on your phone.',
    primary: ['show-qr', 'Show QR'], secondary: ['new-qr', 'New QR'], foot: 'Only the latest QR works' }
};

/**
 * Firewall heuristic (feasibility report §4): only with a block rule for the engine or a Public network,
 * AND no connection attempt at all after 45 s (CONNECTION_HELP without phoneAttempted). Never a certainty.
 */
export function firewallSuspected(status, firewall) {
  return !!status && !!firewall && !firewall.error && (firewall.blockRule || firewall.publicNetwork)
    && status.issueCode === 'CONNECTION_HELP' && !status.phoneAttempted && status.phone !== 'CONNECTED' && status.websocket === 'LISTENING';
}
export function firewallProblem(firewall) {
  const reasons = [];
  if (firewall?.blockRule) reasons.push('Windows has a rule that blocks FPV Phone Controller, usually left by cancelling its first network prompt.');
  if (firewall?.publicNetwork) reasons.push('This network is set to Public, where Windows blocks other devices. If it is your home network, set it to Private.');
  reasons.push('It can also be Chrome on the phone: allow local-network access when asked.');
  const publicOnly = firewall?.publicNetwork && !firewall?.blockRule;
  return { tone: 'warn', icon: 'shield', eyebrow: 'PHONE CAN’T REACH THE PC', title: 'Windows Firewall may be blocking it', body: reasons.join(' '),
    primary: publicOnly ? ['network-settings', 'Open network settings'] : ['firewall-allow', 'Allow on private networks'],
    secondary: publicOnly ? ['firewall-allow', 'Allow on private networks'] : ['show-qr', 'Show QR'],
    foot: 'Windows will ask for permission · private networks only' };
}

export function problemFor(issueCode) {
  if (REPAIR_CODES.includes(issueCode)) return 'vjoy';
  return ({ DEVICE_BUSY: 'device', PORT_BUSY: 'port', NETWORK_MISSING: 'network', NETWORK_PERMISSION: 'permission',
    STARTUP_FAILED: 'startup', QR_FAILED: 'startup', FATAL: 'startup', PAIRING_REJECTED: 'pairing' })[issueCode] ?? null;
}

/** Chip mapping (feasibility report §8b). */
export function chips(status) {
  if (!status) return [CHIP.waiting('Checking'), CHIP.waiting('Starting'), CHIP.paused()];
  const code = status.issueCode ?? '';
  const ready = status.virtualController === 'READY', listening = status.websocket === 'LISTENING';
  let controller = ready ? CHIP.ready('Ready') : CHIP.waiting('Checking');
  if (code === 'DRIVER_MISSING' || code === 'DRIVER_MISMATCH') controller = CHIP.warn('Driver needed');
  else if (code === 'DEVICE_UNAVAILABLE') controller = CHIP.warn('Not configured');
  else if (code === 'DEVICE_BUSY') controller = CHIP.error('Busy');
  else if (code === 'FATAL' || code === 'STARTUP_FAILED') controller = ready ? controller : CHIP.paused();
  let server = listening ? CHIP.ready('Ready') : CHIP.waiting('Starting');
  if (code === 'PORT_BUSY') server = CHIP.error('Port busy');
  else if (code === 'NETWORK_MISSING') { server = CHIP.warn('No network'); controller = CHIP.paused(); }
  else if (code === 'NETWORK_PERMISSION') server = CHIP.error('Blocked');
  else if (REPAIR_CODES.includes(code) || code === 'DEVICE_BUSY' || code === 'FATAL' || code === 'STARTUP_FAILED' || code === 'QR_FAILED') server = CHIP.paused();
  let phone = listening ? CHIP.waiting('Waiting') : CHIP.paused();
  if (status.phone === 'CONNECTED') phone = CHIP.connected();
  else if (listening && code === 'PHONE_LOST') phone = CHIP.error('Lost');
  else if (listening && code === 'CONNECTION_HELP') phone = CHIP.warn('Not reaching');
  else if (listening && code === 'PAIRING_REJECTED') phone = CHIP.warn('Old QR');
  return [controller, server, phone];
}

/**
 * Which main card to show: 'problem' (with a PROBLEMS key), 'connected', 'qr' or 'starting'.
 * `ui` holds window-only state: { showQr, dismissedPairing, backendStopped }.
 */
export function screen(status, ui = {}) {
  if (!status) return { kind: ui.backendStopped ? 'problem' : 'starting', problem: ui.backendStopped ? 'startup' : null };
  const problem = problemFor(status.issueCode ?? '');
  if (problem && !(problem === 'pairing' && ui.dismissedPairing)) return { kind: 'problem', problem };
  if (firewallSuspected(status, ui.firewall) && !ui.dismissedFirewall && !ui.showQr) return { kind: 'problem', problem: 'firewall' };
  if (status.websocket !== 'LISTENING') return { kind: ui.backendStopped ? 'problem' : 'starting', problem: ui.backendStopped ? 'startup' : null };
  if (status.phone === 'CONNECTED' && !ui.showQr) return { kind: 'connected', problem: null };
  return { kind: 'qr', problem: null };
}

/** Hint under the QR for soft phone issues that do not deserve a full problem screen. */
export function waitingNote(status) {
  const code = status?.issueCode ?? '';
  if (code === 'PHONE_LOST') return 'Phone connection lost. Check the network and tap Retry on your phone.';
  if (code === 'CONNECTION_HELP') return 'Still waiting for your phone. Check that both are on the same network and allow local-network access in Chrome.';
  return '';
}

/** "ws://192.168.1.20:8080/?token=abcd…" → "ws://192.168.1.20:8080/?token=••••" (copy uses the full value). */
export function maskEndpoint(endpoint) {
  return typeof endpoint === 'string' ? endpoint.replace(/token=[^&#]+/i, 'token=••••') : '';
}

export function deviceText(device) {
  if (!device) return { text: '—', warning: '' };
  const text = '#' + device.id + ' · ' + device.axes + ' axes · ' + device.buttons + ' buttons';
  const warning = device.buttons < 8 ? 'This vJoy device has ' + device.buttons + ' buttons; buttons above ' + device.buttons + ' are ignored.' : '';
  return { text, warning };
}

/**
 * Knob offsets in -1..1 for the mini sticks from calibrated axes (what vJoy receives).
 * Screen up = throttle high on the left stick; on the right stick pitch is drawn as joy.cpl shows it
 * (the PC inverts pitch, so pushing the phone stick up still moves this knob up).
 */
export function stickOffsets(axes) {
  const clamp = value => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
  if (!axes) return { left: { x: 0, y: 1 }, right: { x: 0, y: 0 } };
  return { left: { x: clamp(axes.yaw), y: clamp(1 - 2 * axes.throttle) }, right: { x: clamp(axes.roll), y: clamp(axes.pitch) } };
}
