import { AppError, type Session } from '@muneem/contracts';
import type { EventBus } from '../infra/events.js';

/** In-memory session (access token lives here only, LLD §15.1). */
export class SessionService {
  private current: Session | null = null;
  private accessToken: string | null = null;
  private accessExpiresAt = 0;

  constructor(private readonly events: EventBus) {}

  get(): Session | null { return this.current; }
  require(): Session {
    if (!this.current) throw new AppError('NOT_AUTHENTICATED', 'Please log in');
    return this.current;
  }
  set(s: Session | null): void {
    this.current = s;
    this.events.emit('session.changed', s);
  }
  patch(p: Partial<Session>): Session {
    const s = { ...this.require(), ...p };
    this.set(s);
    return s;
  }
  setAccessToken(token: string | null, expiresInSec = 0): void {
    this.accessToken = token;
    this.accessExpiresAt = token ? Date.now() + expiresInSec * 1000 : 0;
  }
  getAccessToken(): string | null {
    if (this.accessToken && Date.now() > this.accessExpiresAt) return null;
    return this.accessToken;
  }
  clear(): void { this.setAccessToken(null); this.set(null); }
}
