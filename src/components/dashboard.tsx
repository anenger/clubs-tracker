"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  ChevronRight,
  LoaderCircle,
  RefreshCw,
  Search,
  Shield,
  Target,
  Users,
} from "lucide-react";
import { demo } from "@/lib/demo";
import { request } from "@/lib/client-api";
import {
  format,
  insights,
  perGame,
  type Club,
  type ClubData,
} from "@/lib/stats";
import { useSelection } from "./use-selection";
import { ClubSearch } from "./club-search";
import { Comparison } from "./comparison";
import { Development } from "./development";
import { Matches, RatingChart } from "./matches";

const tabs = ["Overview", "Matches", "Compare", "Improve"] as const;
type Tab = (typeof tabs)[number];

export function Dashboard() {
  const [selection, saveSelection] = useSelection();
  const [tab, setTab] = useState<Tab>("Overview");
  const [searching, setSearching] = useState(false);
  const isDemo = selection.club.id === "demo";
  const query = useQuery({
    queryKey: ["club", "common-gen5", selection.club.id],
    queryFn: ({ signal }) =>
      request<ClubData>(`/api/clubs?id=${selection.club.id}`, signal),
    enabled: !isDemo,
  });
  const data = isDemo ? demo : query.data;
  const member =
    data?.members.find((m) => m.name === selection.player) ?? data?.members[0];
  const focus = member && data ? insights(member, data.members)[0] : undefined;
  function selectClub(club: Club) {
    saveSelection({ club, player: "" });
    setSearching(false);
    setTab("Overview");
  }

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-accent focus:p-3 focus:text-black"
      >
        Skip to content
      </a>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-xl font-bold tracking-tight"
          >
            <Activity className="text-accent" size={26} />
            touchline
            <span className="hidden border-l border-line pl-4 text-sm font-normal tracking-normal text-muted md:inline">
              Clubs stats
            </span>
          </Link>
          <button className="btn-secondary" onClick={() => setSearching(true)}>
            <Search size={17} />
            <span>Find a club</span>
          </button>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[1320px] px-5 pb-12 sm:px-8">
        {isDemo && (
          <div className="mt-6 flex flex-col justify-between gap-4 rounded-lg border border-accent/25 bg-accent/5 p-4 sm:flex-row sm:items-center">
            <div>
              <strong className="text-sm font-semibold">
                You’re viewing a demo player
              </strong>
              <p className="mt-1 text-sm text-muted">
                Find your club and select your player to see your actual stats.
              </p>
            </div>
            <button
              className="btn-primary shrink-0"
              onClick={() => setSearching(true)}
            >
              Find my club <ArrowRight size={17} />
            </button>
          </div>
        )}
        <div className="mt-8 flex items-center gap-2 text-sm text-muted">
          <Shield size={16} />
          <button
            className="hover:text-white"
            onClick={() => setSearching(true)}
          >
            {selection.club.name}
          </button>
          <ChevronRight size={14} />
          <span>Player stats</span>
        </div>
        <section className="flex flex-col justify-between gap-6 py-7 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-line bg-raised text-xl font-bold sm:h-20 sm:w-20 sm:text-2xl">
              {(member?.proName || member?.name || "?")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {member?.proName || member?.name || selection.club.name}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                {member && (
                  <>
                    <span>{member.name}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{member.role}</span>
                  </>
                )}
                <span className="rounded border border-line px-2 py-0.5 text-xs">
                  {isDemo ? "DEMO" : "EA CLUBS"}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {member && data && (
              <label className="flex flex-col gap-2 text-sm text-muted">
                Player
                <select
                  id="player"
                  className="max-w-64 text-zinc-100"
                  value={member.name}
                  onChange={(e) =>
                    saveSelection({ ...selection, player: e.target.value })
                  }
                >
                  {data.members.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.proName || m.name}
                      {m.proName ? ` · ${m.name}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="pb-2 text-right text-sm text-muted">
              <span className="block">Current season</span>
              {!isDemo && (
                <span className="mt-1 block text-xs">
                  {query.isFetching
                    ? "Updating…"
                    : data
                      ? `Data fetched ${new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "EA public API"}
                </span>
              )}
            </div>
            {!isDemo && (
              <button
                className="btn-secondary px-3"
                aria-label="Refresh stats"
                disabled={query.isFetching}
                onClick={() => query.refetch()}
              >
                <RefreshCw
                  size={17}
                  className={query.isFetching ? "animate-spin" : ""}
                />
              </button>
            )}
          </div>
        </section>
        <nav
          aria-label="Player stats"
          className="mb-7 flex gap-6 overflow-x-auto border-b border-line sm:gap-9"
        >
          {tabs.map((item) => (
            <button
              key={item}
              aria-current={tab === item ? "page" : undefined}
              onClick={() => setTab(item)}
              className={`shrink-0 border-b-2 px-1 pt-2 pb-4 text-base font-medium ${tab === item ? "border-accent text-white" : "border-transparent text-muted hover:text-white"}`}
            >
              {item}
            </button>
          ))}
        </nav>
        {!isDemo && query.error && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-400/30 bg-red-400/5 p-5"
          >
            <p className="text-red-200">
              {data && "Showing previously fetched stats. "}
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
                Explore demo
              </button>
            </div>
          </div>
        )}
        {data?.warning && (
          <p
            role="status"
            className="mb-6 rounded-lg border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-200"
          >
            {data.warning}
          </p>
        )}
        {!data && query.isPending && (
          <div className="panel flex items-center gap-4 p-10">
            <LoaderCircle className="animate-spin text-accent" />
            <p>Loading members and recent matches from EA…</p>
          </div>
        )}
        {data && !member && (
          <div className="panel p-10">
            <h2 className="text-xl font-semibold">No member stats available</h2>
            <button
              onClick={() => setSearching(true)}
              className="btn-primary mt-5"
            >
              Try another club
            </button>
          </div>
        )}
        {data && member && (
          <>
            {tab === "Overview" && (
              <div className="space-y-6">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-xl font-semibold">Season overview</h2>
                  <span className="text-sm text-muted">
                    {format(member.games, 0)} matches played
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    {
                      label: "Average rating",
                      value: format(member.rating),
                      detail: "Out of 10",
                      accent: true,
                    },
                    {
                      label: "Goals",
                      value: format(member.goals, 0),
                      detail: `${format(perGame(member.goals, member.games), 2)} per match`,
                    },
                    {
                      label: "Assists",
                      value: format(member.assists, 0),
                      detail: `${format(perGame(member.assists, member.games), 2)} per match`,
                    },
                    {
                      label: "Player of the match",
                      value: format(member.motm, 0),
                      detail: "This season",
                    },
                  ].map((stat) => (
                    <section key={stat.label} className="panel p-5 sm:p-6">
                      <h3 className="text-sm text-muted">{stat.label}</h3>
                      <strong
                        className={`mt-3 block text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl ${stat.accent ? "text-accent" : ""}`}
                      >
                        {stat.value}
                      </strong>
                      <p className="mt-3 text-sm text-muted">{stat.detail}</p>
                    </section>
                  ))}
                </div>
                <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
                  <section className="panel p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold">
                        Recent match ratings
                      </h2>
                      <span className="text-sm text-muted">
                        Last {data.matches.length} club matches
                      </span>
                    </div>
                    <RatingChart data={data} member={member} />
                  </section>
                  <section className="panel flex flex-col border-t-2 border-t-accent p-6">
                    <div className="flex items-center gap-2 text-sm font-medium text-accent">
                      <Target size={18} />
                      Your next focus
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold">
                      {focus?.label ?? "Build your baseline"}
                    </h2>
                    {focus ? (
                      <>
                        <p className="mt-3 leading-relaxed text-muted">
                          {focus.gap < 0
                            ? "Below your same-position teammates. A useful place to start your next session."
                            : "You’re matching or exceeding your role peers. Review what’s working."}
                        </p>
                        <div className="my-5 grid grid-cols-2 gap-4">
                          <div>
                            <strong className="text-3xl font-semibold">
                              {format(focus.value, 2)}
                              {focus.unit}
                            </strong>
                            <p className="mt-1 text-sm text-muted">You</p>
                          </div>
                          <div>
                            <strong className="text-3xl font-semibold text-muted">
                              {format(focus.average, 2)}
                              {focus.unit}
                            </strong>
                            <p className="mt-1 text-sm text-muted">
                              Role average
                            </p>
                          </div>
                        </div>
                        <p className="mb-5 text-xs text-muted">
                          {focus.peers} role peers ·{" "}
                          {focus.peers < 3 || (member.games ?? 0) < 10
                            ? "Limited sample"
                            : "Season comparison"}
                        </p>
                      </>
                    ) : (
                      <p className="my-5 leading-relaxed text-muted">
                        Insights unlock when you and a teammate in the same
                        position have at least 5 appearances each.
                      </p>
                    )}
                    <button
                      className="btn-secondary mt-auto w-full justify-between"
                      onClick={() => setTab("Improve")}
                    >
                      See improvement areas <ArrowRight size={17} />
                    </button>
                  </section>
                </div>
                <section className="panel">
                  <div className="flex items-center justify-between gap-3 p-5 sm:p-6">
                    <h2 className="text-lg font-semibold">Recent matches</h2>
                    <button
                      onClick={() => setTab("Matches")}
                      className="flex items-center gap-2 text-sm text-accent hover:text-orange-200"
                    >
                      View all <ArrowRight size={16} />
                    </button>
                  </div>
                  <Matches data={data} member={member} limit={5} />
                </section>
                <button
                  onClick={() => setTab("Compare")}
                  className="panel flex w-full items-center gap-4 p-5 text-left hover:bg-raised"
                >
                  <Users size={25} className="text-muted" />
                  <div className="flex-1">
                    <strong className="font-semibold">
                      How do you compare?
                    </strong>
                    <p className="mt-1 text-sm text-muted">
                      See your stats alongside {data.members.length - 1}{" "}
                      teammates.
                    </p>
                  </div>
                  <ArrowRight size={20} className="text-accent" />
                </button>
              </div>
            )}
            {tab === "Matches" && (
              <section className="panel">
                <div className="p-6">
                  <h2 className="text-xl font-semibold">
                    Recent league matches
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    Club results with your individual performance. Not a
                    complete match history.
                  </p>
                </div>
                <Matches data={data} member={member} />
                <p className="border-t border-line p-5 text-sm text-muted">
                  Player stats are linked by unique gamertag. — means
                  unavailable or not matched.
                </p>
              </section>
            )}
            {tab === "Compare" && (
              <Comparison
                key={`${data.club.id}:${member.name}`}
                member={member}
                members={data.members}
              />
            )}
            {tab === "Improve" && <Development data={data} member={member} />}
          </>
        )}
        <footer className="mt-10 flex flex-col justify-between gap-3 border-t border-line pt-6 text-xs text-muted sm:flex-row">
          <span>Touchline · Unofficial Clubs companion</span>
          <span>
            {isDemo
              ? "Illustrative demo data, not real players"
              : "EA public Clubs API · PS5 / Xbox Series / PC"}
          </span>
        </footer>
      </main>
      {searching && (
        <ClubSearch onClose={() => setSearching(false)} onSelect={selectClub} />
      )}
    </div>
  );
}
