"use client";

import { useMemo, useState, type ReactNode } from "react";
import { analyzePlayer } from "@/lib/analytics";
import type { HistoryData } from "@/lib/history-types";
import type { CareerMember, ClubOverall, Match, Member } from "@/lib/stats";

const views = ["Performance", "Trends", "Sessions", "Squad chemistry"] as const;
type View = (typeof views)[number];
function number(value: number | null | undefined, digits = 1) {
  return value == null
    ? "-"
    : value.toLocaleString("en-GB", { maximumFractionDigits: digits });
}
function date(value: string | number) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}
function ScrollTable({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={`${label}, scroll horizontally for more stats`}
      className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
    >
      <table className="w-full text-sm whitespace-nowrap">{children}</table>
    </div>
  );
}
function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
      {detail && <dd className="mt-1 text-xs text-muted">{detail}</dd>}
    </div>
  );
}

export function AnalyticsDashboard({
  matches,
  member,
  history,
  overall,
  careerMembers,
  demo = false,
}: {
  matches: Match[];
  member: Member;
  history: HistoryData | undefined;
  overall?: ClubOverall | null;
  careerMembers?: CareerMember[];
  demo?: boolean;
}) {
  const [view, setView] = useState<View>("Performance");
  const analysis = useMemo(
    () => analyzePlayer(matches, member.name),
    [matches, member.name],
  );
  const career = useMemo(() => {
    const candidates =
      careerMembers?.filter(
        (player) => player.name.toLowerCase() === member.name.toLowerCase(),
      ) ?? [];
    return candidates.length === 1 ? candidates[0] : undefined;
  }, [careerMembers, member.name]);
  const teammates = useMemo(
    () =>
      analysis.teammates
        .filter((player) => player.appearances >= 3)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [analysis.teammates],
  );
  const appearances = analysis.appearances;
  const { summary, trend, consistency } = analysis;
  const coverage = (key: string) =>
    analysis.summaryCoverage?.[key] == null
      ? `Coverage unavailable · ${appearances} associated appearances`
      : `${analysis.summaryCoverage[key]} / ${appearances} appearances reported`;
  const groups = [
    {
      title: "Attack",
      metrics: [
        ["Goals", "goals", false],
        ["Assists", "assists", false],
        ["Shots", "shots", false],
        ["Shot conversion", "conversion", true],
      ],
    },
    {
      title: "Passing",
      metrics: [
        ["Completed", "passesMade", false],
        ["Attempted", "passAttempts", false],
        ["Pass accuracy", "passAccuracy", true],
      ],
    },
    {
      title: "Defending",
      metrics: [
        ["Tackles won", "tacklesMade", false],
        ["Attempted", "tackleAttempts", false],
        ["Tackle success", "tackleAccuracy", true],
        ["Red cards", "redCards", false],
      ],
    },
    {
      title: "Goalkeeping / clean sheets",
      metrics: [
        ["Saves", "saves", false],
        ["Clean sheets", "cleanSheets", false],
      ],
    },
  ] as const;

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold">Player analytics</h2>
        <p className="mt-2 text-sm text-muted">
          {member.name} · {appearances} associated appearances across{" "}
          {matches.length} loaded matches in the selected competition. Gamertag
          association is provisional.
        </p>
      </header>
      <section
        className="panel px-4 py-3 text-sm"
        aria-label="History tracking status"
      >
        <p className="font-medium">
          {demo
            ? "Illustrative demo history"
            : !history
              ? "History status unavailable"
              : history.status === "ready"
                ? "History tracking ready"
                : history.status === "disabled"
                  ? "History tracking disabled · recent feed only"
                  : "History unavailable · showing available matches"}
        </p>
        <p className="mt-1 text-xs text-muted">
          {demo
            ? "Sample matches demonstrate analytics; they are not stored club history. "
            : history?.trackingStartedAt
              ? `Tracking started ${date(history.trackingStartedAt)} UTC. `
              : "No tracking start recorded. "}
          History is bounded to 200 loaded matches; it is not a complete season
          archive.
          {history?.hasMore &&
            " More stored matches exist outside this window."}
          {history?.lastSyncedAt &&
            ` Last synced ${date(history.lastSyncedAt)} UTC.`}
        </p>
        {history?.warning && (
          <p className="mt-2 text-xs text-amber-300">{history.warning}</p>
        )}
      </section>
      {appearances < 10 && (
        <p className="text-sm text-amber-300">
          Small sample · {appearances} appearances. Treat patterns as
          provisional, especially with fewer than 5 reported values.
        </p>
      )}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Analytics views"
      >
        {views.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={view === item}
            onClick={() => setView(item)}
            className={view === item ? "btn-primary" : "btn-secondary"}
          >
            {item}
          </button>
        ))}
      </div>
      {!appearances && (
        <p className="panel p-5 text-sm text-muted">
          No unique player associations in the loaded matches. Try another
          competition or player; missing statistics are shown as -.
        </p>
      )}

      {view === "Performance" && (
        <div className="space-y-5">
          <section className="panel p-5">
            <h3 className="mb-4 font-semibold">Loaded-match overview</h3>
            <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <Stat
                label="Mean rating"
                value={number(summary.rating, 2)}
                detail={coverage("rating")}
              />
              <Stat
                label="Player of the match"
                value={number(summary.motm, 0)}
                detail={coverage("motm")}
              />
              <Stat
                label="Appearances"
                value={appearances}
                detail={`${matches.length} club matches loaded`}
              />
              <Stat
                label="Rated appearances"
                value={consistency.ratedAppearances}
                detail={`${appearances} associated appearances`}
              />
            </dl>
          </section>
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((group) => (
              <section className="panel p-5" key={group.title}>
                <h3 className="mb-4 font-semibold">{group.title}</h3>
                <dl className="grid grid-cols-2 gap-5">
                  {group.metrics.map(([label, key, percentage]) => (
                    <Stat
                      key={key}
                      label={label}
                      value={`${number(summary[key], percentage ? 1 : 0)}${percentage && summary[key] != null ? "%" : ""}`}
                      detail={
                        percentage && key in analysis.ratios
                          ? `${number(analysis.ratios[key as keyof typeof analysis.ratios].numerator, 0)} / ${number(analysis.ratios[key as keyof typeof analysis.ratios].denominator, 0)} attempts · ${coverage(key)}`
                          : coverage(key)
                      }
                    />
                  ))}
                </dl>
              </section>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Totals include reported values only. Accuracy and conversion use
            paired reported numerators / attempts; zero attempts have no
            percentage. Coverage can differ by metric. Clean sheets are reported
            player clean sheets, including defensive roles; they do not measure
            individual responsibility.
          </p>
          {(career || overall) && (
            <details className="panel p-5">
              <summary className="cursor-pointer font-semibold">
                Career & club totals{" "}
                <span className="text-xs font-normal text-muted">
                  · separate API scope
                </span>
              </summary>
              <p className="mt-3 text-xs text-muted">
                These endpoint totals are separate from the selected
                competition’s loaded-match window. They are not used in the
                analytics above. Career association uses the same provisional
                gamertag match.
              </p>
              {career && (
                <section className="mt-5">
                  <h3 className="mb-3 text-sm font-semibold">
                    Player career at this club · {career.name}
                  </h3>
                  <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                    {(
                      [
                        ["Games", career.games],
                        ["Goals", career.goals],
                        ["Assists", career.assists],
                        ["Rating", career.rating],
                        ["MOTM", career.motm],
                      ] as const
                    ).map(([label, value]) => (
                      <Stat key={label} label={label} value={number(value)} />
                    ))}
                  </dl>
                </section>
              )}
              {overall && (
                <section className="mt-5 border-t border-line pt-5">
                  <h3 className="mb-3 text-sm font-semibold">
                    Club overall · all players
                  </h3>
                  <p className="mb-4 text-xs text-muted">
                    EA’s overall endpoint has no verified season/reset or
                    competition scope.
                  </p>
                  <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                    {(
                      [
                        ["Games", overall.games],
                        ["Wins", overall.wins],
                        ["Draws", overall.draws],
                        ["Losses", overall.losses],
                        ["Goals", overall.goals],
                        ["Conceded", overall.conceded],
                        ["Skill rating", overall.skillRating],
                        ["Win streak", overall.winStreak],
                        ["Unbeaten streak", overall.unbeatenStreak],
                      ] as const
                    ).map(([label, value]) => (
                      <Stat
                        key={label}
                        label={label}
                        value={number(value, 0)}
                      />
                    ))}
                  </dl>
                </section>
              )}
            </details>
          )}
        </div>
      )}

      {view === "Trends" && (
        <div className="space-y-5">
          <section className="panel p-5">
            <h3 className="font-semibold">
              Recent 5 vs previous 5 appearances
            </h3>
            <p className="mt-2 text-xs text-muted">
              Mean reported ratings in consecutive appearance windows, latest
              first. Missing ratings are excluded.
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3">
              <Stat
                label="Recent mean"
                value={number(trend.recentRating, 2)}
                detail={`${trend.recentRatedCount} rated / ${trend.recentCount} recent appearances`}
              />
              <Stat
                label="Previous mean"
                value={number(trend.previousRating, 2)}
                detail={`${trend.previousRatedCount} rated / ${trend.previousCount} previous appearances`}
              />
              <Stat
                label="Rating change"
                detail="Requires at least 3 rated appearances in each window"
                value={
                  trend.ratingDelta == null
                    ? "-"
                    : `${trend.ratingDelta > 0 ? "+" : ""}${number(trend.ratingDelta, 2)}`
                }
              />
            </dl>
            {trend.recentRating != null && trend.previousRating != null && (
              <div className="mt-5 space-y-3">
                {[
                  { label: "Recent", value: trend.recentRating },
                  { label: "Previous", value: trend.previousRating },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 text-xs"
                  >
                    <span className="w-16 text-muted">{item.label}</span>
                    <div
                      role="meter"
                      aria-label={`${item.label} mean rating`}
                      aria-valuemin={0}
                      aria-valuemax={10}
                      aria-valuenow={item.value}
                      className="h-2 flex-1 overflow-hidden rounded-full bg-raised"
                    >
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{
                          width: `${Math.max(0, Math.min(10, item.value)) * 10}%`,
                        }}
                      />
                    </div>
                    <span className="w-12 text-right tabular-nums">
                      {number(item.value, 2)} / 10
                    </span>
                  </div>
                ))}
              </div>
            )}
            {(trend.recentCount < 5 || trend.previousCount < 5) && (
              <p className="mt-4 text-xs text-amber-300">
                Incomplete comparison windows · a few matches can shift the
                averages substantially.
              </p>
            )}
          </section>
          <section className="panel p-5">
            <h3 className="mb-4 font-semibold">Rating consistency</h3>
            <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
              <Stat
                label="Median rating"
                value={number(consistency.medianRating, 2)}
              />
              <Stat
                label="Standard deviation"
                value={number(consistency.ratingStdDev, 2)}
              />
              <Stat
                label="Rated sample"
                value={`${consistency.ratedAppearances} / ${appearances}`}
              />
            </dl>
            <p className="mt-4 text-xs text-muted">
              Lower standard deviation means ratings varied less; it does not
              imply better performance. Roles, opposition and small samples
              affect these values.
            </p>
          </section>
          <section className="panel overflow-hidden">
            <h3 className="p-5 font-semibold">Reported role breakdown</h3>
            <ScrollTable label="Role breakdown">
              <thead>
                <tr>
                  {[
                    "Role",
                    "Appearances",
                    "Mean rating",
                    "Goals",
                    "Assists",
                  ].map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analysis.positions.map((position) => (
                  <tr key={position.role}>
                    <th scope="row" className="text-left capitalize">
                      {position.role}
                    </th>
                    <td>
                      {position.appearances} / {appearances}
                    </td>
                    <td>{number(position.rating, 2)}</td>
                    <td>{number(position.goals, 0)}</td>
                    <td>{number(position.assists, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </ScrollTable>
            {!analysis.positions.length && (
              <p className="p-5 text-sm text-muted">
                No role breakdown available.
              </p>
            )}
            <p className="p-5 text-xs text-muted">
              Roles are match-reported. Unknown roles are not inferred from a
              favourite position. Rating coverage may vary within each role.
            </p>
          </section>
        </div>
      )}

      {view === "Sessions" && (
        <section className="panel overflow-hidden">
          <div className="p-5">
            <h3 className="font-semibold">Session reports</h3>
            <p className="mt-2 text-xs text-muted">
              Appearances grouped by gaps of at most 90 minutes, not official
              session IDs · times UTC. Session boundaries can be incomplete when
              history is limited. W / D / L includes known outcomes only.
            </p>
          </div>
          <ScrollTable label="Session reports">
            <thead>
              <tr>
                {[
                  "Started",
                  "Ended",
                  "Appearances",
                  "W / D / L",
                  "Mean rating",
                  "Goals",
                  "Assists",
                ].map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analysis.sessions.map((session, index) => (
                <tr key={`${session.startedAt}-${index}`}>
                  <th scope="row" className="text-left">
                    {date(session.startedAt)}
                  </th>
                  <td>{date(session.endedAt)}</td>
                  <td>
                    {session.appearances}
                    {session.appearances < 5 && (
                      <span className="ml-2 text-xs text-amber-300">
                        Small sample
                      </span>
                    )}
                  </td>
                  <td>
                    {session.wins} / {session.draws} / {session.losses}
                  </td>
                  <td>{number(session.rating, 2)}</td>
                  <td>{number(session.goals, 0)}</td>
                  <td>{number(session.assists, 0)}</td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
          {!analysis.sessions.length && (
            <p className="p-5 text-sm text-muted">
              No associated sessions available.
            </p>
          )}
          <p className="p-5 text-xs text-muted">
            Statistics use reported values only; an appearance count is not a
            guarantee of complete stat coverage.
          </p>
        </section>
      )}

      {view === "Squad chemistry" && (
        <section className="panel overflow-hidden">
          <div className="p-5">
            <h3 className="font-semibold">Lineup associations</h3>
            <p className="mt-2 text-sm text-muted">
              At least 3 shared appearances · alphabetical order. These are
              associations, not a ranking of teammate impact.
            </p>
          </div>
          <ScrollTable label="Lineup associations">
            <thead>
              <tr>
                {[
                  "Teammate",
                  "Together",
                  "Wins / known results",
                  "Win rate",
                  "Your mean rating together",
                ].map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teammates.map((teammate) => (
                <tr key={teammate.id}>
                  <th
                    scope="row"
                    className="text-left tracking-normal normal-case"
                  >
                    {teammate.name || "Unnamed player"}
                  </th>
                  <td>
                    {teammate.appearances} / {appearances}
                    {teammate.appearances < 10 && (
                      <span className="ml-2 text-xs text-amber-300">
                        Small sample
                      </span>
                    )}
                  </td>
                  <td>
                    {teammate.wins} / {teammate.knownResults}
                  </td>
                  <td>
                    {number(teammate.winRate)}
                    {teammate.winRate != null && "%"}
                  </td>
                  <td>{number(teammate.ratingTogether, 2)}</td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
          {!teammates.length && (
            <p className="p-5 text-sm text-muted">
              No teammates have at least 3 shared appearances in this window.
            </p>
          )}
          <p className="p-5 text-xs leading-relaxed text-muted">
            Win rates use known results; missing results and ratings may reduce
            their denominators below shared appearances. Lineups overlap, and
            opposition, roles and tactics differ. These numbers cannot show who
            caused a result.
          </p>
        </section>
      )}
      <p className="text-xs text-muted">
        - = unavailable, not zero. Analytics describe only loaded, uniquely
        associated appearances; no minutes-normalised or expected-goals
        estimates.
      </p>
    </div>
  );
}
