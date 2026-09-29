import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import type { analyzePlayer } from "@/lib/analytics";
import {
  format,
  insights,
  matchPlayer,
  matchResult,
  metrics,
  type CareerMember,
  type Match,
  type Member,
  type MetricKey,
} from "@/lib/stats";
import { MatchList, RatingChart } from "./matches";
import { Card, Delta, InfoTip, PeerBar, SampleBadge, ratingTone } from "./ui";

type Analysis = ReturnType<typeof analyzePlayer>;

const tips: Record<MetricKey, string> = {
  passing:
    "Take the simpler outlet before the difficult pass, and offer a supporting angle before you receive.",
  tackling:
    "Stay goal-side and pick your moment to challenge rather than diving in.",
  goals:
    "Find space to receive in scoring positions; your role shapes goals as much as finishing does.",
  assists:
    "Look for runners beyond the ball and the extra pass before shooting.",
  shooting:
    "Prioritise clearer chances. Conversion can’t show how hard your chances were.",
  rating: "Rewatch your best recent matches and pick out what you can repeat.",
  cleanSheets:
    "Work on shape and communication together — clean sheets are a team outcome.",
};

const roleMetrics: Record<Member["role"], MetricKey[]> = {
  goalkeeper: ["rating", "passing", "cleanSheets"],
  defender: ["rating", "passing", "tackling", "cleanSheets"],
  midfielder: ["rating", "assists", "passing", "tackling"],
  forward: ["rating", "goals", "assists", "shooting"],
  unknown: ["rating", "goals", "assists", "passing"],
};

function SeasonCard({
  member,
  members,
  career,
}: {
  member: Member;
  members: Member[];
  career?: CareerMember;
}) {
  const peers = members.filter(
    (m) =>
      m.name !== member.name &&
      m.role === member.role &&
      member.role !== "unknown" &&
      (m.games ?? 0) >= 5,
  );
  const tiles = metrics.filter((m) => roleMetrics[member.role].includes(m.key));
  return (
    <Card
      eyebrow={
        <span className="inline-flex items-center gap-1.5">
          Season · {format(member.games, 0)} matches
          <InfoTip text="EA’s season totals for you at this club, compared with teammates in the same position who have played at least 5 matches. The marker on each bar is their average." />
        </span>
      }
      title="Your season"
      action={
        ((member.games ?? 0) < 10 || peers.length < 2) && (
          <SampleBadge title="Fewer than 10 matches or fewer than 2 same-position teammates — treat comparisons as a rough guide." />
        )
      }
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-5">
        {tiles.map((metric) => {
          const value = metric.get(member);
          const peerValues = peers
            .map(metric.get)
            .filter((n): n is number => n !== null);
          const average = peerValues.length
            ? peerValues.reduce((a, b) => a + b, 0) / peerValues.length
            : null;
          const max =
            metric.unit === "%"
              ? 100
              : metric.key === "rating"
                ? 10
                : Math.max(value ?? 0, average ?? 0, ...peerValues) * 1.15 || 1;
          const digits = metric.key === "rating" || metric.unit === "%" ? 1 : 2;
          return (
            <div key={metric.key}>
              <dt className="text-sm text-muted">{metric.label}</dt>
              <dd
                className={`mt-1 text-3xl font-semibold tracking-tight tabular-nums ${metric.key === "rating" ? ratingTone(value) : ""}`}
              >
                {format(value, digits)}
                {value !== null && metric.unit}
              </dd>
              {value !== null && average !== null ? (
                <>
                  <PeerBar value={value} average={average} max={max} />
                  <dd className="mt-2 text-xs text-muted">
                    Position avg {format(average, digits)}
                    {metric.unit}
                  </dd>
                </>
              ) : (
                <dd className="mt-2 text-xs text-muted">No position average</dd>
              )}
            </div>
          );
        })}
        <div>
          <dt className="text-sm text-muted">Player of the match</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
            {format(member.motm, 0)}
          </dd>
          <dd className="mt-2 text-xs text-muted">
            {member.motm !== null && member.games
              ? `${Math.round((100 * member.motm) / member.games)}% of matches`
              : "—"}
          </dd>
        </div>
      </dl>
      {career && (
        <p className="mt-6 border-t border-line pt-4 text-sm text-muted">
          Career at this club:{" "}
          <span className="text-zinc-200">
            {format(career.games, 0)} matches · {format(career.goals, 0)} goals
            · {format(career.assists, 0)} assists · {format(career.rating)} avg
            rating
          </span>
        </p>
      )}
    </Card>
  );
}

