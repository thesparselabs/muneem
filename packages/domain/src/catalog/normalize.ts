const MARK = /\p{M}/u;
const LATIN = /\p{Script=Latin}/u;

// Accents are stripped only after a Latin base: in Indic scripts the marks are vowel signs, not decoration.
export function normalizeName(raw: string): string {
  const decomposed = raw.normalize('NFKC').toLowerCase().normalize('NFD');
  let out = '';
  let base = '';
  for (const ch of decomposed) {
    if (!MARK.test(ch)) base = ch;
    else if (LATIN.test(base)) continue;
    out += ch;
  }
  return out.normalize('NFC').replace(/\s+/gu, ' ').trim();
}
