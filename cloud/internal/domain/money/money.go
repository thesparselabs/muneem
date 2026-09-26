// Package money is the Go port of packages/domain/src/money.ts.
// Both implementations must accept and reject exactly the same inputs and produce identical results;
// packages/domain/fixtures/** is the contract and CI runs it in both languages.
package money

import (
	"fmt"
	"math/big"
	"sort"
)

// MaxSafeInt mirrors JS Number.MAX_SAFE_INTEGER (2^53 - 1).
const MaxSafeInt int64 = 1<<53 - 1

// DomainError is thrown by domain engines on invalid input.
type DomainError struct {
	Code    string // INVALID_INPUT | OVERFLOW | DISCOUNT_EXCEEDS_VALUE | DIVIDE_BY_ZERO
	Message string
}

func (e *DomainError) Error() string { return e.Code + ": " + e.Message }

func Errorf(code, format string, a ...any) *DomainError {
	return &DomainError{Code: code, Message: fmt.Sprintf(format, a...)}
}

func abs64(n int64) int64 {
	if n < 0 {
		return -n
	}
	return n
}

// AssertSafeInt mirrors assertSafeInt: |v| <= 2^53-1.
func AssertSafeInt(n int64, what string) (int64, error) {
	if n > MaxSafeInt || n < -MaxSafeInt {
		return 0, Errorf("OVERFLOW", "%s must be a safe integer, got %d", what, n)
	}
	return n, nil
}

// MulChecked multiplies with overflow detection against the JS safe range.
func MulChecked(a, b int64) (int64, error) {
	p := new(big.Int).Mul(big.NewInt(a), big.NewInt(b))
	if !p.IsInt64() {
		return 0, Errorf("OVERFLOW", "product must be a safe integer")
	}
	return AssertSafeInt(p.Int64(), "product")
}

// DivRound is HALF_UP on the absolute value, sign preserved. The only rounding primitive.
func DivRound(numerator, denominator int64) (int64, error) {
	if _, err := AssertSafeInt(numerator, "numerator"); err != nil {
		return 0, err
	}
	if _, err := AssertSafeInt(denominator, "denominator"); err != nil {
		return 0, err
	}
	if denominator == 0 {
		return 0, Errorf("DIVIDE_BY_ZERO", "divRound by zero")
	}
	sign := int64(1)
	if (numerator < 0) != (denominator < 0) && numerator != 0 {
		sign = -1
	}
	n := abs64(numerator)
	d := abs64(denominator)
	twoNPlusD := 2*n + d // cannot overflow int64 given the safe-int bound on inputs
	if _, err := AssertSafeInt(twoNPlusD, "divRound intermediate"); err != nil {
		return 0, err
	}
	return sign * (twoNPlusD / (2 * d)), nil
}

// PctOf is base × bp / 10000, HALF_UP.
func PctOf(base, rateBp int64) (int64, error) {
	p, err := MulChecked(base, rateBp)
	if err != nil {
		return 0, Errorf("OVERFLOW", "pctOf intermediate must be a safe integer")
	}
	return DivRound(p, 10000)
}

// Apportion is largest-remainder apportionment: Σ result == total exactly, deterministic tie-break
// (larger remainder first, then lower index). Uses big.Int for total × weight.
func Apportion(total int64, weights []int64) ([]int64, error) {
	if _, err := AssertSafeInt(total, "total"); err != nil {
		return nil, err
	}
	var sum int64
	for _, w := range weights {
		if _, err := AssertSafeInt(w, "weight"); err != nil {
			return nil, err
		}
		if w < 0 {
			return nil, Errorf("INVALID_INPUT", "apportion weights must be >= 0")
		}
		sum += w
	}
	out := make([]int64, len(weights))
	if sum == 0 {
		if total != 0 {
			return nil, Errorf("INVALID_INPUT", "cannot apportion a non-zero total over zero weights")
		}
		return out, nil
	}
	S := big.NewInt(sum)
	T := big.NewInt(total)
	rem := make([]*big.Int, len(weights))
	var baseSum int64
	for i, w := range weights {
		num := new(big.Int).Mul(T, big.NewInt(w))
		q, r := new(big.Int).QuoRem(num, S, new(big.Int)) // truncates toward zero, like BigInt
		if r.Sign() < 0 {
			q.Sub(q, big.NewInt(1))
			r.Add(r, S)
		}
		out[i] = q.Int64()
		rem[i] = r
		baseSum += out[i]
	}
	left := total - baseSum
	order := make([]int, len(weights))
	for i := range order {
		order[i] = i
	}
	sort.SliceStable(order, func(a, b int) bool {
		c := rem[order[a]].Cmp(rem[order[b]])
		if c != 0 {
			return c > 0
		}
		return order[a] < order[b]
	})
	for _, i := range order {
		if left <= 0 {
			break
		}
		out[i]++
		left--
	}
	return out, nil
}

// SumInts sums with the safe-int check after every addition.
func SumInts(values []int64) (int64, error) {
	var s int64
	for _, v := range values {
		if _, err := AssertSafeInt(v, "value"); err != nil {
			return 0, err
		}
		s += v
		if _, err := AssertSafeInt(s, "sum"); err != nil {
			return 0, err
		}
	}
	return s, nil
}
