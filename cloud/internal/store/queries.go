package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

type User struct {
	ID, Name, Identifier, PasswordHash string
	Email, Mobile                      *string
	IsActive                           bool
}
type Organization struct{ ID, Name string }
type Business struct {
	ID, OrganizationID, Name, BusinessType, StateCode, TaxScheme, CreatedBy        string
	LegalName, AddressLine1, AddressLine2, City, PinCode, Phone, Email, Gstin, Pan *string
	FyStartMonth, Version                                                          int
	CreatedAt, UpdatedAt                                                           time.Time
}
type Membership struct {
	UserID, BusinessID string
	BusinessName       *string
	OrganizationID     string
	Roles              []string
	GrantsJSON         json.RawMessage
	PermVer            int
	IssuedAt           time.Time
}
type Branch struct {
	ID, BusinessID, Code, Name, StateCode string
	AddressLine1, City, Gstin             *string
	IsDefault                             bool
	Version                               int
	CreatedAt                             time.Time
}
type Terminal struct {
	ID, BusinessID, BranchID, Code, Name string
	DeviceID                             *string
	Version                              int
	CreatedAt                            time.Time
}
type Device struct {
	ID, OrganizationID, RegisteredBy, InstallationID, PublicKey, Platform, AppVersion, Status string
	BusinessID, Name, MachineFingerprint                                                      *string
	SchemaVersion                                                                             int
	LastSeenAt                                                                                *time.Time
	CreatedAt                                                                                 time.Time
}
type RefreshToken struct {
	ID, UserID, FamilyID, TokenHash string
	DeviceID                        *string
	ExpiresAt                       time.Time
	UsedAt, RevokedAt               *time.Time
}

// ---- users / orgs ----

