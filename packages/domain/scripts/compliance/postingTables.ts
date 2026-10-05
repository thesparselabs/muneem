import * as accounting from '../../src/accounting/index.js';
import {
  buildJournal, CHART_OF_ACCOUNTS, closingLines, paymentAccount, tenderAccount, type AccountRef, type JournalLine, type PostingRule,
} from '../../src/index.js';
import { rupees } from './format.js';

const H = { cgstPaise: 0, sgstPaise: 0, igstPaise: 0, cessPaise: 0 };

// Each rule with an example taken from docs/accounting/posting-matrix.md where it has one, so both documents are checked.
interface Entry { document: string; rule: string; example: string; facts: unknown }
const ENTRIES: Entry[] = [
  { document: 'Sale', rule: 'SALE_RULE', example: '₹1,000 taxable + 9% CGST + 9% SGST, rounded to ₹1,179.60; ₹500 cash, ₹300 UPI, the rest on credit; COGS ₹700.',
    facts: { cashPaise: 50_000, clearingPaise: 30_000, creditPaise: 37_960, customerId: 'C1', taxablePaise: 100_000, tax: { ...H, cgstPaise: 9_000, sgstPaise: 9_000 }, roundOffPaise: -40, cogsPaise: 70_000 } },
  { document: 'Credit note (sale return or cancel)', rule: 'SALE_RETURN_RULE',
    example: 'The whole of that sale comes back after ₹79.60 of the credit was paid: ₹300 settles the bill, ₹879.60 is refunded in cash.',
    facts: { cashPaise: 87_960, clearingPaise: 0, creditPaise: 30_000, customerId: 'C1', taxablePaise: 100_000, tax: { ...H, cgstPaise: 9_000, sgstPaise: 9_000 }, roundOffPaise: -40, costPaise: 70_000 } },
  { document: 'Purchase invoice', rule: 'PURCHASE_RULE', example: '₹1,000 + 2.5% CGST + 2.5% SGST + ₹100 freight, with a bill 50 paise higher.',
    facts: { supplierId: 'S1', inventoryPaise: 110_000, itc: { ...H, cgstPaise: 2_500, sgstPaise: 2_500 }, roundOffPaise: 50, totalPaise: 115_050 } },
  { document: 'Debit note (goods returned to the supplier)', rule: 'DEBIT_NOTE_RULE',
    example: '2 of 20 bags go back, worth ₹100 + ₹2.50 + ₹2.50; their ₹10 freight share is not refunded.',
    facts: { supplierId: 'S1', totalPaise: 10_500, inventoryPaise: 11_000, itcReversed: { ...H, cgstPaise: 250, sgstPaise: 250 }, lossPaise: 1_000, roundOffPaise: 0 } },
  { document: 'Customer receipt', rule: 'RECEIPT_RULE', example: '₹500 received by UPI.', facts: { partyType: 'customer', partyId: 'C1', method: 'upi', amountPaise: 50_000 } },
  { document: 'Supplier payment', rule: 'SUPPLIER_PAYMENT_RULE', example: '₹500 paid in cash.', facts: { partyType: 'supplier', partyId: 'S1', method: 'cash', amountPaise: 50_000 } },
  { document: 'Write-off', rule: 'WRITE_OFF_RULE', example: '₹200 written off.', facts: { customerId: 'C1', amountPaise: 20_000 } },
  { document: 'Expense', rule: 'EXPENSE_RULE', example: 'An internet bill on credit: ₹100 + 9% + 9%.',
    facts: { expenseAccount: { code: '5440' }, method: 'credit', supplierId: 'S1', expensePaise: 10_000, itc: { ...H, cgstPaise: 900, sgstPaise: 900 }, roundOffPaise: 0, totalPaise: 11_800 } },
  { document: 'Opening stock', rule: 'OPENING_STOCK_RULE', example: '₹5,000 of stock on day one.', facts: { valuePaise: 500_000 } },
  { document: 'Stock adjustment / stock take', rule: 'STOCK_ADJUSTMENT_RULE', example: '₹15 of stock short at average cost.', facts: { lossPaise: 1_500, gainPaise: 0 } },
  { document: 'Cost correction', rule: 'COST_CORRECTION_RULE', example: 'Units sold below zero re-costed ₹2.50 higher.', facts: { valuePaise: 250 } },
  { document: 'Party opening balance', rule: 'PARTY_OPENING_RULE', example: 'A customer owed ₹1,200 on day one.', facts: { partyType: 'customer', partyId: 'C1', signedPaise: 120_000 } },
  { document: 'Register close', rule: 'REGISTER_VARIANCE_RULE', example: 'The drawer is ₹5 short.', facts: { variancePaise: -500 } },
  { document: 'GST set-off', rule: 'GST_SETOFF_RULE',
    example: 'Output CGST 892.44, SGST 892.43 and cess 99.16 against input IGST 324.00 and cess 18.00.',
    facts: { liability: { ...H, cgstPaise: 89_244, sgstPaise: 89_243, cessPaise: 9_916 }, creditUsed: { ...H, igstPaise: 32_400, cessPaise: 1_800 }, cashPaise: 154_203 } },
  { document: 'GST payment (challan)', rule: 'GST_PAYMENT_RULE', example: 'The set-off above paid by challan.', facts: { totalPaise: 154_203 } },
  { document: 'Cash in or out of the drawer, no document', rule: 'CASH_MOVEMENT_RULE', example: '₹2,000 put into the drawer.', facts: { direction: 'in', amountPaise: 200_000 } },
];

