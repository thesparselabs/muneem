package reports

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/sparselabs/muneem/cloud/api"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

var ErrNotMember = errors.New("not a member of the business")

const dayFormat = "2006-01-02"

// Daily reads a business's aggregates for [from, to] for a member, under that business's RLS scope.
func Daily(ctx context.Context, db *store.DB, userID, businessID string, from, to time.Time) (*api.DailyReport, error) {
	out := &api.DailyReport{BusinessId: businessID, Sales: []api.DailySales{}, Payments: []api.DailyPayment{}, Products: []api.ProductSalesDaily{},
		Parties: []api.PartyOutstanding{}}
	err := db.WithTx(ctx, store.Scope{UserID: userID, BusinessID: businessID}, func(tx pgx.Tx) error {
		if _, err := store.GetMembership(ctx, tx, userID, businessID); err != nil {
			if errors.Is(err, store.ErrNotFound) {
				return ErrNotMember
			}
			return err
		}
		var err error
		if out.Sales, err = sales(ctx, tx, businessID, from, to); err != nil {
			return err
		}
		if out.Payments, err = payments(ctx, tx, businessID, from, to); err != nil {
			return err
		}
		if out.Products, err = products(ctx, tx, businessID, from, to); err != nil {
			return err
		}
		out.Parties, err = parties(ctx, tx, businessID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func sales(ctx context.Context, tx pgx.Tx, businessID string, from, to time.Time) ([]api.DailySales, error) {
	rows, err := tx.Query(ctx, `SELECT branch_id, day, sale_count, sale_taxable_paise, sale_tax_paise, sale_total_paise, sale_cogs_paise,
			return_count, return_taxable_paise, return_tax_paise, return_total_paise, return_cost_paise
		FROM daily_sales_summary WHERE business_id = $1 AND day BETWEEN $2 AND $3 ORDER BY day, branch_id COLLATE "C"`, businessID, from, to)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (api.DailySales, error) {
		var s api.DailySales
		var day time.Time
		err := r.Scan(&s.BranchId, &day, &s.SaleCount, &s.SaleTaxablePaise, &s.SaleTaxPaise, &s.SaleTotalPaise, &s.SaleCogsPaise,
			&s.ReturnCount, &s.ReturnTaxablePaise, &s.ReturnTaxPaise, &s.ReturnTotalPaise, &s.ReturnCostPaise)
		s.Day = day.Format(dayFormat)
		return s, err
	})
}

func payments(ctx context.Context, tx pgx.Tx, businessID string, from, to time.Time) ([]api.DailyPayment, error) {
	rows, err := tx.Query(ctx, `SELECT branch_id, day, flow, method, doc_count, amount_paise FROM daily_payment_summary
		WHERE business_id = $1 AND day BETWEEN $2 AND $3 ORDER BY day, branch_id COLLATE "C", flow COLLATE "C", method COLLATE "C"`, businessID, from, to)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (api.DailyPayment, error) {
		var p api.DailyPayment
		var day time.Time
		err := r.Scan(&p.BranchId, &day, &p.Flow, &p.Method, &p.DocCount, &p.AmountPaise)
		p.Day = day.Format(dayFormat)
		return p, err
	})
}

func products(ctx context.Context, tx pgx.Tx, businessID string, from, to time.Time) ([]api.ProductSalesDaily, error) {
	rows, err := tx.Query(ctx, `SELECT branch_id, day, product_id, sold_qty_milli, sold_taxable_paise, sold_cogs_paise, returned_qty_milli, returned_taxable_paise,
			returned_cost_paise
		FROM product_sales_daily WHERE business_id = $1 AND day BETWEEN $2 AND $3 ORDER BY day, product_id COLLATE "C", branch_id COLLATE "C"`, businessID, from, to)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (api.ProductSalesDaily, error) {
		var p api.ProductSalesDaily
		var day time.Time
		err := r.Scan(&p.BranchId, &day, &p.ProductId, &p.SoldQtyMilli, &p.SoldTaxablePaise, &p.SoldCogsPaise, &p.ReturnedQtyMilli, &p.ReturnedTaxablePaise,
			&p.ReturnedCostPaise)
		p.Day = day.Format(dayFormat)
		return p, err
	})
}

func parties(ctx context.Context, tx pgx.Tx, businessID string) ([]api.PartyOutstanding, error) {
	rows, err := tx.Query(ctx, `SELECT party_type, party_id, balance_paise FROM party_outstanding WHERE business_id = $1 AND balance_paise <> 0
		ORDER BY party_type COLLATE "C", party_id COLLATE "C"`, businessID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (api.PartyOutstanding, error) {
		var p api.PartyOutstanding
		err := r.Scan(&p.PartyType, &p.PartyId, &p.BalancePaise)
		return p, err
	})
}
