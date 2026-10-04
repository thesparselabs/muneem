// Package objectstore holds the object storage behind hydration bundles and device backups: S3-compatible storage,
// and an in-memory store for tests.
package objectstore

import (
	"context"
	"errors"
	"io"
	"net/url"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// S3Config is the MUNEEM_S3_* environment. Endpoint is a URL; http:// turns TLS off (local MinIO).
type S3Config struct {
	Endpoint  string
	Bucket    string
	AccessKey string
	SecretKey string
	Region    string
}

const partSize = 16 << 20

var ErrNotFound = errors.New("object not found")

type S3 struct {
	client *minio.Client
	bucket string
}

// NewS3 connects and creates the bucket if it is missing.
func NewS3(ctx context.Context, cfg S3Config) (*S3, error) {
	if cfg.Endpoint == "" || cfg.Bucket == "" {
		return nil, errors.New("an S3 endpoint and bucket are required")
	}
	host, secure, err := splitEndpoint(cfg.Endpoint)
	if err != nil {
		return nil, err
	}
	client, err := minio.New(host, &minio.Options{
		Creds: credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""), Secure: secure, Region: cfg.Region,
	})
	if err != nil {
		return nil, err
	}
	s := &S3{client: client, bucket: cfg.Bucket}
	return s, s.ensureBucket(ctx, cfg.Region)
}

func splitEndpoint(endpoint string) (host string, secure bool, err error) {
	if !strings.Contains(endpoint, "://") {
		return endpoint, true, nil
	}
	u, err := url.Parse(endpoint)
	if err != nil {
		return "", false, err
	}
	return u.Host, u.Scheme == "https", nil
}

func (s *S3) ensureBucket(ctx context.Context, region string) error {
	exists, err := s.client.BucketExists(ctx, s.bucket)
	if err != nil || exists {
		return err
	}
	return s.client.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{Region: region})
}

// Ping is the readiness check: the bucket answers and exists.
func (s *S3) Ping(ctx context.Context) error {
	exists, err := s.client.BucketExists(ctx, s.bucket)
	if err == nil && !exists {
		err = errors.New("bucket " + s.bucket + " is missing")
	}
	return err
}

// Put streams body of unknown length as a multipart upload, buffering one part at a time.
func (s *S3) Put(ctx context.Context, key string, body io.Reader) error {
	_, err := s.client.PutObject(ctx, s.bucket, key, body, -1, minio.PutObjectOptions{ContentType: "application/gzip", PartSize: partSize})
	return err
}

func (s *S3) PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error) {
	u, err := s.client.PresignedGetObject(ctx, s.bucket, key, ttl, nil)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

// PresignPut lets a device upload one object straight to storage, without its bytes passing through the API.
func (s *S3) PresignPut(ctx context.Context, key string, ttl time.Duration) (string, error) {
	u, err := s.client.PresignedPutObject(ctx, s.bucket, key, ttl)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

// Get streams an object with its size; a missing object is ErrNotFound.
func (s *S3) Get(ctx context.Context, key string) (io.ReadCloser, int64, error) {
	obj, err := s.client.GetObject(ctx, s.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, 0, err
	}
	info, err := obj.Stat()
	if err != nil {
		obj.Close()
		if minio.ToErrorResponse(err).Code == "NoSuchKey" {
			return nil, 0, ErrNotFound
		}
		return nil, 0, err
	}
	return obj, info.Size, nil
}

// Delete removes an object; deleting one that is missing succeeds.
func (s *S3) Delete(ctx context.Context, key string) error {
	return s.client.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{})
}
