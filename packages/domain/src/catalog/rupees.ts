const grouping = new Intl.NumberFormat('en-IN');

export function formatRupees(paise: number): string {
  const abs = Math.abs(paise);
  return `${paise < 0 ? '-' : ''}₹${grouping.format(Math.floor(abs / 100))}.${String(abs % 100).padStart(2, '0')}`;
}
