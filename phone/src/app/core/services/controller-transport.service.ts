import { inject, Injectable, OnDestroy, signal } from '@angular/core';
import type { ControllerMessage } from '../../../../../shared/src/index';
import type { ControllerState } from '../models/controller-state.model';
import type { ConnectionStatus } from '../models/connection-status.model';
import { SOCKET_FACTORY, TRANSPORT_CLOCK, type TransportSocket } from './transport-runtime';

@Injectable({ providedIn: 'root' })
export class ControllerTransportService implements OnDestroy {
  private readonly createSocket = inject(SOCKET_FACTORY);
  private readonly clock = inject(TRANSPORT_CLOCK);
  private readonly connection = signal<ConnectionStatus>('disconnected');
  private readonly failure = signal('');
  readonly status = this.connection.asReadonly();
  readonly errorMessage = this.failure.asReadonly();
  private socket: TransportSocket | null = null;
  private sequence = 0;
  private readonly lastSequenceValue = signal<number | null>(null);
  private readonly rateValue = signal(0);
  readonly lastSequence = this.lastSequenceValue.asReadonly();
  readonly packetsPerSecond = this.rateValue.asReadonly();
  private sampleStarted = 0;
  private sentInSample = 0;
  private cancelTimeout: (() => void) | undefined;

  connect(url: string): void {
    this.disconnect();
    this.failure.set('');
    try {
      const address = new URL(url.trim());
      if (!['ws:', 'wss:'].includes(address.protocol)) throw new Error('Usa ws://IP_DEL_PC:8080');
      const socket = this.createSocket(address.href);
      this.socket = socket;
      this.sequence = 0;
      this.lastSequenceValue.set(null); this.rateValue.set(0);
      this.sampleStarted = this.clock.now(); this.sentInSample = 0;
      this.connection.set('connecting');
      this.cancelTimeout = this.clock.schedule(() => {
        if (this.socket === socket) this.fail('Tiempo de conexión agotado. Revisa la IP y el firewall.');
      }, 8000);
      socket.addEventListener('open', () => {
        if (this.socket !== socket) return;
        this.clearTimeout(); this.sampleStarted = this.clock.now(); this.connection.set('connected');
      });
      socket.addEventListener('error', () => {
        if (this.socket === socket) this.fail('No se pudo conectar. Copia la dirección actual del companion y permite el acceso a red local en Chrome. Revisa también la red y el firewall.');
      });
      socket.addEventListener('close', () => {
        if (this.socket !== socket) return;
        this.clearTimeout(); this.socket = null; this.rateValue.set(0); this.connection.set('disconnected');
      });
    } catch (error) { this.fail(error instanceof Error ? error.message : 'No se pudo abrir WebSocket.'); }
  }
  disconnect(): void {
    this.clearTimeout();
    const socket = this.socket; this.socket = null;
    this.connection.set('disconnected');
    this.rateValue.set(0);
    socket?.close();
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
    if (!socket || socket.readyState !== 1 || socket.bufferedAmount > 4096) return;
    const message: ControllerMessage = {
      type: 'controller-state', sequence: this.sequence, timestamp: this.clock.timestamp(), axes: { ...state }
    };
    try {
      socket.send(JSON.stringify(message));
      this.lastSequenceValue.set(this.sequence); this.sequence += 1; this.sentInSample += 1;
    }
    catch { this.fail('No se pudo enviar el estado.'); }
  }
  ngOnDestroy(): void { this.disconnect(); }
  private clearTimeout(): void { this.cancelTimeout?.(); this.cancelTimeout = undefined; }
  private fail(message: string): void {
    this.disconnect(); this.failure.set(message); this.connection.set('error');
  }
}
