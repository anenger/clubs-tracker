import { test } from "node:test";
import assert from "node:assert/strict";
import {
  insights,
  matchPlayer,
  matchResult,
  normalizeClubs,
  normalizeMatches,
  normalizeMembers,
  normalizeOverall,
  normalizeCareer,
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

test("normalization preserves opponent identities, roles and raw keeper/time fields", () => {
  const [match] = normalizeMatches(
    [
      {
        matchId: 9,
        timestamp: 20,
        clubs: { own: { goals: "0" }, other: { goals: "1" } },
        players: {
          own: {
            keeper: {
              playername: "Keeper",
              pos: "goalkeeper",
              saves: "7",
              cleansheetsgk: "0",
              cleansheetsdef: "1",
              goalsconceded: "1",
              secondsPlayed: "7200",
              gameTime: "99",
              man_of_the_match: "1",
              passattempts: "10",
            },
          },
          other: {
            striker: {
              playername: "Striker",
              pos: "forward",
              goals: "1",
              shots: "3",
              mom: "0",
              realtimegame: "900",
            },
          },
        },
      },
    ],
    "own",
    "friendlyMatch",
  );
  assert.ok(match);
  assert.equal(match.competition, "friendlyMatch");
  assert.equal(match.opponentId, "other");
  assert.equal(match.players[0]?.saves, 7);
  assert.equal(match.players[0]?.cleanSheets, 0);
  assert.equal(match.players[0]?.passesMade, null);
  assert.equal(match.players[0]?.secondsPlayed, 7200);
  assert.equal(match.opponentPlayers?.[0]?.id, "striker");
  assert.equal(match.opponentPlayers?.[0]?.secondsPlayed, null);
});

test("overall and career map EA field names without inventing unavailable totals", () => {
  assert.equal(normalizeOverall([]), null);
  assert.equal(normalizeOverall(null), null);
  const overall = normalizeOverall([
    {
      gamesPlayed: "20",
      ties: "3",
      wstreak: "0",
      unbeatenstreak: "4",
      skillRating: "1200",
    },
  ]);
  assert.equal(overall?.games, 20);
  assert.equal(overall?.draws, 3);
  assert.equal(overall?.winStreak, 0);
  assert.equal(overall?.goals, null);
  assert.deepEqual(normalizeCareer(null), []);
  assert.deepEqual(
    normalizeCareer({
      members: [
        {
          name: "Player",
          gamesPlayed: "8",
          goals: "0",
          favoritePosition: "goalkeeper",
          manOfTheMatch: "2",
        },
        { goals: "99" },
      ],
    }),
    [
      {
        name: "Player",
        games: 8,
        goals: 0,
        assists: null,
        rating: null,
        role: "goalkeeper",
        motm: 2,
      },
    ],
  );
});

test("demo squad goals and event denominators are coherent on both teams", () => {
  assert.equal(demo.matches.length, 24);
  for (const match of demo.matches) {
    assert.equal(
      match.players.reduce((sum, p) => sum + (p.goals ?? 0), 0),
      match.goals,
    );
    assert.equal(
      match.opponentPlayers?.reduce((sum, p) => sum + (p.goals ?? 0), 0),
      match.conceded,
    );
    for (const p of [...match.players, ...(match.opponentPlayers ?? [])]) {
      assert.ok(p.goals! <= p.shots!);
      assert.ok(p.passesMade! <= p.passAttempts!);
      assert.ok(p.tacklesMade! <= p.tackleAttempts!);
    }
  }
});
