const grouping = new Intl.NumberFormat('en-IN');

// Indian grouping, two decimals: 123456789 paise → "12,34,567.89".
export const rupees = (paise: number): string => {
  const abs = Math.abs(paise);
  return `${paise < 0 ? '−' : ''}${grouping.format(Math.trunc(abs / 100))}.${String(abs % 100).padStart(2, '0')}`;
};

// A blank cell for zero keeps wide tables readable.
export const cell = (paise: number): string => (paise === 0 ? '' : rupees(paise));

export const rate = (bp: number): string => `${bp / 100}%`;

export const qty = (milli: number): string => String(milli / 1000);
