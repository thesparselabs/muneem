// Package reports keeps the cloud's typed daily aggregates (8e, ADR-0046 as built) and serves them to members.
package reports

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// Applied is one stored operation as the projector needs it: its payload, and for a later operation the document
// it applies to as the cloud held it before.
type Applied struct {
	EntityType    string
	EntityID      string
	OperationType string
	Payload       json.RawMessage
	Prior         json.RawMessage
}

// Project moves the daily tables and party balances by what one applied operation changed. It runs inside the push
// transaction, after idempotency, so each document counts exactly once; the rules mirror the device's migration 0018.
func Project(ctx context.Context, tx pgx.Tx, businessID string, op Applied) error {
	p := projection{ctx: ctx, tx: tx, businessID: businessID}
	if err := p.partyEntries(op.Payload); err != nil {
		return err
	}
	switch {
	case op.OperationType == "create" && op.EntityType == "sale":
		return p.sale(op.EntityID, op.Payload)
	case op.OperationType == "create" && op.EntityType == "credit_note":
		return p.creditNote(op.Payload)
	case op.OperationType == "create" && op.EntityType == "payment":
		return p.payment(op.Payload, 1)
	case op.OperationType == "cancel" && op.EntityType == "payment":
		return p.payment(op.Prior, -1)
	case op.OperationType == "create" && op.EntityType == "expense":
		return p.expense(op.Payload, 1)
	case op.OperationType == "cancel" && op.EntityType == "expense":
		return p.expense(op.Prior, -1)
	}
	return nil
}

type projection struct {
	ctx        context.Context
	tx         pgx.Tx
	businessID string
}

type taxHeads struct {
	TaxablePaise int64 `json:"taxablePaise"`
	CgstPaise    int64 `json:"cgstPaise"`
	SgstPaise    int64 `json:"sgstPaise"`
	IgstPaise    int64 `json:"igstPaise"`
	CessPaise    int64 `json:"cessPaise"`
	TotalPaise   int64 `json:"totalPaise"`
}

func (t taxHeads) tax() int64 { return t.CgstPaise + t.SgstPaise + t.IgstPaise + t.CessPaise }

type salePayload struct {
	BranchID string   `json:"branchId"`
	DocDate  string   `json:"docDate"`
	Status   string   `json:"status"`
	Totals   taxHeads `json:"totals"`
	Lines    []struct {
		LineNo       int    `json:"lineNo"`
		ProductID    string `json:"productId"`
		BaseQtyMilli int64  `json:"baseQtyMilli"`
		TaxablePaise int64  `json:"taxablePaise"`
	} `json:"lines"`
	Tenders []struct {
		Method      string `json:"method"`
		AmountPaise int64  `json:"amountPaise"`
		ChangePaise int64  `json:"changePaise"`
	} `json:"tenders"`
	Movements []struct {
		RefLineID  *string `json:"refLineId"`
		ValuePaise int64   `json:"valuePaise"`
	} `json:"movements"`
}

// A line's cost is its stock movement's, as a device filing the pulled sale takes it (ADR-0040).
func (s *salePayload) lineCost(saleID string, lineNo int) int64 {
	id := fmt.Sprintf("%s-%03d", saleID, lineNo)
	for _, m := range s.Movements {
		if m.RefLineID != nil && *m.RefLineID == id {
			return -m.ValuePaise
		}
	}
	return 0
}

func (p *projection) sale(id string, raw json.RawMessage) error {
	var s salePayload
	if err := json.Unmarshal(raw, &s); err != nil {
		return err
	}
	if s.Status != "" && s.Status != "posted" {
		return nil
	}
	var cogs int64
	for _, l := range s.Lines {
		cost := s.lineCost(id, l.LineNo)
		cogs += cost
		if err := p.product(s.BranchID, s.DocDate, l.ProductID, [6]int64{l.BaseQtyMilli, l.TaxablePaise, cost, 0, 0, 0}); err != nil {
			return err
		}
	}
	for _, t := range s.Tenders {
		if err := p.flow(s.BranchID, s.DocDate, "sale", t.Method, 1, t.AmountPaise-t.ChangePaise); err != nil {
			return err
		}
	}
	return p.sales(s.BranchID, s.DocDate, [10]int64{1, s.Totals.TaxablePaise, s.Totals.tax(), s.Totals.TotalPaise, cogs, 0, 0, 0, 0, 0})
}

