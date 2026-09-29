import {
  format,
  matchPlayer,
  matchResult,
  type ClubData,
  type Member,
  type Match,
} from "@/lib/stats";

export function Matches({
  data,
  member,
  limit,
  onSelect,
}: {
  data: ClubData;
  member: Member;
  limit?: number;
  onSelect?: (match: Match) => void;
}) {
  const matches = limit ? data.matches.slice(0, limit) : data.matches;
  return (
    <div
      className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      tabIndex={0}
      role="region"
      aria-label="Match results, scroll horizontally for more stats"
    >
      <table className="w-full">
        <thead>
          <tr>
            <th>Result</th>
            <th>Opponent</th>
            <th>Score</th>
            <th>Goals</th>
            <th>Assists</th>
            <th className="text-right">Rating</th>
            {onSelect && (
              <th>
                <span className="sr-only">Match report</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => {
            const player = matchPlayer(match, member.name);
            const result = matchResult(match);
            return (
              <tr key={match.id} className="hover:bg-white/[.02]">
                <td>
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded text-sm font-bold ${result === "W" ? "bg-emerald-400/10 text-emerald-300" : result === "L" ? "bg-red-400/10 text-red-300" : "bg-zinc-400/10 text-zinc-300"}`}
                  >
                    {result}
                  </span>
                </td>
                <td>
                  <span className="block font-medium">{match.opponent}</span>
                  <span className="mt-1 block text-xs text-muted">
                    {new Date(match.timestamp).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      timeZone: "UTC",
                    })}
                    {match.awardedByDnf && " · DNF win"}
                  </span>
                </td>
                <td className="font-semibold tabular-nums">
                  {format(match.goals, 0)}{" "}
                  <span className="px-1 text-muted">–</span>{" "}
                  {format(match.conceded, 0)}
                </td>
                <td>{format(player?.goals ?? null, 0)}</td>
                <td>{format(player?.assists ?? null, 0)}</td>
                <td className="text-right">
                  <span
                    className={`inline-block min-w-10 rounded px-2 py-1 text-center font-semibold tabular-nums ${(player?.rating ?? 0) >= 8 ? "bg-sky-400/10 text-sky-300" : "bg-raised"}`}
                  >
                    {format(player?.rating ?? null)}
                  </span>
                </td>
                {onSelect && (
                  <td className="text-right">
                    <button
                      className="min-h-10 rounded px-2 text-sm text-accent hover:bg-raised"
                      onClick={() => onSelect(match)}
                      aria-label={`View match report against ${match.opponent}`}
                    >
                      Report →
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!matches.length && (
        <p className="p-8 text-muted">
          No matches available for this competition.
        </p>
      )}
    </div>
  );
}

export function RatingChart({
  data,
  member,
}: {
  data: ClubData;
  member: Member;
}) {
  const all = [...data.matches].reverse();
  const points = all.map((match, i) => ({
    x: 35 + i * (600 / Math.max(all.length - 1, 1)),
    rating: matchPlayer(match, member.name)?.rating ?? null,
  }));
  const valid = points.filter((p) => p.rating !== null);
  const y = (rating: number) => 180 - Math.min(10, Math.max(0, rating)) * 15;
  return valid.length ? (
    <>
      <svg
        viewBox="0 0 665 215"
        className="mt-4 w-full"
        role="img"
        aria-label={`Recent match ratings, oldest first: ${points.map((p) => p.rating ?? "unavailable").join(", ")}`}
      >
        {[0, 5, 10].map((n) => (
          <g key={n}>
            <text x="0" y={y(n) + 4} fill="#a7adb8" fontSize="12">
              {n}
            </text>
            <line
              x1="35"
              x2="635"
              y1={y(n)}
              y2={y(n)}
              stroke="#363b44"
              strokeDasharray="3 5"
            />
          </g>
        ))}
        {points.map((p, i) => {
          const prev = points[i - 1];
          return p.rating !== null && prev?.rating != null ? (
            <line
              key={i}
              x1={prev.x}
              y1={y(prev.rating)}
              x2={p.x}
              y2={y(p.rating)}
              stroke="#ff825c"
              strokeWidth="2.5"
            />
          ) : null;
        })}
        {points.map((p, i) =>
          p.rating === null ? null : (
            <g key={i}>
              <circle cx={p.x} cy={y(p.rating)} r="4" fill="#ff825c" />
              <text
                x={p.x}
                y={y(p.rating) - 14}
                textAnchor="middle"
                fill="#e4e4e7"
                fontSize="12"
              >
                {p.rating}
              </text>
            </g>
          ),
        )}
        <text x="35" y="210" fill="#a7adb8" fontSize="12">
          Oldest
        </text>
        <text x="635" y="210" fill="#a7adb8" fontSize="12" textAnchor="end">
          Latest
        </text>
      </svg>
      <p className="mt-3 text-sm text-muted">
        {valid.length} matched appearances · Selected competition
      </p>
    </>
  ) : (
    <div className="flex min-h-48 items-center justify-center text-muted">
      No recent ratings for this player.
    </div>
  );
}
