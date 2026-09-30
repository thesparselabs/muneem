import { describe, expect, it } from 'vitest';
import { PreviewStore } from '../src/main/services/import/previewStore.js';

const MIN = 60_000;

describe('PreviewStore', () => {
  it('keeps a preview alive while it is being used and expires it 15 minutes after the last use', () => {
    let now = 0;
    const store = new PreviewStore(() => now);
    const s = store.put({ businessId: 'b', fileName: 'f.csv', table: { columns: [], rows: [] }, mapping: {} });
    now = 14 * MIN;
    store.get(s.id, 'b');
    now = 20 * MIN;
    expect(store.get(s.id, 'b').id).toBe(s.id);
    now = 36 * MIN;
    expect(() => store.get(s.id, 'b')).toThrow(/expired/);
  });
  it('never returns another business’s preview', () => {
    const store = new PreviewStore(() => 0);
    const s = store.put({ businessId: 'b', fileName: 'f.csv', table: { columns: [], rows: [] }, mapping: {} });
    expect(() => store.get(s.id, 'other')).toThrow(/expired/);
  });
});
