import type { FinancialYear } from '@muneem/contracts';

export interface CheckItem { label: string; done: boolean; detail?: string }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthShort = (month: string): string => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

export function statusLabel(y: FinancialYear): string {
  if (y.status === 'requested') return 'Close sent — waiting for the cloud';
  if (y.status === 'closed') return y.needsReclose ? 'Closed — postings since need closing' : 'Closed';
  return y.ended ? 'Ready to close once the checklist is done' : 'In progress';
}

// What must be true before a year can close (ADR-0045), in the order a shop works through it.
export function checklist(y: FinancialYear): CheckItem[] {
  const open = y.months.filter((m) => m.status === 'open');
  const items: CheckItem[] = [{ label: 'The year has ended', done: y.ended }];
  if (y.gst.required) {
    const last = y.gst.lastActiveMonth!;
    items.push({ label: `GST set off through ${monthShort(last)}`, done: y.gst.settledThrough !== null && y.gst.settledThrough >= last,
      ...(y.gst.settledThrough && { detail: `last set-off: ${monthShort(y.gst.settledThrough)}` }) });
  }
  items.push({ label: 'Every month locked', done: open.length === 0, ...(open.length > 0 && { detail: `${open.length} open: ${open.map((m) => monthShort(m.month)).join(', ')}` }) });
  return items;
}

export const canClose = (y: FinancialYear): boolean => y.status === 'open' && y.blockers.length === 0;
