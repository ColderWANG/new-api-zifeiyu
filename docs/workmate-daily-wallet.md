# Workmate daily wallet

The `workmate` user group defaults to USD 50 per user per Beijing business day.
At 00:00 Asia/Shanghai its wallet is replaced, without carrying forward credits.
Top-ups, redemption and manual adjustments work during the day. The reset amount
is not a spending cap. Workmate requests always use wallet funding; saved
subscription preferences and subscription records remain intact.

## Administration

- System Settings → Billing → Group Pricing → Workmate daily wallet: Root can
  change the group amount; other administrators can read it.
- Users → Edit → select `workmate`: inherit the group amount or set a personal
  override. Zero is valid. Clearing the override restores inheritance.
- Changes adjust the wallet by the difference in applied reset amounts, including
  negative balances. Repeating a save cannot grant money again.
- First entry replaces the wallet; leaving preserves it and stops resets. Rejoining
  on the same day uses the same period. Existing personal choices survive leaving.
- The dashboard shows the wallet, reset amount, settled daily usage, pending
  reservations and next Beijing reset time. Usage comes from the ledger and
  remains correct after top-ups. API token quotas and historical counters persist.

`GET /api/group/quota-policies` requires administrator access;
`PUT /api/group/quota-policies/workmate` requires Root and an integer
`daily_quota` in internal quota units. User create/update accept optional
`daily_quota_override`: absent preserves, null inherits, integer zero is explicit.
Never send a displayed currency amount directly as internal quota.

## Accounting and compatibility

Five additive tables hold group policies, personal overrides, unique user/day
periods, request transitions and reset/adjustment audits. User rows carry a
persisted `daily_wallet_managed` marker; legacy Midjourney rows gain private
period/request identifiers. General asynchronous tasks persist these identifiers
inside their existing private JSON. Old tasks without identifiers keep their old
billing path. Resets are separate from recharge income.

Managed balance changes lock the user row and run in one transaction. Reads and
reservations reconcile the business day before proceeding. Startup and minute
maintenance drain due users in bounded batches. Managed wallets bypass Redis
balance reservations and deferred wallet batches, including after leaving the
group so queued deltas cannot undo the first reset. Ordinary users retain their
existing cache/batch paths. A request's persisted period isolates late settlement
or refund from a newer wallet, with idempotent request state transitions.

No existing user is moved to workmate, and no channel gains automatic permission
to serve that group. Configure channel access separately when enabling members.
Existing custom group multipliers are retained; the new group's default is 1.

## Verification — 2026-10-20

Toolchains: Go 1.26.1, Bun 1.4.0, ARM64 Linux. No dependency upgrades.

- `GOWORK=off GOMAXPROCS=4 go test ./... -count=1`: passed.
- `GOWORK=off GOMAXPROCS=4 go vet ./...`: passed.
- `TEST_MYSQL_DSN=… TEST_POSTGRES_DSN=… TEST_REDIS_ADDR=… GOWORK=off
  go test ./model -run '^TestDailyWalletDatabaseMatrix$' -v -count=1`:
  passed against real SQLite 3.50.4, MySQL 8.0.46, PostgreSQL 16.15 and a private
  Redis instance. Covers schema upgrades and repeated migration, legacy wallets
  and tasks, midnight boundaries, startup batches, stale cache rejection, batch
  compatibility, group transitions, null/zero overrides, delta adjustments,
  concurrent reservations, replay, late settlement/refund and integer bounds.
- `bun run typecheck` and `bun run build`: passed.
- `bun run test src/features/users src/features/dashboard/components/overview
  src/features/system-settings/models src/lib/__tests__/format.test.ts`:
  18 files and 123 tests passed.
- Native oxlint executed successfully on the compatible ARM64 host. All changed
  TypeScript files passed. Full-repository lint remains failing on existing
  errors: current 89 versus baseline 90, with no new errors. This is not claimed
  as a full-repository lint pass. The earlier native allocator crash is resolved
  by this validation environment.
- The full frontend suite was attempted and terminated after it stalled in an
  unrelated suite emitting repeated jsdom scrollTo warnings. Only the relevant
  123-test run is claimed as passing.
- Isolated fresh installation: setup, administrator policy API, user creation,
  80/10/zero personal overrides, repeated saves, null inheritance, group deltas,
  and ordinary user isolation passed. Chromium saved group and user changes,
  verified desktop/mobile dashboards, and reported no page errors or overflow.
- A local mock upstream verified two unlimited API keys sharing one wallet,
  normal JSON and SSE billing, ledger usage and cleared reservations, plus
  insufficient-wallet rejection before the upstream is contacted. No paid
  upstream requests or production test users/channels were created.

Evidence logs and screenshots are retained with the pinned deployment release.

## Deployment and rollback

Build a pinned release from base `805af775c`. Before switching, run the existing
SQLite online backup, verify integrity, and preserve configuration and current
release metadata. Switch the release symlink and restart `new-api.service`;
check startup migration, HTTPS status and administrator policy reads. Keep the
existing site branding, domain configuration and ordinary user membership.

Before reverting to a binary without this feature, stop admission of new
workmate requests (for example disable the relevant API tokens), leave the new
service running until period-bound requests and asynchronous tasks settle, and
check that `daily_wallet_requests.state = 'pending'` has no rows. Resolve failed
or still-running task billing before proceeding; do not blindly clear ledger
rows. Move any remaining workmate accounts out of the group before returning to
a binary that cannot enforce its rules. Restore admission only after deciding
how those accounts should be funded on the older release.

Keep the added tables, columns and current data when reverting the binary.
Never automatically restore the pre-upgrade database: doing so would discard
later usage, credits and account changes. Preserve the current database before
any separately approved recovery operation.
