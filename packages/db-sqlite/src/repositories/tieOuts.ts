import type { Db } from '../open.js';
import { stmt } from '../statements.js';

export interface TieOut { name: string; ledgerPaise: number; subledgerPaise: number }

const HEADS = ['cgst', 'sgst', 'igst', 'cess'] as const;

// Debit-minus-credit balance of the account holding a role, over every period.
function roleBalance(db: Db, businessId: string, role: string): number {
  return stmt(db, `SELECT COALESCE(SUM(l.debit_paise - l.credit_paise), 0) FROM journal_line l JOIN account a ON a.id = l.account_id
    WHERE l.business_id = ? AND a.role = ?`).pluck().get(businessId, role) as number;
}
const one = (db: Db, sql: string, businessId: string): number => stmt(db, sql).pluck().get(sql.includes('@b') ? { b: businessId } : businessId) as number;

// ADR-0034: the general ledger against the sub-ledgers and documents it was posted from. Every pair must be equal.
export function accountingTieOuts(db: Db, businessId: string): TieOut[] {
  const out: TieOut[] = [
    { name: 'inventory (1400) = stock valuation', ledgerPaise: roleBalance(db, businessId, 'inventory'),
      subledgerPaise: one(db, 'SELECT COALESCE(SUM(value_paise), 0) FROM stock_level WHERE business_id = ?', businessId) },
    { name: 'receivables (1300) = customer balances', ledgerPaise: roleBalance(db, businessId, 'ar'),
      subledgerPaise: one(db, "SELECT COALESCE(SUM(amount_paise), 0) FROM party_ledger_entry WHERE business_id = ? AND party_type = 'customer'", businessId) },
    { name: 'payables (2100) = supplier balances', ledgerPaise: roleBalance(db, businessId, 'ap'),
      subledgerPaise: one(db, "SELECT COALESCE(SUM(amount_paise), 0) FROM party_ledger_entry WHERE business_id = ? AND party_type = 'supplier'", businessId) },
  ];
  for (const h of HEADS) {
    out.push({
      name: `output ${h.toUpperCase()} = sales tax`, ledgerPaise: -roleBalance(db, businessId, `output_${h}`),
      subledgerPaise: one(db, `SELECT COALESCE(SUM(${h}_paise), 0) FROM sale WHERE business_id = ? AND status = 'posted'`, businessId),
    });
    out.push({
      name: `input ${h.toUpperCase()} = claimable tax`, ledgerPaise: roleBalance(db, businessId, `input_${h}`),
      subledgerPaise: one(db, `SELECT
          COALESCE((SELECT SUM(i.${h}_paise) FROM purchase_item i JOIN purchase p ON p.id = i.purchase_id
            WHERE p.business_id = @b AND p.status = 'posted' AND i.itc_eligible = 1), 0)
        - COALESCE((SELECT SUM(d.${h}_paise) FROM debit_note_item d JOIN debit_note n ON n.id = d.debit_note_id JOIN purchase_item i ON i.id = d.purchase_item_id
            WHERE n.business_id = @b AND n.status = 'posted' AND i.itc_eligible = 1), 0)
        + COALESCE((SELECT SUM(${h}_paise) FROM expense WHERE business_id = @b AND status = 'posted' AND itc_paise > 0), 0)`, businessId),
    });
  }
  const cache = stmt(db, 'SELECT COALESCE(SUM(debit_paise), 0) AS dr, COALESCE(SUM(credit_paise), 0) AS cr FROM account_balance WHERE business_id = ?')
    .get(businessId) as { dr: number; cr: number };
  const lines = stmt(db, 'SELECT COALESCE(SUM(debit_paise), 0) AS dr, COALESCE(SUM(credit_paise), 0) AS cr FROM journal_line WHERE business_id = ?')
    .get(businessId) as { dr: number; cr: number };
  out.push({ name: 'balance cache debits = journal debits', ledgerPaise: cache.dr, subledgerPaise: lines.dr });
  out.push({ name: 'balance cache credits = journal credits', ledgerPaise: cache.cr, subledgerPaise: lines.cr });
  out.push({ name: 'journal debits = journal credits', ledgerPaise: lines.dr, subledgerPaise: lines.cr });
  return out;
}

export const tieOutFailures = (db: Db, businessId: string): TieOut[] => accountingTieOuts(db, businessId).filter((t) => t.ledgerPaise !== t.subledgerPaise);
