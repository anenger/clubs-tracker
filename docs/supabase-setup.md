# Optional Supabase history

Live EA requests and illustrative demo data work without Supabase. Missing either database environment variable returns `status: "disabled"` from the history route. Demo and search responses never enter storage. No player accounts or authentication product setup is required.

## Manual setup

1. Create/select a Supabase project yourself.
2. Apply `supabase/migrations/20260928000100_club_history.sql` using the project's SQL editor or the CLI: after `pnpm dlx supabase login` and `pnpm dlx supabase link --project-ref <project-ref>`, run `pnpm dlx supabase db push --linked --dry-run`, then `pnpm dlx supabase db push --linked`. The CLI records applied migrations and skips them on subsequent pushes.
3. Merge `.env.example` into `.env.local` and set `SUPABASE_URL` (or the existing `NEXT_PUBLIC_SUPABASE_URL`) and `SUPABASE_SECRET_KEY` using the project's server secret. A legacy service-role key can be supplied as the value of `SUPABASE_SECRET_KEY`. The URL is public; the secret must never have a `NEXT_PUBLIC_` prefix, reach browser code, or be committed. The browser publishable key is not needed by this integration.
4. Restart the server. Open a live club and inspect `GET /api/clubs/history?id=123&competition=leagueMatch&limit=100` with a real club ID. Confirm rows are collected and repeated cached requests do not duplicate snapshots or matches.

All three tables have RLS enabled, with no browser policies or anon/authenticated grants. Both RPCs revoke public execution and grant it only to the service role. The server client disables auth persistence, token refresh, and URL session detection; each Supabase HTTP call has a five-second timeout. A storage failure adds a warning without dropping fresh EA results.

## Collection semantics

- Only `common-gen5` is supported. Viewing a club tracks the selected competition (`leagueMatch`, `friendlyMatch`, or `playoffMatch`), independently from the other competitions. New tracking requires a valid club-info response or matches containing that club; failed requests cannot enroll arbitrary IDs for perpetual polling. Subsequent upserts preserve the first tracking time, and failures for existing tracked pairs are recorded.
- Five fixed EA endpoints are fetched independently: club info, member stats, selected-competition matches, club overall stats, and member career stats. The match request asks for ten recent matches. No browser-submitted statistics or caller-selected upstream endpoints are accepted.
- Raw successful endpoint responses are stored even when other endpoints fail. Atomic ingestion records snapshots, matches, and tracking metadata together. The snapshot key includes platform, club, endpoint, request scope, and source fetch time, so reusing a five-minute EA cache entry does not create duplicate snapshots. Request scope is the competition for matches and empty for shared endpoints: viewing another competition does not duplicate a cached overall/member snapshot. Separate workers may record separate observations of an unchanged payload; those have genuinely different fetch times.
- Matches are validated, upserted by platform/club/competition/match ID, and normalized again on history reads. First observation time is preserved; older observations cannot overwrite newer match data. Stored malformed payloads produce a history error instead of unchecked output.
- `lastSyncedAt` is the newest successful, validated match-fetch timestamp, not the time a cached payload was saved. `sync_status` is `complete` when all endpoint requests succeed and their expected shapes validate, `partial` when only some data is usable, and `failed` when every request fails. Here “complete” describes one collection attempt, **never complete historical coverage**. Optional endpoint snapshots remain raw and may not normalize into every optional UI field.
- History is separate from live data; it does not silently replace failed live EA responses. A ready response may have no tracking metadata or matches yet. Warnings distinguish missing/partial/failed collection and always explain limited coverage.
- The history API defaults to 100 and accepts 1–200 matches; it reads at most 201 rows to compute `hasMore`. Results are newest-first. `hasMore` means older stored rows exist; there is no pagination/cursor contract yet. Historical gaps and matches outside EA's recent window cannot be backfilled by this integration.

## Optional scheduling (manual)

Set a long random `CRON_SECRET` on the server, then configure your own trusted scheduler to POST `/api/sync` with `Authorization: Bearer <CRON_SECRET>`. Missing/incorrect credentials fail closed. The route accepts no target club, platform, endpoint, or statistics body. No schedule or credentials are configured automatically.

Each invocation atomically claims at most **two tracked club/competition pairs**, then collects them sequentially. Pairs become eligible five minutes after their last attempt; oldest attempts go first with deterministic tie-breakers. Claims use `FOR UPDATE SKIP LOCKED` and five-minute leases. Claiming advances the attempt time even if the process dies, and failed collections advance it too, preventing a repeatedly failing club from starving the others. Public live requests also refresh attempt times. Only competitions actually viewed are enrolled; collection of all three requires viewing each separately.

The handler requests a 180-second runtime budget. EA calls have twelve-second timeouts and a serialized one-second throttle; queued calls older than sixty seconds fail before fetching. Ensure your host supports this budget. Increase scheduler frequency as the tracked set grows (two pairs per invocation); overlapping runs use leases. This is bounded collection, not a global distributed EA rate limiter. Monitor upstream failures and collection age before increasing concurrency.

## Retention and operations

No destructive retention runs automatically. Snapshot volume grows by successful endpoint observations; match volume grows by unique matches. Choose a retention policy for raw snapshots (for example 90 days) and manually schedule batched deletion using the indexed `stored_at` column after evaluating your auditing needs. Keep match rows and tracking metadata for longer-term analytics. Deleting a tracked pair cascades its matches and snapshots first stored by that pair (including shared endpoint snapshots), and resets tracking start if later enrolled again. Back up before destructive operations.

Check stored status and `last_synced_at`, database size, and scheduler results. `status: "error"` from history means storage/validation failed; an empty `ready` result is not evidence of a successful historical backfill. Real Supabase permissions, migrations, and concurrent ingestion must be verified against your configured project; local checks without credentials cannot verify them.

## Future backend seam

`src/lib/ea.ts` owns fixed upstream collection; `src/lib/persistence.ts` owns privileged storage, runtime validation, and normalized history reads. The atomic ingestion/claim RPCs are the cross-process coordination boundary. A worker/backend can reuse these tables and contracts while Next.js keeps validated public read routes. Browser analytics continue to consume bounded normalized `Match[]`; browser code never needs database secrets or raw write access.