func CreateUserWithOrg(ctx context.Context, tx pgx.Tx, u User, orgID, orgName string) error {
	if _, err := tx.Exec(ctx, `INSERT INTO app_user (id, name, identifier, email, mobile, password_hash) VALUES ($1,$2,$3,$4,$5,$6)`,
		u.ID, u.Name, u.Identifier, u.Email, u.Mobile, u.PasswordHash); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO organization (id, name) VALUES ($1,$2)`, orgID, orgName); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `INSERT INTO organization_member (organization_id, user_id, role) VALUES ($1,$2,'owner')`, orgID, u.ID)
	return err
}

func GetUserByIdentifier(ctx context.Context, q pgx.Tx, identifier string) (*User, error) {
	u := &User{}
	err := q.QueryRow(ctx, `SELECT id, name, identifier, email, mobile, password_hash, is_active FROM app_user WHERE identifier = $1`, identifier).
		Scan(&u.ID, &u.Name, &u.Identifier, &u.Email, &u.Mobile, &u.PasswordHash, &u.IsActive)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return u, err
}
func GetUser(ctx context.Context, q pgx.Tx, id string) (*User, error) {
	u := &User{}
	err := q.QueryRow(ctx, `SELECT id, name, identifier, email, mobile, password_hash, is_active FROM app_user WHERE id = $1`, id).
		Scan(&u.ID, &u.Name, &u.Identifier, &u.Email, &u.Mobile, &u.PasswordHash, &u.IsActive)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return u, err
}
func ListOrganizations(ctx context.Context, q pgx.Tx, userID string) ([]Organization, error) {
	rows, err := q.Query(ctx, `SELECT o.id, o.name FROM organization o JOIN organization_member m ON m.organization_id = o.id WHERE m.user_id = $1 ORDER BY m.created_at`, userID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (Organization, error) { var o Organization; return o, r.Scan(&o.ID, &o.Name) })
}
func IsOrgMember(ctx context.Context, q pgx.Tx, orgID, userID string) (bool, error) {
	var n int
	err := q.QueryRow(ctx, `SELECT COUNT(*) FROM organization_member WHERE organization_id = $1 AND user_id = $2`, orgID, userID).Scan(&n)
	return n > 0, err
}

// ---- memberships ----

func ListMemberships(ctx context.Context, q pgx.Tx, userID string) ([]Membership, error) {
	rows, err := q.Query(ctx, `SELECT m.user_id, m.business_id, b.name, b.organization_id, m.roles_json, m.grants_json, m.perm_ver, m.issued_at
		FROM business_membership m JOIN business b ON b.id = m.business_id WHERE m.user_id = $1 AND b.deleted_at IS NULL ORDER BY b.created_at`, userID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (Membership, error) {
		var m Membership
		var roles []byte
		err := r.Scan(&m.UserID, &m.BusinessID, &m.BusinessName, &m.OrganizationID, &roles, &m.GrantsJSON, &m.PermVer, &m.IssuedAt)
		if err == nil {
			err = json.Unmarshal(roles, &m.Roles)
		}
		return m, err
	})
}
func GetMembership(ctx context.Context, q pgx.Tx, userID, businessID string) (*Membership, error) {
	ms, err := ListMemberships(ctx, q, userID)
	if err != nil {
		return nil, err
	}
	for i := range ms {
		if ms[i].BusinessID == businessID {
			return &ms[i], nil
		}
	}
	return nil, ErrNotFound
}
func UpsertMembership(ctx context.Context, tx pgx.Tx, userID, businessID string, roles []string, grants any) error {
	r, _ := json.Marshal(roles)
	g, _ := json.Marshal(grants)
	_, err := tx.Exec(ctx, `INSERT INTO business_membership (user_id, business_id, roles_json, grants_json, perm_ver) VALUES ($1,$2,$3,$4,1)
		ON CONFLICT (user_id, business_id) DO UPDATE SET roles_json = EXCLUDED.roles_json, grants_json = EXCLUDED.grants_json,
		perm_ver = business_membership.perm_ver + 1, issued_at = now()`, userID, businessID, r, g)
	return err
}

// ---- business / branch / terminal ----

const businessCols = `id, organization_id, name, legal_name, business_type, address_line1, address_line2, city, state_code, pin_code, phone, email, gstin, pan, tax_scheme, fy_start_month, version, created_by, created_at, updated_at`

func scanBusiness(r pgx.Row) (*Business, error) {
	b := &Business{}
	err := r.Scan(&b.ID, &b.OrganizationID, &b.Name, &b.LegalName, &b.BusinessType, &b.AddressLine1, &b.AddressLine2, &b.City, &b.StateCode,
		&b.PinCode, &b.Phone, &b.Email, &b.Gstin, &b.Pan, &b.TaxScheme, &b.FyStartMonth, &b.Version, &b.CreatedBy, &b.CreatedAt, &b.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return b, err
}
func GetBusiness(ctx context.Context, q pgx.Tx, id string) (*Business, error) {
	return scanBusiness(q.QueryRow(ctx, `SELECT `+businessCols+` FROM business WHERE id = $1 AND deleted_at IS NULL`, id))
}
func ListBusinessesForUser(ctx context.Context, q pgx.Tx, userID string) ([]Business, error) {
	rows, err := q.Query(ctx, `SELECT `+businessCols+` FROM business b WHERE deleted_at IS NULL AND (created_by = $1 OR EXISTS (SELECT 1 FROM business_membership m WHERE m.business_id = b.id AND m.user_id = $1)) ORDER BY created_at`, userID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (Business, error) {
		b, err := scanBusiness(r)
		if err != nil {
			return Business{}, err
		}
		return *b, nil
	})
}
func InsertBusiness(ctx context.Context, tx pgx.Tx, b *Business) error {
	_, err := tx.Exec(ctx, `INSERT INTO business (id, organization_id, name, legal_name, business_type, address_line1, address_line2, city, state_code, pin_code, phone, email, gstin, pan, tax_scheme, fy_start_month, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
		b.ID, b.OrganizationID, b.Name, b.LegalName, b.BusinessType, b.AddressLine1, b.AddressLine2, b.City, b.StateCode, b.PinCode, b.Phone, b.Email, b.Gstin, b.Pan, b.TaxScheme, b.FyStartMonth, b.CreatedBy)
	return err
}
func UpdateBusiness(ctx context.Context, tx pgx.Tx, b *Business, expectedVersion int) (bool, error) {
	ct, err := tx.Exec(ctx, `UPDATE business SET name=$2, legal_name=$3, business_type=$4, address_line1=$5, address_line2=$6, city=$7, state_code=$8, pin_code=$9, phone=$10, email=$11, gstin=$12, pan=$13, tax_scheme=$14, fy_start_month=$15, version = version + 1, updated_at = now()
		WHERE id = $1 AND version = $16 AND deleted_at IS NULL`,
		b.ID, b.Name, b.LegalName, b.BusinessType, b.AddressLine1, b.AddressLine2, b.City, b.StateCode, b.PinCode, b.Phone, b.Email, b.Gstin, b.Pan, b.TaxScheme, b.FyStartMonth, expectedVersion)
	return ct.RowsAffected() == 1, err
}
func InsertEntitlement(ctx context.Context, tx pgx.Tx, businessID string) error {
	_, err := tx.Exec(ctx, `INSERT INTO entitlement (business_id, plan, status, device_limit, valid_until) VALUES ($1, 'trial', 'trial', 3, (now() + interval '30 days')::date) ON CONFLICT DO NOTHING`, businessID)
	return err
}
func DeviceLimit(ctx context.Context, q pgx.Tx, businessID string) (limit, used int, err error) {
	err = q.QueryRow(ctx, `SELECT e.device_limit, (SELECT COUNT(*) FROM device d WHERE d.business_id = e.business_id AND d.status = 'active') FROM entitlement e WHERE e.business_id = $1`, businessID).Scan(&limit, &used)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, 0, ErrNotFound
	}
	return
}