function FormCard({
  matches,
  member,
  analysis,
  competitionLabel,
}: {
  matches: Match[];
  member: Member;
  analysis: Analysis;
  competitionLabel: string;
}) {
  const played = matches.filter((m) => matchPlayer(m, member.name));
  const recent = played.slice(0, 10).map(matchResult);
  const { trend, summary } = analysis;
  return (
    <Card
      eyebrow={`${competitionLabel} · ${played.length} appearances`}
      title="Form"
    >
      <dl className="mb-5 grid grid-cols-3 gap-4">
        <div>
          <dt className="text-sm text-muted">Last 5 avg</dt>
          <dd className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">
              {format(trend.recentRating, 1)}
            </span>
            {trend.ratingDelta !== null && <Delta value={trend.ratingDelta} />}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Last 10 record</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {recent.filter((r) => r === "W").length}
            <span className="text-muted">–</span>
            {recent.filter((r) => r === "D").length}
            <span className="text-muted">–</span>
            {recent.filter((r) => r === "L").length}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Goals + assists</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {(summary.goals ?? 0) + (summary.assists ?? 0)}
          </dd>
        </div>
      </dl>
      <RatingChart matches={matches} memberName={member.name} />
      <p className="mt-2 text-xs text-muted">
        Dashed line: your average. Change compares your last 5 rated matches
        with the 5 before.
      </p>
    </Card>
  );
}

function FocusCard({
  member,
  members,
  onCompare,
}: {
  member: Member;
  members: Member[];
  onCompare: () => void;
}) {
  const ranked = insights(member, members);
  const weakest = ranked.find((i) => i.gap < 0);
  const strongest = [...ranked].reverse().find((i) => i.gap >= 0);
  const item = (
    insight: NonNullable<typeof weakest>,
    kind: "work" | "keep",
  ) => (
    <div className="rounded-xl bg-raised/60 p-4">
      <p
        className={`flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase ${kind === "work" ? "text-accent" : "text-win"}`}
      >
        {kind === "work" ? (
          <TrendingDown size={14} aria-hidden />
        ) : (
          <TrendingUp size={14} aria-hidden />
        )}
        {kind === "work" ? "Work on" : "Keep doing"}
      </p>
      <p className="mt-2 flex items-baseline justify-between gap-3">
        <span className="font-semibold">{insight.label}</span>
        <span className="text-sm text-muted tabular-nums">
          {format(insight.value, 2)}
          {insight.unit} vs {format(insight.average, 2)}
          {insight.unit}
        </span>
      </p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">
        {tips[insight.key]}
      </p>
    </div>
  );
  return (
    <Card eyebrow="Compared with your position" title="Next steps">
      {weakest || strongest ? (
        <div className="space-y-3">
          {weakest && item(weakest, "work")}
          {strongest && item(strongest, "keep")}
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-muted">
          Suggestions appear once you and a teammate in the same position have
          each played 5 matches.
        </p>
      )}
      <button
        type="button"
        onClick={onCompare}
        className="mt-4 flex items-center gap-1.5 text-sm font-medium text-accent hover:text-orange-200"
      >
        Compare with the squad <ArrowRight size={15} aria-hidden />
      </button>
    </Card>
  );
}

export function Overview({
  member,
  members,
  career,
  matches,
  analysis,
  competitionLabel,
  onSelectMatch,
  onShowMatches,
  onShowSquad,
}: {
  member: Member;
  members: Member[];
  career?: CareerMember;
  matches: Match[];
  analysis: Analysis;
  competitionLabel: string;
  onSelectMatch: (match: Match) => void;
  onShowMatches: () => void;
  onShowSquad: () => void;
}) {
  return (
    <div className="space-y-5">
      <SeasonCard member={member} members={members} career={career} />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <FormCard
          matches={matches}
          member={member}
          analysis={analysis}
          competitionLabel={competitionLabel}
        />
        <FocusCard member={member} members={members} onCompare={onShowSquad} />
      </div>
      <Card
        eyebrow={competitionLabel}
        title="Recent matches"
        action={
          <button
            type="button"
            onClick={onShowMatches}
            className="flex items-center gap-1.5 text-sm font-medium text-accent hover:text-orange-200"
          >
            All matches <ArrowRight size={15} aria-hidden />
          </button>
        }
      >
        <MatchList
          matches={matches.slice(0, 5)}
          memberName={member.name}
          onSelect={onSelectMatch}
        />
      </Card>
    </div>
  );
}
