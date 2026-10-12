import { chips, deviceText, maskEndpoint, PROBLEMS, screen, stickOffsets, waitingNote } from './view-model.js';

// Host bridge: CompanionWindow.cs forwards every backend stdout line (status, metrics, fatal) and its own
// {type:'host'} state; the page sends {cmd, ...} back. Outside WebView2 (?demo=...) it renders fixtures.
const host = window.chrome?.webview ?? null;
const send = (cmd, extra = {}) => host?.postMessage({ cmd, ...extra });

const state = { status: null, metrics: null, version: '', repairing: false, repairNote: '', backendStopped: false,
  showQr: false, dismissedPairing: false, advanced: false, lastIssue: '' };

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icons = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg>',
  arrow: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>',
  joystick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="6" r="3"/><path d="M12 9v7"/><rect x="4" y="16" width="16" height="5" rx="2"/></svg>',
  plug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3v5M15 3v5"/><path d="M6 8h12v3a6 6 0 0 1-12 0V8Z"/><path d="M12 17v4"/></svg>',
  wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8.5a15 15 0 0 1 20 0"/><path d="M5 12a10 10 0 0 1 14 0"/><path d="M8.5 15.5a5 5 0 0 1 7 0"/><path d="M12 19h.01"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6l-7-3Z"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17v.01"/></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h7v-4"/></svg>'
};

function renderChips() {
  const labels = ['CONTROLLER', 'SERVER', 'PHONE'];
  $('chips').innerHTML = chips(state.status).map((chip, i) =>
    '<div class="chip ' + chip.tone + '" data-chip="' + labels[i] + '"><span class="label">' + labels[i] + '</span>' +
    '<span class="value"><span class="dot" aria-hidden="true"></span>' + esc(chip.value) + '</span></div>').join('');
}

function pwaHost() { try { return new URL(state.status?.pwaUrl || state.status?.localWebUrl).host; } catch { return 'the controller page'; } }

function renderQr() {
  const status = state.status, connected = status.phone === 'CONNECTED';
  const note = connected ? 'Only one phone can be connected at a time.' : waitingNote(status);
  return '<div class="qr-wrap"><div class="qr-glow" aria-hidden="true"></div><div class="qr-box">' +
    (status.qrPngBase64 ? '<img id="qr" alt="Pairing QR code" src="data:image/png;base64,' + esc(status.qrPngBase64) + '">' : '<div class="spinner"></div>') +
    '<div class="sweep" aria-hidden="true"></div></div></div>' +
    '<div class="center"><h1 class="title">Scan with your phone</h1><p class="text">Your camera opens ' + esc(pwaHost()) +
    ' and pairs on its own. Keep both on the same Wi‑Fi.</p></div>' +
    (note ? '<p class="note">' + esc(note) + '</p>' : '') +
    '<div class="row"><button class="pill" type="button" data-cmd="copy-link">' + icons.copy + 'Copy link</button>' +
    '<button class="pill" type="button" data-cmd="new-qr">' + icons.refresh + 'New QR</button>' +
    (connected ? '<button class="pill ghost" type="button" data-ui="hide-qr">Back</button>' : '') + '</div>';
}

function renderConnected() {
  const rate = state.metrics?.packetsPerSecond ?? 0;
  return '<div class="sticks" aria-hidden="true"><div class="mini"><div class="knob" id="knob-left"></div></div>' +
    '<div class="mini"><div class="knob right" id="knob-right"></div></div></div>' +
    '<div class="center"><span><span class="rate" id="rate">' + rate + '</span><span class="unit">packets/s</span></span>' +
    '<span class="failsafe" id="failsafe"' + (state.metrics?.failsafe ? '' : ' hidden') + '>FAILSAFE · CONTROLS RESET</span>' +
    '<h1 class="title spaced">You’re ready to fly</h1>' +
    '<p class="text">Open your simulator and select the vJoy controller. Tested with Uncrashed and FPV SkyDive.</p></div>' +
    '<div class="row bottom"><button class="pill" type="button" data-cmd="disconnect-phone">Disconnect phone</button>' +
    '<button class="pill ghost" type="button" data-ui="show-qr">Show QR</button></div>';
}

