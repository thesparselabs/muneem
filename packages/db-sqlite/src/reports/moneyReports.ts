import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { inRange, rangeParams, type ReportRange } from './range.js';

export interface PurchaseRegisterRow {
  kind: 'purchase' | 'debit_note'; id: string; docDate: string; docNumber: string; supplierName: string; invoiceNo: string | null;
  taxablePaise: number; taxPaise: number; totalPaise: number;
}

// Posted purchases, and debit notes as negative rows on their own date, so the total is net purchases.
export function purchaseRegister(db: Db, r: ReportRange): PurchaseRegisterRow[] {
  return stmt(db, `SELECT * FROM (
      SELECT 'purchase' AS kind, x.id, x.doc_date AS docDate, x.doc_number AS docNumber, s.name AS supplierName, x.supplier_invoice_no AS invoiceNo,
        x.taxable_paise AS taxablePaise, x.cgst_paise + x.sgst_paise + x.igst_paise + x.cess_paise AS taxPaise, x.total_paise AS totalPaise
      FROM purchase x JOIN supplier s ON s.id = x.supplier_id WHERE ${inRange('x')} AND x.status = 'posted'
      UNION ALL
      SELECT 'debit_note', x.id, x.doc_date, x.doc_number, s.name, p.supplier_invoice_no,
        -x.taxable_paise, -(x.cgst_paise + x.sgst_paise + x.igst_paise + x.cess_paise), -x.total_paise
      FROM debit_note x JOIN supplier s ON s.id = x.supplier_id JOIN purchase p ON p.id = x.purchase_id WHERE ${inRange('x')} AND x.status = 'posted')
    ORDER BY docDate, docNumber`).all(rangeParams(r)) as PurchaseRegisterRow[];
}

export interface ExpenseRegisterRow {
  id: string; date: string; docNumber: string; category: string; vendor: string | null; method: string; taxablePaise: number; taxPaise: number; totalPaise: number;
}

export function expenseRegister(db: Db, r: ReportRange): ExpenseRegisterRow[] {
  return stmt(db, `SELECT x.id, x.expense_date AS date, x.doc_number AS docNumber, c.name AS category, COALESCE(s.name, x.vendor_name) AS vendor, x.method,
      x.taxable_paise AS taxablePaise, x.cgst_paise + x.sgst_paise + x.igst_paise + x.cess_paise AS taxPaise, x.total_paise AS totalPaise
    FROM expense x JOIN expense_category c ON c.id = x.category_id LEFT JOIN supplier s ON s.id = x.supplier_id
    WHERE ${inRange('x', 'expense_date')} AND x.status = 'posted' ORDER BY x.expense_date, x.doc_number`).all(rangeParams(r)) as ExpenseRegisterRow[];
}

export interface PaymentRegisterRow {
  id: string; date: string; docNumber: string; direction: 'in' | 'out'; partyType: string; partyName: string | null; method: string;
  amountPaise: number; reference: string | null;
}

export function paymentRegister(db: Db, r: ReportRange): PaymentRegisterRow[] {
  return stmt(db, `SELECT x.id, x.payment_date AS date, x.doc_number AS docNumber, x.direction, x.party_type AS partyType,
      COALESCE(c.name, s.name) AS partyName, x.method, x.amount_paise AS amountPaise, x.reference
    FROM payment x LEFT JOIN customer c ON x.party_type = 'customer' AND c.id = x.party_id LEFT JOIN supplier s ON x.party_type = 'supplier' AND s.id = x.party_id
    WHERE ${inRange('x', 'payment_date')} AND x.status = 'posted' ORDER BY x.payment_date, x.doc_number`).all(rangeParams(r)) as PaymentRegisterRow[];
}

export interface CashDay { date: string; openingPaise: number; inPaise: number; outPaise: number; closingPaise: number }

// The cash-in-hand account day by day, from the journal (FR-054 cash report); it ties to the Cash Book and the Trial Balance.
export function cashByDay(db: Db, r: ReportRange): CashDay[] {
  const params = rangeParams(r);
  const opening = stmt(db, `SELECT COALESCE(SUM(l.debit_paise - l.credit_paise), 0) FROM account a JOIN journal_line l ON l.account_id = a.id
      JOIN journal_entry j ON j.id = l.entry_id
    WHERE a.business_id = @businessId AND a.role = 'cash' AND j.entry_date < @from AND (@branchId IS NULL OR j.branch_id = @branchId)`).pluck().get(params) as number;
  const days = stmt(db, `SELECT j.entry_date AS date, SUM(l.debit_paise) AS inPaise, SUM(l.credit_paise) AS outPaise
    FROM journal_entry j JOIN journal_line l ON l.entry_id = j.id JOIN account a ON a.id = l.account_id
    WHERE j.business_id = @businessId AND j.entry_date BETWEEN @from AND @to AND (@branchId IS NULL OR j.branch_id = @branchId) AND a.role = 'cash'
    GROUP BY j.entry_date ORDER BY j.entry_date`).all(params) as { date: string; inPaise: number; outPaise: number }[];
  let balance = opening;
  return days.map((d) => {
    const row = { date: d.date, openingPaise: balance, inPaise: d.inPaise, outPaise: d.outPaise, closingPaise: balance + d.inPaise - d.outPaise };
    balance = row.closingPaise;
    return row;
  });
}
