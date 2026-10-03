import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { AppError, ROLE_PRESETS, type HttpComponents, type Session } from '@muneem/contracts';
import {
  appendAudit, getCredential, getMembership, getMeta, getUser, getUserByIdentifier, listCachedUsers, listMemberships, META_KEYS,
  recordPinAttempt, replaceMemberships, setMeta, setPinHash, touchOnlineAuth, upsertCredential, upsertUser, withTransaction, type Db,
} from '@muneem/db-sqlite';
import { DEVICE_AUDIT_SCOPE } from '../ipc/gateway.js';
import type { CloudClient } from '../infra/cloudClient.js';
import { SECRET_KEYS, type SecretStore } from '../infra/secrets.js';
import type { Loggers } from '../infra/logger.js';
import type { SessionService } from './session.js';
import type { DeviceService } from './device.js';

type LoginResponse = HttpComponents['schemas']['LoginResponse'];

export interface AuthDeps {
  db: () => Db; cloud: () => CloudClient; secrets: SecretStore; session: SessionService; device: DeviceService; loggers: Loggers;
  isOnline: () => boolean;
  now?: () => number;
}

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_SECONDS = 300;
const ARGON = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const; // OWASP 2023 Argon2id baseline

export class AuthService {
  constructor(private readonly d: AuthDeps) {}
  private now(): number { return (this.d.now ?? Date.now)(); }

  async register(input: { name: string; identifier: string; password: string; otp?: string | undefined }): Promise<{ userId: string }> {
    const r = await this.d.cloud().request<{ user_id: string }>('POST', '/auth/register', { name: input.name, identifier: input.identifier, password: input.password, ...(input.otp && { otp: input.otp }) }, { auth: false });
    return { userId: r.data.user_id };
  }

  /** Online login: cloud authenticates, we cache what offline mode needs (LLD §15.2). */
  async login(input: { identifier: string; password: string }): Promise<Session> {
    const db = this.d.db();
    const { installationId } = this.d.device.ensureIdentity();
    let res: LoginResponse;
    try {
      res = (await this.d.cloud().request<LoginResponse>('POST', '/auth/login', { identifier: input.identifier, password: input.password, installation_id: installationId }, { auth: false })).data;
    } catch (e) {
      if (e instanceof AppError && e.code === 'NETWORK_UNREACHABLE') {
        // Fall through to the offline path: a previously authenticated user must not be blocked by the network.
        return this.loginOffline(input);
      }
      throw e;
    }
    this.d.session.setAccessToken(res.access_token, res.expires_in);
    this.d.secrets.set(SECRET_KEYS.refreshToken, res.refresh_token);
    const passwordHash = await argonHash(input.password, ARGON);
    withTransaction(db, () => {
      upsertUser(db, { id: res.user.id, name: res.user.name, identifier: input.identifier, email: res.user.email ?? null, mobile: res.user.mobile ?? null });
      replaceMemberships(db, res.user.id, res.memberships.map((m) => ({
        businessId: m.business_id, organizationId: m.organization_id, businessName: m.business_name ?? null,
        snapshot: { permVer: m.permission_snapshot.perm_ver, roles: m.permission_snapshot.roles, issuedAt: m.permission_snapshot.issued_at,
          grants: m.permission_snapshot.grants.map((g) => ({ permission: g.permission as never, ...(g.limit && { limit: { ...(g.limit.max_discount_bp !== undefined && { maxDiscountBp: g.limit.max_discount_bp }), ...(g.limit.max_refund_paise !== undefined && { maxRefundPaise: g.limit.max_refund_paise }), ...(g.limit.backdate_days !== undefined && { backdateDays: g.limit.backdate_days }) } }) })) },
      })));
      // Keep locally-created (not yet synced) memberships: replaceMemberships wiped them, re-grant owner for local businesses.
      for (const m of localOwnerBusinesses(db, res.user.id)) {
        if (!res.memberships.some((x) => x.business_id === m.businessId)) {
          db.prepare(`INSERT OR REPLACE INTO user_membership (user_id, business_id, organization_id, business_name, roles_json, grants_json, perm_ver, issued_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`)
            .run(res.user.id, m.businessId, m.organizationId, m.name, JSON.stringify(['owner']), JSON.stringify(ROLE_PRESETS.owner), new Date().toISOString());
        }
      }
      upsertCredential(db, { userId: res.user.id, passwordHash, maxOfflineDays: res.offline_policy.max_offline_days });
      setMeta(db, `orgs:${res.user.id}`, JSON.stringify(res.organizations));
      setMeta(db, META_KEYS.lastServerContactAt, new Date().toISOString());
    });
    try {
      await this.d.device.registerIfNeeded(res.memberships[0]?.business_id ?? null);
    } catch (e) {
      this.d.loggers.app.warn({ err: String(e) }, 'device registration failed; will retry on next login');
    }
    const session = this.buildSession(res.user.id, 'online', res.memberships[0]?.permission_snapshot.perm_ver ?? 0);
    this.d.session.set(session);
    this.audit(session, 'auth.login', { identifier: input.identifier, mode: 'online' });
    return session;
  }

