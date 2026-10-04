package auth

import "github.com/sparselabs/muneem/cloud/api"

// Mirrors packages/contracts/src/ipc/permissions.ts ROLE_PRESETS — keep in lockstep.
var resources = []string{"sales", "purchases", "inventory", "products", "customers", "suppliers", "payments", "expenses",
	"accounting", "reports", "settings", "users", "business", "pos", "sync", "diagnostics", "gst"}
var actions = []string{"view", "create", "edit", "cancel", "approve", "manage", "adjust", "financial", "export"}

func grant(p string) api.Grant { return api.Grant{Permission: p} }
func cross(rs, as []string) []api.Grant {
	var out []api.Grant
	for _, r := range rs {
		for _, a := range as {
			out = append(out, grant(r+"."+a))
		}
	}
	return out
}
func grants(ps ...string) []api.Grant {
	out := make([]api.Grant, 0, len(ps))
	for _, p := range ps {
		out = append(out, grant(p))
	}
	return out
}

func RolePreset(role string) []api.Grant {
	switch role {
	case "owner":
		return cross(resources, actions)
	case "manager":
		g := cross([]string{"sales", "purchases", "inventory", "products", "customers", "suppliers", "payments", "expenses", "pos", "gst"},
			[]string{"view", "create", "edit", "cancel", "approve", "adjust"})
		return append(g, grants("reports.view", "reports.export", "reports.financial", "sync.view", "sync.manage", "diagnostics.view", "business.view", "settings.view")...)
	case "cashier":
		five := 500
		g := grants("sales.view")
		g = append(g, api.Grant{Permission: "sales.create", Limit: &struct {
			BackdateDays   *int   `json:"backdate_days,omitempty"`
			MaxDiscountBp  *int   `json:"max_discount_bp,omitempty"`
			MaxRefundPaise *int64 `json:"max_refund_paise,omitempty"`
		}{MaxDiscountBp: &five}})
		return append(g, grants("pos.view", "pos.create", "products.view", "customers.view", "customers.create", "payments.view", "payments.create", "sync.view", "business.view")...)
	case "accountant":
		g := cross([]string{"accounting", "payments", "expenses", "purchases", "gst"}, []string{"view", "create", "edit", "financial"})
		return append(g, grants("reports.view", "reports.financial", "reports.export", "sales.view", "customers.view", "suppliers.view", "business.view")...)
	case "inventory":
		g := cross([]string{"inventory", "products", "purchases", "suppliers"}, []string{"view", "create", "edit", "adjust"})
		return append(g, grants("reports.view", "business.view")...)
	}
	return nil
}

// GrantsFor merges presets for a set of roles (de-duplicated by permission, first limit wins).
func GrantsFor(roles []string) []api.Grant {
	seen := map[string]bool{}
	var out []api.Grant
	for _, r := range roles {
		for _, g := range RolePreset(r) {
			if !seen[g.Permission] {
				seen[g.Permission] = true
				out = append(out, g)
			}
		}
	}
	if out == nil {
		out = []api.Grant{}
	}
	return out
}
