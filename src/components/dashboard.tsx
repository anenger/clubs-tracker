"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LoaderCircle, RefreshCw, Search } from "lucide-react";
import { analyzePlayer } from "@/lib/analytics";
import { demo } from "@/lib/demo";
import { getClub, getHistory } from "@/lib/client-api";
import { matchPlayer, matchResult, type Club, type Match } from "@/lib/stats";
import {
  competitions,
  type HistoryData,
  type MatchType,
} from "@/lib/history-types";
import { mergeMatchHistory } from "@/lib/match-history";
import { useSelection } from "./use-selection";
import { ClubSearch } from "./club-search";
import { FootballMark } from "./football-mark";
import { MatchList } from "./matches";
import { MatchReport } from "./match-report";
import { Overview } from "./overview";
import { Squad } from "./squad";
import { Card, InfoTip, ResultChip, Segmented } from "./ui";

const tabs = ["Overview", "Matches", "Squad"] as const;
type Tab = (typeof tabs)[number];

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const [selection, saveSelection] = useSelection();
  const [tab, setTab] = useState<Tab>("Overview");
  const [searching, setSearching] = useState(false);
  const [competition, setCompetition] = useState<MatchType>("leagueMatch");
  const [report, setReport] = useState<Match | null>(null);
  const [visibleMatches, setVisibleMatches] = useState(20);
  const isDemo = selection.club.id === "demo";

  const query = useQuery({
    queryKey: ["club", "common-gen5", selection.club.id, competition],
    queryFn: async ({ signal }) => {
      const result = await getClub(selection.club.id, competition, signal);
      void queryClient.invalidateQueries({
        queryKey: ["club-history", selection.club.id, competition],
      });
      return result;
    },
    enabled: !isDemo,
    refetchInterval: 5 * 60_000,
  });
  const data = useMemo(
    () =>
      isDemo
        ? {
            ...demo,
            matches: demo.matches.filter(
              (m) => (m.competition ?? "leagueMatch") === competition,
            ),
          }
        : query.data,
    [isDemo, competition, query.data],
  );
  const historyQuery = useQuery({
    queryKey: ["club-history", selection.club.id, competition],
    queryFn: async ({ signal }) => {
      const result = await getHistory(selection.club.id, competition, signal);
      if (result.status === "error")
        throw new Error(result.warning || "Collected history is unavailable.");
      return result;
    },
    enabled: !isDemo && !!data,
  });
  const history: HistoryData | undefined = isDemo
    ? undefined
    : historyQuery.data;
  const matches = useMemo(
    () =>
      mergeMatchHistory(
        data?.matches ?? [],
        historyQuery.data?.matches ?? [],
        competition,
      ),
    [data?.matches, historyQuery.data?.matches, competition],
  );
  const member =
    data?.members.find((m) => m.name === selection.player) ??
    (isDemo ? data?.members[0] : undefined);
  const analysis = useMemo(
    () => analyzePlayer(matches, member?.name ?? ""),
    [matches, member?.name],
  );
  const career = useMemo(() => {
    const found =
      data?.careerMembers?.filter(
        (p) => p.name.toLowerCase() === member?.name.toLowerCase(),
      ) ?? [];
    return found.length === 1 ? found[0] : undefined;
  }, [data?.careerMembers, member?.name]);
  const form = member
    ? matches
        .filter((m) => matchPlayer(m, member.name))
        .slice(0, 5)
        .map(matchResult)
        .reverse()
    : [];
  const competitionLabel =
    competitions.find((c) => c.value === competition)?.label ?? "League";

  function selectClub(club: Club) {
    saveSelection({ club, player: "" });
    setSearching(false);
    setTab("Overview");
    setReport(null);
    setVisibleMatches(20);
  }
  function changeCompetition(value: MatchType) {
    setCompetition(value);
    setVisibleMatches(20);
    setReport(null);
  }
  function showTab(next: Tab) {
    setTab(next);
    window.scrollTo({ top: 0 });
  }

  const status = isDemo
    ? null
    : query.isFetching
      ? "Updating…"
      : data
        ? `Updated ${new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : null;
  const historyNote = history?.trackingStartedAt
    ? `${matches.length} ${competitionLabel.toLowerCase()} matches saved since ${shortDate(history.trackingStartedAt)}. EA only shares a club’s most recent matches, so older ones are kept here as the club is viewed.`
    : "EA only shares a club’s most recent matches. Touchline saves them as the club is viewed, so history builds up over time.";

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-accent focus:p-3 focus:text-black"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-page/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <FootballMark className="h-6 w-6 text-accent" />
            <span className="hidden sm:inline">touchline</span>
          </span>
          <span className="h-5 w-px bg-line" aria-hidden />
          <button
            type="button"
            onClick={() => setSearching(true)}
            className="flex min-h-9 min-w-0 items-center gap-1.5 rounded-lg px-2 text-sm font-medium hover:bg-raised"
            aria-label={`Club: ${selection.club.name}. Change club`}
          >
            <span className="truncate">{selection.club.name}</span>
            {isDemo && (
              <span className="rounded bg-raised px-1.5 py-0.5 text-[10px] font-bold text-muted">
                DEMO
              </span>
            )}
            <ChevronDown
              size={15}
              className="shrink-0 text-muted"
              aria-hidden
            />
          </button>
          <div className="ml-auto flex items-center gap-2">
            {status && (
              <span className="hidden items-center gap-1 text-xs text-muted sm:flex">
                {status}
                <InfoTip text={historyNote} />
              </span>
            )}
            {!isDemo && (
              <button
                type="button"
                className="btn-secondary h-9 min-h-9 w-9 px-0"
                aria-label="Refresh stats"
                disabled={query.isFetching}
                onClick={() => query.refetch()}
              >
                <RefreshCw
                  size={15}
                  className={query.isFetching ? "animate-spin" : ""}
                />
              </button>
            )}
            {isDemo && (
              <button
                type="button"
                className="btn-primary min-h-9 py-1.5"
                onClick={() => setSearching(true)}
              >
                <Search size={15} aria-hidden />
                <span className="whitespace-nowrap">
                  Find <span className="hidden sm:inline">my </span>club
                </span>
              </button>
            )}
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pb-2 sm:px-6">
          <nav aria-label="Sections" className="flex gap-1">
            {tabs.map((item) => (
              <button
                key={item}
                type="button"
                aria-current={tab === item ? "page" : undefined}
                onClick={() => showTab(item)}
                className={`min-h-9 rounded-lg px-3 text-sm font-medium ${tab === item ? "bg-raised text-zinc-100" : "text-muted hover:text-zinc-100"}`}
              >
                {item}
              </button>
            ))}
          </nav>
          <div className="hidden sm:block">
            <Segmented
              label="Competition"
              value={competition}
              onChange={changeCompetition}
              options={competitions}
            />
          </div>
          <select
            aria-label="Competition"
            className="py-1.5 sm:hidden"
            value={competition}
            onChange={(e) => changeCompetition(e.target.value as MatchType)}
          >
            {competitions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-6">
        {isDemo && (
          <p className="mb-5 text-sm text-muted">
            You’re looking at a made-up demo club.{" "}
            <button
              type="button"
              onClick={() => setSearching(true)}
              className="font-medium text-accent hover:text-orange-200"
            >
              Find your club
            </button>{" "}
            to see your own stats.
          </p>
        )}

        {data && data.members.length > 0 && (
          <section className="mb-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/30 to-accent/5 text-lg font-bold text-accent ring-1 ring-accent/30">
                {(member?.proName || member?.name || "?")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
                  {member
                    ? member.proName || member.name
                    : "Which player are you?"}
                </h1>
                <p className="mt-1 text-sm text-muted">
                  {member ? (
                    <>
                      {member.name} ·{" "}
                      <span className="capitalize">{member.role}</span>
                    </>
                  ) : (
                    "Pick your gamertag to see your stats. We’ll remember it on this device."
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {form.length > 0 && (
                <div>
                  <p className="eyebrow mb-1.5" title="Oldest to newest">
                    Form · last {form.length}
                  </p>
                  <div className="flex gap-1">
                    {form.map((result, i) => (
                      <ResultChip key={i} result={result} size="sm" />
                    ))}
                  </div>
                </div>
              )}
              <label className="flex flex-col gap-1.5">
                <span className="eyebrow">
                  {member ? "Viewing as" : "Your gamertag"}
                </span>
                <select
                  id="player"
                  className={`min-w-48 ${member ? "" : "ring-2 ring-accent"}`}
                  value={member?.name ?? ""}
                  onChange={(e) =>
                    saveSelection({ ...selection, player: e.target.value })
                  }
                >
                  <option value="" disabled>
                    Select your gamertag…
                  </option>
                  {data.members.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                      {m.proName ? ` · ${m.proName}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        )}

        {!isDemo && query.error && (
          <div role="alert" className="card mb-5 p-5 ring-loss/30">
            <p className="text-loss">
              {data && "Showing the last stats we loaded. "}
              {query.error.message}
            </p>
            <div className="mt-4 flex gap-3">
              <button className="btn-secondary" onClick={() => query.refetch()}>
                Try again
              </button>
              <button
                className="btn-secondary"
                onClick={() => selectClub(demo.club)}
              >
                Explore the demo
              </button>
            </div>
          </div>
        )}
        {(data?.warning || historyQuery.error) && (
          <p role="status" className="mb-5 text-sm text-amber-200">
            {data?.warning}
            {historyQuery.error &&
              " Saved history couldn’t load, so only EA’s latest matches are shown."}
          </p>
        )}
        {!data && query.isPending && (
          <div className="card flex items-center gap-3 p-8 text-muted">
            <LoaderCircle className="animate-spin text-accent" />
            Loading {selection.club.name} from EA…
          </div>
        )}
        {data && !data.members.length && (
          <Card title="No member stats for this club">
            <p className="text-sm text-muted">
              EA didn’t return any players for this club.
            </p>
            <button
              onClick={() => setSearching(true)}
              className="btn-primary mt-5"
            >
              Try another club
            </button>
          </Card>
        )}

        {data && member && (
          <>
            {tab === "Overview" && (
              <Overview
                member={member}
                members={data.members}
                career={career}
                matches={matches}
                analysis={analysis}
                competitionLabel={competitionLabel}
                onSelectMatch={setReport}
                onShowMatches={() => showTab("Matches")}
                onShowSquad={() => showTab("Squad")}
              />
            )}
            {tab === "Matches" && (
              <Card
                eyebrow={
                  <span className="inline-flex items-center gap-1.5">
                    {competitionLabel} · {matches.length} matches
                    <InfoTip
                      text={`${historyNote} Matches less than 90 minutes apart are grouped into one session.`}
                    />
                  </span>
                }
                title="Matches"
              >
                <MatchList
                  matches={matches.slice(0, visibleMatches)}
                  memberName={member.name}
                  onSelect={setReport}
                  grouped
                />
                {matches.length > visibleMatches && (
                  <button
                    className="btn-secondary mt-5 w-full"
                    onClick={() => setVisibleMatches((n) => n + 20)}
                  >
                    Show more matches
                  </button>
                )}
              </Card>
            )}
            {tab === "Squad" && (
              <Squad
                member={member}
                members={data.members}
                matches={matches}
                overall={data.overall}
                analysis={analysis}
                competitionLabel={competitionLabel}
              />
            )}
          </>
        )}

        <details className="group mt-10 text-sm text-muted">
          <summary className="cursor-pointer list-none font-medium text-zinc-300 hover:text-zinc-100">
            About these numbers{" "}
            <span className="text-muted group-open:hidden">+</span>
          </summary>
          <ul className="mt-3 max-w-3xl list-disc space-y-1.5 pl-5 leading-relaxed">
            <li>
              “Your season” and squad comparisons use EA’s season totals. Form,
              matches and partnerships use individual matches for the selected
              competition, so the two can differ.
            </li>
            <li>
              EA only shares a club’s latest matches. Touchline saves them when
              a club is viewed, so older history may have gaps.
            </li>
            <li>
              You’re matched to match data by gamertag. A renamed account may
              stop matching older games.
            </li>
            <li>A dash (—) means EA didn’t report that number.</li>
            <li>
              Comparisons describe results, not their causes. Small samples can
              swing a lot; tips are general suggestions.
            </li>
          </ul>
        </details>
        <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-line pt-5 text-xs text-muted sm:flex-row">
          <span>Touchline · Unofficial EA Clubs companion</span>
          <span>
            {isDemo
              ? "Demo data, not real players"
              : "Data from EA’s public Clubs API · PS5 / Xbox Series / PC"}
          </span>
        </footer>
      </main>

      {searching && (
        <ClubSearch onClose={() => setSearching(false)} onSelect={selectClub} />
      )}
      {report && member && (
        <MatchReport
          match={report}
          member={member}
          clubName={selection.club.name}
          onClose={() => setReport(null)}
        />
      )}
    </div>
  );
}
