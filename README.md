# Touchline · Clubs Tracker

A player-first Next.js application for EA Clubs members, with a neutral charcoal/coral interface inspired by sports analytics products. Find your club, select your player, and navigate between Overview, Matches, Compare, and Improve.

## Run locally

Requires Node.js 22.12+ and pnpm 12.6.0 (pinned in `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. The initial dashboard uses **clearly labelled demo data**. Choose **Find a club** to search the live EA API. No credentials or environment variables are required.

```sh
pnpm check
pnpm build
pnpm start
```

Production builds use `.next-build` so they do not interfere with a running development server.

## Features

- Personal season totals, rating chart, and recent league match results.
- Whole-squad, same-position, and individual teammate comparisons.
- Explainable improvement opportunities and strengths, based on same-role peers with at least five appearances each.
- Club/player selection remembered locally, without sign-in.
- Responsive layouts, keyboard-accessible club search, empty/error states, and a sample squad.

## Architecture

- **Next.js App Router + TypeScript** for the application and server API.
- **Tailwind CSS v4** with the dedicated PostCSS plugin, CSS-first theme tokens, and utility-based responsive styling.
- **TanStack React Query** for five-minute client caching, deduplication, cancellation of client requests, and explicit refresh.
- `src/lib/ea.ts`: server-only adapter for the [fc27-clubs-api reference](https://github.com/1erkandogan/fc27-clubs-api). Reimplements HTTP requests in TypeScript; no Python runtime needed.
- `src/app/api/clubs/route.ts`: validated club search/detail endpoint. Uses only fixed EA endpoints on `common-gen5` (PS5, Xbox Series, PC).
- `src/lib/stats.ts`: validated response normalization, nullable metrics, role-aware comparisons, and conservative gamertag association.
- `src/lib/demo.ts`: illustrative data, never substituted silently for live results.
- `src/components/dashboard.tsx`: player overview and navigation. Search, comparisons, matches, and development have focused components alongside it.
- `src/components/use-selection.ts`: hydration-safe local preferences with cross-tab updates and a storage-unavailable fallback.

## Code quality

- `pnpm lint` / `pnpm lint:fix`: ESLint flat config with Next.js Core Web Vitals and TypeScript recommended rules, plus consistent type imports. ESLint 9 is retained because the Next.js React/import/accessibility plugins do not yet declare ESLint 10 support.
- `pnpm format` / `pnpm format:check`: Prettier with explicit defaults and automatic Tailwind class sorting. Formatting conflicts are disabled in ESLint through `eslint-config-prettier`.
- `pnpm typecheck`: strict TypeScript, checked indexed access, explicit overrides, switch fallthrough checks, consistent filename casing, and type-only import preservation. Next.js bundler resolution, isolated modules, and its TypeScript plugin remain enabled.
- `pnpm check`: lint, types, formatting, and unit tests. Production compilation is separate (`pnpm build`).
- `pnpm-workspace.yaml` explicitly allows only the installed build-script dependencies that require approval.

The server keeps a bounded five-minute in-memory response cache, deduplicates requests, spaces upstream calls by one second, limits the pending queue, and applies twelve-second upstream timeouts. CDN responses may serve stale data while revalidating. Refresh respects those server caches. These protections are **per server instance**, not a distributed quota; scale-out deployments would need a shared cache/rate limiter.

## Data interpretation and limits

- EA's public API is unofficial. Browser-style server requests were verified locally against real search/member/match responses; access can differ on deployment hosts or fail intermittently. Failures are shown explicitly, and existing client-cached stats remain visible when refresh fails.
- The actual upstream path is `/api/fc`; there is no verified edition selector, despite the reference repository's FC27 name.
- No global player search or account-ownership verification is available. Select a club first, then a member.
- Member responses have gamertags but no player IDs. Recent-match association requires a unique case-insensitive gamertag match; it is provisional and can break after renames. Match player IDs are retained.
- Unknown numerical fields remain unavailable (`—`), rather than becoming zero. Per-match metrics require a nonzero appearance count.
- Position comparisons use EA's `favoritePosition` category, not undocumented numeric position IDs. Peer averages are unweighted; five appearances is a minimum eligibility rule, not statistical confidence.
- Only recent league matches are requested. Missing matches, incomplete history, minutes, and tactical context limit conclusions. Improvement tips are general suggestions, not inferred causes.
- No database, scheduled collection, or historical snapshot storage is included. Long-term trends would require persisting observations from the date tracking begins; full historical backfill is not established by the reference API.

## Verification

Unit tests cover numerical normalization, timestamp conversion, player-ID retention, ambiguous identity matches, and insight eligibility/peer selection. The app was also checked in a real browser for live discovery, member and match loading, player switching, local persistence, comparisons, development views, and mobile layout.

The optional repository engineering-skill tracker configuration is not installed. Run `/setup-matt-pocock-skills` if you want tracker-backed specs and formal issue-linked reviews.
