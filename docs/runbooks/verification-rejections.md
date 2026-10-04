# Verification rejections rising

**Alert:** `muneem-verification-rejections` (warning) fires when `sum by (business_id) (muneem_business_rejections_recent)` > 10 for 5m.

## What it means
More than 10 operations from one shop failed server verification within an hour. A systematic disagreement between the device and the cloud, not a one-off.

## How to check
- Sync dashboard → Rejections by code.
- Group the dead letters by code and entity type for the shop.

## How to fix
- Follow [dead-letters](dead-letters.md) for the dominant code.
- If one app version causes it, pause that version's rollout (ADR-0049 / the release channel).
