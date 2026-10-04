// Package parties is the Go port of packages/domain/src/parties (allocation only, ADR-0025).
package parties

import (
	"sort"

	"github.com/sparselabs/muneem/cloud/internal/domain/money"
)

type OpenItem struct {
	ID               string `json:"id"`
	DueDate          string `json:"dueDate"`
	DocDate          string `json:"docDate"`
	OutstandingPaise int64  `json:"outstandingPaise"`
}

type Allocation struct {
	ItemID      string `json:"itemId"`
	AmountPaise int64  `json:"amountPaise"`
}

type AllocationResult struct {
	Allocations      []Allocation `json:"allocations"`
	UnallocatedPaise int64        `json:"unallocatedPaise"`
}

func olderThan(a, b OpenItem) bool {
	if a.DueDate != b.DueDate {
		return a.DueDate < b.DueDate
	}
	if a.DocDate != b.DocDate {
		return a.DocDate < b.DocDate
	}
	return a.ID < b.ID
}

// AllocateOldestFirst mirrors allocateOldestFirst: oldest due date first, then document date, then id.
func AllocateOldestFirst(items []OpenItem, amountPaise int64) (*AllocationResult, error) {
	if amountPaise <= 0 || amountPaise > money.MaxSafeInt {
		return nil, money.Errorf("INVALID_INPUT", "payment must be a positive amount, got %d", amountPaise)
	}
	sorted := append([]OpenItem(nil), items...)
	sort.SliceStable(sorted, func(i, j int) bool { return olderThan(sorted[i], sorted[j]) })
	left := amountPaise
	out := &AllocationResult{Allocations: []Allocation{}}
	for _, item := range sorted {
		if left == 0 {
			break
		}
		if item.OutstandingPaise <= 0 {
			continue
		}
		take := min(left, item.OutstandingPaise)
		out.Allocations = append(out.Allocations, Allocation{ItemID: item.ID, AmountPaise: take})
		left -= take
	}
	out.UnallocatedPaise = left
	return out, nil
}
