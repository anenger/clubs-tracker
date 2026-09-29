# Deep analytics rollout

## Architecture

Supabase Postgres stores source observations and collected matches. Next.js owns EA ingestion and privileged database access. React Query loads bounded datasets; pure TypeScript functions calculate analytics in the browser. A future backend can reuse the ingestion/storage boundary without changing the analytics UI.

## Tasks

- [x] Expand and validate EA match, goalkeeper, season, career, and club data.
- [x] Add Supabase migrations, server-only repository, idempotent collection, and a bounded history API.
- [x] Add optional scheduled collection of tracked clubs, with explicit collection/freshness status.
- [x] Implement weighted accuracy, finishing/defending/keeper summaries, position splits, rolling comparisons, sessions, and lineup associations.
- [x] Build a deep analytics view, competition filters, full match reports, and history-aware loading/empty states.
- [x] Expand illustrative demo data and cover statistical edge cases with meaningful tests.
- [x] Document Supabase setup, data limits, collection behavior, and the future backend seam.
- [x] Verify lint, TypeScript, formatting, tests, production build, and browser flows.
- [x] Connect a Supabase project and run migrations; verify live ingestion, history read-back, duplicate handling, and private table access.

Scheduled background collection still requires a deployed server, `CRON_SECRET`, and an external scheduler; viewing a live club already collects its selected competition.

## Interpretation rules

- Recent results are not complete history; collection starts when tracking is enabled.
- No invented xG, heatmaps, pass networks, event timelines, or unverified per-90 metrics.
- Missing data stays missing; accuracy uses summed valid numerators/denominators.
- Gamertag associations are provisional. Role, competition, sample sizes, and DNF results remain visible.
- Demo data never silently substitutes for failed live requests.
