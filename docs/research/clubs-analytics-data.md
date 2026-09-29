# How deep can Clubs analytics go with `fc27-clubs-api`?

Research date: **2026-09-28**. Source snapshot: [`1erkandogan/fc27-clubs-api@9fb7980940bbc4dc4afc9b44101001f790eba06b`](https://github.com/1erkandogan/fc27-clubs-api/tree/9fb7980940bbc4dc4afc9b44101001f790eba06b).

## Executive assessment

**We can build a substantially deeper match-statistics and longitudinal team-analysis product:** possession-independent passing and tackling efficiency, shooting conversion, role-specific player form, goalkeeper workload, opponent comparisons, lineup/co-appearance analysis, attendance, club progression, and carefully qualified with/without-player comparisons. Most of the enabling fields already exist in the raw match response; the convenience tables hide some of the most valuable ones. [S1][S2][S3]

**The highest-impact investment is collecting and persisting raw matches now.** The client requests recent matches, defaults to 10, and exposes no verified historical pagination. A larger `maxResultCount` is a request parameter, not evidence that arbitrary history can be recovered. Deep trends depend on an archive we build. [S1][S2]

**This is aggregate match data, not tracking or a play-by-play feed.** The inspected schema does not supply shot locations, event timestamps, pass recipients, movement coordinates, possession sequences, or a documented event dictionary. Real xG/xA, heatmaps, passing networks, progressive actions, pressing metrics, and in-game tactical timelines are unsupported from this source alone. Undocumented event-count strings do not solve that limitation. [S2][S3]

### Evidence boundary

- **Verified in source/fixtures** means a field or implementation exists in this repository. It does not mean its exact gameplay semantics are officially documented by EA.
- The endpoint reference says its real-club observation was **2026-09-19**. Names, IDs, dates, kit values, and club totals in its examples are placeholders. Tests are offline and the match fixture is explicitly trimmed. Treat fixtures as schema evidence, not a representative statistical sample or internally reconciled dataset. [S2][S4][S9]
- This research directly inspected `fc27_api.py`, `docs/endpoints.md`, README, all six JSON fixtures, tests, and contribution notes. No live EA request was made; current availability, actual limits, and semantic hypotheses remain to be validated. Context7 discovery had no matching library entry, so the repository's own implementation and fixtures are the primary evidence.
- Roadmap, formulas, storage design, and validation gates below are **recommendations/inferences**, not promises made by the upstream project.

## 1. Verified endpoint inventory and scope

All seven are `GET https://proclubs.ea.com/api/fc/<endpoint>`. The wrapper adds `platform`; only `common-gen5` is documented as tested (PS5 / Xbox Series / PC). Browser-style headers are used. Singular/plural parameter spelling matters, and only single-club IDs have been tested. The API is unofficial and undocumented; the client has no authentication-key requirement, caching, retry/backoff policy, or rate limiter. The README suggests a pause between requests but does not establish an EA quota. [S1][S2][S4]

| Verified endpoint           | Additional parameters                    | Actual output and analytical value                                                                                                                                 | Scope/limit cautions                                                                                                                                               |
| --------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `allTimeLeaderboard/search` | `clubName`                               | List of matching clubs; wins, ties, losses, games, goals, goals against, clean sheets, points, divisions, promotions/relegations, reputation, nested club identity | Reference calls these **all-time league totals**. Name search is not a verified complete leaderboard/export API.                                                   |
| `clubs/info`                | `clubIds`                                | Dictionary keyed by club ID; name, club ID, region ID, team ID, custom kit/stadium                                                                                 | Identity/branding, not performance history. `teamId` is distinct from `clubId`; never use it as the club join key.                                                 |
| `clubs/overallStats`        | `clubIds`                                | List: record, goals, skill rating, streaks, promotion/relegation counts, finish counters, recent opponent IDs                                                      | No season selector or explicit season identity in this response. Its exact reset/competition coverage is not established merely by the word “overall.”             |
| `members/stats`             | `clubId`                                 | `{members: [...], positionCount: {...}}`; member summaries and build/profile fields                                                                                | Reference and wrapper describe **current-season** statistics. No explicit season ID or player ID in inspected member records.                                      |
| `members/career/stats`      | `clubId`                                 | Same wrapper, fewer per-member totals                                                                                                                              | Documented as **career at this club**, not universal cross-club account career. No season selector or player ID in inspected records.                              |
| `clubs/matches`             | `clubIds`, `matchType`, `maxResultCount` | Recent matches, both club score records, nested players for both sides, team aggregates                                                                            | Wrapper accepts `leagueMatch`, `friendlyMatch`, `playoffMatch`, defaults to 10 requested records. No verified cursor, offset, date-range, or match-by-ID endpoint. |
| `club/playoffAchievements`  | `clubId`                                 | Observed `[]`                                                                                                                                                      | Populated schema unknown. Playoff match requests also returned `[]` in the reference; this is not proof playoffs are permanently unavailable.                      |

Evidence: endpoint definitions and parameters [S1][S2]; actual payloads [S3][S5][S6][S7][S8][S10]. No additional endpoint is assumed here.

### Scope and season identity need special care

1. Search all-time league totals, overall club statistics, current-season member statistics, member career-at-club totals, and a collected match window are **five different datasets**. Do not silently combine their numerators and denominators. Matching example totals do not establish identical live scopes. [S2][S5][S6][S7][S8]
2. `clubs[clubId].season_id` exists in match data but is `"0"` throughout the supplied fixture; `gameNumber` is also `"0"`. Neither establishes a usable season partition or ordered match counter. There is no documented season calendar/history endpoint here. `customKit.seasonalTeamId` and `seasonalKitId` are kit fields, not evidence of a competition season key. [S3][S10]
3. Persist the raw season value, but initially show explicit date windows and “collected since” history. A product-defined season calendar must be marked as product-defined. Track suspected counter resets separately from confirmed season transitions.
4. `lastOpponent0`–`9` are documented as recent opponent IDs. `lastMatch0`–`9` had `1` and `-1`, with `-1` explicitly unconfirmed. These are not ten match IDs and cannot reconstruct lost match records. [S2][S7]
5. `gamesPlayedPlayoff`, `leagueAppearances`, `reputationtier`, `bestFinishGroup`, and `finishesInDivision1Group1` through `finishesInDivision6Group1` exist, but their exact counting/reset rules are not established. `bestDivision` and `bestFinishGroup` can be null. Do not label the finish counters “titles” without validation. [S2][S7]

## 2. The wrapper is a lossy view of a richer payload

### What to retrieve

For archival ingestion, use the raw `clubs/matches` response (through `get_json` or an equivalent HTTP client). It contains the result record, both sides, the player IDs, and aggregates in one response. Calling `get_club_matches` and `get_match_players` separately makes separate upstream requests and may capture different recent windows. [S1]

If using the convenience player method, request **`both_teams=True, all_columns=True`**. This retains player IDs and the raw player fields, but **still does not include the match's `clubs` or `aggregate` objects**. It is not a substitute for the raw archive. [S1]

| Method                                     | Important information lost or transformed                                                                                                                                                                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default `get_match_players`                | Drops `playerId` despite constructing it internally; excludes opponent players by default; drops GK subtypes, `goalsconceded`, specialized clean sheets, raw clocks, event aggregates, archetype and namespace.                         |
| `get_match_players(..., all_columns=True)` | Includes all flattened player-row fields, but no requested `matchType` column, club score objects, or team aggregates. Attach request provenance yourself.                                                                              |
| `get_club_matches`                         | Produces match ID/time, requested match type, club/opponent identity, score, normalized result and a single `dnf` Boolean. No `all_columns` option. Raw result codes, per-side DNF award, season ID, players, and aggregates disappear. |
| `get_member_stats(..., all_columns=True)`  | Retains member fields, but still drops top-level `positionCount`; it cannot create absent member IDs.                                                                                                                                   |
| `get_member_career_stats`                  | Keeps all member-record fields but drops `positionCount`; has no `all_columns` parameter.                                                                                                                                               |
| `to_dataframe`                             | Flattens nested objects and attempts numeric conversion on every wholly numeric column, including identifier-like columns. Retain raw IDs as strings in our database rather than letting numeric conversion determine identity types.   |
| `get_json`                                 | Preserves dictionaries/lists except normalizing JSON `null` into `[]`. Preserve HTTP outcome separately if the distinction matters operationally.                                                                                       |

These are verified implementation behaviors, not inferred API restrictions. [S1]

The match summarizer also assigns its **requested** match type to each output row and defaults missing score values to zero. Production ingestion should distinguish missing scores from real 0–0 draws and preserve both requested type and returned raw `clubs[id].matchType`. The test fixture intentionally combines league and friendly examples; it does not prove a live league query returns friendlies. [S1][S3][S9]

## 3. Raw fields: what is actually available

### Match and club-side records

- Match envelope: `matchId`, Unix-second UTC `timestamp`, presentation-oriented `timeAgo`, `clubs`, `players`, `aggregate`.
- `clubs[clubId]`: `date`, `gameNumber`, `season_id`, `matchType`, `goals`, `goalsAgainst`, `score`, `wins`, `ties`, `losses`, `result`, `winnerByDnf`, `TEAM`, and nested club `details`.
- `players[clubId][playerId]`: keyed player records. Preserve both IDs rather than grouping by `playername`.
- `aggregate[clubId]`: many player-shaped fields as numeric totals, including attempts, completions, shots, saves, ratings, clocks, and various code-like fields. [S2][S3]

The reference reports league result codes `1` win, `2` loss, `4` draw, `16385` win by opponent DNF and `10` loss by DNF. `winnerByDnf="1"` marks the awarded winner. Friendlies have zero result/W/D/L flags, requiring score comparison. Raw match types observed were `"1"` league and `"5"` friendly. Preserve unknown codes and report an unknown result rather than extending these observations to unobserved modes. [S2]

### Player-match fields

| Group                  | Verified raw fields                                                                                                      | What that supports / what is not established                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity/role          | Outer player ID, `playername`, `pos`, `namespace`, `archetypeid`                                                         | Per-match identity and broad role; namespace/archetype meanings and cross-platform ID stability are not documented.                             |
| Attacking output       | `goals`, `assists`, `shots`                                                                                              | Output volume and goals per reported shot. No named shots-on-target field, chance quality, shot coordinates, or assisted-shot count.            |
| Passing                | `passattempts`, `passesmade`                                                                                             | Attempt-weighted completion and unsuccessful attempts. No distance, destination, recipient, progressive/key-pass flag, or possession ownership. |
| Tackling               | `tackleattempts`, `tacklesmade`                                                                                          | Attempt-weighted success and unsuccessful attempts. Not all duels, defensive actions, interceptions, or pressures.                              |
| Goalkeeping            | `saves`, `goalsconceded`, `ballDiveSaves`, `crossSaves`, `goodDirectionSaves`, `parrySaves`, `punchSaves`, `reflexSaves` | Workload and reported save categories; subtype overlap, definitions, and denominator semantics unknown.                                         |
| Clean sheets           | `cleansheetsany`, `cleansheetsdef`, `cleansheetsgk`                                                                      | Separate reported awards/counters; do not assume “any” is an OR of the others or encodes an ANY controller role.                                |
| Recognition/discipline | `rating`, `mom`, `redcards`                                                                                              | Ratings, man-of-match awards, red-card counts. No named yellow-card/foul fields in inspected schema.                                            |
| Participation/clocks   | `secondsPlayed`, `gameTime`, `realtimegame`, `realtimeidle`                                                              | Reported time counters; clock model and units beyond suggestive field names need verification.                                                  |
| Result/internal fields | `wins`, `losses`, `userResult`, `SCORE`, `vproattr`, `vprohackreason`                                                    | Preserve, but do not equate `SCORE` with performance rating or infer behavioral/cheating judgments from internal codes.                         |
| Opaque event counts    | `match_event_aggregate_0` through `_3`                                                                                   | Strings of undocumented `eventId:count` pairs, not event records.                                                                               |

All listed fields occur in the match fixture/reference. Existence is stronger evidence than semantic interpretation; specialized fields may be zero or mode-dependent. [S2][S3]

### Current member and career fields

`members/stats` includes `name`, `proName`, `favoritePosition`, `proPos`, `proStyle`, `proHeight`, `proNationality`, `proOverall`, `proOverallStr`, `gamesPlayed`, `winRate`, `goals`, `assists`, `ratingAve`, `manOfTheMatch`, `shotSuccessRate`, `passesMade`, `passSuccessRate`, `tacklesMade`, `tackleSuccessRate`, `cleanSheetsDef`, `cleanSheetsGK`, `redCards`, `prevGoals`, and `prevGoals1`–`prevGoals10`. The meaning/order of `prevGoals*` is not documented sufficiently to label them a verified match timeline. Numeric profile IDs lack a published lookup in the reference. [S2][S5]

`members/career/stats` is narrower: inspected member records contain `name`, `proPos`, `gamesPlayed`, `goals`, `assists`, `manOfTheMatch`, `ratingAve`, `prevGoals`, and `favoritePosition`. **No career passing attempts, tackling attempts, shots, saves, or stable member player ID are present in that fixture.** Do not promise those career statistics from this endpoint. [S6]

Member summary percentages are not substitutes for exact attempts. Rounded/opaque `passSuccessRate` cannot reliably reconstruct attempts as `passesMade / rate`; the same applies to tackling, shooting, and win counts. There is no documented rounding contract. [S2][S5]

## 4. Critical semantics: aggregates, GK stats, event IDs, and time

### Team aggregates are useful, but are not eleven independently meaningful team metrics

The docs describe `aggregate` as player fields summed over the club. This makes additive action counts useful candidates for team passing, tackling, and shot totals. It does **not** make every summed field meaningful. [S2][S3]

- `aggregate.rating` is not a team average. `aggregate.secondsPlayed` is not match duration. Summed `wins` is not a count of matches, and summed `archetypeid`, `namespace`, `SCORE`, or `userResult` is not a new category.
- `aggregate.goalsconceded` can repeat the same conceded goal across players. In the fixture's drawn match, one club's score record has `goalsAgainst="1"` while its aggregate has `goalsconceded=8`. Use the **club score record** for team goals against. [S3]
- The fixture contains only two players per side but aggregates for a larger set. Tests explicitly call the fixture trimmed. Aggregate-vs-visible-player mismatches therefore cannot prove AI inclusion, a live API bug, or a valid correction factor. [S3][S9]
- Preserve aggregate and player-summed totals separately. Validate live completeness, AI/ANY behavior, DNF handling, and modes before presenting them as interchangeable “whole-team” totals.
- Never add aggregate totals to player totals: they overlap. Never sum each player's `goalsconceded` to compute the score.

### Goalkeeping: meaningful volume now; efficiency needs validation

1. **Immediately defensible:** GK appearances (`pos="goalkeeper"`), reported saves, saves per observed GK appearance, reported GK clean sheets, clean sheets per eligible GK appearance, GK rating distributions, and passing efficiency for GK rows. Show field completeness and DNF exclusions.
2. **Conditional save percentage:** `Σsaves / (Σsaves + Σgoalsconceded)` only becomes a conventional save percentage if validated that these are shots saved and shot-based goals conceded **by that keeper during the same covered exposure**. Outfield players also have `goalsconceded`; the fixture's DNF goalkeeper has zero conceded while the club conceded goals. Own goals, partial appearances, replacements, and forfeits can break a shots-on-target interpretation. Initially label any such display a “reported saves / (saves + reported conceded) proxy,” or defer it. [S3]
3. **Never use saves / opponent shots as save percentage.** `shots` includes an unverified mix of on/off-target attempts; it is not a shots-faced-on-target denominator. Nor should club goals against automatically replace goalkeeper concessions for partial appearances.
4. **Subtype exploration:** show raw `ballDiveSaves`, `crossSaves`, `goodDirectionSaves`, `parrySaves`, `punchSaves`, `reflexSaves` counts. Do not stack them into a 100% chart or require their sum to equal `saves`: categories may overlap or describe different actions. The fixture has nonzero aggregate save-related values, but its lone explicit goalkeeper player example is all zero for these fields; it does not validate per-keeper subtype semantics. [S3]
5. **Unsupported:** goals prevented above expectation, post-shot xG, one-on-one save rate, cross-claim success rate, or distribution by target zone. Their necessary opportunities/shot-quality/location inputs are absent from inspected fields. [S2][S3]

### Event aggregates are an R&D lead, not a hidden play-by-play API

The reference calls `match_event_aggregate_*` `eventId:count` lists and explicitly says event IDs are undocumented. The fixture has nonempty `_1` values as well as `_0`; `_2`/`_3` are present but empty in the examples. Preserve **all four** slots, including raw text. Team aggregate slots are numeric zero in the fixture, unlike player strings. [S2][S3]

Possible exploratory storage: `(player_match_key, slot, event_id_as_string, count, raw_token, parser_version)`. Validate syntax, retain malformed tokens, and avoid assuming slots are halves, periods, or distinct event taxonomies. If an ID occurs more than once/across slots, preserve that fact before deciding whether counts should be added.

Do not guess that an ID means a key pass, interception, sprint, possession, or shot merely because its count correlates with a known field. A defensible mapping requires a reproducible first-party source or controlled gameplay/video comparisons across repeated matches, roles, modes, and game versions. Even a verified dictionary would yield **counts**, not action ordering, locations, timestamps, or actor-to-recipient edges. Such decoding could unlock additional count metrics later, but not tracking analytics by itself.

### Per-90 is gated by clock semantics

The fixture has a completed-match player with `secondsPlayed="5480"`, `gameTime="5480"`, and `realtimegame="1020"`; a friendly player has `secondsPlayed="685"` but `realtimegame="32569"`. These literal examples demonstrate that the counters cannot safely be treated as interchangeable wall-clock seconds. Their values do not establish a universal conversion ratio. [S3]

- Prefer per-appearance rates initially.
- Only after validating that `secondsPlayed` is comparable simulated football exposure use `per90 = 5400 × Σevents / Σvalidated_secondsPlayed`. Numerator and exposure must cover exactly the same eligible rows, with positive exposure.
- If the field is wall-clock time instead, this formula would measure events per 90 real minutes, not per football 90. Do not relabel it.
- Do not infer full-match participation, substitutions, or exact pitch overlap solely from a single time total. Do not use summed team player-seconds as team match duration.
- Validate full matches, extra time if observable, DNF, individual disconnects, GK/outfield roles, and friendlies separately. Record anomalous/missing clocks rather than silently clipping them.

## 5. Derived metrics with precise denominators

### Common eligibility contract

Every chart/metric should disclose **platform, club/player identity, match type, time window, number of unique matches or appearances, and DNF policy**. Let `M` be distinct eligible club matches; let `P` be eligible player-match rows for the selected player/role. Deduplicate before aggregation. For each metric, include only rows with valid numerator **and** denominator inputs, and report exclusions.

Use `null`/“not enough data” for a zero or unavailable denominator, not 0%. Treat a missing field differently from a reported zero. Across matches/players, compute ratios of summed counts, not the unweighted mean of percentages. Keep counts alongside every percentage. Never manufacture exact attempts from member summary percentages.

| Metric/product                            | Formula / exact denominator                                                                  | Qualifications                                                                                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Club win/draw/loss rate                   | Respective classified result count / number of classified matches in `M`                     | Unknown results excluded and counted separately; use friendly score fallback; include/exclude DNF explicitly.                                                                            |
| Unbeaten rate                             | `(wins + draws) / classified matches`                                                        | Window-defined; observed streaks can be left-censored by missing older history.                                                                                                          |
| Points per match                          | `(3 × wins + draws) / classified matches`                                                    | A **3–1–0 analytical convention**, not automatically EA's `points` or promotion progression. League-only by default.                                                                     |
| Scoring/conceding rate                    | `Σclubs.goals / valid score matches`; analogous for `goalsAgainst`                           | Keep score-pair availability consistent for goal difference.                                                                                                                             |
| Goal difference per match                 | `Σ(goals − goalsAgainst) / matches with both scores`                                         | Use club score fields, not aggregate player concessions.                                                                                                                                 |
| Team clean-sheet rate                     | Count of matches with valid `goalsAgainst=0` / matches with valid conceded score             | Separate awarded/DNF outcomes from completed-match defending.                                                                                                                            |
| Both-teams-score / failed-to-score        | Count of matches satisfying score condition / matches with required valid scores             | Describe outcomes, not chance creation quality.                                                                                                                                          |
| Player goals, assists, G+A per appearance | Sum of relevant counts / eligible observed appearances in `P`                                | Missing event fields excluded; role/mode filter; not per90.                                                                                                                              |
| Player scoring involvement                | `Σ(goals + assists) / Σclub goals in the same eligible appearances`                          | Requires valid player and club values and positive club goals; not “all-time goal share.” Multiple player involvements can refer to the same goal; summed squad shares need not be 100%. |
| Passing completion                        | `Σpassesmade / Σpassattempts`                                                                | Both inputs required per included row; show attempts. Team version uses one consistently validated aggregate/summed-player source.                                                       |
| Unsuccessful pass attempts                | `Σ(passattempts − passesmade)`; per appearance divide by eligible appearances                | “Unsuccessful passes,” not all turnovers; flag made > attempts.                                                                                                                          |
| Passing workload                          | `Σpassattempts / eligible appearances`                                                       | Completion alone can reward tiny/safe passing samples; pair rate and volume.                                                                                                             |
| Tackle success                            | `Σtacklesmade / Σtackleattempts`                                                             | Not defensive win rate, duel success, pressing efficiency, or tackling impact.                                                                                                           |
| Unsuccessful tackle attempts              | `Σ(tackleattempts − tacklesmade)`                                                            | Not automatically “times dribbled past,” errors, or goals caused.                                                                                                                        |
| Tackle workload                           | `Σtackleattempts / eligible appearances`; similarly tackles made                             | Separate volume from success; defensive role and opponent exposure affect both.                                                                                                          |
| Shot conversion                           | `Σgoals / Σshots` over rows with both fields                                                 | Call “goals per reported shot,” not shot accuracy. Investigate goals > shots, own goals, DNF/awarded scores, and mode anomalies.                                                         |
| Shots per appearance                      | `Σshots / eligible appearances`                                                              | Shooting volume, not chance quality.                                                                                                                                                     |
| Shots per goal                            | `Σshots / Σgoals`                                                                            | Undefined if zero goals; same shot/goal input cohort as conversion.                                                                                                                      |
| Team shot share                           | Team reported shots / (team + opponent reported shots) in matched eligible records           | Positive paired denominator; require consistent aggregate coverage. Not possession share or xG share.                                                                                    |
| Mean/median rating, consistency           | Mean/median of valid player `rating`; SD/IQR over those same ratings                         | Show number of rated appearances. Prefer role-adjusted comparisons; do not average aggregate rating sums.                                                                                |
| MOM award rate                            | Count of valid awarded appearances / appearances with interpretable `mom`                    | Verify Boolean/counter semantics; distinguish awards from incomplete rows.                                                                                                               |
| Red-card rate                             | Sum of reported red cards / appearances with valid card count                                | Can display per 100 appearances; not a foul/yellow-card rate.                                                                                                                            |
| GK saves per appearance                   | `Σsaves / eligible GK appearances with saves available`                                      | GK-only cohort; display workload and sample size.                                                                                                                                        |
| GK reported clean-sheet rate              | Count/sum of verified `cleansheetsgk` awards / eligible GK appearances with the field        | Validate flag semantics; member `cleanSheetsGK / gamesPlayed` is not a GK-only rate when the player also plays outfield.                                                                 |
| Conditional GK save proxy                 | `Σsaves / (Σsaves + Σgoalsconceded)` on the same eligible GK rows                            | Semantic gate described above; not a verified shots-on-target denominator.                                                                                                               |
| Attendance / participation share          | Player's observed appearances / observed club matches with sufficiently complete roster data | Not real-world availability or attendance at all games; absent data is not absence from a match.                                                                                         |
| Lineup / pair record                      | W/D/L, score rates, passing etc. in distinct matches where all selected IDs appear           | Denominator is joint-match count, not summed player appearances. “Co-appeared,” not proven minutes together or pass combinations.                                                        |
| With/without contrast                     | Difference between same-scope team metric with player present and absent                     | Report both sample sizes and coverage; association, not causal player impact.                                                                                                            |
| Role/archetype splits                     | Apply the same metric within observed `pos` or raw `archetypeid` group                       | Use match role rather than current favorite position; raw archetype IDs remain unlabeled until mapped.                                                                                   |
| Head-to-head                              | Team outcomes/score/action metrics restricted to opponent club ID                            | Same opponent identity scope; not opponent name matching.                                                                                                                                |

These formulas are derived from verified inputs [S2][S3][S5], not new upstream statistics. Snapshot-only member views can additionally calculate goals/assists/MOM per reported `gamesPlayed` within that snapshot's stated scope. Their precomputed rates/ratings should be labeled “EA-reported” rather than reverse-engineered into exact event counts.

### More advanced analysis that becomes possible after collection

- **Rolling form:** last-N eligible matches and date windows for ratings, production, conversion, passing, defending, and GK volume. Show sample counts and collection coverage; overlapping rolling windows are correlated.
- **Session recap:** group matches by a documented product-defined time-gap rule; summarize results, involvement, trends and roster. This source has no session ID, so allow corrections and avoid treating the grouping as an EA fact.
- **Style fingerprints:** role-conditioned percentiles/scatterplots for passing volume vs completion, shot volume vs conversion, tackling volume vs success, and assists vs goals. Label the comparison population “tracked players,” not the global player base.
- **Opponent context:** opponent IDs enable rematch scouting and descriptive head-to-head trends. Capture opponent rating/division snapshots near match time; today's opponent strength is not historical prematch strength. Global strength-of-schedule claims require substantially broader, time-aligned data.
- **Lineup research:** lineup size, observed role balance, pair co-appearance matrix, and team results with/without players. Start with descriptive counts. Opponents, role changes, session selection, DNF, and regular playing groups confound comparisons.
- **Adjusted ratings later:** a regularized team-outcome model could use observed lineups and opponent context, with out-of-time evaluation and uncertainty. This is a model of associations, not measured tactical contribution; tiny and collinear lineups can make individual coefficients unidentified.
- **Milestones and progression:** archive score/event totals and snapshot skill rating, division, pro overall, and club/member counters. Use cumulative match totals for “since tracking began” milestones; source snapshots for their separately labeled season/career scopes.
- **Snapshot deltas:** monotonic counters can provide changes between observations if identity and scope match and no reset/correction occurred. They cannot reveal exact missing matches. Do not difference rounded percentages or `ratingAve` to obtain exact interval performance.

## 6. Identity and join stability

**Match-player history has an ID; member summaries do not expose that same ID.** This is the most consequential join limitation. Member fixtures have `name` and profile fields, while match players are keyed by `playerId` and have `playername` and `namespace`. The repository contains no verified mapping endpoint or documented stable cross-platform identity contract. [S1][S3][S5][S6]

Recommended model:

- Club external identity: `(provider/game-era, platform, clubId_as_string)`. Store time-varying names as observations. `teamId`, `TEAM`, stadium, kit IDs and club names are not identity keys.
- Match external identity: candidate `(provider/game-era, platform, matchId_as_string)`. Validate consistency across duplicate retrievals. Store requested mode separately; do not count the same match twice because both clubs or multiple queries returned it. Quarantine conflicting IDs/payloads rather than assuming global uniqueness forever.
- Player external identity: retain `(platform, playerId_as_string)` **and raw `namespace`** plus game-era provenance. Neither ignoring namespace nor declaring it a stable ID component is proven correct. If a player ID appears with conflicting namespaces, preserve observations and investigate before merging or splitting identities.
- Player-match fact: match key + club ID + player ID (and namespace observation). Store the exact observed name/role and never group history primarily by display name.
- Member snapshots: store raw row with snapshot identity; name-based matching to match-player identities is a **candidate association**, with confidence and evidence, not a foreign-key guarantee. Same name, changed name, duplicate names, different platforms, and `proName` vs gamertag are all reasons to avoid an automatic irreversible merge.
- A rename should not erase old aliases; an ambiguous member row should remain unresolved. Do not infer identity from `proPos`, height, or current archetype.

### Membership survivorship

The endpoints describe club members, but the inspected sources do not establish retention rules for departed members, returning members, or guests. A current member list cannot be assumed to enumerate every historical contributor. [S2][S5][S6]

Persist roster snapshots and historical player-match facts independently. “First/last observed” membership is different from join/leave time. Never delete past performances because a member disappears. Do not sum only today's members to reconstruct the club's historical totals: leavers, guests, missing rows, different modes, and scopes can all break reconciliation. Avoid comparing a current-roster survivor cohort with all historical team matches without stating that selection.

## 7. Data to collect and persist

### Minimum durable acquisition

| Dataset                       | Persist                                                                                                                                                   | Enables                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Raw fetch envelope            | Endpoint, parameters including requested mode/count/platform, UTC fetch time, HTTP outcome/error, raw body/hash, parser/schema version, provider/game-era | Reprocessing, schema changes, provenance, distinguishing empty data from failed fetches |
| Complete raw match            | Match envelope plus both clubs, all provided players, aggregate objects, raw codes and event-count strings                                                | Nearly all deeper match analytics; future decoding without refetching expired history   |
| Normalized club-match facts   | IDs, original timestamp, raw/requested match types, score, result flags/codes, per-side DNF award, raw season value                                       | Results, sessions, head-to-head and mode-aware filters                                  |
| Normalized player-match facts | IDs/namespace/name/role/archetype, all action counts, GK fields, ratings, awards, time counters                                                           | Player/role trends and exact attempt-weighted rates                                     |
| Separate aggregate facts      | Every raw aggregate field; never overwrite with player sums                                                                                               | Team/opponent action comparisons and reconciliation                                     |
| Member and career snapshots   | Full wrapper including `positionCount`, all raw member fields, UTC observation time, identity-candidate metadata                                          | Season/career cards, roster observations, build progression, reset detection            |
| Club snapshots                | `clubs/info`, `clubs/overallStats`, and relevant search result, timestamped and source-separated                                                          | Branding, skill/division/streak changes, cumulative records, milestone context          |
| Coverage/quality ledger       | Successful/failed polls, response count, requested count, overlap with previous window, oldest/newest timestamps, missing fields, conflicts               | Honest history completeness indicators and bounded conclusions                          |
| Semantic configuration        | Confirmed field interpretations, versioned result maps, season assignments, thresholds and exclusion policy                                               | Reproducible metrics as understanding evolves                                           |

### Ingestion strategy and practical limits

1. Fetch each supported match type separately. Store a single complete response and derive all views from it. Fetch/persist both sides from that payload; no need for a second opponent match request merely to access the included opponent rows. [S1][S2]
2. Use idempotent upserts plus raw observation history. Responses may repeat or be revised; deduplicate by verified match identity and retain changes rather than overwriting evidence silently.
3. Determine the effective recent-window size empirically with an authorized real club. The code forwards `count` without enforcing/documenting a maximum; do **not** claim a hard 10, 20, or 100-match server limit. A request for more records may be capped or ignored. [S1][S2]
4. Poll frequently enough for the club's match volume to maintain window overlap, with bounded backoff and shared caching. If more matches occur between polls than the retrievable window, some may be irrecoverable. No-overlap or full-window responses are gap-risk indicators, not precise counts of missing games.
5. Recheck the recent window for delayed finalization/corrections; do not assume the first observation is final. Persist UTC source time and fetch time separately; timezone is a presentation choice.
6. Snapshot slower-changing club/member data on a separately chosen cadence. Capture opponent context near the match when feasible; respect request budgets instead of recursively crawling every opponent.
7. Preserve source errors and last-success freshness. Empty playoffs, JSON null, access denial, schema failure, and “no new match” are different operational states even if the wrapper sometimes normalizes them. [S1][S2]
8. Use a background collector rather than coupling durable history acquisition to someone opening the dashboard. Product claims should read “recorded matches since [date]” unless completeness has actually been established.

Neither an API key nor copying the Python wrapper creates an availability guarantee. Browser-header workarounds and README statements about Python vs curl reflect reported observations, not a permanent service contract. [S1][S2][S4]

## 8. Unsupported or conditional tracking claims

| Desired feature                                                     | Evidence-based assessment                                                                                                                                                                          |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| True xG, xA, shot-quality maps, post-shot xG                        | Unsupported: no documented per-shot location/context/outcome record. Goals/shots alone cannot recover chance quality. A prediction based only on totals must be named as a separate model, not xG. |
| Heatmaps, average positions, movement, distance, sprint speed       | Unsupported: no time-stamped coordinates or movement trace. Broad `pos` and archetype are insufficient.                                                                                            |
| Pass networks, progressive passes, key passes, passing into zones   | Unsupported from named fields: no recipient, start/end location, or documented action type dictionary.                                                                                             |
| Possession %, field tilt, territory, PPDA, pressure success         | Unsupported: attempts do not measure possession time/zone or opposition passes in relevant pressing areas; pressures absent.                                                                       |
| Event timeline, goal times, score-state performance, substitutions  | Unsupported: a match timestamp and action totals do not recover ordering or on-pitch intervals.                                                                                                    |
| First-half vs second-half, comeback sequences, late-goal tendencies | Unsupported: no verified period/event clock. Event aggregate slots are not documented as halves.                                                                                                   |
| Formation-specific tactics and exact positions                      | Broad `pos` categories available; no verified formation or detailed role lookup in inspected schema. `favoritePosition` is not a match lineup position.                                            |
| Complete all-time per-match histories                               | Not established: recent response plus no verified pagination/backfill endpoint. Career totals are not historical match rows.                                                                       |
| Global rankings / percentiles                                       | Only against our explicitly defined collected cohort; name search is not verified global enumeration.                                                                                              |
| Playoff trophies/achievement breakdown                              | Deferred: endpoint exists, populated schema unknown.                                                                                                                                               |
| Fouls, yellow cards, interceptions, dribbles, aerial duels          | Not present as named fields in the inspected match schema. Opaque event IDs are a research possibility, not verified support.                                                                      |
| Accurate per90 / GK save percentage / decoded event metrics         | Conditional on the semantic validation gates described above.                                                                                                                                      |

Scope of these negative claims: **the inspected repository and payloads**, not proof that EA has no other private or future endpoint. [S1][S2][S3]

## 9. Highest-impact product roadmap

### Priority 0 — Preserve history and trust

**Deliver:** raw-match archive, stable external-ID handling, both-side ingestion, member/club snapshots, source/mode/date filters, DNF distinction, freshness and coverage display.

**Why first:** lost recent matches may be impossible to recover. Every later longitudinal feature depends on history and correct joins. Success means repeat fetches do not double-count, unknown fields remain recoverable, failures do not become zeros, and historical players survive roster changes.

### Priority 1 — Rich match center and player form

**Deliver:** team/opponent comparison; exact passing/tackling rates with attempts; goals/shots conversion; rating and award trends; output per appearance; role filters; score-derived team clean sheets; full/partial/DNF context where verified.

**Why high impact:** understandable improvements using explicit fields, little speculative modeling, and clear actionable contrasts between efficiency and volume. Use the archive's actual window rather than labeling a recent sample “season.”

### Priority 2 — Specialist and club-progression dashboards

**Deliver:** goalkeeper saves/workload and reported clean-sheet trends; raw save-category exploration; skill/division/pro-overall snapshot history; career-at-club versus current-season cards; milestones; session recaps.

**Gates:** stable member-to-player linking where needed; clear snapshot scope; no stacked GK category assumptions; per90/save percentage only after clock/concession validation.

### Priority 3 — Team chemistry and scouting

**Deliver:** co-appearance matrix, lineup/pair sample counts and records, role balance, descriptive with/without comparisons, opponent head-to-head and time-aligned context.

**Gates:** sufficient complete rosters, repeated observations, minimum group sizes, mode/opponent/session confounding disclosure. Label these associations; avoid definitive “best player” or optimal-lineup claims from sparse data.

### Priority 4 — Advanced models and event decoding research

**Deliver only when supported:** role/cohort-adjusted benchmarks, uncertainty-aware form alerts, shrinkage estimates, regularized lineup models, and controlled experiments on opaque event IDs.

**Gates:** substantial longitudinal data, documented definitions, held-out evaluation, stable joins, and versioned mappings. Do not postpone the earlier roadmap waiting for undocumented event decoding, and do not promise tracking/xG features from count data.

## 10. Statistical and presentation guardrails

- **Expose the denominator.** “Completed / attempted passes” is more informative than a standalone rate. Show appearances, shots, tackle attempts, and GK exposure next to rankings.
- **Small samples:** publish configurable minimum appearances and action attempts, not a universal magic cutoff. Prefer intervals and shrinkage toward role/cohort averages for noisy rates. A perfect conversion rate on a tiny shot sample is not strong evidence of superior finishing.
- **Dependence:** actions within a match and matches within a session are correlated. Naive binomial intervals can understate uncertainty; for serious comparisons consider match/session-clustered bootstrap intervals. Do not treat teammates' shared wins as independent outcomes.
- **Selection:** current members are survivors; observed opponents and tracked clubs are not a random global sample. Make cohort selection visible.
- **Role effects:** outfield/GK, forward/defender, archetype, opponent, DNF, game mode and playing group change opportunity. Raw cross-role leaderboards and within-role comparisons answer different questions.
- **Missingness:** missing player rows or failed polls are not zero contribution or absence. Avoid making a player look better/worse because one source omitted their bad/good games.
- **Multiple comparisons:** extensive slicing will produce apparently impressive pairs and streaks by chance. Surface counts/uncertainty and validate patterns on later matches.
- **Ratings:** EA's rating construction is opaque here. A decimal does not establish equal difficulty across roles or that tiny mean differences are meaningful.
- **Source consistency:** do not force sums to reconcile by inventing missing player events, interpreting AI behavior from trimmed fixtures, or replacing missing fields with zero.
- **Scope labels:** distinguish “EA-reported season,” “career at this club,” “all-time league search,” “overall snapshot,” and “our recorded match window.” Never imply that snapshot values describe the exact same match cohort without validation.

## 11. Validation backlog before stronger claims

1. Capture full, consented/live examples for completed league, friendly, DNF, human GK, role-switching players, and playoffs if available. Compare displayed in-game stats with raw payloads.
2. Measure effective history limits, whether larger counts change returned unique matches, update latency, and recent-record revision behavior. Do not invent pagination parameters.
3. Confirm player-ID/namespace behavior across repeated matches, renames, platforms and club moves; assess name-based member linkage ambiguity.
4. Determine member/overall reset boundaries, actual mode coverage, departed-member retention, and whether `season_id` ever provides meaningful season identity.
5. Reconcile club score, player actions and aggregate actions on untrimmed responses; assess AI/ANY inclusion and DNF effects independently.
6. Verify goals/assists/shots accounting, passing/tackling count definitions, clean-sheet award eligibility, and result codes for every supported mode.
7. Validate goalkeeper concession exposure, save subtypes and overlap before displaying conventional save percentages or category proportions.
8. Validate clocks with observed gameplay duration and in-game time before per90; do not infer substitutions from counter differences alone.
9. If researching event IDs, preserve source/version and controlled evidence for each mapping. Keep undecoded IDs opaque.

## Primary-source citations

All links below are pinned to the inspected repository snapshot. These are primary sources for **the client's implementation and recorded observations**, not official EA semantic documentation.

- **[S1]** [`fc27_api.py`](https://github.com/1erkandogan/fc27-clubs-api/blob/9fb7980940bbc4dc4afc9b44101001f790eba06b/fc27_api.py): endpoints/parameters, column projections, both-team handling, player IDs, numeric conversion, result derivation, separate fetches, time conversion and errors.
- **[S2]** [`docs/endpoints.md`](https://github.com/1erkandogan/fc27-clubs-api/blob/9fb7980940bbc4dc4afc9b44101001f790eba06b/docs/endpoints.md): observation date, placeholder caveats, raw endpoint shapes, scopes, result codes, unknown event IDs, unknown playoff schema and parameter limitations.
- **[S3]** [`tests/fixtures/matches.json`](https://github.com/1erkandogan/fc27-clubs-api/blob/9fb7980940bbc4dc4afc9b44101001f790eba06b/tests/fixtures/matches.json): actual inspected match/player/aggregate field names and values, GK subtypes, clocks, raw event strings and source discrepancies.
- **[S4]** [`README.md`](https://github.com/1erkandogan/fc27-clubs-api/blob/9fb7980940bbc4dc4afc9b44101001f790eba06b/README.md): unofficial status, public client usage, default recent-match count, no cache/rate limiter and anonymized offline fixtures.
- **[S5]** [`tests/fixtures/members.json`](https://github.com/1erkandogan/fc27-clubs-api/blob/9fb7980940bbc4dc4afc9b44101001f790eba06b/tests/fixtures/members.json): member summary, profile, prior-goal fields and position counts; no player ID in inspected member records.
- **[S6]** [`tests/fixtures/career.json`](https://github.com/1erkandogan/fc27-clubs-api/blob/9fb7980940bbc4dc4afc9b44101001f790eba06b/tests/fixtures/career.json): narrower career-at-club member schema.
- **[S7]** [`tests/fixtures/overall.json`](https://github.com/1erkandogan/fc27-clubs-api/blob/9fb7980940bbc4dc4afc9b44101001f790eba06b/tests/fixtures/overall.json): overall fields, nullable division, finish counters, last-match/opponent slots and league/playoff counters.
- **[S8]** [`tests/fixtures/search.json`](https://github.com/1erkandogan/fc27-clubs-api/blob/9fb7980940bbc4dc4afc9b44101001f790eba06b/tests/fixtures/search.json): search record, divisions, points, clean sheets, nested club identity.
- **[S9]** [`tests/test_fc27_api.py`](https://github.com/1erkandogan/fc27-clubs-api/blob/9fb7980940bbc4dc4afc9b44101001f790eba06b/tests/test_fc27_api.py): offline mocks, explicitly trimmed match fixture, default-count test, result handling and null/empty behavior.
- **[S10]** [`tests/fixtures/info.json`](https://github.com/1erkandogan/fc27-clubs-api/blob/9fb7980940bbc4dc4afc9b44101001f790eba06b/tests/fixtures/info.json): club identity, stadium and kit fields, including kit-related seasonal IDs.
- **[S11]** [`CONTRIBUTING.md`](https://github.com/1erkandogan/fc27-clubs-api/blob/9fb7980940bbc4dc4afc9b44101001f790eba06b/CONTRIBUTING.md): intentional fixture anonymization and distinction between offline tests and live API behavior.
