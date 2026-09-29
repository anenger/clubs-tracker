import type { Match } from "./stats";
import type { MatchType } from "./history-types";

/** Current EA responses take precedence over previously collected copies. */
export function mergeMatchHistory(
  recent: Match[],
  stored: Match[],
  competition: MatchType,
  limit = 200,
): Match[] {
  const byId = new Map<string, Match>();
  for (const match of [...stored, ...recent]) {
    if ((match.competition ?? "leagueMatch") !== competition) continue;
    byId.set(match.id, match);
  }
  return [...byId.values()]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}