function renderProblem(key) {
  const problem = PROBLEMS[key];
  const repairing = key === 'vjoy' && state.repairing;
  const note = key === 'vjoy' && state.repairNote ? '<p class="note error">' + esc(state.repairNote) + '</p>' : '';
  const button = ([cmd, label], cls, extra = '') => '<button class="' + cls + '" type="button" ' + (cmd === 'show-qr' ? 'data-ui' : 'data-cmd') + '="' + cmd + '"' + extra + '>' + label + '</button>';
  return '<div class="icon-box ' + problem.tone + '">' + icons[problem.icon] + '</div>' +
    '<div class="problem-text"><span class="eyebrow ' + problem.tone + '-tone">' + problem.eyebrow + '</span>' +
    '<h1 class="title">' + problem.title + '</h1><p class="text">' + problem.body + '</p></div>' + note +
    '<div class="actions">' +
    button(repairing ? [problem.primary[0], 'Repairing…'] : problem.primary, 'cta', (repairing ? ' disabled' : '') + ' id="primary"') .replace('</button>', (repairing ? '' : icons.arrow) + '</button>') +
    button(problem.secondary, 'secondary', repairing ? ' disabled' : '') +
    '<span class="foot">' + problem.foot + '</span></div>';
}

function renderCard() {
  const view = screen(state.status, state);
  const card = $('card');
  card.className = 'card' + (view.kind === 'problem' ? ' problem' : '');
  card.dataset.screen = view.kind === 'problem' ? 'problem-' + view.problem : view.kind;
  document.body.classList.toggle('connected-mode', view.kind === 'connected');
  if (view.kind === 'problem') card.innerHTML = renderProblem(view.problem);
  else if (view.kind === 'connected') { card.innerHTML = renderConnected(); renderSticks(); }
  else if (view.kind === 'qr') card.innerHTML = renderQr();
  else card.innerHTML = '<div class="center fill"><div class="spinner"></div><p class="text">Starting…</p></div>';
}

function renderSticks() {
  const left = $('knob-left'), right = $('knob-right');
  if (!left || !right) return;
  const offsets = stickOffsets(state.metrics?.axes);
  left.style.transform = 'translate(' + (offsets.left.x * 37).toFixed(1) + 'px,' + (offsets.left.y * 37).toFixed(1) + 'px)';
  right.style.transform = 'translate(' + (offsets.right.x * 37).toFixed(1) + 'px,' + (offsets.right.y * 37).toFixed(1) + 'px)';
  $('rate').textContent = String(state.metrics?.packetsPerSecond ?? 0);
  $('failsafe').hidden = !state.metrics?.failsafe;
}

function statusSummary() {
  const status = state.status;
  if (!status) return { tone: '', title: 'Starting…', detail: '' };
  if (status.phone === 'CONNECTED') return { tone: 'ok', title: 'Phone connected', detail: 'Controller and server ready' };
  if (status.issueCode && !['PHONE_LOST', 'CONNECTION_HELP', 'PAIRING_REJECTED'].includes(status.issueCode)) return { tone: 'warn', title: 'Needs attention', detail: 'Close Advanced to see what to do' };
  if (status.websocket === 'LISTENING') return { tone: '', title: 'Waiting for phone', detail: 'Controller and server ready' };
  return { tone: '', title: 'Starting…', detail: '' };
}

