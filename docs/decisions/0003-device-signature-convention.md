# ADR-0003 — Device request signature convention

**Status:** Accepted, 2026-09-27

## Context
Each installation holds an Ed25519 key pair and signs cloud requests so a stolen access token alone cannot act as a
device. The Go verifier and the desktop signer were built in parallel; the desktop used an RFC 3339 timestamp while
Go parsed unix seconds — every signed request would have failed with 401.

## Decision
- `X-Device-Timestamp` is **unix seconds** as a decimal string; the server rejects skew beyond ±5 minutes with
  `DEVICE_CLOCK_SKEW` (the UI tells the user to check the computer's clock).
- Signed string: `METHOD\nPATH\nTIMESTAMP\nsha256hex(body)`; PATH includes `/v1` and excludes the query string; an
  absent body hashes the empty string. Signature is base64(std) of the Ed25519 signature.
- Public key is the raw 32-byte Ed25519 key, base64(std).
- The convention lives in `packages/contracts/openapi/muneem-v1.yaml` and `SYNC_HEADERS`/`DEVICE_SIGNING_STRING` in
  `@muneem/contracts`, and is exercised by the live end-to-end test.

## Consequences
- The body bytes sent must be exactly the bytes hashed (no re-serialisation between signing and sending).
- Changing any element requires a protocol version bump (FR-105).
