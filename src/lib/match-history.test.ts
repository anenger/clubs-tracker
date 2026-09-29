import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeMatchHistory } from "./match-history";
import type { Match } from "./stats";

const match: Match = {
  id: "one",
  timestamp: 1000,
  opponent: "Opponent",
  goals: 1,
  conceded: 0,
  players: [],
};
test("merging collected history prefers current results, isolates competition and bounds output", () => {
  const result = mergeMatchHistory(
    [{ ...match, goals: 2 }],
    [
      match,
      { ...match, id: "older", timestamp: 500 },
      { ...match, id: "friendly", competition: "friendlyMatch" },
    ],
    "leagueMatch",
    1,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0]?.goals, 2);
  assert.deepEqual(mergeMatchHistory([], [match], "playoffMatch"), []);
});