function renderAdvanced() {
  const status = state.status ?? {}, summary = statusSummary();
  $('status-row').innerHTML = '<span class="big-dot ' + summary.tone + '" aria-hidden="true"></span><div class="grow"><strong>' + esc(summary.title) +
    '</strong><small>' + esc(summary.detail) + '</small></div><span><span class="rate">' + (state.metrics?.packetsPerSecond ?? 0) +
    '</span><span class="unit tight">pkt/s</span></span>';
  const addresses = Array.isArray(status.addresses) ? status.addresses : [];
  const selected = addresses.find(entry => entry.address === status.selectedAddress);
  const device = deviceText(status.device);
  const repair = ['DRIVER_MISSING', 'DRIVER_MISMATCH', 'DEVICE_UNAVAILABLE'].includes(status.issueCode);
  const driverReady = status.virtualController === 'READY' || !!status.device;
  $('advanced').innerHTML =
    '<div class="advanced-head"><strong>Advanced</strong><button class="round" type="button" data-ui="close-advanced" aria-label="Hide advanced">' + icons.up + '</button></div>' +
    '<span class="section">NETWORK</span><div class="table">' +
    '<div><span class="key">PC network</span><select id="network" aria-label="PC network"' + (addresses.length ? '' : ' disabled') + '>' +
    (addresses.length ? addresses.map(entry => '<option value="' + esc(entry.address) + '"' + (entry.address === status.selectedAddress ? ' selected' : '') + '>' +
      esc(entry.name + ' — ' + entry.address) + '</option>').join('') : '<option>No network</option>') + '</select></div>' +
    '<div><span class="key">Local IP</span><span class="val">' + esc(status.selectedAddress || '—') + '</span></div>' +
    '<div><span class="key">Port</span><span class="val">' + esc(status.port ?? '—') + '</span></div>' +
    '<div class="endpoint"><span class="key">Endpoint</span><span class="val" id="endpoint" title="The access key is hidden; Copy copies the full endpoint">' +
    esc(maskEndpoint(selected?.endpoint) || '—') + '</span><button class="copy" type="button" data-cmd="copy-endpoint" aria-label="Copy endpoint"' + (selected ? '' : ' disabled') + '>' + icons.copy + '</button></div>' +
    '</div>' +
    '<span class="section">VIRTUAL CONTROLLER</span><div class="table">' +
    '<div><span class="key">vJoy driver</span><span class="val status"><span class="dot ' + (repair ? 'warn' : driverReady ? 'ok' : '') + '" aria-hidden="true"></span>' +
    (repair ? 'Needs repair' : driverReady ? 'Installed' : 'Checking') + '</span></div>' +
    '<div><span class="key">Device</span><span class="val" id="device">' + esc(device.text) + '</span></div></div>' +
    (device.warning ? '<p class="warning" id="device-warning">' + esc(device.warning) + '</p>' : '') +
    '<div class="wrap"><button class="pill small" type="button" data-cmd="test-joystick">Test joystick</button>' +
    '<button class="pill small" type="button" data-cmd="repair"' + (state.repairing ? ' disabled' : '') + '>Repair driver</button></div>' +
    '<span class="section">TOOLS</span><div class="wrap">' +
    '<button class="pill small" type="button" data-cmd="new-qr">New QR</button>' +
    '<button class="pill small" type="button" data-cmd="open-logs">Open logs folder</button>' +
    '<button class="pill small" type="button" data-cmd="help">Help</button>' +
    '<button class="pill small" type="button" data-cmd="open-pwa">Open PWA</button>' +
    '<button class="pill small" type="button" data-cmd="local-preview">Local preview</button>' +
    '<button class="pill small" type="button" data-cmd="licenses">Third-party licenses</button></div>' +
    '<span class="section">HOW IT WORKS</span><ol class="steps"><li>Connect your PC and phone to the same network (or USB tethering).</li>' +
    '<li>Scan the QR with your phone’s camera.</li><li>Open your FPV simulator.</li><li>Select the vJoy controller in its settings.</li></ol>' +
    '<p class="fine">New QR restarts the connection and creates a new access key; the previous QR stops working. The endpoint is for manual connection in the phone’s Settings → Connection.</p>' +
    '<p class="fine">Virtual controller driver: vJoy 2.2.2.0 by Shaul Eizikovich and contributors, MIT License (github.com/BrunnerInnovation/vJoy). ' +
    'Uninstalling FPV Phone Controller keeps vJoy, because other apps may use it.</p>';
}