  async loginOffline(input: { identifier: string; password: string }): Promise<Session> {
    const db = this.d.db();
    const user = getUserByIdentifier(db, input.identifier);
    const cred = user ? getCredential(db, user.id) : null;
    if (!user || !cred) throw new AppError('INVALID_CREDENTIALS', 'No offline record for this user. Connect once to sign in.');
    const ok = await argonVerify(cred.passwordHash, input.password).catch(() => false);
    if (!ok) throw new AppError('INVALID_CREDENTIALS', 'Wrong password');
    const days = (this.now() - Date.parse(cred.lastOnlineAuthAt)) / 86_400_000;
    if (days > cred.maxOfflineDays) throw new AppError('OFFLINE_PERIOD_EXCEEDED', `Offline for more than ${cred.maxOfflineDays} days. Connect once to continue.`);
    const session = this.buildSession(user.id, 'offline', 0, Math.max(0, Math.ceil(cred.maxOfflineDays - days)));
    this.d.session.set(session);
    this.audit(session, 'auth.loginOffline', { identifier: input.identifier, mode: 'offline' });
    return session;
  }

  async switchUser(input: { userId: string; pin: string }): Promise<Session> {
    const db = this.d.db();
    const cred = getCredential(db, input.userId);
    const user = getUser(db, input.userId);
    if (!cred || !user) throw new AppError('INVALID_CREDENTIALS', 'Unknown user on this device');
    if (cred.pinLockedUntil && Date.parse(cred.pinLockedUntil) > this.now()) throw new AppError('PIN_LOCKED', 'Too many wrong PINs. Try again in a few minutes.');
    if (!cred.pinHash) throw new AppError('INVALID_CREDENTIALS', 'This user has not set a PIN');
    const ok = await argonVerify(cred.pinHash, input.pin).catch(() => false);
    const r = recordPinAttempt(db, input.userId, ok, PIN_MAX_ATTEMPTS, PIN_LOCKOUT_SECONDS);
    if (!ok) {
      this.audit(this.d.session.get(), 'auth.switchUser.failed', { userId: input.userId, locked: r.locked });
      throw new AppError(r.locked ? 'PIN_LOCKED' : 'INVALID_CREDENTIALS', r.locked ? 'Too many wrong PINs. Locked for 5 minutes.' : 'Wrong PIN');
    }
    const prev = this.d.session.get();
    const mode = prev?.mode ?? (this.d.isOnline() ? 'online' : 'offline');
    const session = this.buildSession(user.id, mode, 0);
    // keep the active business/terminal context of the terminal
    const s2: Session = { ...session, businessId: prev?.businessId ?? session.businessId, branchId: prev?.branchId ?? session.branchId, terminalId: prev?.terminalId ?? session.terminalId };
    this.d.session.set(s2);
    this.audit(s2, 'auth.switchUser', { userId: user.id });
    return s2;
  }

