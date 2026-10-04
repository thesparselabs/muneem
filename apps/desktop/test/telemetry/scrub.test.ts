import { describe, expect, it } from 'vitest';
import { installationHash, parseStack, redact, toEvent, type ReportContext } from '../../src/main/telemetry/scrub.js';

// Values a careless error could carry; none may appear in what leaves the machine.
const PII = ['Ramesh Kumar', '9876543210', '27AAPFU0939F1ZV', 'ramesh@example.com', 'INV-2026-00042', 'C:\\Users\\ramesh', '/home/ramesh', 'Sharma Store', '1250000'];

const ctx: ReportContext = { appVersion: '1.2.0', schemaVersion: 20, os: 'win32 10.0.19045', installation: installationHash('01JINSTALL0000000000000000'), environment: 'production' };

const leaky = Object.assign(new TypeError(`cannot bill 'Ramesh Kumar' (9876543210, 27AAPFU0939F1ZV, ramesh@example.com) for "INV-2026-00042" total 1250000 at C:\\Users\\ramesh\\AppData\\db.sqlite`), {
  stack: [
    "TypeError: cannot bill 'Ramesh Kumar' (9876543210)",
    '    at completeSale (C:\\Users\\ramesh\\AppData\\Local\\Programs\\muneem\\resources\\app.asar\\out\\main\\index.js:120:7)',
    '    at /home/ramesh/muneem/out/main/index.js:88:3',
    '    at Object.<anonymous> (file:///home/ramesh/Sharma Store/app.js:1:1)',
    '    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)',
  ].join('\n'),
});

describe('crash report scrubbing (NFR-025)', () => {
  it('keeps only allow-listed fields and no value from the fixture', () => {
    const event = toEvent({ kind: 'uncaught', process: 'main', name: leaky.name, message: leaky.message, stack: leaky.stack }, ctx, 'e1', Date.UTC(2026, 9, 5));
    const out = JSON.stringify(event);
    for (const value of PII) expect(out).not.toContain(value);
    expect(Object.keys(event).sort()).toEqual(['environment', 'event_id', 'exception', 'level', 'platform', 'release', 'tags', 'timestamp']);
    expect(Object.keys(event.tags).sort()).toEqual(['installation', 'kind', 'os', 'process', 'schema_version']);
    expect(event).toMatchObject({ release: 'muneem@1.2.0', level: 'fatal', tags: { kind: 'uncaught', process: 'main', schema_version: '20' } });
    expect(event.tags.installation).toMatch(/^[0-9a-f]{16}$/u);
    expect(event.exception.values[0]!.type).toBe('TypeError');
    expect(event.exception.values[0]!.value).toContain('[number]');
  });

  it('keeps frames as function, base name and position, oldest first', () => {
    expect(parseStack(leaky.stack)).toEqual([
      { function: 'process.processTicksAndRejections', filename: 'task_queues', lineno: 95, colno: 5 },
      { function: 'Object.<anonymous>', filename: 'app.js', lineno: 1, colno: 1 },
      { function: '?', filename: 'index.js', lineno: 88, colno: 3 },
      { function: 'completeSale', filename: 'index.js', lineno: 120, colno: 7 },
    ]);
  });

  it('redacts quoted values, contacts, GSTINs, long numbers and directories', () => {
    expect(redact(`no customer "Ramesh" phone 9876543210 gstin 27AAPFU0939F1ZV mail a.b@c.in in /home/x/y/file.db`))
      .toBe('no customer "…" phone [number] gstin [gstin] mail [email] in …/file.db');
  });

  it('drops a name or identifier that is not the expected shape', () => {
    const event = toEvent({ kind: 'renderer', process: 'Ramesh Kumar renderer', name: 'Ramesh Kumar: 9876543210' }, { ...ctx, installation: 'Ramesh' }, 'e2', 0);
    expect(event.tags.process).toBe('unknown');
    expect(event.tags.installation).toBe('');
    expect(event.exception.values[0]!.type).toBe('Error');
    for (const value of PII) expect(JSON.stringify(event)).not.toContain(value);
  });

  it('hashes the installation id so it cannot be read back', () => {
    expect(installationHash('01JINSTALL0000000000000000')).not.toContain('01JINSTALL');
    expect(installationHash('a')).toBe(installationHash('a'));
    expect(installationHash('a')).not.toBe(installationHash('b'));
  });
});
