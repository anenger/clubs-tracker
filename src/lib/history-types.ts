import type { Match } from "./stats";

export type MatchType = "leagueMatch" | "friendlyMatch" | "playoffMatch";
export const competitions: { value: MatchType; label: string }[] = [
  { value: "leagueMatch", label: "League" },
  { value: "friendlyMatch", label: "Friendlies" },
  { value: "playoffMatch", label: "Playoffs" },
];

export type HistoryData = {
  status: "disabled" | "ready" | "error";
  matches: Match[];
  trackingStartedAt: string | null;
  lastSyncedAt: string | null;
  hasMore: boolean;
  warning?: string;
};
