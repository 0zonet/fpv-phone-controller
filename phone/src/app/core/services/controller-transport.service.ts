import { inject, Injectable, OnDestroy, signal } from '@angular/core';
import type { ControllerMessage } from '../../../../../shared/src/index';
import type { ControllerState } from '../models/controller-state.model';
import type { ConnectionStatus } from '../models/connection-status.model';
import { SOCKET_FACTORY, TRANSPORT_CLOCK, type TransportSocket } from './transport-runtime';

/** Close codes sent by companions with protocol 2. */
export const CLOSE_DISCONNECTED_BY_PC = 4001;
export const CLOSE_PAIRING_REJECTED = 4003;
/** D4: automatic reconnection only after an unexpected close, with this backoff, for about 30 s. */
export const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000] as const;
export const RECONNECT_WINDOW_MS = 30000;
/** Without an ack for this long (companions that sent hello), the connection is considered lost. */
export const ACK_TIMEOUT_MS = 2000;
/** '' = still connected or closed by the user; 'pc' = the PC ended the session; 'rejected' = old/invalid QR. */
export type EndReason = '' | 'pc' | 'rejected';

@Injectable({ providedIn: 'root' })
export class ControllerTransportService implements OnDestroy {
  private readonly createSocket = inject(SOCKET_FACTORY);
  private readonly clock = inject(TRANSPORT_CLOCK);
  private readonly connection = signal<ConnectionStatus>('disconnected');
  private readonly failure = signal('');
  readonly status = this.connection.asReadonly();
  readonly errorMessage = this.failure.asReadonly();
  private readonly lostValue = signal(false);
  readonly connectionLost = this.lostValue.asReadonly();
  private readonly reconnectingValue = signal(false);
  /** True while retrying after an unexpected close (status is 'connecting'). */
  readonly reconnecting = this.reconnectingValue.asReadonly();
  private readonly endReasonValue = signal<EndReason>('');
  readonly endReason = this.endReasonValue.asReadonly();
  private readonly latencyValue = signal<number | null>(null);
  /** Round trip in ms measured with the PC's acks; null with companions that do not send them (D6). */
  readonly latency = this.latencyValue.asReadonly();
  private socket: TransportSocket | null = null;
  private url = '';
  private sequence = 0;
  private readonly lastSequenceValue = signal<number | null>(null);
  private readonly rateValue = signal(0);
  readonly lastSequence = this.lastSequenceValue.asReadonly();
  readonly packetsPerSecond = this.rateValue.asReadonly();
  private sampleStarted = 0;
  private sentInSample = 0;
  private cancelTimeout: (() => void) | undefined;
  private cancelReconnect: (() => void) | undefined;
  private reconnectStarted = 0;
  private reconnectAttempt = 0;
  private acknowledged = false;
  private lastAckAt = 0;
  private readonly sentAt = new Map<number, number>();

  connect(url: string): void {
    this.disconnect();
    this.open(url);
  }
  disconnect(): void {
    this.stopReconnect();
    this.lostValue.set(false); this.endReasonValue.set('');
    this.closeSocket();
    this.connection.set('disconnected');
  }
  send(state: ControllerState): void {
    const now = this.clock.now();
    const elapsed = now - this.sampleStarted;
    if (elapsed >= 1000) {
      this.rateValue.set(Math.round(this.sentInSample * 1000 / elapsed));
      this.sentInSample = 0; this.sampleStarted = now;
    }
    const socket = this.socket;
    // OPEN = 1; avoids a dependency on the global WebSocket constructor in tests.
    if (!socket || socket.readyState !== 1) return;
    // A silent Wi-Fi drop may not close TCP for a long time; acks reveal it within ~2 s.
    if (this.acknowledged && now - this.lastAckAt > ACK_TIMEOUT_MS) { this.ended(socket, null, true); socket.close(); return; }
    if (socket.bufferedAmount > 4096) return;
    const message: ControllerMessage = {
      type: 'controller-state', sequence: this.sequence, timestamp: this.clock.timestamp(), axes: { throttle: state.throttle, yaw: state.yaw, pitch: state.pitch, roll: state.roll }, buttons: [...state.buttons]
    };
    try {
      socket.send(JSON.stringify(message));
      this.sentAt.set(this.sequence, now);
      if (this.sentAt.size > 240) this.sentAt.delete(this.sentAt.keys().next().value as number);
      this.lastSequenceValue.set(this.sequence); this.sequence += 1; this.sentInSample += 1;
    }
    catch { this.ended(socket, null, true); socket.close(); }
  }
  ngOnDestroy(): void { this.disconnect(); }

