# Supabase live data and history

The labelled demo needs no configuration. Live club search, refresh, and collected history use Supabase. The Vercel deployment is a static export and runs no Next.js functions.

## Setup

1. Create or select a Supabase project.
2. Authenticate and link the CLI:

   ```sh
   pnpm dlx supabase login
   pnpm dlx supabase link --project-ref <project-ref>
   ```

3. Review and apply the migrations:

   ```sh
   pnpm dlx supabase db push --linked --dry-run
   pnpm dlx supabase db push --linked
   ```

4. Deploy the EA adapter:

   ```sh
   pnpm dlx supabase functions deploy clubs-api --use-api
   ```

5. Set these public values locally and in the Vercel Production environment:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

The Edge Function receives Supabase's server credentials automatically. Do not add `SUPABASE_SECRET_KEY` to Vercel, source control, or any `NEXT_PUBLIC_` variable.

## Access model

EA exposes the club, player, and match records publicly, so anonymous browser reads are intentional:

- `tracked_clubs`: public `SELECT` on tracking and freshness columns only.
- `club_matches`: public `SELECT` on identity, ordering, competition, and payload columns only.
- `club_snapshots` and `club_refresh_leases`: no public access.
- All table writes and the `ingest_club_observations`, `claim_club_refresh`, and `claim_tracked_clubs` RPCs: server roles only.

RLS remains enabled on every table. The browser publishable key cannot inspect raw snapshots, mutate history, or invoke privileged ingestion. The `clubs-api` function uses `@supabase/server` publishable authentication for callers and an internal admin client for atomic persistence.

## Collection semantics

- Only `common-gen5` and `leagueMatch`, `friendlyMatch`, or `playoffMatch` are accepted.
- Search accepts a 2–60 character club name. Detail requests accept only numeric club IDs.
- A detail refresh fetches five fixed EA endpoints sequentially: club info, members, selected-competition matches, overall stats, and member career stats. Callers cannot choose arbitrary upstream URLs or submit statistics.
- Each club and competition gets at most one live EA refresh every five minutes. The function claims a lease in `club_refresh_leases` first; if another request holds it, the function returns the latest stored snapshots instead of calling EA, or `429` if nothing is stored yet. If the lease check itself fails, the function fetches live data rather than going down.
- Successful raw observations and validated matches are ingested atomically. Matches upsert by platform, club, competition, and match ID; older observations cannot overwrite newer payloads.
- React Query keeps browser data fresh for five minutes. Collection happens only when someone views a club; no background schedule is currently configured.
- `complete` describes one successful five-endpoint collection attempt, not complete historical coverage. EA exposes only recent matches, so old matches and missed windows cannot be backfilled reliably.
- The browser reads at most 201 stored rows and returns at most 200 normalized matches. `hasMore` only indicates that older stored rows exist; there is no pagination contract yet.

## Verification

Run local checks and Supabase advisors:

```sh
pnpm check
pnpm build
pnpm dlx supabase db advisors --linked --type security --level warn
```

Then verify with the deployed app:

1. Search for a real club.
2. Select it and confirm members and recent matches load.
3. Refresh the same club and confirm match rows do not duplicate. A second request within five minutes should return quickly with the same `updatedAt`, showing it came from stored snapshots.
4. Confirm a publishable-key read of `club_matches` succeeds.
5. Confirm publishable-key reads of `club_snapshots` and all writes fail.

## Operations and limits

No destructive retention runs automatically. Raw snapshot volume grows with successful detail refreshes; unique match volume grows as new matches appear. The indexed `stored_at` column supports a future batched snapshot-retention policy.

Club detail refreshes are rate limited per club and competition, but club search is not throttled beyond browser caching. Monitor Supabase invocation, database, and egress usage before broad promotion. `club_refresh_leases` holds one small row per viewed club and competition.

Vercel does not deploy Supabase changes. After changing a migration or the Edge Function, run `pnpm dlx supabase db push --linked` or `pnpm dlx supabase functions deploy clubs-api --use-api`.
