# Sync protocol fixtures

These are request/response pairs that the TypeScript reference server (`packages/sync-reference`) and the Go server
(`cloud/internal/devicesync`) must both pass (ADR-0042). They were recorded from a real flow by
`apps/desktop/test/sync/genProtocolFixtures.test.ts` and are frozen. Regenerate them only when the protocol changes,
and change both servers in the same PR.

## Format

```json
{ "name": "...", "description": "...",
  "setup": { "organizationId": "...", "userId": "...", "devices": ["A", "B"] },
  "steps": [ { "device": "A", "call": "push" | "pull", "request": { }, "expect": { } } ] }
```

- **`setup`:** a runner creates the organization, the user as its owner, and one registered device per symbol. Every
  fixture starts from an empty cloud; the business itself arrives by push (a business created offline).
- **`device`:** the symbol of the signed device making the call. In an expectation, `originDeviceId: "A"` means that
  device's real id.
- **`request`:** the body of `POST /sync/push`, or the query of `GET /sync/pull`.

## Matching

An expectation is a **partial match**:
- objects match on the keys listed;
- arrays match in length and element by element;
- values not listed (`serverSeq`, `serverTime`, `seq`, `version`, error `detail`) are not checked.

`lastChangeFor` matches the last change in the page for that entity.

## Previous protocol (`v1/`)

ADR-0049: the cloud accepts protocol N and N−1. `v1/` is a frozen copy of these fixtures as protocol 1 left them; the
Go server (`TestPreviousProtocolFixturesOnNextServer`) and the reference server replay it against a server configured
as N=2, min 1. When the protocol becomes 2, regenerate the top-level fixtures and keep `v1/` unchanged; when it becomes
3, freeze the protocol-2 set as `v2/` and retire `v1/`.
