import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  ACCOUNT_ROLES, buildJournal, CASH_MOVEMENT_RULE, CHART_OF_ACCOUNTS, COST_CORRECTION_RULE, DEBIT_NOTE_RULE, EXPENSE_RULE, OPENING_STOCK_RULE,
  PARTY_OPENING_RULE, PURCHASE_RULE, RECEIPT_RULE, REGISTER_VARIANCE_RULE, reverse, SALE_RULE, STOCK_ADJUSTMENT_RULE, SUPPLIER_PAYMENT_RULE,
  totals, WRITE_OFF_RULE, type JournalLine, type PostingRule, type TaxHeads,
} from '../src/index.js';

const key = (l: JournalLine) => ('role' in l.account ? l.account.role : `code:${l.account.code}`) + (l.party ? `@${l.party.partyId}` : '');
// Lines as [account, debit, credit], for pinning a rule to the posting matrix.
const show = (lines: JournalLine[]) => lines.map((l) => [key(l), l.debitPaise, l.creditPaise]);
const net = (lines: readonly JournalLine[]) => {
  const m = new Map<string, number>();
  for (const l of lines) m.set(key(l), (m.get(key(l)) ?? 0) + l.debitPaise - l.creditPaise);
  return m;
};
const noTax: TaxHeads = { cgstPaise: 0, sgstPaise: 0, igstPaise: 0, cessPaise: 0 };

describe('posting rules, pinned to the posting matrix (ADR-0032)', () => {
  it('a sale paid partly in cash, partly by UPI and partly on credit, with round-off and COGS', () => {
    // ₹1,000 taxable + 9% + 9% = ₹1,180, rounded down 40 paise: ₹1,179.60 → ₹500 cash, ₹300 UPI, ₹379.60 on credit.
    const lines = buildJournal(SALE_RULE, {
      cashPaise: 50_000, clearingPaise: 30_000, creditPaise: 37_960, customerId: 'C1', taxablePaise: 100_000,
      tax: { cgstPaise: 9000, sgstPaise: 9000, igstPaise: 0, cessPaise: 0 }, roundOffPaise: -40, cogsPaise: 70_000,
    });
    expect(show(lines)).toEqual([
      ['cash', 50_000, 0], ['clearing', 30_000, 0], ['ar@C1', 37_960, 0], ['sales_goods', 0, 100_000],
      ['output_cgst', 0, 9000], ['output_sgst', 0, 9000], ['round_off', 40, 0], ['cogs', 70_000, 0], ['inventory', 0, 70_000],
    ]);
  });

  it('a purchase: stock at landed cost, claimable tax, round-off and the bill owed', () => {
    // ₹1,000 + 2.5% CGST + 2.5% SGST + ₹100 freight; the supplier's bill came to 50 paise more.
    const lines = buildJournal(PURCHASE_RULE, {
      supplierId: 'S1', inventoryPaise: 110_000, itc: { cgstPaise: 2500, sgstPaise: 2500, igstPaise: 0, cessPaise: 0 }, roundOffPaise: 50, totalPaise: 115_050,
    });
    expect(show(lines)).toEqual([['inventory', 110_000, 0], ['input_cgst', 2500, 0], ['input_sgst', 2500, 0], ['round_off', 50, 0], ['ap@S1', 0, 115_050]]);
  });

  it('a debit note whose freight the supplier keeps', () => {
    // 2 of 20 bags back: ₹100 + ₹2.50 + ₹2.50; their ₹10 freight share is not refunded.
    const lines = buildJournal(DEBIT_NOTE_RULE, {
      supplierId: 'S1', totalPaise: 10_500, inventoryPaise: 11_000, itcReversed: { cgstPaise: 250, sgstPaise: 250, igstPaise: 0, cessPaise: 0 }, lossPaise: 1000, roundOffPaise: 0,
    });
    expect(show(lines)).toEqual([['ap@S1', 10_500, 0], ['purchase_return_loss', 1000, 0], ['inventory', 0, 11_000], ['input_cgst', 0, 250], ['input_sgst', 0, 250]]);
  });

  it('receipts, supplier payments and write-offs move the control accounts', () => {
    expect(show(buildJournal(RECEIPT_RULE, { partyType: 'customer', partyId: 'C1', method: 'upi', amountPaise: 60_000 }))).toEqual([['bank', 60_000, 0], ['ar@C1', 0, 60_000]]);
    expect(show(buildJournal(SUPPLIER_PAYMENT_RULE, { partyType: 'supplier', partyId: 'S1', method: 'cash', amountPaise: 1000 }))).toEqual([['ap@S1', 1000, 0], ['cash', 0, 1000]]);
    expect(show(buildJournal(WRITE_OFF_RULE, { customerId: 'C1', amountPaise: 500 }))).toEqual([['bad_debts', 500, 0], ['ar@C1', 0, 500]]);
  });

  it('an expense on credit with claimable GST, and one paid from the bank', () => {
    expect(show(buildJournal(EXPENSE_RULE, {
      expenseAccount: { code: '5440' }, method: 'credit', supplierId: 'S1', expensePaise: 10_000, itc: { cgstPaise: 900, sgstPaise: 900, igstPaise: 0, cessPaise: 0 }, roundOffPaise: 0, totalPaise: 11_800,
    }))).toEqual([['code:5440', 10_000, 0], ['input_cgst', 900, 0], ['input_sgst', 900, 0], ['ap@S1', 0, 11_800]]);
    expect(show(buildJournal(EXPENSE_RULE, { expenseAccount: { code: '5400' }, method: 'bank', supplierId: null, expensePaise: 2_000_000, itc: noTax, roundOffPaise: 0, totalPaise: 2_000_000 })))
      .toEqual([['code:5400', 2_000_000, 0], ['bank', 0, 2_000_000]]);
  });

  it('stock documents post their movement values', () => {
    expect(show(buildJournal(OPENING_STOCK_RULE, { valuePaise: 44_000 }))).toEqual([['inventory', 44_000, 0], ['opening_equity', 0, 44_000]]);
    expect(show(buildJournal(STOCK_ADJUSTMENT_RULE, { lossPaise: 6000, gainPaise: 1500 })))
      .toEqual([['shrinkage', 6000, 0], ['inventory', 0, 6000], ['inventory', 1500, 0], ['inventory_gain', 0, 1500]]);
    expect(show(buildJournal(COST_CORRECTION_RULE, { valuePaise: -2500 }))).toEqual([['inventory', 0, 2500], ['cogs', 2500, 0]]);
  });

  it('openings by side, register variance and cash to classify', () => {
    expect(show(buildJournal(PARTY_OPENING_RULE, { partyType: 'supplier', partyId: 'S1', signedPaise: -50_000 }))).toEqual([['ap@S1', 0, 50_000], ['opening_equity', 50_000, 0]]);
    expect(show(buildJournal(PARTY_OPENING_RULE, { partyType: 'customer', partyId: 'C1', signedPaise: 1000 }))).toEqual([['ar@C1', 1000, 0], ['opening_equity', 0, 1000]]);
    expect(show(buildJournal(REGISTER_VARIANCE_RULE, { variancePaise: -300 }))).toEqual([['cash_short', 300, 0], ['cash', 0, 300]]);
    expect(show(buildJournal(REGISTER_VARIANCE_RULE, { variancePaise: 200 }))).toEqual([['cash', 200, 0], ['cash_over', 0, 200]]);
    expect(buildJournal(REGISTER_VARIANCE_RULE, { variancePaise: 0 })).toEqual([]);
    expect(show(buildJournal(CASH_MOVEMENT_RULE, { direction: 'out', amountPaise: 5000 }))).toEqual([['cash', 0, 5000], ['cash_to_classify', 5000, 0]]);
  });

  it('refuses a rule that does not balance, before anything is written', () => {
    const broken: PostingRule<{ n: number }> = [{ side: 'dr', account: { role: 'cash' }, amount: (f) => f.n }];
    expect(() => buildJournal(broken, { n: 1 })).toThrow(expect.objectContaining({ code: 'LEDGER_IMBALANCE' }));
    expect(() => buildJournal(broken, { n: 0.5 })).toThrow(/whole paise/);
  });
});

