import { release } from 'node:os';
import { newUlid } from '@muneem/domain';
import { currentSchemaVersion, getMeta, getSetting, META_KEYS, setMeta, type Db } from '@muneem/db-sqlite';
import type { Handlers } from '../ipc/gateway.js';
import type { Logger } from '../infra/logger.js';
import { CrashReports, httpCrashSend, storeUrl, type CrashSend } from './crashReports.js';
import { installationHash } from './scrub.js';

export interface TelemetryDeps {
  db: () => Db;
  businessId: () => string | null;
  installationId: () => string;
  appVersion: string;
  platform: string;
  dsn: string | null;
  isDev: boolean;
  log: Logger;
  fetchImpl?: typeof fetch;
  send?: CrashSend;
  now?: () => number;
}

type TelemetryHandlers = Pick<Handlers, 'diagnostics.crashReporting' | 'diagnostics.reportRendererError'>;

// Consent is the owner's setting for the open business, or, before sign-in, for the business last opened here.
export function createTelemetry(d: TelemetryDeps): { crashReports: CrashReports; handlers: TelemetryHandlers } {
  const url = storeUrl(d.dsn);
  const send = d.send ?? (url ? httpCrashSend(url, d.fetchImpl ?? fetch) : null);
  const crashReports = new CrashReports({
    send, log: d.log, newId: () => newUlid().toLowerCase(), now: d.now ?? (() => Date.now()),
    enabled: () => {
      const businessId = d.businessId() ?? getMeta(d.db(), META_KEYS.activeBusinessId);
      return !!businessId && getSetting(d.db(), businessId, 'telemetry.crashReports') === true;
    },
    context: () => ({
      appVersion: d.appVersion, os: `${d.platform} ${release()}`, environment: d.isDev ? 'development' : 'production',
      schemaVersion: (() => { try { return currentSchemaVersion(d.db()); } catch { return null; } })(),
      installation: (() => { try { return installationHash(d.installationId()); } catch { return ''; } })(),
    }),
    lastSent: () => { try { return getMeta(d.db(), META_KEYS.crashReportLast); } catch { return null; } },
    recordSent: (iso) => { try { setMeta(d.db(), META_KEYS.crashReportLast, iso); } catch { /* db closed while sending */ } },
  });
  const handlers: TelemetryHandlers = {
    'diagnostics.crashReporting': () => crashReports.status(),
    'diagnostics.reportRendererError': (i) => {
      crashReports.capture({ kind: 'renderer', process: 'renderer', name: i.name, message: i.message, stack: i.stack });
      return { ok: true as const };
    },
  };
  return { crashReports, handlers };
}