type creditNotePayload struct {
	taxHeads
	BranchID     string `json:"branchId"`
	DocDate      string `json:"docDate"`
	Status       string `json:"status"`
	CostPaise    int64  `json:"costPaise"`
	RefundMethod string `json:"refundMethod"`
	RefundPaise  int64  `json:"refundPaise"`
	CreditPaise  int64  `json:"creditPaise"`
	Lines        []struct {
		ProductID    string `json:"productId"`
		BaseQtyMilli int64  `json:"baseQtyMilli"`
		TaxablePaise int64  `json:"taxablePaise"`
		CostPaise    int64  `json:"costPaise"`
	} `json:"lines"`
}

func (p *projection) creditNote(raw json.RawMessage) error {
	var n creditNotePayload
	if err := json.Unmarshal(raw, &n); err != nil {
		return err
	}
	if n.Status != "" && n.Status != "posted" {
		return nil
	}
	for _, l := range n.Lines {
		if err := p.product(n.BranchID, n.DocDate, l.ProductID, [6]int64{0, 0, 0, l.BaseQtyMilli, l.TaxablePaise, l.CostPaise}); err != nil {
			return err
		}
	}
	refunds := []struct {
		method string
		amount int64
	}{{n.RefundMethod, n.RefundPaise}, {"credit", n.CreditPaise}}
	for _, r := range refunds {
		if r.amount > 0 {
			if err := p.flow(n.BranchID, n.DocDate, "refund", r.method, 1, r.amount); err != nil {
				return err
			}
		}
	}
	return p.sales(n.BranchID, n.DocDate, [10]int64{0, 0, 0, 0, 0, 1, n.TaxablePaise, n.tax(), n.TotalPaise, n.CostPaise})
}

func (p *projection) payment(raw json.RawMessage, sign int64) error {
	var d struct {
		BranchID    string `json:"branchId"`
		PaymentDate string `json:"paymentDate"`
		Direction   string `json:"direction"`
		Method      string `json:"method"`
		AmountPaise int64  `json:"amountPaise"`
	}
	if len(raw) == 0 {
		return nil
	}
	if err := json.Unmarshal(raw, &d); err != nil {
		return err
	}
	flow := "payment"
	if d.Direction == "in" {
		flow = "receipt"
	}
	return p.flow(d.BranchID, d.PaymentDate, flow, d.Method, sign, sign*d.AmountPaise)
}

func (p *projection) expense(raw json.RawMessage, sign int64) error {
	var d struct {
		BranchID    string `json:"branchId"`
		ExpenseDate string `json:"expenseDate"`
		Method      string `json:"method"`
		TotalPaise  int64  `json:"totalPaise"`
	}
	if len(raw) == 0 {
		return nil
	}
	if err := json.Unmarshal(raw, &d); err != nil {
		return err
	}
	return p.flow(d.BranchID, d.ExpenseDate, "expense", d.Method, sign, sign*d.TotalPaise)
}

type partyEntry struct {
	PartyType   string `json:"partyType"`
	PartyID     string `json:"partyId"`
	AmountPaise int64  `json:"amountPaise"`
}

// Every document carries its party sub-ledger entry under one of these keys, a cancel its reversing one (ADR-0022).
func (p *projection) partyEntries(raw json.RawMessage) error {
	var d struct {
		PartyEntry *partyEntry `json:"partyEntry"`
		Entry      *partyEntry `json:"entry"`
	}
	if err := json.Unmarshal(raw, &d); err != nil {
		return err
	}
	for _, e := range []*partyEntry{d.PartyEntry, d.Entry} {
		if e == nil || e.PartyID == "" || (e.PartyType != "customer" && e.PartyType != "supplier") {
			continue
		}
		if _, err := p.tx.Exec(p.ctx, `INSERT INTO party_outstanding (business_id, party_type, party_id, balance_paise) VALUES ($1, $2, $3, $4)
			ON CONFLICT (business_id, party_type, party_id) DO UPDATE SET balance_paise = party_outstanding.balance_paise + EXCLUDED.balance_paise`,
			p.businessID, e.PartyType, e.PartyID, e.AmountPaise); err != nil {
			return err
		}
	}
	return nil
}