const paise = (max = 10_000_000) => fc.integer({ min: 0, max });
const heads = fc.record({ cgstPaise: paise(2_000_000), sgstPaise: paise(2_000_000), igstPaise: paise(2_000_000), cessPaise: paise(500_000) });
const sumHeads = (t: TaxHeads) => t.cgstPaise + t.sgstPaise + t.igstPaise + t.cessPaise;
const pick = (t: TaxHeads, eligible: readonly boolean[]): TaxHeads => ({
  cgstPaise: eligible[0] ? t.cgstPaise : 0, sgstPaise: eligible[1] ? t.sgstPaise : 0, igstPaise: eligible[2] ? t.igstPaise : 0, cessPaise: eligible[3] ? t.cessPaise : 0,
});
const flags = fc.array(fc.boolean(), { minLength: 4, maxLength: 4 });
const roundOff = fc.integer({ min: -100, max: 100 });

// Each generator obeys the document's own CHECKs, so a balanced journal is a property of the rule, not of the data.
const sale = fc.record({ taxablePaise: paise(), tax: heads, roundOffPaise: roundOff, cogsPaise: paise(), split: fc.tuple(fc.nat(100), fc.nat(100)) })
  .filter((s) => s.taxablePaise + sumHeads(s.tax) + s.roundOffPaise >= 0)
  .map(({ split, ...s }) => {
    const total = s.taxablePaise + sumHeads(s.tax) + s.roundOffPaise;
    const cash = Math.floor((total * split[0]) / 100);
    const clearing = Math.floor(((total - cash) * split[1]) / 100);
    return { ...s, cashPaise: cash, clearingPaise: clearing, creditPaise: total - cash - clearing, customerId: 'C1' };
  });
const purchase = fc.record({ taxable: paise(), charges: paise(500_000), tax: heads, eligible: flags, roundOffPaise: roundOff })
  .map((p) => {
    const itc = pick(p.tax, p.eligible);
    const inventoryPaise = p.taxable + p.charges + sumHeads(p.tax) - sumHeads(itc);
    return { supplierId: 'S1', inventoryPaise, itc, roundOffPaise: p.roundOffPaise, totalPaise: inventoryPaise + sumHeads(itc) + p.roundOffPaise };
  });
