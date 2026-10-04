package devicesync_test

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/url"
	"testing"

	"github.com/sparselabs/muneem/cloud/api"
)

const keyID = "0123456789abcdef"

func backupSetup(t *testing.T) (*cloud, *testDevice, string) {
	c, f, a := setup(t)
	c.push(a, f.request(f.ops...))
	return c, a, f.businessID
}

func (c *cloud) escrow(d *testDevice, businessID, keyID string, key []byte) (int, []byte) {
	body, _ := json.Marshal(api.BackupKey{BusinessId: businessID, KeyId: keyID, Key: base64.StdEncoding.EncodeToString(key)})
	return c.do(d, http.MethodPost, "/v1/backups/key", nil, body)
}

func (c *cloud) fetchKey(d *testDevice, businessID string) (int, api.BackupKey) {
	code, raw := c.do(d, http.MethodGet, "/v1/backups/key", url.Values{"businessId": {businessID}}, nil)
	var k api.BackupKey
	if code == http.StatusOK {
		_ = json.Unmarshal(raw, &k)
	}
	return code, k
}

func (c *cloud) presign(d *testDevice, businessID string, object []byte) (int, api.BackupUpload) {
	sum := sha256.Sum256(object)
	body, _ := json.Marshal(api.BackupPresignRequest{BusinessId: businessID, Bytes: int64(len(object)), Sha256: hex.EncodeToString(sum[:]), KeyId: keyID, SchemaVersion: 15})
	code, raw := c.do(d, http.MethodPost, "/v1/backups/presign", nil, body)
	var up api.BackupUpload
	if code == http.StatusOK {
		_ = json.Unmarshal(raw, &up)
	}
	return code, up
}

func put(t *testing.T, target string, object []byte) {
	t.Helper()
	req, _ := http.NewRequest(http.MethodPut, target, bytes.NewReader(object))
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("PUT: HTTP %d", res.StatusCode)
	}
}

func (c *cloud) confirm(d *testDevice, backupID string) (int, []byte) {
	return c.do(d, http.MethodPost, "/v1/backups/"+backupID+"/confirm", nil, nil)
}

// upload presigns, PUTs and confirms one object, as the device's uploader does.
func (c *cloud) upload(t *testing.T, d *testDevice, businessID string, object []byte) string {
	t.Helper()
	code, up := c.presign(d, businessID, object)
	if code != http.StatusOK {
		t.Fatalf("presign: HTTP %d", code)
	}
	put(t, up.Url, object)
	if code, raw := c.confirm(d, up.BackupId); code != http.StatusOK {
		t.Fatalf("confirm: HTTP %d %s", code, raw)
	}
	return up.BackupId
}

func (c *cloud) listBackups(d *testDevice, businessID string) (int, []api.Backup) {
	code, raw := c.do(d, http.MethodGet, "/v1/backups", url.Values{"businessId": {businessID}}, nil)
	var out []api.Backup
	if code == http.StatusOK {
		_ = json.Unmarshal(raw, &out)
	}
	return code, out
}

func randomBytes(n int) []byte {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return b
}

func TestBackupKeyEscrowIsIdempotentAndOnlyForMembers(t *testing.T) {
	c, a, businessID := backupSetup(t)
	key := randomBytes(32)
	if code, raw := c.escrow(a, businessID, keyID, key); code != http.StatusOK {
		t.Fatalf("escrow: HTTP %d %s", code, raw)
	}
	if code, _ := c.escrow(a, businessID, keyID, key); code != http.StatusOK {
		t.Fatalf("escrowing the same key again should succeed: HTTP %d", code)
	}
	if code, _ := c.escrow(a, businessID, keyID, randomBytes(32)); code != http.StatusConflict {
		t.Fatalf("another key under the same id should conflict: HTTP %d", code)
	}
	if n := c.count(`SELECT count(*) FROM backup_key WHERE business_id = $1 AND wrapped <> $2`, businessID, key); n != 1 {
		t.Fatalf("one key row stored, never in the clear: %d", n)
	}

	newcomer := c.registerDevice()
	code, k := c.fetchKey(newcomer, businessID)
	if got, _ := base64.StdEncoding.DecodeString(k.Key); code != http.StatusOK || k.KeyId != keyID || !bytes.Equal(got, key) {
		t.Fatalf("a member's new device should get the key back: HTTP %d %+v", code, k)
	}
	if code, _ := c.fetchKey(c.stranger(), businessID); code != http.StatusNotFound {
		t.Fatalf("a stranger's device must not get the key: HTTP %d", code)
	}
	if code, _ := c.escrow(c.stranger(), businessID, "fedcba9876543210", randomBytes(32)); code != http.StatusNotFound {
		t.Fatalf("a stranger must not escrow a key: HTTP %d", code)
	}
	if code, _ := c.escrow(a, businessID, keyID, randomBytes(16)); code != http.StatusUnprocessableEntity {
		t.Fatalf("a short key is invalid: HTTP %d", code)
	}
}