  private open(url: string): void {
    this.closeSocket();
    this.failure.set('');
    this.url = url;
    let socket: TransportSocket;
    try {
      const address = new URL(url.trim());
      if (!['ws:', 'wss:'].includes(address.protocol)) throw new Error('Usa ws://IP_DEL_PC:8080');
      socket = this.createSocket(address.href);
    } catch {
      this.stopReconnect();
      this.fail('No se pudo abrir la conexión. Revisa la configuración o escanea el QR actual.', false);
      return;
    }
    this.socket = socket;
    this.sequence = 0; this.sentAt.clear(); this.acknowledged = false; this.latencyValue.set(null);
    this.lastSequenceValue.set(null); this.rateValue.set(0);
    this.sampleStarted = this.clock.now(); this.sentInSample = 0;
    this.connection.set('connecting');
    this.cancelTimeout = this.clock.schedule(() => { if (this.socket === socket) { this.ended(socket, null, false); socket.close(); } }, 8000);
    socket.addEventListener('open', () => {
      if (this.socket !== socket) return;
      this.clearTimeout(); this.stopReconnect();
      this.sampleStarted = this.clock.now(); this.lastAckAt = this.clock.now();
      this.lostValue.set(false); this.connection.set('connected');
    });
    socket.addEventListener('message', event => { if (this.socket === socket) this.receive(event.data); });
    socket.addEventListener('error', () => this.ended(socket, null, false));
    socket.addEventListener('close', event => this.ended(socket, event?.code ?? null, false));
  }
  private receive(data: unknown): void {
    if (typeof data !== 'string' || data.length > 1024) return;
    let message: { type?: unknown; protocol?: unknown; capabilities?: unknown; sequence?: unknown };
    try { message = JSON.parse(data); } catch { return; }
    const now = this.clock.now();
    if (message.type === 'hello' && Array.isArray(message.capabilities) && message.capabilities.includes('ack')) {
      this.acknowledged = true; this.lastAckAt = now;
    } else if (message.type === 'ack' && Number.isInteger(message.sequence)) {
      this.acknowledged = true; this.lastAckAt = now;
      const sequence = message.sequence as number;
      const sentAt = this.sentAt.get(sequence);
      // Heartbeat acks repeat an already measured sequence: liveness only.
      if (sentAt === undefined) return;
      const rtt = Math.max(0, now - sentAt);
      const previous = this.latencyValue();
      this.latencyValue.set(Math.round(previous === null ? rtt : previous * 0.7 + rtt * 0.3));
      for (const key of this.sentAt.keys()) { if (key > sequence) break; this.sentAt.delete(key); }
    }
  }
  /** Any end of a socket: close (with code), error, timeout, ack silence or a failed send. */
  private ended(socket: TransportSocket, code: number | null, unexpected: boolean): void {
    if (this.socket !== socket) return;
    const wasConnected = this.connection() === 'connected';
    this.clearTimeout(); this.socket = null; this.rateValue.set(0); this.latencyValue.set(null);
    if (code === CLOSE_DISCONNECTED_BY_PC) {
      this.stopReconnect(); this.lostValue.set(false); this.endReasonValue.set('pc'); this.connection.set('disconnected'); return;
    }
    if (code === CLOSE_PAIRING_REJECTED) {
      this.stopReconnect(); this.lostValue.set(false); this.endReasonValue.set('rejected');
      this.failure.set('Este QR ya no es válido. Escanea el QR actual de la app de Windows.'); this.connection.set('error'); return;
    }
    if (wasConnected || unexpected || this.reconnectingValue()) { this.lostValue.set(true); this.scheduleReconnect(); return; }
    if (code === null) this.fail('No se pudo conectar. Copia la dirección actual del companion y permite el acceso a red local en Chrome. Revisa también la red y el firewall.', false);
    else this.connection.set('disconnected');
  }
  private scheduleReconnect(): void {
    const now = this.clock.now();
    if (!this.reconnectingValue()) { this.reconnectingValue.set(true); this.reconnectStarted = now; this.reconnectAttempt = 0; }
    if (now - this.reconnectStarted >= RECONNECT_WINDOW_MS) {
      this.stopReconnect();
      this.fail('Se perdió la conexión con el PC. Revisa que la app de Windows siga abierta y toca Reintentar.', true);
      return;
    }
    const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempt += 1;
    this.connection.set('connecting');
    this.cancelReconnect?.();
    this.cancelReconnect = this.clock.schedule(() => { this.cancelReconnect = undefined; this.open(this.url); }, delay);
  }
  private stopReconnect(): void {
    this.cancelReconnect?.(); this.cancelReconnect = undefined;
    this.reconnectingValue.set(false); this.reconnectAttempt = 0;
  }
  private closeSocket(): void {
    this.clearTimeout();
    const socket = this.socket; this.socket = null;
    this.rateValue.set(0); this.latencyValue.set(null);
    socket?.close();
  }
  private clearTimeout(): void { this.cancelTimeout?.(); this.cancelTimeout = undefined; }
  private fail(message: string, lost: boolean): void {
    this.closeSocket(); this.failure.set(message); this.connection.set('error'); this.lostValue.set(lost);
  }
}
