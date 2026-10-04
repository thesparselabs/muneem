import { useUi } from '../store.js';
import { stockStaleness } from '../lib/sync/status.js';
import { useNow } from '../lib/useNow.js';

export default function StockStaleness() {
  const sync = useUi((s) => s.sync);
  const text = stockStaleness(sync, useNow());
  return text ? <p className="text-xs text-slate-500" role="note">{text}</p> : null;
}
