import { test } from "node:test";
import assert from "node:assert/strict";
import {
  insights,
  matchPlayer,
  matchResult,
  normalizeClubs,
  normalizeMatches,
  normalizeMembers,
  number,
  perGame,
} from "./stats";
import { demo } from "./demo";

test("EA numbers preserve unknowns instead of inventing zeroes", () => {
  for (const input of [null, undefined, "", " ", "not a number", -1, Infinity])
    assert.equal(number(input), null);
  assert.equal(number("0"), 0);
  assert.equal(number("7.4"), 7.4);
  assert.equal(perGame(2, 0), null);
  const [member] = normalizeMembers({
    members: [
      {
        name: "Player",
        gamesPlayed: "8",
        favoritePosition: "defender",
        goals: "0",
      },
    ],
  });
  assert.ok(member);
  assert.equal(member.goals, 0);
  assert.equal(member.rating, null);
  assert.equal(member.role, "defender");
});

test("matches use score data, convert timestamps, and retain player IDs", () => {
  const [match] = normalizeMatches(
    [
      {
        matchId: "1",
        timestamp: 1000,
        clubs: {
          "42": { goals: "3", result: "0" },
          "43": { goals: "2", details: { name: "Opponent" } },
        },
        players: { "42": { "99": { playername: "Player", rating: "8.1" } } },
      },
    ],
    "42",
  );
  assert.ok(match);
  assert.ok(match.players[0]);
  assert.equal(match.timestamp, 1_000_000);
  assert.equal(match.conceded, 2);
  assert.equal(match.players[0].id, "99");
  assert.equal(matchPlayer(match, "player")?.rating, 8.1);
  assert.equal(
    matchPlayer(
      {
        ...match,
        players: [...match.players, { ...match.players[0], id: "100" }],
      },
      "Player",
    ),
    undefined,
  );
  assert.deepEqual(normalizeMatches(null, "42"), []);
});

test("insights compare only eligible role peers and require a meaningful baseline", () => {
  const member = demo.members[0];
  assert.ok(member);
  const result = insights(member, demo.members);
  assert.equal(result.find((r) => r.key === "passing")?.average, 88);
  assert.equal(result.find((r) => r.key === "passing")?.peers, 2);
  assert.equal(result[0]?.key, "passing");
  assert.deepEqual(insights({ ...member, games: 4 }, demo.members), []);
  assert.deepEqual(insights({ ...member, role: "unknown" }, demo.members), []);
  assert.deepEqual(insights(member, [member]), []);
  assert.deepEqual(
    insights(member, [member, { ...member, name: "new", games: 0 }]),
    [],
  );
});

test("search accepts nested or top-level names and empty responses", () => {
  assert.deepEqual(normalizeClubs(null), []);
  assert.deepEqual(
    normalizeClubs([
      { clubId: 1, clubName: "Top level" },
      { clubId: "2", clubInfo: { name: "Nested" } },
    ]),
    [
      { id: "1", name: "Top level" },
      { id: "2", name: "Nested" },
    ],
  );
});

test("official outcomes take priority over score for forfeits", () => {
  const [match] = normalizeMatches(
    [
      {
        matchId: "1",
        timestamp: 1000,
        clubs: { "42": { goals: "0", goalsAgainst: "2", winnerByDnf: "1" } },
      },
    ],
    "42",
  );
  assert.ok(match);
  assert.equal(matchResult(match), "W");
  assert.equal(match.awardedByDnf, true);
  assert.equal(matchResult({ ...match, outcome: undefined }), "L");
  assert.equal(matchResult({ ...match, outcome: undefined, goals: null }), "—");
});