const RULES = accounting as unknown as Record<string, PostingRule<unknown> | undefined>;
export const RULE_NAMES = Object.keys(accounting).filter((k) => k.endsWith('_RULE')).sort();
export const CATALOGUED = ENTRIES.map((e) => e.rule).sort();

const accountName = (ref: AccountRef): string => {
  const a = 'code' in ref ? CHART_OF_ACCOUNTS.find((x) => x.code === ref.code) : CHART_OF_ACCOUNTS.find((x) => x.role === ref.role);
  return `${a!.code} ${a!.name}`;
};

// Runs fn over the facts and lists the fields it read, so each table row names exactly what the rule uses.
function reads<F>(facts: F, fn: (f: F) => unknown): { value: unknown; fields: string[] } {
  const fields: string[] = [];
  const wrap = (o: object, prefix: string): object => new Proxy(o, {
    get(target, key) {
      const v = (target as Record<string | symbol, unknown>)[key];
      const path = `${prefix}${String(key)}`;
      if (v !== null && typeof v === 'object') return wrap(v, `${path}.`);
      if (!fields.includes(path)) fields.push(path);
      return v;
    },
  });
  return { value: fn(wrap(facts as object, '') as F), fields };
}

const code = (fields: string[]): string => fields.map((f) => `\`${f}\``).join(', ');

// The party is named outright unless the rule reads the party type from the document.
function partyText(x: { value: unknown; fields: string[] }): string {
  const type = (x.value as { partyType: string }).partyType;
  return x.fields.includes('partyType') ? `by ${code(x.fields)}` : `${type} (by ${code(x.fields)})`;
}

function ruleTable(rule: PostingRule<unknown>, facts: unknown): string[] {
  const rows = rule.map((r, i) => {
    const account = typeof r.account === 'function'
      ? (() => { const x = reads(facts, r.account); const example = accountName(x.value as AccountRef); return `by ${code(x.fields)}, e.g. ${example}`; })()
      : accountName(r.account);
    const amount = code(reads(facts, r.amount).fields);
    const when = r.when ? code(reads(facts, r.when).fields) : '';
    const party = r.party ? partyText(reads(facts, r.party)) : '';
    return `| ${i + 1} | ${r.side === 'dr' ? 'Dr' : 'Cr'} | ${account} | ${amount} | ${when} | ${party} |`;
  });
  return ['| # | Side | Account | Amount (fact) | Only when | Party |', '|---|---|---|---|---|---|', ...rows];
}

export function journalTable(lines: readonly JournalLine[]): string[] {
  return ['| Dr | Cr | Account |', '|---:|---:|---|',
    ...lines.map((l) => `| ${l.debitPaise ? rupees(l.debitPaise) : ''} | ${l.creditPaise ? rupees(l.creditPaise) : ''} | ${accountName(l.account)} |`)];
}

const METHODS = ['cash', 'upi', 'card', 'bank', 'cheque', 'other'];

export function postingTablesMarkdown(): string {
  const out = [
    '# Posting tables (generated)',
    '',
    'Generated from `packages/domain/src/accounting/rules.ts` by `pnpm --filter @muneem/domain gen:compliance`. Do not edit by hand:',
    '`packages/domain/test/complianceDocs.test.ts` fails when this file and the rules differ. The narrative version, with the reasons',
    'for each departure from the design, is `docs/accounting/posting-matrix.md`; the worked examples below are its examples, posted',
    'through the real rules.',
    '',
    '**How to read a table.** Each row is one journal line the rule can write. *Amount (fact)* names the field of the document the',
    'amount comes from. A line whose amount is zero is not written, and a negative (signed) amount — round-off, a cost correction,',
    'cash in or out — is written on the other side. Every journal must balance or it is refused.',
    '',
    '## Which account money moves through',
    '',
    '| Method | Sale tender | Payment, receipt or expense |',
    '|---|---|---|',
    ...METHODS.map((m) => `| ${m} | ${accountName(tenderAccount(m))} | ${accountName(paymentAccount(m))} |`),
  ];
  for (const e of ENTRIES) {
    const rule = RULES[e.rule]!;
    out.push('', `## ${e.document} — \`${e.rule}\``, '', ...ruleTable(rule, e.facts), '', `*Worked example:* ${e.example}`, '',
      ...journalTable(buildJournal(rule, e.facts)));
  }
  const closing = closingLines([
    { code: '4100', type: 'income', netPaise: -10_000_000 }, { code: '5100', type: 'expense', netPaise: 6_000_000 }, { code: '5400', type: 'expense', netPaise: 1_200_000 },
  ]);
  out.push('', '## Year-end close — `closingLines`', '',
    'Each income and expense account\'s movement over the year is posted to its opposite side, and the difference goes to',
    '3300 Retained Earnings (credit for a profit, debit for a loss). Dated 31 March, numbered `CL/2526` (ADR-0045).', '',
    '*Worked example:* sales 1,00,000.00, COGS 60,000.00 and rent 12,000.00.', '', ...journalTable(closing));
  return out.join('\n') + '\n';
}
