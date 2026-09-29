import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzePlayer } from "./analytics";
import type { Match, MatchPlayer } from "./stats";

function match(
  id: number,
  player: Partial<MatchPlayer> = {},
  extra: Partial<Match> = {},
): Match {
  return {
    id: String(id),
    timestamp: id * 30 * 60_000,
    opponent: "Other",
    goals: 1,
    conceded: 0,
    players: [
      {
        id: "p",
        name: "Player",
        rating: null,
        goals: null,
        assists: null,
        ...player,
      },
    ],
    ...extra,
  };
}

test("weighted ratios exclude unpaired and impossible values, while observed sums retain coverage", () => {
  const result = analyzePlayer(
    [
      match(1, {
        passesMade: 8,
        passAttempts: 10,
        goals: 1,
        shots: 2,
        tacklesMade: 1,
        tackleAttempts: 2,
      }),
      match(2, {
        passesMade: 45,
        passAttempts: 90,
        goals: 0,
        shots: 8,
        tacklesMade: 8,
        tackleAttempts: 10,
      }),
      match(3, {
        passesMade: null,
        passAttempts: 100,
        goals: null,
        shots: 100,
        tacklesMade: 5,
      }),
      match(4, {
        passesMade: 20,
        passAttempts: null,
        goals: 10,
        shots: null,
        tackleAttempts: 100,
      }),
      match(5, { passesMade: 12, passAttempts: 10 }),
    ],
    "player",
  );
  assert.equal(result.summary.passAccuracy, 53);
  assert.equal(result.ratios.passAccuracy.numerator, 53);
  assert.equal(result.ratios.passAccuracy.denominator, 100);
  assert.equal(result.summary.conversion, 10);
  assert.equal(result.summary.tackleAccuracy, 75);
  assert.equal(result.summary.goals, 11);
  assert.equal(result.summaryCoverage.goals, 3);
  assert.equal(result.summaryCoverage.passAccuracy, 2);
  assert.equal(result.summary.rating, null);
  assert.equal(result.summary.saves, null);
  assert.equal(
    analyzePlayer([match(1, { passesMade: 0, passAttempts: 0 })], "Player")
      .summary.passAccuracy,
    null,
  );
});

test("deduplicates competition+ID, joins unique own-side names and never mutates input", () => {
  const one = match(1, { rating: 8 });
  const ambiguous = match(
    2,
    {},
    {
      players: [
        one.players[0]!,
        { ...one.players[0]!, id: "other", name: "PLAYER" },
      ],
    },
  );
  const input = [
    one,
    one,
    { ...one, competition: "friendlyMatch" as const },
    ambiguous,
    match(3, { name: "Absent" }, { opponentPlayers: one.players }),
  ];
  const before = JSON.stringify(input);
  const result = analyzePlayer(input, "PLAYER");
  assert.equal(result.appearances, 2);
  assert.equal(result.consistency.ratedAppearances, 2);
  assert.equal(JSON.stringify(input), before);
  assert.equal(analyzePlayer(input, "").appearances, 0);
});

test("role splits, keeper totals, rolling windows and session boundary use matched appearances", () => {
  const matches = Array.from({ length: 10 }, (_, i) =>
    match(
      i,
      {
        role: i < 5 ? "defender" : "goalkeeper",
        rating: i < 5 ? 6 : 8,
        saves: i < 5 ? null : 3,
        cleanSheets: i < 5 ? 0 : 1,
      },
      { timestamp: i < 5 ? i * 30 * 60_000 : (i * 30 + 91) * 60_000 },
    ),
  );
  const result = analyzePlayer(matches.reverse(), "Player");
  assert.equal(result.trend.ratingDelta, 2);
  assert.equal(result.trend.recentCount, 5);
  assert.equal(
    result.positions.find((p) => p.role === "goalkeeper")?.appearances,
    5,
  );
  assert.equal(result.summary.saves, 15);
  assert.equal(result.summaryCoverage.saves, 5);
  assert.equal(result.sessions.length, 2);
  assert.equal(result.sessions[0]?.wins, 5);
  assert.equal(result.consistency.medianRating, 7);
  assert.equal(result.consistency.ratingStdDev, 1);
  assert.equal(
    analyzePlayer(matches.slice(0, 7), "Player").trend.ratingDelta,
    null,
  );
  assert.equal(
    analyzePlayer([match(0), match(3)], "Player").sessions.length,
    1,
  );
  assert.equal(
    analyzePlayer(
      [match(0), match(3, {}, { timestamp: 90 * 60_000 + 1 })],
      "Player",
    ).sessions.length,
    2,
  );
});

test("lineup joins actual IDs, counts each roster once, requires three matches and excludes unknown outcomes", () => {
  const matches = Array.from({ length: 4 }, (_, i) => {
    const m = match(i, { rating: 8 });
    const teammate = {
      ...m.players[0]!,
      id: "teammate",
      name: i === 3 ? "Renamed" : "Same",
    };
    m.players.push(teammate, teammate);
    if (i < 2) m.players.push({ ...teammate, id: "short-sample" });
    if (i === 3) {
      m.goals = null;
      m.conceded = null;
    }
    if (i === 2) m.outcome = "L";
    return m;
  });
  const result = analyzePlayer(matches, "Player");
  assert.equal(result.teammates.length, 1);
  assert.equal(result.teammates[0]?.id, "teammate");
  assert.equal(result.teammates[0]?.name, "Renamed");
  assert.equal(result.teammates[0]?.appearances, 4);
  assert.equal(result.teammates[0]?.knownResults, 3);
  assert.equal(result.teammates[0]?.winRate, 200 / 3);
  assert.equal(result.teammates[0]?.sample, "small");
});

test("empty history is unknown, not a zero-performance sample", () => {
  const result = analyzePlayer([], "Player");
  assert.equal(result.appearances, 0);
  assert.equal(result.summary.goals, null);
  assert.equal(result.consistency.medianRating, null);
  assert.equal(result.trend.ratingDelta, null);
  assert.deepEqual(result.sessions, []);
});
