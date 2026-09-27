import type { Grant, PermissionSnapshot } from '@muneem/contracts';
import type { Db } from '../open.js';
import { nowIso, withTransaction } from '../uow.js';

export interface CachedUser { id: string; name: string; identifier: string; email: string | null; mobile: string | null; isActive: boolean }
export interface Membership { userId: string; businessId: string; organizationId: string; businessName: string | null; snapshot: PermissionSnapshot }
export interface CredentialRow {
  userId: string; passwordHash: string; pinHash: string | null; lastOnlineAuthAt: string;
  failedPinAttempts: number; pinLockedUntil: string | null; maxOfflineDays: number;
}

export function upsertUser(db: Db, u: Omit<CachedUser, 'isActive'>): void {
  const t = nowIso();
  db.prepare(`INSERT INTO user (id, name, identifier, email, mobile, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, identifier = excluded.identifier, email = excluded.email, mobile = excluded.mobile,
      updated_at = excluded.updated_at, version = user.version + 1`).run(u.id, u.name, u.identifier, u.email, u.mobile, t, t);
}
export function getUserByIdentifier(db: Db, identifier: string): CachedUser | null {
  const r = db.prepare('SELECT * FROM user WHERE identifier = ? COLLATE NOCASE').get(identifier) as { id: string; name: string; identifier: string; email: string | null; mobile: string | null; is_active: number } | undefined;
  return r ? { id: r.id, name: r.name, identifier: r.identifier, email: r.email, mobile: r.mobile, isActive: r.is_active === 1 } : null;
}
export function getUser(db: Db, id: string): CachedUser | null {
  const r = db.prepare('SELECT * FROM user WHERE id = ?').get(id) as { id: string; name: string; identifier: string; email: string | null; mobile: string | null; is_active: number } | undefined;
  return r ? { id: r.id, name: r.name, identifier: r.identifier, email: r.email, mobile: r.mobile, isActive: r.is_active === 1 } : null;
}
export function listCachedUsers(db: Db): CachedUser[] {
  return (db.prepare('SELECT u.* FROM user u JOIN user_credential c ON c.user_id = u.id WHERE u.is_active = 1 ORDER BY u.name').all() as { id: string; name: string; identifier: string; email: string | null; mobile: string | null; is_active: number }[])
    .map((r) => ({ id: r.id, name: r.name, identifier: r.identifier, email: r.email, mobile: r.mobile, isActive: true }));
}

export function replaceMemberships(db: Db, userId: string, memberships: Omit<Membership, 'userId'>[]): void {
  withTransaction(db, () => {
    db.prepare('DELETE FROM user_membership WHERE user_id = ?').run(userId);
    const ins = db.prepare(`INSERT INTO user_membership (user_id, business_id, organization_id, business_name, roles_json, grants_json, perm_ver, issued_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const m of memberships) {
      ins.run(userId, m.businessId, m.organizationId, m.businessName, JSON.stringify(m.snapshot.roles), JSON.stringify(m.snapshot.grants), m.snapshot.permVer, m.snapshot.issuedAt);
    }
  });
}
/** Local, pre-sync membership for a business created on this device: owner preset. */
export function grantLocalOwnership(db: Db, userId: string, businessId: string, organizationId: string, businessName: string, grants: Grant[]): void {
  db.prepare(`INSERT OR REPLACE INTO user_membership (user_id, business_id, organization_id, business_name, roles_json, grants_json, perm_ver, issued_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)`).run(userId, businessId, organizationId, businessName, JSON.stringify(['owner']), JSON.stringify(grants), nowIso());
}
export function listMemberships(db: Db, userId: string): Membership[] {
  return (db.prepare('SELECT * FROM user_membership WHERE user_id = ?').all(userId) as { user_id: string; business_id: string; organization_id: string; business_name: string | null; roles_json: string; grants_json: string; perm_ver: number; issued_at: string }[])
    .map((r) => ({ userId: r.user_id, businessId: r.business_id, organizationId: r.organization_id, businessName: r.business_name,
      snapshot: { permVer: r.perm_ver, roles: JSON.parse(r.roles_json) as string[], grants: JSON.parse(r.grants_json) as Grant[], issuedAt: r.issued_at } }));
}
export function getMembership(db: Db, userId: string, businessId: string): Membership | null {
  return listMemberships(db, userId).find((m) => m.businessId === businessId) ?? null;
}

export function upsertCredential(db: Db, c: { userId: string; passwordHash: string; maxOfflineDays: number; lastOnlineAuthAt?: string }): void {
  const t = nowIso();
  db.prepare(`INSERT INTO user_credential (user_id, password_hash, last_online_auth_at, max_offline_days, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET password_hash = excluded.password_hash, last_online_auth_at = excluded.last_online_auth_at,
      max_offline_days = excluded.max_offline_days, failed_pin_attempts = 0, pin_locked_until = NULL, updated_at = excluded.updated_at`)
    .run(c.userId, c.passwordHash, c.lastOnlineAuthAt ?? t, c.maxOfflineDays, t);
}
export function getCredential(db: Db, userId: string): CredentialRow | null {
  const r = db.prepare('SELECT * FROM user_credential WHERE user_id = ?').get(userId) as { user_id: string; password_hash: string; pin_hash: string | null; last_online_auth_at: string; failed_pin_attempts: number; pin_locked_until: string | null; max_offline_days: number } | undefined;
  return r ? { userId: r.user_id, passwordHash: r.password_hash, pinHash: r.pin_hash, lastOnlineAuthAt: r.last_online_auth_at, failedPinAttempts: r.failed_pin_attempts, pinLockedUntil: r.pin_locked_until, maxOfflineDays: r.max_offline_days } : null;
}
export function setPinHash(db: Db, userId: string, pinHash: string): void {
  db.prepare('UPDATE user_credential SET pin_hash = ?, failed_pin_attempts = 0, pin_locked_until = NULL, updated_at = ? WHERE user_id = ?').run(pinHash, nowIso(), userId);
}
export function recordPinAttempt(db: Db, userId: string, ok: boolean, maxAttempts: number, lockoutSeconds: number): { locked: boolean; lockedUntil: string | null } {
  if (ok) {
    db.prepare('UPDATE user_credential SET failed_pin_attempts = 0, pin_locked_until = NULL WHERE user_id = ?').run(userId);
    return { locked: false, lockedUntil: null };
  }
  const r = db.prepare('UPDATE user_credential SET failed_pin_attempts = failed_pin_attempts + 1 WHERE user_id = ? RETURNING failed_pin_attempts AS n').get(userId) as { n: number } | undefined;
  if (r && r.n >= maxAttempts) {
    const until = new Date(Date.now() + lockoutSeconds * 1000).toISOString();
    db.prepare('UPDATE user_credential SET pin_locked_until = ?, failed_pin_attempts = 0 WHERE user_id = ?').run(until, userId);
    return { locked: true, lockedUntil: until };
  }
  return { locked: false, lockedUntil: null };
}
export function touchOnlineAuth(db: Db, userId: string): void {
  db.prepare('UPDATE user_credential SET last_online_auth_at = ?, updated_at = ? WHERE user_id = ?').run(nowIso(), nowIso(), userId);
}
