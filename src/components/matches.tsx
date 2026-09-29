import { ChevronRight } from "lucide-react";
import { matchPlayer, matchResult, type Match } from "@/lib/stats";
import { Empty, RatingBadge, ResultChip, ratingTone } from "./ui";

const SESSION_GAP = 90 * 60_000;

function day(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
function time(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function MatchRow({
  match,
  memberName,
  onSelect,
  showDay = true,
}: {
  match: Match;
  memberName: string;
  onSelect: (match: Match) => void;
  showDay?: boolean;
}) {
  const player = matchPlayer(match, memberName);
  const result = matchResult(match);
  const contributions = [
    player?.goals ? `${player.goals}G` : null,
    player?.assists ? `${player.assists}A` : null,
  ].filter(Boolean);
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(match)}
        aria-label={`Match report: ${match.goals ?? "?"}–${match.conceded ?? "?"} against ${match.opponent}`}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[.03] sm:gap-4 sm:px-5"
      >
        <ResultChip result={result} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{match.opponent}</span>
          <span className="mt-0.5 block text-xs text-muted">
            {showDay && `${day(match.timestamp)} · `}
            {time(match.timestamp)}
            {match.dnf && " · Forfeit"}
            {!player && " · You didn’t play"}
          </span>
        </span>
        <span className="w-14 text-center font-semibold tabular-nums">
          {match.goals ?? "—"}–{match.conceded ?? "—"}
        </span>
        <span className="hidden w-14 text-sm text-muted tabular-nums sm:block">
          {contributions.join(" ")}
        </span>
        {player ? (
          <RatingBadge rating={player.rating} />
        ) : (
          <span className="min-w-11" />
        )}
        <ChevronRight size={16} className="text-muted" aria-hidden />
      </button>
    </li>
  );
}

export function MatchList({
  matches,
  memberName,
  onSelect,
  grouped = false,
}: {
  matches: Match[];
  memberName: string;
  onSelect: (match: Match) => void;
  grouped?: boolean;
}) {
  if (!matches.length)
    return <Empty>No matches in this competition yet.</Empty>;
  if (!grouped)
    return (
      <ul className="-mx-5 divide-y divide-line/70 sm:-mx-6">
        {matches.map((match) => (
          <MatchRow
            key={match.id}
            match={match}
            memberName={memberName}
            onSelect={onSelect}
          />
        ))}
      </ul>
    );

  // Consecutive matches less than 90 minutes apart form one playing session.
  const sessions: Match[][] = [];
  for (const match of matches) {
    const current = sessions.at(-1);
    const last = current?.at(-1);
    if (current && last && last.timestamp - match.timestamp <= SESSION_GAP)
      current.push(match);
    else sessions.push([match]);
  }
  return (
    <div className="-mx-5 sm:-mx-6">
      {sessions.map((session) => {
        const results = session.map(matchResult);
        const ratings = session
          .map((m) => matchPlayer(m, memberName)?.rating)
          .filter((r): r is number => typeof r === "number");
        const average = ratings.length
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : null;
        const newest = session[0]!;
        const oldest = session.at(-1)!;
        return (
          <section
            key={newest.id}
            className="border-t border-line first:border-0"
          >
            <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-white/[.02] px-4 py-2.5 sm:px-5">
              <h3 className="text-sm font-medium">
                {day(newest.timestamp)}{" "}
                <span className="font-normal text-muted">
                  {session.length > 1
                    ? `${time(oldest.timestamp)}–${time(newest.timestamp)}`
                    : time(newest.timestamp)}
                </span>
              </h3>
              <p className="text-xs text-muted">
                {results.filter((r) => r === "W").length}W{" "}
                {results.filter((r) => r === "D").length}D{" "}
                {results.filter((r) => r === "L").length}L
                {average !== null && (
                  <>
                    {" · "}your avg{" "}
                    <span className={`font-semibold ${ratingTone(average)}`}>
                      {average.toFixed(1)}
                    </span>
                  </>
                )}
              </p>
            </header>
            <ul className="divide-y divide-line/70">
              {session.map((match) => (
                <MatchRow
                  key={match.id}
                  match={match}
                  memberName={memberName}
                  onSelect={onSelect}
                  showDay={false}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

const toneHex = (rating: number) =>
  rating >= 8
    ? "#34d399"
    : rating >= 7
      ? "#f4f4f5"
      : rating >= 6
        ? "#fcd34d"
        : "#f87171";

/** Rating per appearance, oldest to newest, with the player's average as a reference line. */
export function RatingChart({
  matches,
  memberName,
  limit = 20,
}: {
  matches: Match[];
  memberName: string;
  limit?: number;
}) {
  const points = matches
    .flatMap((match) => {
      const rating = matchPlayer(match, memberName)?.rating;
      return typeof rating === "number" ? [{ match, rating }] : [];
    })
    .slice(0, limit)
    .reverse();
  if (points.length < 2)
    return <Empty>Play a couple more matches to see your form.</Empty>;

  const ratings = points.map((p) => p.rating);
  const low = Math.max(0, Math.floor(Math.min(...ratings) - 0.5));
  const high = Math.min(10, Math.ceil(Math.max(...ratings) + 0.5));
  const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const width = 640,
    height = 180,
    left = 28,
    right = 8,
    top = 12,
    bottom = 24;
  const x = (i: number) =>
    left + (i * (width - left - right)) / (points.length - 1);
  const y = (r: number) =>
    top + ((high - r) / (high - low || 1)) * (height - top - bottom);
  const line = points.map((p, i) => `${x(i)},${y(p.rating)}`).join(" ");
  const area = `${x(0)},${height - bottom} ${line} ${x(points.length - 1)},${height - bottom}`;
  const ticks = [low, (low + high) / 2, high];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label={`Your last ${points.length} match ratings, oldest first: ${ratings.join(", ")}. Average ${average.toFixed(1)}.`}
    >
      <defs>
        <linearGradient id="rating-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ff825c" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ff825c" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={left}
            x2={width - right}
            y1={y(tick)}
            y2={y(tick)}
            stroke="#2b3038"
          />
          <text
            x={left - 8}
            y={y(tick) + 4}
            fill="#9ba2ae"
            fontSize="11"
            textAnchor="end"
          >
            {Number.isInteger(tick) ? tick : tick.toFixed(1)}
          </text>
        </g>
      ))}
      <line
        x1={left}
        x2={width - right}
        y1={y(average)}
        y2={y(average)}
        stroke="#9ba2ae"
        strokeDasharray="4 4"
      />
      <polygon points={area} fill="url(#rating-area)" />
      <polyline
        points={line}
        fill="none"
        stroke="#ff825c"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle
          key={p.match.id}
          cx={x(i)}
          cy={y(p.rating)}
          r="4.5"
          fill={toneHex(p.rating)}
          stroke="#171a1f"
          strokeWidth="2"
        >
          <title>{`${p.rating.toFixed(1)} vs ${p.match.opponent} · ${day(p.match.timestamp)}`}</title>
        </circle>
      ))}
      <text x={left} y={height - 4} fill="#9ba2ae" fontSize="11">
        {day(points[0]!.match.timestamp)}
      </text>
      <text
        x={width - right}
        y={height - 4}
        fill="#9ba2ae"
        fontSize="11"
        textAnchor="end"
      >
        {day(points.at(-1)!.match.timestamp)}
      </text>
    </svg>
  );
}