func (p *projection) sales(branchID, day string, v [10]int64) error {
	_, err := p.tx.Exec(p.ctx, `INSERT INTO daily_sales_summary (business_id, branch_id, day, sale_count, sale_taxable_paise, sale_tax_paise, sale_total_paise,
			sale_cogs_paise, return_count, return_taxable_paise, return_tax_paise, return_total_paise, return_cost_paise)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (business_id, day, branch_id) DO UPDATE SET
			sale_count = daily_sales_summary.sale_count + EXCLUDED.sale_count,
			sale_taxable_paise = daily_sales_summary.sale_taxable_paise + EXCLUDED.sale_taxable_paise,
			sale_tax_paise = daily_sales_summary.sale_tax_paise + EXCLUDED.sale_tax_paise,
			sale_total_paise = daily_sales_summary.sale_total_paise + EXCLUDED.sale_total_paise,
			sale_cogs_paise = daily_sales_summary.sale_cogs_paise + EXCLUDED.sale_cogs_paise,
			return_count = daily_sales_summary.return_count + EXCLUDED.return_count,
			return_taxable_paise = daily_sales_summary.return_taxable_paise + EXCLUDED.return_taxable_paise,
			return_tax_paise = daily_sales_summary.return_tax_paise + EXCLUDED.return_tax_paise,
			return_total_paise = daily_sales_summary.return_total_paise + EXCLUDED.return_total_paise,
			return_cost_paise = daily_sales_summary.return_cost_paise + EXCLUDED.return_cost_paise`,
		p.businessID, branchID, day, v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8], v[9])
	return err
}

// A cancel takes its document back out of its own day; a row it empties is removed, as on the device.
func (p *projection) flow(branchID, day, flow, method string, count, amount int64) error {
	if _, err := p.tx.Exec(p.ctx, `INSERT INTO daily_payment_summary (business_id, branch_id, day, flow, method, doc_count, amount_paise)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (business_id, day, branch_id, flow, method) DO UPDATE SET
			doc_count = daily_payment_summary.doc_count + EXCLUDED.doc_count, amount_paise = daily_payment_summary.amount_paise + EXCLUDED.amount_paise`,
		p.businessID, branchID, day, flow, method, count, amount); err != nil {
		return err
	}
	if count >= 0 {
		return nil
	}
	_, err := p.tx.Exec(p.ctx, `DELETE FROM daily_payment_summary WHERE business_id = $1 AND branch_id = $2 AND day = $3 AND doc_count = 0 AND amount_paise = 0`,
		p.businessID, branchID, day)
	return err
}

func (p *projection) product(branchID, day, productID string, v [6]int64) error {
	_, err := p.tx.Exec(p.ctx, `INSERT INTO product_sales_daily (business_id, branch_id, day, product_id, sold_qty_milli, sold_taxable_paise, sold_cogs_paise,
			returned_qty_milli, returned_taxable_paise, returned_cost_paise)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (business_id, day, product_id, branch_id) DO UPDATE SET
			sold_qty_milli = product_sales_daily.sold_qty_milli + EXCLUDED.sold_qty_milli,
			sold_taxable_paise = product_sales_daily.sold_taxable_paise + EXCLUDED.sold_taxable_paise,
			sold_cogs_paise = product_sales_daily.sold_cogs_paise + EXCLUDED.sold_cogs_paise,
			returned_qty_milli = product_sales_daily.returned_qty_milli + EXCLUDED.returned_qty_milli,
			returned_taxable_paise = product_sales_daily.returned_taxable_paise + EXCLUDED.returned_taxable_paise,
			returned_cost_paise = product_sales_daily.returned_cost_paise + EXCLUDED.returned_cost_paise`,
		p.businessID, branchID, day, productID, v[0], v[1], v[2], v[3], v[4], v[5])
	return err
}
