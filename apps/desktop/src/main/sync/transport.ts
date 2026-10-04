import type { PullResponse, PushRequest, PushResponse, Snapshot, SyncStream } from '@muneem/contracts';

export interface PullQuery { businessId: string; stream: SyncStream; since: number; limit: number }

// The wire, behind one interface (7d): HTTP in the utility process, a proxy to it from main, or the reference server in tests.
export interface Transport {
  push(request: PushRequest): Promise<PushResponse>;
  pull(query: PullQuery): Promise<PullResponse>;
  bootstrap(request: { businessId: string }): Promise<Snapshot>;
}

// What a request is signed and authorised with; main owns it and hands it to whichever transport sends.
export interface Credentials { deviceId: string; privateKeyPem: string; accessToken: string | null }

// status 0 is "never reached the server"; otherwise the HTTP status and the server's error code.
export class TransportError extends Error {
  constructor(readonly status: number, readonly code: string, message = code) {
    super(message);
    this.name = 'TransportError';
  }
}

export const NETWORK_UNREACHABLE = 'NETWORK_UNREACHABLE';
export const isTransportError = (e: unknown): e is TransportError => e instanceof TransportError;
