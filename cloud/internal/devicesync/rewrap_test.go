package devicesync_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"io"
	"log/slog"
	"net/http"
	"testing"

	"github.com/sparselabs/muneem/cloud/internal/backups"
	"github.com/sparselabs/muneem/cloud/internal/devicesync"
)

const newMasterKey = "HyAeHRwbGhkYFxYVFBMSERAPDg0MCwoJCAcGBQQDAgE="

func TestRewrapMovesEscrowedKeysToTheActiveMasterKey(t *testing.T) {
	c, a, businessID := backupSetup(t)
	key := randomBytes(32)
	if code, raw := c.escrow(a, businessID, keyID, key); code != http.StatusOK {
		t.Fatalf("escrow: HTTP %d %s", code, raw)
	}
	if n := c.count(`SELECT COUNT(*)::int FROM backup_key WHERE master_key_version = 'v1'`); n != 1 {
		t.Fatal("a key escrowed under the single master key is v1")
	}
	ring, err := backups.MasterKeysFromEnv("v2:"+newMasterKey, TestMasterKey)
	if err != nil {
		t.Fatal(err)
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	res, err := backups.Rewrap(context.Background(), c.db, ring, log)
	if err != nil || res.Rewrapped != 1 || res.Failed != 0 {
		t.Fatalf("rewrap: %+v %v", res, err)
	}
	if n := c.count(`SELECT COUNT(*)::int FROM backup_key WHERE master_key_version = 'v2'`); n != 1 {
		t.Fatal("the key should now be under v2")
	}
	if res, err := backups.Rewrap(context.Background(), c.db, ring, log); err != nil || res.Rewrapped != 0 {
		t.Fatalf("a second rewrap has nothing to do: %+v %v", res, err)
	}

	onlyNew, err := backups.MasterKeysFromEnv("v2:"+newMasterKey, "")
	if err != nil {
		t.Fatal(err)
	}
	svc := backups.NewService(c.db, nil, onlyNew, log, backups.DefaultOptions)
	_, got, err := svc.Key(context.Background(), devicesync.Caller{UserID: a.user, DeviceID: a.id}, businessID, nil)
	if err != nil || !bytes.Equal(got, key) {
		t.Fatalf("the rewrapped key must open with v1 removed: %v", err)
	}
}

func TestRewrapReportsKeysItCannotOpen(t *testing.T) {
	c, a, businessID := backupSetup(t)
	c.escrow(a, businessID, keyID, randomBytes(32))
	wrongV1 := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{9}, 32))
	ring, err := backups.MasterKeysFromEnv("v2:"+newMasterKey+",v1:"+wrongV1, "")
	if err != nil {
		t.Fatal(err)
	}
	res, err := backups.Rewrap(context.Background(), c.db, ring, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err == nil || res.Failed != 1 {
		t.Fatalf("rewrap with the wrong v1 must fail: %+v %v", res, err)
	}
	if n := c.count(`SELECT COUNT(*)::int FROM backup_key WHERE master_key_version = 'v1'`); n != 1 {
		t.Fatal("a key that cannot be opened stays as it was")
	}
}
