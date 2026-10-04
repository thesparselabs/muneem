package devicesync

import (
	"encoding/json"
	"time"
)

// Wire types mirror packages/contracts/src/sync/protocol.ts. Payloads stay raw so they are stored exactly as sent.

type PushRequest struct {
	BusinessID    string      `json:"businessId"`
	Protocol      int         `json:"protocol"`
	SchemaVersion int         `json:"schemaVersion"`
	ClientTime    time.Time   `json:"clientTime"`
	Operations    []Operation `json:"operations"`
}

type Operation struct {
	OperationID   string          `json:"operationId"`
	Seq           int64           `json:"seq"`
	EntityType    string          `json:"entityType"`
	EntityID      string          `json:"entityId"`
	OperationType string          `json:"operationType"`
	DependsOn     *string         `json:"dependsOn"`
	PayloadHash   string          `json:"payloadHash"`
	Payload       json.RawMessage `json:"payload"`
}

const (
	StatusApplied   = "applied"
	StatusDuplicate = "duplicate"
	StatusRejected  = "rejected"
	StatusDeferred  = "deferred"
)

type SyncError struct {
	Code   string `json:"code"`
	Class  string `json:"class"`
	Detail string `json:"detail"`
}

type Result struct {
	OperationID string     `json:"operationId"`
	Status      string     `json:"status"`
	ServerSeq   *int64     `json:"serverSeq,omitempty"`
	Error       *SyncError `json:"error,omitempty"`
}

type PushResponse struct {
	ServerTime  time.Time `json:"serverTime"`
	NextPullSeq int64     `json:"nextPullSeq"`
	Results     []Result  `json:"results"`
}

type Change struct {
	Seq            int64           `json:"seq"`
	Stream         string          `json:"stream"`
	EntityType     string          `json:"entityType"`
	EntityID       string          `json:"entityId"`
	Op             string          `json:"op"`
	Version        int             `json:"version"`
	OriginDeviceID *string         `json:"originDeviceId"`
	Payload        json.RawMessage `json:"payload"`
}

type PullResponse struct {
	Changes    []Change  `json:"changes"`
	NextSeq    int64     `json:"nextSeq"`
	HasMore    bool      `json:"hasMore"`
	ServerTime time.Time `json:"serverTime"`
}

func applied(op Operation, seq int64) Result {
	return Result{OperationID: op.OperationID, Status: StatusApplied, ServerSeq: &seq}
}

func duplicate(op Operation, seq *int64) Result {
	return Result{OperationID: op.OperationID, Status: StatusDuplicate, ServerSeq: seq}
}

func deferred(op Operation, code, detail string) Result {
	return Result{OperationID: op.OperationID, Status: StatusDeferred, Error: &SyncError{Code: code, Class: classOf[code], Detail: detail}}
}

func rejected(op Operation, code, detail string) Result {
	return Result{OperationID: op.OperationID, Status: StatusRejected, Error: &SyncError{Code: code, Class: classOf[code], Detail: detail}}
}
