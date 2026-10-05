import type { Gstr3b, GstHeads } from './types.js';

// Movements on the tax accounts in the month, set-off journals left out: output as credit − debit, input as debit − credit.
export interface GstBooks { output: GstHeads; input: GstHeads }
export interface GstTieOut { name: string; returnPaise: number; booksPaise: number }

const HEADS = [['IGST', 'igstPaise'], ['CGST', 'cgstPaise'], ['SGST', 'sgstPaise'], ['Cess', 'cessPaise']] as const;

// ADR-0044: the month's return totals equal the movements on the matching tax accounts, exactly.
export function gstTieOuts(r: Gstr3b, books: GstBooks): GstTieOut[] {
  return [
    ...HEADS.map(([label, k]) => ({ name: `output ${label}: 3.1 = output account`, returnPaise: r.outputTax[k], booksPaise: books.output[k] })),
    ...HEADS.map(([label, k]) => ({ name: `input ${label}: 4C = input account`, returnPaise: r.netItc[k], booksPaise: books.input[k] })),
  ];
}
