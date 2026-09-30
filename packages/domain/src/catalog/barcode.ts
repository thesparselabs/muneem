export const SYMBOLOGIES = ['EAN13', 'EAN8', 'UPCA', 'CODE128'] as const;
export type Symbology = (typeof SYMBOLOGIES)[number];

const DIGITS = /^\d+$/;
const PRINTABLE_ASCII = /^[\x20-\x7e]{1,48}$/;
const GTIN_LENGTH: Partial<Record<Symbology, number>> = { EAN13: 13, EAN8: 8, UPCA: 12 };

function gtinChecksumOk(code: string): boolean {
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

export function isValidBarcode(code: string, symbology: Symbology): boolean {
  const length = GTIN_LENGTH[symbology];
  if (length === undefined) return PRINTABLE_ASCII.test(code) && code.trim() === code;
  return code.length === length && DIGITS.test(code) && gtinChecksumOk(code);
}

export function detectSymbology(code: string): Symbology {
  for (const s of ['EAN13', 'UPCA', 'EAN8'] as const) if (isValidBarcode(code, s)) return s;
  return 'CODE128';
}