func TestBackupUploadIsCheckedListedAndDownloaded(t *testing.T) {
	c, a, businessID := backupSetup(t)
	object := randomBytes(70_000)
	if code, _ := c.presign(a, businessID, object); code != http.StatusNotFound {
		t.Fatalf("a backup under a key the cloud does not hold is refused: HTTP %d", code)
	}
	if code, _ := c.escrow(a, businessID, keyID, randomBytes(32)); code != http.StatusOK {
		t.Fatal("escrow")
	}
	code, up := c.presign(a, businessID, object)
	if code != http.StatusOK || up.Url == "" {
		t.Fatalf("presign: HTTP %d", code)
	}
	if code, _ := c.confirm(a, up.BackupId); code != http.StatusConflict {
		t.Fatalf("confirming before the upload: HTTP %d", code)
	}
	put(t, up.Url, object)
	if code, _ := c.confirm(c.registerDevice(), up.BackupId); code != http.StatusNotFound {
		t.Fatalf("only the uploading device confirms: HTTP %d", code)
	}
	if code, raw := c.confirm(a, up.BackupId); code != http.StatusOK {
		t.Fatalf("confirm: HTTP %d %s", code, raw)
	}
	if code, _ := c.confirm(a, up.BackupId); code != http.StatusOK {
		t.Fatal("confirming again is idempotent")
	}

	newcomer := c.registerDevice()
	code, list := c.listBackups(newcomer, businessID)
	if code != http.StatusOK || len(list) != 1 || list[0].BackupId != up.BackupId || list[0].Bytes != int64(len(object)) || list[0].KeyId != keyID {
		t.Fatalf("list: HTTP %d %+v", code, list)
	}
	code, raw := c.do(newcomer, http.MethodGet, "/v1/backups/"+up.BackupId, nil, nil)
	var d api.BackupDownload
	_ = json.Unmarshal(raw, &d)
	if code != http.StatusOK || d.Url == "" {
		t.Fatalf("get: HTTP %d", code)
	}
	if status, got := download(t, d.Url, ""); status != http.StatusOK || !bytes.Equal(got, object) {
		t.Fatalf("download: HTTP %d, %d bytes", status, len(got))
	}
	if status, tail := download(t, d.Url, "bytes=100-"); status != http.StatusPartialContent || !bytes.Equal(tail, object[100:]) {
		t.Fatalf("a resumed download: HTTP %d", status)
	}
	stranger := c.stranger()
	if code, _ := c.do(stranger, http.MethodGet, "/v1/backups/"+up.BackupId, nil, nil); code != http.StatusNotFound {
		t.Fatalf("a stranger must not see the backup: HTTP %d", code)
	}
	if code, _ := c.listBackups(stranger, businessID); code != http.StatusNotFound {
		t.Fatalf("a stranger must not list: HTTP %d", code)
	}
}

func TestATamperedUploadIsRefusedAndDiscarded(t *testing.T) {
	c, a, businessID := backupSetup(t)
	c.escrow(a, businessID, keyID, randomBytes(32))
	object := randomBytes(4096)
	_, up := c.presign(a, businessID, object)
	tampered := append([]byte{}, object...)
	tampered[10] ^= 1
	put(t, up.Url, tampered)
	if code, _ := c.confirm(a, up.BackupId); code != http.StatusUnprocessableEntity {
		t.Fatalf("a checksum mismatch: HTTP %d", code)
	}
	if n := c.count(`SELECT count(*) FROM backup WHERE id = $1`, up.BackupId); n != 0 {
		t.Fatal("the mismatched backup row should be gone")
	}
	if _, list := c.listBackups(a, businessID); len(list) != 0 {
		t.Fatalf("nothing listed: %+v", list)
	}
}

func TestTheCloudKeepsTheLast30BackupsPerBusiness(t *testing.T) {
	c, a, businessID := backupSetup(t)
	c.escrow(a, businessID, keyID, randomBytes(32))
	var ids []string
	for i := 0; i < 32; i++ {
		ids = append(ids, c.upload(t, a, businessID, randomBytes(512)))
	}
	_, list := c.listBackups(a, businessID)
	if len(list) != 30 || list[0].BackupId != ids[31] || list[29].BackupId != ids[2] {
		t.Fatalf("kept %d, newest %s", len(list), list[0].BackupId)
	}
	if n := c.count(`SELECT count(*) FROM backup WHERE business_id = $1`, businessID); n != 30 {
		t.Fatalf("pruned rows remain: %d", n)
	}
	if code, _ := c.do(a, http.MethodGet, "/v1/backups/"+ids[0], nil, nil); code != http.StatusNotFound {
		t.Fatalf("a pruned backup is gone: HTTP %d", code)
	}
}
