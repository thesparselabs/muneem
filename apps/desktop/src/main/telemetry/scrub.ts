import { createHash } from 'node:crypto';

export type ReportKind = 'uncaught' | 'unhandled_rejection' | 'renderer' | 'process_gone' | 'native';

export interface ReportInput {
  kind: ReportKind;
  process: string;
  name?: string | undefined;
  message?: string | undefined;
  stack?: string | undefined;
}

export interface ReportContext {
  appVersion: string;
  schemaVersion: number | null;
  os: string;
  installation: string;
  environment: 'production' | 'development';
}

export interface Frame { function: string; filename: string; lineno?: number; colno?: number }

// A Sentry store-endpoint event with nothing but allow-listed fields (ADR-0053).
export interface CrashEvent {
  event_id: string;
  timestamp: string;
  platform: 'node';
  level: 'error' | 'fatal';
  release: string;
  environment: string;
  tags: { kind: ReportKind; process: string; os: string; schema_version: string; installation: string };
  exception: { values: { type: string; value: string; stacktrace: { frames: Frame[] } }[] };
}

const PROCESSES = new Set(['main', 'renderer', 'utility', 'gpu', 'zygote', 'sandbox_helper', 'pepper_plugin', 'unknown']);
const MAX_MESSAGE = 500;
const MAX_FRAMES = 30;

/** Strips what an error message can leak: quoted values, e-mails, GSTINs, phone or long numbers, and directories. */
export function redact(text: string): string {
  return text
    .replace(/"[^"]*"|'[^']*'|`[^`]*`/gu, '"…"')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/gu, '[email]')
    .replace(/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/giu, '[gstin]')
    .replace(/\d{6,}/gu, '[number]')
    .replace(/(?:[A-Za-z]:)?[\\/][^\s:()]+[\\/]/gu, '…/')
    .slice(0, MAX_MESSAGE);
}

const baseName = (file: string) => file.replace(/^file:\/\//u, '').split(/[\\/]/u).pop()!.slice(0, 80);
const identifier = (s: string | undefined, fallback: string) => (s && /^[A-Za-z_$][\w$.<> ]{0,80}$/u.test(s) ? s : fallback);

/** V8 stack lines → frames, oldest first as Sentry expects; only the function, the file's base name and the position. */
export function parseStack(stack: string | undefined): Frame[] {
  if (!stack) return [];
  const frames: Frame[] = [];
  for (const line of stack.split('\n')) {
    const m = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/u.exec(line);
    if (!m) continue;
    frames.push({ function: identifier(m[1], '?'), filename: baseName(m[2]!), lineno: Number(m[3]), colno: Number(m[4]) });
    if (frames.length === MAX_FRAMES) break;
  }
  return frames.reverse();
}

export function installationHash(installationId: string): string {
  return createHash('sha256').update(`muneem-crash\0${installationId}`).digest('hex').slice(0, 16);
}

/** Builds the event by allow-list: no user, request, breadcrumbs, extras, contexts or anything from the documents. */
export function toEvent(input: ReportInput, ctx: ReportContext, eventId: string, now: number): CrashEvent {
  const fatal = input.kind === 'uncaught' || input.kind === 'native' || input.kind === 'process_gone';
  return {
    event_id: eventId, timestamp: new Date(now).toISOString(), platform: 'node', level: fatal ? 'fatal' : 'error',
    release: `muneem@${ctx.appVersion}`, environment: ctx.environment,
    tags: {
      kind: input.kind, process: PROCESSES.has(input.process) ? input.process : 'unknown', os: redact(ctx.os).slice(0, 80),
      schema_version: ctx.schemaVersion === null ? '' : String(ctx.schemaVersion), installation: /^[0-9a-f]{16}$/u.test(ctx.installation) ? ctx.installation : '',
    },
    exception: { values: [{ type: identifier(input.name, 'Error'), value: redact(input.message ?? ''), stacktrace: { frames: parseStack(input.stack) } }] },
  };
}

/** Same error, same place: reported once per window. */
export function fingerprint(e: CrashEvent): string {
  const x = e.exception.values[0]!;
  const top = x.stacktrace.frames.at(-1);
  return [e.tags.kind, e.tags.process, x.type, x.value, top ? `${top.function}@${top.filename}:${top.lineno}` : ''].join('|');
}
