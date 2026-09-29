# Touchline · Clubs Tracker

A player-first Next.js application for EA Clubs members, with a charcoal/coral interface inspired by sports analytics products. Find your club, pick your gamertag, and switch between three sections: **Overview**, **Matches**, and **Squad**.

## Run locally

Requires Node.js 22.12+ and pnpm 12.6.0 (pinned in `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. The initial dashboard uses **clearly labelled demo data** and needs no configuration. To search live EA clubs, copy `.env.example` to `.env.local` and set the two public Supabase values (see [Supabase data access](#supabase-data-access)), then choose **Find my club**.

```sh
pnpm check
pnpm build
```

`pnpm build` produces a static export in `out/`, which any static file host can serve. There is no Next.js server to start.

## Features

- **Overview:** season stats with bars against same-position teammates, a form chart with last-5 rating change and record, one thing to work on and one to keep doing, and recent matches.
- **Matches:** results grouped into playing sessions, with colour-coded ratings and full two-team match reports.
- **Squad:** season comparison with your position or the whole squad, the teammates you play with most and how you do together, and the club's record.
- One pinned bar for club, section, and competition (League, Friendlies, Playoffs); a compact player header with recent form.
- Secondary context lives in info tooltips, "small sample" badges, and a single "About these numbers" section rather than on every stat.
- Club/player selection remembered locally, without sign-in. Responsive layouts, keyboard-accessible search and dialogs, and a labelled demo club.
- Supabase collection of raw responses and matches, with separate league, friendly, and playoff histories.

## Supabase data access

The labelled demo works without configuration. Live club search, refresh, and history require `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; both are intentionally public browser credentials. See [Supabase setup](docs/supabase-setup.md) for migrations, Edge Function deployment, and verification.

Club and match statistics are public EA data. The browser reads a bounded history window directly through Supabase's Data API under RLS and column grants. Raw snapshots, table writes, and ingestion RPCs remain private. The `clubs-api` Edge Function accepts the publishable key, validates fixed query shapes, calls fixed EA endpoints, and performs privileged ingestion internally; no secret key reaches the browser or Vercel.

Collection is on demand when a club is viewed and React Query refreshes approximately every five minutes. There is currently no background schedule. “Real time” means recalculating on freshly requested match data, not live in-game telemetry.

## Deploy to Vercel

1. Import the GitHub repository into Vercel or run `pnpm dlx vercel link`.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the Production environment. These identify the public project API and are not secrets.
3. Deploy from `main` or run `pnpm dlx vercel --prod`.
4. Verify the homepage, a live club lookup, and collected history. Never add a Supabase secret key to Vercel or a `NEXT_PUBLIC_` variable.

Vercel deploys only the frontend. Database migrations and the `clubs-api` Edge Function are deployed separately with the Supabase CLI; see [Supabase setup](docs/supabase-setup.md).

The Next.js build is a static export, so Vercel serves files without application functions. Vercel automatically deploys changes pushed to the connected production branch. GitHub Actions independently runs linting, strict TypeScript checks, formatting, tests, and a production build for pushes and pull requests. The Edge Function remains dependent on EA's unofficial upstream service; monitor Supabase usage and upstream failures before promoting the app widely.

## Architecture

- **Next.js App Router + TypeScript** for a static application shell.
- **Tailwind CSS v4** with the dedicated PostCSS plugin, CSS-first theme tokens, and utility-based responsive styling.
- **TanStack React Query** for five-minute client caching, deduplication, cancellation of client requests, and explicit refresh.
- `supabase/functions/clubs-api`: publishable-key Edge Function for fixed, validated EA requests and privileged persistence.
- `src/lib/client-api.ts`: browser adapter for the Edge Function and public, bounded Supabase history reads.
- `src/lib/analytics.ts`: pure client-compatible calculations; no React, database, or HTTP dependencies.
- `src/lib/stats.ts`: validated response normalization, nullable metrics, role-aware comparisons, and conservative gamertag association.
- `src/lib/demo.ts`: illustrative data, never substituted silently for live results.
- `src/components/dashboard.tsx`: data loading, pinned bar, player header, and section switching. `overview.tsx`, `matches.tsx`, and `squad.tsx` render each section; `ui.tsx` holds shared cards, chips, bars, and tooltips; `match-report.tsx` and `club-search.tsx` are the dialogs.
- `src/components/use-selection.ts`: hydration-safe local preferences with cross-tab updates and a storage-unavailable fallback.

## Code quality

- `pnpm lint` / `pnpm lint:fix`: ESLint flat config with Next.js Core Web Vitals and TypeScript recommended rules, plus consistent type imports. ESLint 9 is retained because the Next.js React/import/accessibility plugins do not yet declare ESLint 10 support.
- `pnpm format` / `pnpm format:check`: Prettier with explicit defaults and automatic Tailwind class sorting. Formatting conflicts are disabled in ESLint through `eslint-config-prettier`.
- `pnpm typecheck`: strict TypeScript, checked indexed access, explicit overrides, switch fallthrough checks, consistent filename casing, and type-only import preservation. Next.js bundler resolution, isolated modules, and its TypeScript plugin remain enabled.
- `pnpm check`: lint, types, formatting, and unit tests. Production compilation is separate (`pnpm build`).
- `pnpm-workspace.yaml` explicitly allows only the installed build-script dependencies that require approval.

React Query caches requests for five minutes in each browser. The Edge Function accepts only club search, numeric club IDs, and the three known competition values. Each club and competition gets at most one live EA refresh every five minutes, enforced by a database lease; other requests in that window receive the latest stored snapshot. A live refresh spaces its five fixed EA calls by 750 milliseconds with twelve-second timeouts. Club search is not throttled beyond browser caching.

## Data interpretation and limits

- EA's public API is unofficial. Direct browser requests fail CORS and Vercel egress receives EA `403` responses, so live requests run through Supabase Edge. Failures are shown explicitly, and existing client-cached stats remain visible when refresh fails.
- The actual upstream path is `/api/fc`; there is no verified edition selector, despite the reference repository's FC27 name.
- No global player search or account-ownership verification is available. Select a club first, then a member.
- Member responses have gamertags but no player IDs. Recent-match association requires a unique case-insensitive gamertag match; it is provisional and can break after renames. Match player IDs are retained.
- Unknown numerical fields remain unavailable (`—`), rather than becoming zero. Per-match metrics require a nonzero appearance count.
- Position comparisons use EA's `favoritePosition` category, not undocumented numeric position IDs. Peer averages are unweighted; five appearances is a minimum eligibility rule, not statistical confidence.
- League, friendly, and playoff datasets remain separate. Missing matches, incomplete history, minutes, and tactical context limit conclusions. Improvement tips are general suggestions, not inferred causes.
- Supabase history for a club and competition starts the first time someone views it. The upstream has no verified full-backfill endpoint, and missed collection windows may leave permanent gaps. The browser loads a bounded window of up to 200 matches.
- Weighted accuracy uses paired valid attempt/completion fields. Missing rows are excluded and coverage is shown. Session grouping and teammate co-appearance statistics are descriptive heuristics, not causal findings.
- Career totals are career **at the club**; club overall statistics have an unverified reset/competition scope. Neither is silently blended with the selected match window.

The source-backed [data research](docs/research/clubs-analytics-data.md) documents available fields, exact formulas, and unsupported analytics. [TODO.md](TODO.md) records rollout progress and configuration-dependent tasks.

## Verification

Tests cover numerical normalization, timestamp conversion, player-ID retention, ambiguous identity matches, weighted calculations with missing data, rolling windows, sessions, teammate associations, and history merging. Migrations also run against in-memory PostgreSQL (PGlite) to verify idempotent collection, atomic rollback, public read boundaries, private writes, refresh leases, and scheduler leases; no external test database is required. Browser checks, run locally and against production, cover live discovery, member and match loading, player switching, local persistence, analytics and history views, full match reports, and mobile layout.

The optional repository engineering-skill tracker configuration is not installed. Run `/setup-matt-pocock-skills` if you want tracker-backed specs and formal issue-linked reviews.