  async setPin(pin: string): Promise<void> {
    const s = this.d.session.require();
    setPinHash(this.d.db(), s.user.id, await argonHash(pin, ARGON));
  }
  async verifyPin(pin: string): Promise<boolean> {
    const s = this.d.session.require();
    const cred = getCredential(this.d.db(), s.user.id);
    if (!cred?.pinHash) throw new AppError('INVALID_CREDENTIALS', 'No PIN set');
    if (cred.pinLockedUntil && Date.parse(cred.pinLockedUntil) > this.now()) throw new AppError('PIN_LOCKED', 'PIN locked');
    const ok = await argonVerify(cred.pinHash, pin).catch(() => false);
    const r = recordPinAttempt(this.d.db(), s.user.id, ok, PIN_MAX_ATTEMPTS, PIN_LOCKOUT_SECONDS);
    if (!ok) throw new AppError(r.locked ? 'PIN_LOCKED' : 'INVALID_CREDENTIALS', 'Wrong PIN');
    return true;
  }
  listCachedUsers() { return listCachedUsers(this.d.db()).map((u) => ({ id: u.id, name: u.name, identifier: u.identifier })); }

  async logout(): Promise<void> {
    const s = this.d.session.get();
    const refresh = this.d.secrets.get(SECRET_KEYS.refreshToken);
    if (refresh && this.d.isOnline()) {
      try { await this.d.cloud().request('POST', '/auth/logout', { refresh_token: refresh }); } catch { /* best effort */ }
    }
    this.d.secrets.delete(SECRET_KEYS.refreshToken);
    this.audit(s, 'auth.logout', {});
    this.d.session.clear();
  }

  /** Called by the cloud client when the access token is missing/expired and a refresh token exists. */
  async refreshAccessToken(): Promise<boolean> {
    const refresh = this.d.secrets.get(SECRET_KEYS.refreshToken);
    if (!refresh) return false;
    try {
      const r = await this.d.cloud().request<{ access_token: string; refresh_token: string; expires_in: number }>('POST', '/auth/refresh', { refresh_token: refresh }, { auth: false });
      this.d.session.setAccessToken(r.data.access_token, r.data.expires_in);
      this.d.secrets.set(SECRET_KEYS.refreshToken, r.data.refresh_token);
      const s = this.d.session.get();
      if (s) touchOnlineAuth(this.d.db(), s.user.id);
      return true;
    } catch (e) {
      this.d.loggers.app.warn({ err: String(e) }, 'refresh failed');
      return false;
    }
  }

  buildSession(userId: string, mode: 'online' | 'offline', permVer: number, offlineDaysRemaining: number | null = null): Session {
    const db = this.d.db();
    const user = getUser(db, userId)!;
    const memberships = listMemberships(db, userId);
    const active = getMeta(db, META_KEYS.activeBusinessId);
    const m = memberships.find((x) => x.businessId === active) ?? memberships[0] ?? null;
    const orgs = JSON.parse(getMeta(db, `orgs:${userId}`) ?? '[]') as { id: string }[];
    const branchId = m ? getMeta(db, META_KEYS.activeBranchId) : null;
    const terminalId = m ? getMeta(db, META_KEYS.activeTerminalId) : null;
    return {
      user: { id: user.id, name: user.name, identifier: user.identifier, roles: m?.snapshot.roles ?? [] },
      organizationId: m?.organizationId ?? orgs[0]?.id ?? null,
      businessId: m?.businessId ?? null,
      branchId: branchId || null,
      terminalId: terminalId || null,
      deviceId: this.d.device.localDeviceId(),
      mode, permVer: m?.snapshot.permVer ?? permVer, offlineDaysRemaining, permissions: m?.snapshot.grants.map((g) => g.permission) ?? [],
    };
  }

  private audit(s: Session | null, action: string, after: unknown): void {
    const db = this.d.db();
    withTransaction(db, () => appendAudit(db, {
      businessId: s?.businessId ?? DEVICE_AUDIT_SCOPE, deviceId: this.d.device.localDeviceId(), userId: s?.user.id ?? 'anonymous',
      terminalId: s?.terminalId ?? null, action, entityType: 'auth', after,
    }));
  }
}

function localOwnerBusinesses(db: Db, userId: string): { businessId: string; organizationId: string; name: string }[] {
  return (db.prepare("SELECT id AS businessId, organization_id AS organizationId, name FROM business WHERE created_by = ? AND sync_state = 'pending' AND deleted_at IS NULL").all(userId) as { businessId: string; organizationId: string; name: string }[]);
}
export { getMembership };
