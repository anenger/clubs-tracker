import { ArrowDownRight, ArrowUpRight, Users } from "lucide-react";
import {
  format,
  insights,
  matchResult,
  type ClubData,
  type Member,
  type MetricKey,
} from "@/lib/stats";

const tips: Record<MetricKey, string> = {
  passing:
    "Try a simpler outlet before a difficult pass. Create a supporting angle before receiving the ball.",
  tackling:
    "Stay goal-side and choose your moment to challenge. Use this as a baseline for your next few sessions.",
  goals:
    "Look for space to receive in scoring positions. Your role and chances affect goals per match as much as finishing.",
  assists:
    "Look for runners beyond the ball and opportunities for an extra pass before shooting.",
  shooting:
    "Prioritise clearer shooting opportunities. Conversion alone cannot tell us how difficult your chances were.",
  rating:
    "Review your best recent matches with your squad to identify repeatable contributions.",
  cleanSheets:
    "Work on defensive shape and communication together. Clean sheets are a shared team outcome.",
};

export function Development({
  data,
  member,
}: {
  data: ClubData;
  member: Member;
}) {
  const recommendations = insights(member, data.members);
  const scored = data.matches.filter(
    (m) => m.goals !== null && m.conceded !== null,
  );
  const conceded = scored.reduce((total, m) => total + (m.conceded ?? 0), 0);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">What to work on</h2>
        <p className="mt-2 text-muted">
          Your season stats against teammates in the same position. At least 5
          appearances each.
        </p>
      </div>
      {recommendations.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {recommendations.map((insight) => (
            <section key={insight.key} className="panel p-6">
              <div
                className={`flex items-center gap-2 text-sm font-medium ${insight.gap < 0 ? "text-accent" : "text-sky-300"}`}
              >
                {insight.gap < 0 ? (
                  <ArrowDownRight size={18} />
                ) : (
                  <ArrowUpRight size={18} />
                )}
                {insight.gap < 0
                  ? "Below role average"
                  : "At or above role average"}
              </div>
              <h3 className="mt-4 text-xl font-semibold">{insight.label}</h3>
              <div className="mt-5 flex flex-wrap items-baseline gap-3">
                <strong className="text-4xl font-semibold tabular-nums">
                  {format(insight.value, 2)}
                  {insight.unit}
                </strong>
                <span className="text-sm text-muted">
                  vs {format(insight.average, 2)}
                  {insight.unit} role average
                </span>
              </div>
              <p className="mt-5 leading-relaxed text-zinc-300">
                {tips[insight.key]}
              </p>
              <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
                {insight.peers} role peer{insight.peers !== 1 && "s"} ·{" "}
                {format(member.games, 0)} appearances
                {(insight.peers < 3 || (member.games ?? 0) < 10) && (
                  <span className="mt-1 block text-amber-300">
                    Limited sample — treat as a starting point
                  </span>
                )}
              </p>
            </section>
          ))}
        </div>
      ) : (
        <div className="panel p-8">
          <h3 className="text-lg font-semibold">
            Not enough comparable data yet
          </h3>
          <p className="mt-3 text-muted">
            You and at least one teammate in the same known position need 5
            appearances each.
          </p>
        </div>
      )}
      {!!scored.length && (
        <section className="panel p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Users size={22} /> Team performance
          </h2>
          <p className="mt-2 text-sm text-muted">
            Recent league matches for the whole club, including games you didn’t
            play.
          </p>
          <div className="my-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              [
                "Wins",
                `${scored.filter((m) => matchResult(m) === "W").length} / ${scored.length}`,
              ],
              [
                "Goals / match",
                format(
                  scored.reduce((sum, m) => sum + (m.goals ?? 0), 0) /
                    scored.length,
                  2,
                ),
              ],
              ["Conceded / match", format(conceded / scored.length, 2)],
              [
                "Clean sheets",
                `${scored.filter((m) => m.conceded === 0).length} / ${scored.length}`,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <span className="text-sm text-muted">{label}</span>
                <strong className="mt-2 block text-3xl font-semibold">
                  {value}
                </strong>
              </div>
            ))}
          </div>
          <p className="leading-relaxed text-zinc-300">
            {conceded
              ? `The club conceded ${conceded} goals in ${scored.length} matches. Review the goals together: forwards can focus on first-line pressure, midfielders on recovery runs, and defenders and the keeper on communication. These totals don’t identify who was responsible.`
              : "Clean sheets in every available match. Review your defensive shape and communication together to identify habits worth repeating."}
          </p>
          <p className="mt-5 text-sm text-amber-300">
            Limited sample · {scored.length} recent matches, not a season trend
          </p>
        </section>
      )}
      <p className="text-sm leading-relaxed text-muted">
        These comparisons describe outcomes, not their causes. Peer averages are
        unweighted. Opposition, tactics, minutes played, and sample size affect
        the numbers; practice suggestions are general guidance.
      </p>
    </div>
  );
}
