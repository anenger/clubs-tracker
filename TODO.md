# Deep analytics rollout

## Architecture

Supabase Postgres stores source observations and collected matches. A publishable-key Supabase Edge Function owns validated EA ingestion and privileged writes. The statically exported Next.js app uses React Query to load live data and public bounded history; pure TypeScript functions calculate analytics in the browser.

## Tasks

- [x] Expand and validate EA match, goalkeeper, season, career, and club data.
- [x] Add Supabase migrations, idempotent collection, and public bounded history reads.
- [x] Move live EA requests to a validated Supabase Edge Function and make Vercel a static deployment.
- [x] Implement weighted accuracy, finishing/defending/keeper summaries, position splits, rolling comparisons, sessions, and lineup associations.
- [x] Build a deep analytics view, competition filters, full match reports, and history-aware loading/empty states.
- [x] Expand illustrative demo data and cover statistical edge cases with meaningful tests.
- [x] Document Supabase setup, data limits, collection behavior, and the future backend seam.
- [x] Verify lint, TypeScript, formatting, tests, production build, and browser flows.
- [x] Connect a Supabase project and run migrations; verify live ingestion, history read-back, duplicate handling, and private table access.

Background collection is intentionally not configured; viewing a live club collects its selected competition.

## Interpretation rules

- Recent results are not complete history; collection starts when tracking is enabled.
- No invented xG, heatmaps, pass networks, event timelines, or unverified per-90 metrics.
- Missing data stays missing; accuracy uses summed valid numerators/denominators.
- Gamertag associations are provisional. Role, competition, sample sizes, and DNF results remain visible.
- Demo data never silently substitutes for failed live requests.