function render() {
  renderChips();
  $('chips').hidden = state.advanced; $('card').hidden = state.advanced;
  $('status-row').hidden = !state.advanced; $('advanced').hidden = !state.advanced;
  const toggle = $('advanced-toggle');
  toggle.setAttribute('aria-expanded', String(state.advanced));
  toggle.firstChild.textContent = state.advanced ? 'Back ' : 'Advanced ';
  if (state.advanced) renderAdvanced(); else renderCard();
  $('version').textContent = state.version ? 'v' + state.version : '';
}

let toastTimer;
function toast(text) {
  const element = $('toast'); element.textContent = text; element.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove('show'), 1600);
}

function receive(message) {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'metrics') {
    state.metrics = message;
    if (state.advanced) { const rate = document.querySelector('#status-row .rate'); if (rate) rate.textContent = String(message.packetsPerSecond); }
    else renderSticks();
    return;
  }
  if (message.type === 'status') {
    if (message.issueCode !== state.lastIssue) { state.dismissedPairing = false; state.lastIssue = message.issueCode; }
    if (message.phone !== 'CONNECTED') { state.showQr = false; state.metrics = null; }
    state.status = message; state.backendStopped = false;
    if (message.version) state.version = message.version;
  } else if (message.type === 'fatal') {
    state.status = { ...(state.status ?? {}), issueCode: 'FATAL', websocket: 'STOPPED', virtualController: 'NOT AVAILABLE', phone: 'DISCONNECTED' };
    state.lastIssue = 'FATAL';
  } else if (message.type === 'host') {
    if ('version' in message) state.version = message.version;
    if ('repairing' in message) state.repairing = message.repairing;
    if ('repairNote' in message) state.repairNote = message.repairNote;
    if ('backendStopped' in message) state.backendStopped = message.backendStopped;
    if (message.reset) { state.status = null; state.metrics = null; }
    if (message.toast) toast(message.toast);
  } else if (message.type === 'selftest') { void selfTestSummary().then(result => send('selftest-result', { result })); return; }
  render();
}

/** Used by `FPVPhoneController.exe --self-test`: what is on screen right now. */
async function selfTestSummary() {
  await document.fonts.ready;
  const image = document.getElementById('qr');
  if (image) await image.decode().catch(() => {});
  const card = $('card');
  return { screen: card.dataset.screen ?? '', chips: [...document.querySelectorAll('.chip .value')].map(node => node.textContent.trim()),
    title: card.querySelector('.title')?.textContent ?? '', primary: card.querySelector('#primary')?.textContent.trim() ?? '',
    qr: !!document.getElementById('qr')?.complete && (document.getElementById('qr')?.naturalWidth ?? 0) > 0,
    buttons: [...document.querySelectorAll('[data-cmd]')].map(node => node.dataset.cmd), version: $('version').textContent,
    fonts: document.fonts.check('16px Urbanist') };
}

document.addEventListener('click', event => {
  const target = event.target.closest('[data-cmd],[data-ui]');
  if (!target || target.disabled) return;
  const ui = target.dataset.ui;
  if (ui === 'show-qr') { state.showQr = true; state.dismissedPairing = true; state.advanced = false; render(); return; }
  if (ui === 'hide-qr') { state.showQr = false; render(); return; }
  if (ui === 'close-advanced') { state.advanced = false; render(); return; }
  send(target.dataset.cmd);
});
document.addEventListener('change', event => {
  if (event.target.id === 'network') send('select-network', { address: event.target.value });
});
$('advanced-toggle').addEventListener('click', () => { state.advanced = !state.advanced; render(); });

if (host) {
  host.addEventListener('message', event => receive(event.data));
  send('ready');
} else {
  // Browser preview for design reviews: app.html?demo=qr|connected|vjoy|port|network|pairing|advanced
  import('./demo.js').then(module => module.runDemo(receive, state, render)).catch(() => render());
}
render();
