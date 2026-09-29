import type { Uom } from '@muneem/contracts';

export default function UomSelect({ id, uoms, value, onChange, allowNone }: { id: string; uoms: Uom[]; value: string; onChange: (v: string) => void; allowNone?: string }) {
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {allowNone && <option value="">{allowNone}</option>}
      {uoms.map((u) => <option key={u.id} value={u.id}>{u.code} · {u.name}</option>)}
    </select>
  );
}