func scanBranch(r pgx.Row) (*Branch, error) {
	b := &Branch{}
	err := r.Scan(&b.ID, &b.BusinessID, &b.Code, &b.Name, &b.AddressLine1, &b.City, &b.StateCode, &b.Gstin, &b.IsDefault, &b.Version, &b.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return b, err
}

const branchCols = `id, business_id, code, name, address_line1, city, state_code, gstin, is_default, version, created_at`

func GetBranch(ctx context.Context, q pgx.Tx, id string) (*Branch, error) {
	return scanBranch(q.QueryRow(ctx, `SELECT `+branchCols+` FROM branch WHERE id = $1 AND deleted_at IS NULL`, id))
}
func ListBranches(ctx context.Context, q pgx.Tx, businessID string) ([]Branch, error) {
	rows, err := q.Query(ctx, `SELECT `+branchCols+` FROM branch WHERE business_id = $1 AND deleted_at IS NULL ORDER BY is_default DESC, code`, businessID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (Branch, error) {
		b, err := scanBranch(r)
		if err != nil {
			return Branch{}, err
		}
		return *b, nil
	})
}
func InsertBranch(ctx context.Context, tx pgx.Tx, b *Branch) error {
	_, err := tx.Exec(ctx, `INSERT INTO branch (id, business_id, code, name, address_line1, city, state_code, gstin, is_default) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		b.ID, b.BusinessID, b.Code, b.Name, b.AddressLine1, b.City, b.StateCode, b.Gstin, b.IsDefault)
	return err
}

func scanTerminal(r pgx.Row) (*Terminal, error) {
	t := &Terminal{}
	err := r.Scan(&t.ID, &t.BusinessID, &t.BranchID, &t.Code, &t.Name, &t.DeviceID, &t.Version, &t.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return t, err
}

const terminalCols = `id, business_id, branch_id, code, name, device_id, version, created_at`

func GetTerminal(ctx context.Context, q pgx.Tx, id string) (*Terminal, error) {
	return scanTerminal(q.QueryRow(ctx, `SELECT `+terminalCols+` FROM terminal WHERE id = $1 AND deleted_at IS NULL`, id))
}
func ListTerminals(ctx context.Context, q pgx.Tx, businessID string) ([]Terminal, error) {
	rows, err := q.Query(ctx, `SELECT `+terminalCols+` FROM terminal WHERE business_id = $1 AND deleted_at IS NULL ORDER BY branch_id, code`, businessID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (Terminal, error) {
		t, err := scanTerminal(r)
		if err != nil {
			return Terminal{}, err
		}
		return *t, nil
	})
}
func InsertTerminal(ctx context.Context, tx pgx.Tx, t *Terminal) error {
	_, err := tx.Exec(ctx, `INSERT INTO terminal (id, business_id, branch_id, code, name, device_id) VALUES ($1,$2,$3,$4,$5,$6)`, t.ID, t.BusinessID, t.BranchID, t.Code, t.Name, t.DeviceID)
	return err
}

// ---- devices ----

const deviceCols = `id, organization_id, business_id, registered_by, installation_id, name, machine_fingerprint, public_key, platform, app_version, schema_version, status, last_seen_at, created_at`

func scanDevice(r pgx.Row) (*Device, error) {
	d := &Device{}
	err := r.Scan(&d.ID, &d.OrganizationID, &d.BusinessID, &d.RegisteredBy, &d.InstallationID, &d.Name, &d.MachineFingerprint, &d.PublicKey, &d.Platform, &d.AppVersion, &d.SchemaVersion, &d.Status, &d.LastSeenAt, &d.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return d, err
}
func GetDevice(ctx context.Context, q pgx.Tx, id string) (*Device, error) {
	return scanDevice(q.QueryRow(ctx, `SELECT `+deviceCols+` FROM device WHERE id = $1`, id))
}
func GetDeviceByInstallation(ctx context.Context, q pgx.Tx, installationID string) (*Device, error) {
	return scanDevice(q.QueryRow(ctx, `SELECT `+deviceCols+` FROM device WHERE installation_id = $1`, installationID))
}
func ListDevices(ctx context.Context, q pgx.Tx, businessID string) ([]Device, error) {
	rows, err := q.Query(ctx, `SELECT `+deviceCols+` FROM device WHERE business_id = $1 ORDER BY created_at`, businessID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (Device, error) {
		d, err := scanDevice(r)
		if err != nil {
			return Device{}, err
		}
		return *d, nil
	})
}
func InsertDevice(ctx context.Context, tx pgx.Tx, d *Device) error {
	_, err := tx.Exec(ctx, `INSERT INTO device (id, organization_id, business_id, registered_by, installation_id, name, machine_fingerprint, public_key, platform, app_version, schema_version, last_seen_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())`, d.ID, d.OrganizationID, d.BusinessID, d.RegisteredBy, d.InstallationID, d.Name, d.MachineFingerprint, d.PublicKey, d.Platform, d.AppVersion, d.SchemaVersion)
	return err
}
func TouchDevice(ctx context.Context, tx pgx.Tx, id, appVersion string, schemaVersion int, businessID *string, skewMs *int) error {
	_, err := tx.Exec(ctx, `UPDATE device SET last_seen_at = now(), app_version = $2, schema_version = $3, business_id = COALESCE($4, business_id), clock_skew_ms = COALESCE($5, clock_skew_ms), updated_at = now() WHERE id = $1`,
		id, appVersion, schemaVersion, businessID, skewMs)
	return err
}
func SetDeviceStatus(ctx context.Context, tx pgx.Tx, id, status string) (bool, error) {
	ct, err := tx.Exec(ctx, `UPDATE device SET status = $2, updated_at = now() WHERE id = $1`, id, status)
	return ct.RowsAffected() == 1, err
}

// ---- refresh tokens ----

func InsertRefreshToken(ctx context.Context, tx pgx.Tx, t RefreshToken) error {
	_, err := tx.Exec(ctx, `INSERT INTO refresh_token (id, user_id, family_id, token_hash, device_id, expires_at) VALUES ($1,$2,$3,$4,$5,$6)`,
		t.ID, t.UserID, t.FamilyID, t.TokenHash, t.DeviceID, t.ExpiresAt)
	return err
}
func GetRefreshToken(ctx context.Context, q pgx.Tx, hash string) (*RefreshToken, error) {
	t := &RefreshToken{}
	err := q.QueryRow(ctx, `SELECT id, user_id, family_id, token_hash, device_id, expires_at, used_at, revoked_at FROM refresh_token WHERE token_hash = $1`, hash).
		Scan(&t.ID, &t.UserID, &t.FamilyID, &t.TokenHash, &t.DeviceID, &t.ExpiresAt, &t.UsedAt, &t.RevokedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return t, err
}
func MarkRefreshUsed(ctx context.Context, tx pgx.Tx, id string) error {
	_, err := tx.Exec(ctx, `UPDATE refresh_token SET used_at = now() WHERE id = $1`, id)
	return err
}
func RevokeRefreshFamily(ctx context.Context, tx pgx.Tx, familyID string) error {
	_, err := tx.Exec(ctx, `UPDATE refresh_token SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL`, familyID)
	return err
}

// ---- audit ----

func Audit(ctx context.Context, tx pgx.Tx, businessID, userID, deviceID *string, action, entityType string, entityID *string, before, after any, requestID string) error {
	var b, a []byte
	if before != nil {
		b, _ = json.Marshal(before)
	}
	if after != nil {
		a, _ = json.Marshal(after)
	}
	_, err := tx.Exec(ctx, `INSERT INTO audit_log (business_id, user_id, device_id, action, entity_type, entity_id, before_json, after_json, request_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		businessID, userID, deviceID, action, entityType, entityID, nilIfEmpty(b), nilIfEmpty(a), requestID)
	return err
}
func nilIfEmpty(b []byte) any {
	if len(b) == 0 {
		return nil
	}
	return b
}
