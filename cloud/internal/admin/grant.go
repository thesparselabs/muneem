package admin

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/oklog/ulid/v2"

	"github.com/sparselabs/muneem/cloud/internal/auth"
	"github.com/sparselabs/muneem/cloud/internal/store"
)

// MinOperatorPassword is the shortest password a new operator account accepts.
const MinOperatorPassword = 12

// GrantOperator makes the account with this email an operator, creating it (with no organization, so it is no shop's
// user) when missing; newPassword is asked only then. It runs on the server as the owner role: no API role can write
// operator_grant, so no request can make an operator.
func GrantOperator(ctx context.Context, db *store.DB, email string, newPassword func() (string, error)) (created bool, err error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if !strings.Contains(email, "@") {
		return false, errors.New("an operator is named by an email address")
	}
	err = db.WithTx(ctx, store.Scope{}, func(tx pgx.Tx) error {
		var userID string
		err := tx.QueryRow(ctx, `SELECT id FROM app_user WHERE identifier = $1`, email).Scan(&userID)
		if errors.Is(err, pgx.ErrNoRows) {
			userID, err = createOperatorAccount(ctx, tx, email, newPassword)
			created = true
		}
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO operator_grant (user_id, granted_by) VALUES ($1, current_user)
			ON CONFLICT (user_id) DO UPDATE SET granted_at = now(), granted_by = current_user, revoked_at = NULL`, userID); err != nil {
			return err
		}
		return store.Audit(ctx, tx, nil, nil, nil, "admin.operator.grant", "operator", &userID, nil, map[string]any{"email": email, "created": created}, "")
	})
	return created, err
}

func createOperatorAccount(ctx context.Context, tx pgx.Tx, email string, newPassword func() (string, error)) (string, error) {
	password, err := newPassword()
	if err != nil {
		return "", err
	}
	if len(password) < MinOperatorPassword {
		return "", errors.New("an operator password needs at least 12 characters")
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return "", err
	}
	id := ulid.Make().String()
	_, err = tx.Exec(ctx, `INSERT INTO app_user (id, name, identifier, email, password_hash) VALUES ($1, $2, $2, $2, $3)`, id, email, hash)
	return id, err
}

// RevokeOperator ends an operator grant; open sessions stop at their next request.
func RevokeOperator(ctx context.Context, db *store.DB, email string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	return db.WithTx(ctx, store.Scope{}, func(tx pgx.Tx) error {
		var userID string
		err := tx.QueryRow(ctx, `UPDATE operator_grant g SET revoked_at = now() FROM app_user u
			WHERE u.id = g.user_id AND u.identifier = $1 AND g.revoked_at IS NULL RETURNING g.user_id`, email).Scan(&userID)
		if errors.Is(err, pgx.ErrNoRows) {
			return store.ErrNotFound
		}
		if err != nil {
			return err
		}
		return store.Audit(ctx, tx, nil, nil, nil, "admin.operator.revoke", "operator", &userID, nil, map[string]any{"email": email}, "")
	})
}
