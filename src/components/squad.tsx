"use client";

import { useState } from "react";
import type { analyzePlayer } from "@/lib/analytics";
import {
  format,
  matchResult,
  perGame,
  type ClubOverall,
  type Match,
  type Member,
} from "@/lib/stats";
import {
  Card,
  Delta,
  Empty,
  InfoTip,
  Segmented,
  YouBadge,
  ratingTone,
} from "./ui";

type Analysis = ReturnType<typeof analyzePlayer>;

const columns: {
  label: string;
  get: (m: Member) => number | null;
  digits: number;
  unit?: string;
}[] = [
  { label: "Rating", get: (m) => m.rating, digits: 1 },
  { label: "Goals / match", get: (m) => perGame(m.goals, m.games), digits: 2 },
  {
    label: "Assists / match",
    get: (m) => perGame(m.assists, m.games),
    digits: 2,
  },
  { label: "Pass %", get: (m) => m.passing, digits: 0, unit: "%" },
  { label: "Tackle %", get: (m) => m.tackling, digits: 0, unit: "%" },
  { label: "MOTM", get: (m) => m.motm, digits: 0 },
];

function Comparison({
  member,
  members,
}: {
  member: Member;
  members: Member[];
}) {
  const [scope, setScope] = useState<"position" | "all">(
    member.role === "unknown" ? "all" : "position",
  );
  const rows = members
    .filter((m) => scope === "all" || m.role === member.role)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const eligible = rows.filter((m) => (m.games ?? 0) >= 5);
  const best = columns.map((c) =>
    Math.max(...eligible.map((m) => c.get(m) ?? -Infinity)),
  );
  return (
    <Card
      eyebrow={
        <span className="inline-flex items-center gap-1.5">
          Season totals
          <InfoTip text="Per-match season numbers from EA. The best value in each column (among players with 5+ matches) is highlighted. Faded rows have fewer than 5 matches." />
        </span>
      }
      title="How you compare"
      action={
        <Segmented
          label="Comparison group"
          value={scope}
          onChange={setScope}
          options={[
            { value: "position", label: "Your position" },
            { value: "all", label: "Whole squad" },
          ]}
        />
      }
    >
      <div
        tabIndex={0}
        role="region"
        aria-label="Squad comparison, scroll horizontally for more"
        className="-mx-5 overflow-x-auto sm:-mx-6"
      >
        <table className="w-full">
          <thead>
            <tr>
              <th className="sticky left-0 bg-surface pl-5 sm:pl-6">Player</th>
              <th>Matches</th>
              {columns.map((c) => (
                <th key={c.label} className="text-right">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const you = m.name === member.name;
              const faded = (m.games ?? 0) < 5;
              return (
                <tr key={m.name} className={faded ? "opacity-55" : ""}>
                  <th
                    scope="row"
                    className={`sticky left-0 bg-surface pl-5 font-medium text-zinc-100 sm:pl-6 ${you ? "shadow-[inset_3px_0_0_#ff825c]" : ""}`}
                  >
                    {m.proName || m.name}
                    {you && <YouBadge />}
                    <span className="mt-0.5 block text-xs font-normal text-muted capitalize">
                      {m.role}
                    </span>
                  </th>
                  <td className="text-muted tabular-nums">
                    {format(m.games, 0)}
                  </td>
                  {columns.map((c, i) => {
                    const value = c.get(m);
                    const top = !faded && value !== null && value === best[i];
                    return (
                      <td
                        key={c.label}
                        className={`text-right tabular-nums ${top ? "font-semibold text-win" : ""}`}
                      >
                        {format(value, c.digits)}
                        {value !== null && c.unit}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length < 2 && (
        <Empty>No teammates share your position. Try the whole squad.</Empty>
      )}
    </Card>
  );
}

function Partnerships({
  analysis,
  competitionLabel,
}: {
  analysis: Analysis;
  competitionLabel: string;
}) {
  const yourAverage = analysis.summary.rating;
  const partners = [...analysis.teammates]
    .sort((a, b) => b.appearances - a.appearances)
    .slice(0, 6);
  return (
    <Card
      eyebrow={
        <span className="inline-flex items-center gap-1.5">
          {competitionLabel} · 3+ matches together
          <InfoTip text="Results and your rating in matches where you both played. These show what happened together, not who caused it — lineups overlap and samples are small." />
        </span>
      }
      title="Who you play with"
    >
      {partners.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((p) => (
            <li key={p.id} className="rounded-xl bg-raised/60 p-4">
              <p className="flex items-baseline justify-between gap-2">
                <span className="truncate font-semibold">
                  {p.name || "Unnamed player"}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {p.appearances} together
                </span>
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 rounded-full bg-page">
                  <div
                    className="h-full rounded-full bg-win"
                    style={{ width: `${p.winRate ?? 0}%` }}
                  />
                </div>
                <span className="w-16 text-right text-sm tabular-nums">
                  {format(p.winRate, 0)}
                  {p.winRate !== null && "%"} wins
                </span>
              </div>
              <p className="mt-3 flex items-center justify-between text-sm text-muted">
                Your rating together
                <span className="flex items-baseline gap-2">
                  <span
                    className={`font-semibold tabular-nums ${ratingTone(p.ratingTogether)}`}
                  >
                    {format(p.ratingTogether, 1)}
                  </span>
                  {p.ratingTogether !== null &&
                    yourAverage !== null &&
                    Math.abs(p.ratingTogether - yourAverage) >= 0.05 && (
                      <Delta value={p.ratingTogether - yourAverage} />
                    )}
                </span>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>
          Play at least 3 matches with the same teammate to see partnerships.
        </Empty>
      )}
    </Card>
  );
}

function ClubRecord({
  matches,
  overall,
  competitionLabel,
}: {
  matches: Match[];
  overall?: ClubOverall | null;
  competitionLabel: string;
}) {
  const scored = matches.filter((m) => m.goals !== null && m.conceded !== null);
  const results = scored.map(matchResult);
  const perMatch = (n: number) =>
    scored.length ? format(n / scored.length, 1) : "—";
  const stats: [string, string][] = [
    [
      "Record",
      scored.length
        ? `${results.filter((r) => r === "W").length}–${results.filter((r) => r === "D").length}–${results.filter((r) => r === "L").length}`
        : "—",
    ],
    ["Scored / match", perMatch(scored.reduce((s, m) => s + m.goals!, 0))],
    ["Conceded / match", perMatch(scored.reduce((s, m) => s + m.conceded!, 0))],
    [
      "Clean sheets",
      scored.length
        ? String(scored.filter((m) => m.conceded === 0).length)
        : "—",
    ],
  ];
  return (
    <Card
      eyebrow={`${competitionLabel} · last ${scored.length} club matches`}
      title="Club record"
    >
      <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {overall && (
        <p className="mt-6 border-t border-line pt-4 text-sm text-muted">
          All-time:{" "}
          <span className="text-zinc-200">
            {format(overall.wins, 0)}W {format(overall.draws, 0)}D{" "}
            {format(overall.losses, 0)}L · skill rating{" "}
            {format(overall.skillRating, 0)} · unbeaten streak{" "}
            {format(overall.unbeatenStreak, 0)}
          </span>
        </p>
      )}
    </Card>
  );
}

export function Squad({
  member,
  members,
  matches,
  overall,
  analysis,
  competitionLabel,
}: {
  member: Member;
  members: Member[];
  matches: Match[];
  overall?: ClubOverall | null;
  analysis: Analysis;
  competitionLabel: string;
}) {
  return (
    <div className="space-y-5">
      <Comparison
        key={`${member.name}:${member.role}`}
        member={member}
        members={members}
      />
      <Partnerships analysis={analysis} competitionLabel={competitionLabel} />
      <ClubRecord
        matches={matches}
        overall={overall}
        competitionLabel={competitionLabel}
      />
    </div>
  );
}