const debitNote = fc.record({ taxable: paise(), share: paise(500_000), refund: fc.boolean(), tax: heads, eligible: flags, roundOffPaise: roundOff })
  .map((d) => {
    const itcReversed = pick(d.tax, d.eligible);
    const refunded = d.refund ? d.share : 0;
    return {
      supplierId: 'S1', itcReversed, roundOffPaise: d.roundOffPaise, lossPaise: d.share - refunded,
      inventoryPaise: d.taxable + d.share + sumHeads(d.tax) - sumHeads(itcReversed), totalPaise: d.taxable + sumHeads(d.tax) + refunded + d.roundOffPaise,
    };
  });
const method = fc.constantFrom('cash', 'upi', 'card', 'bank', 'cheque', 'other');
const expense = fc.record({ taxable: paise(), tax: heads, eligible: flags, roundOffPaise: roundOff, method: fc.constantFrom('cash', 'upi', 'bank', 'credit') })
  .map((e) => {
    const itc = pick(e.tax, e.eligible);
    return {
      expenseAccount: { code: '5900' }, method: e.method, supplierId: e.method === 'credit' ? 'S1' : null, itc, roundOffPaise: e.roundOffPaise,
      expensePaise: e.taxable + sumHeads(e.tax) - sumHeads(itc), totalPaise: e.taxable + sumHeads(e.tax) + e.roundOffPaise,
    };
  });
const signed = fc.integer({ min: -10_000_000, max: 10_000_000 });

const RULES: [string, PostingRule<never>, fc.Arbitrary<unknown>][] = [
  ['sale', SALE_RULE as PostingRule<never>, sale],
  ['purchase', PURCHASE_RULE as PostingRule<never>, purchase],
  ['debit note', DEBIT_NOTE_RULE as PostingRule<never>, debitNote],
  ['receipt', RECEIPT_RULE as PostingRule<never>, fc.record({ partyType: fc.constant('customer'), partyId: fc.constant('C1'), method, amountPaise: paise() })],
  ['supplier payment', SUPPLIER_PAYMENT_RULE as PostingRule<never>, fc.record({ partyType: fc.constant('supplier'), partyId: fc.constant('S1'), method, amountPaise: paise() })],
  ['write-off', WRITE_OFF_RULE as PostingRule<never>, fc.record({ customerId: fc.constant('C1'), amountPaise: paise() })],
  ['expense', EXPENSE_RULE as PostingRule<never>, expense],
  ['opening stock', OPENING_STOCK_RULE as PostingRule<never>, fc.record({ valuePaise: paise() })],
  ['stock adjustment', STOCK_ADJUSTMENT_RULE as PostingRule<never>, fc.record({ lossPaise: paise(), gainPaise: paise() })],
  ['cost correction', COST_CORRECTION_RULE as PostingRule<never>, fc.record({ valuePaise: signed })],
  ['party opening', PARTY_OPENING_RULE as PostingRule<never>, fc.record({ partyType: fc.constantFrom('customer', 'supplier'), partyId: fc.constant('P1'), signedPaise: signed })],
  ['register variance', REGISTER_VARIANCE_RULE as PostingRule<never>, fc.record({ variancePaise: signed })],
  ['cash movement', CASH_MOVEMENT_RULE as PostingRule<never>, fc.record({ direction: fc.constantFrom('in', 'out'), amountPaise: paise() })],
];

describe('every rule balances for any document its generator can make (FR-052)', () => {
  for (const [name, rule, arb] of RULES) {
    it(`property: ${name} — balanced, no negative or two-sided line, and a reversal nets every account to zero`, () => {
      fc.assert(fc.property(arb, (facts) => {
        const lines = buildJournal(rule, facts as never);
        const t = totals(lines);
        expect(t.debit).toBe(t.credit);
        for (const l of lines) {
          expect(l.debitPaise).toBeGreaterThanOrEqual(0);
          expect(l.creditPaise).toBeGreaterThanOrEqual(0);
          expect((l.debitPaise === 0) !== (l.creditPaise === 0)).toBe(true);
        }
        for (const v of net([...lines, ...reverse(lines)]).values()) expect(v).toBe(0);
      }), { numRuns: 500 });
    });
  }
});

describe('chart of accounts (ADR-0031)', () => {
  it('has unique codes, one account per role, every role a rule needs, and the expense category accounts', () => {
    const codes = CHART_OF_ACCOUNTS.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
    const roles = CHART_OF_ACCOUNTS.flatMap((a) => (a.role ? [a.role] : []));
    expect([...roles].sort()).toEqual([...ACCOUNT_ROLES].sort());
    for (const c of ['5400', '5410', '5420', '5430', '5440', '5450', '5460', '5900']) expect(codes).toContain(c);
    for (const a of CHART_OF_ACCOUNTS) if (!a.isGroup) expect(codes).toContain(a.group);
  });
});
