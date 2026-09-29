import {
  matchPlayer,
  matchResult,
  type Match,
  type MatchPlayer,
  type Role,
} from "./stats";

const sumKeys = [
  "goals",
  "assists",
  "shots",
  "passesMade",
  "passAttempts",
  "tacklesMade",
  "tackleAttempts",
  "saves",
  "cleanSheets",
  "redCards",
  "motm",
] as const;
type StatKey = (typeof sumKeys)[number] | "rating";
type Appearance = { match: Match; player: MatchPlayer };
const valid = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0;
const values = (players: MatchPlayer[], key: StatKey) =>
  players.map((p) => p[key]).filter(valid);
const mean = (ns: number[]) =>
  ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
const total = (ns: number[]) =>
  ns.length ? ns.reduce((a, b) => a + b, 0) : null;
function basic(rows: Appearance[]) {
  const players = rows.map((r) => r.player);
  return {
    rating: mean(values(players, "rating")),
    goals: total(values(players, "goals")),
    assists: total(values(players, "assists")),
  };
}

// Percentages only use rows with both observed, coherent numerator and denominator.
function accuracy(players: MatchPlayer[], made: StatKey, attempted: StatKey) {
  const pairs = players.flatMap((p) => {
    const n = p[made],
      d = p[attempted];
    return valid(n) && valid(d) && n <= d ? [{ n, d }] : [];
  });
  const denominator = pairs.reduce((s, p) => s + p.d, 0);
  return {
    numerator: pairs.length ? pairs.reduce((s, p) => s + p.n, 0) : null,
    denominator: pairs.length ? denominator : null,
    value:
      denominator > 0
        ? (100 * pairs.reduce((s, p) => s + p.n, 0)) / denominator
        : null,
    coverage: pairs.length,
  };
}

/** Pure, bounded-history analytics. Gamertag joins are provisional and unique per match.
 * Sessions use a <=90 minute inter-appearance gap heuristic, not EA session IDs.
 * Lineup figures are associations, never a causal player impact estimate.
 */
export function analyzePlayer(matches: Match[], name: string) {
  const seen = new Set<string>();
  const rows: Appearance[] = matches
    .filter((match) => {
      const key = JSON.stringify([
        match.competition ?? "leagueMatch",
        match.id,
      ]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .flatMap((match) => {
      const player = name ? matchPlayer(match, name) : undefined;
      return player ? [{ match, player }] : [];
    })
    .sort((a, b) => b.match.timestamp - a.match.timestamp);
  const players = rows.map((r) => r.player);
  const summaryCoverage: Record<string, number> = {
    rating: values(players, "rating").length,
  };
  const sums = {} as Record<(typeof sumKeys)[number], number | null>;
  for (const key of sumKeys) {
    const ns = values(players, key);
    sums[key] = total(ns);
    summaryCoverage[key] = ns.length;
  }
  const conversion = accuracy(players, "goals", "shots");
  const passing = accuracy(players, "passesMade", "passAttempts");
  const tackling = accuracy(players, "tacklesMade", "tackleAttempts");
  summaryCoverage.conversion = conversion.coverage;
  summaryCoverage.passAccuracy = passing.coverage;
  summaryCoverage.tackleAccuracy = tackling.coverage;
  const summary = {
    ...sums,
    rating: mean(values(players, "rating")),
    conversion: conversion.value,
    passAccuracy: passing.value,
    tackleAccuracy: tackling.value,
  };
  const roles = new Map<Role, Appearance[]>();
  for (const row of rows) {
    const role = row.player.role ?? "unknown";
    roles.set(role, [...(roles.get(role) ?? []), row]);
  }
  const positions = [...roles].map(([role, group]) => ({
    role,
    appearances: group.length,
    ...basic(group),
  }));
  const recent = rows.slice(0, 5),
    previous = rows.slice(5, 10);
  const recentRatings = values(
    recent.map((r) => r.player),
    "rating",
  );
  const previousRatings = values(
    previous.map((r) => r.player),
    "rating",
  );
  const recentRating = mean(recentRatings),
    previousRating = mean(previousRatings);
  const trend = {
    recentCount: recent.length,
    previousCount: previous.length,
    recentRating,
    previousRating,
    recentRatedCount: recentRatings.length,
    previousRatedCount: previousRatings.length,
    ratingDelta:
      recentRatings.length >= 3 &&
      previousRatings.length >= 3 &&
      recentRating !== null &&
      previousRating !== null
        ? recentRating - previousRating
        : null,
  };
  const groups: Appearance[][] = [];
  for (const row of rows) {
    const group = groups.at(-1);
    const last = group?.at(-1);
    if (
      group &&
      last &&
      last.match.timestamp - row.match.timestamp <= 90 * 60_000
    )
      group.push(row);
    else groups.push([row]);
  }
  const sessions = groups.map((group) => ({
    startedAt: Math.min(...group.map((r) => r.match.timestamp)),
    endedAt: Math.max(...group.map((r) => r.match.timestamp)),
    appearances: group.length,
    wins: group.filter((r) => matchResult(r.match) === "W").length,
    draws: group.filter((r) => matchResult(r.match) === "D").length,
    losses: group.filter((r) => matchResult(r.match) === "L").length,
    ...basic(group),
  }));
  const lineup = new Map<string, { name: string; rows: Appearance[] }>();
  for (const row of rows) {
    const rosterIds = new Set<string>();
    for (const teammate of row.match.players) {
      if (
        !teammate.id ||
        teammate.id === row.player.id ||
        rosterIds.has(teammate.id)
      )
        continue;
      rosterIds.add(teammate.id);
      const group = lineup.get(teammate.id) ?? {
        name: teammate.name,
        rows: [],
      };
      group.rows.push(row);
      lineup.set(teammate.id, group);
    }
  }
  const teammates = [...lineup]
    .filter(([, group]) => group.rows.length >= 3)
    .map(([id, group]) => {
      const wins = group.rows.filter(
        (r) => matchResult(r.match) === "W",
      ).length;
      const knownResults = group.rows.filter(
        (r) => matchResult(r.match) !== "—",
      ).length;
      return {
        id,
        name: group.name,
        appearances: group.rows.length,
        wins,
        winRate: knownResults ? (100 * wins) / knownResults : null,
        ratingTogether: basic(group.rows).rating,
        knownResults,
        sample:
          group.rows.length < 10 ? ("small" as const) : ("observed" as const),
      };
    })
    .sort((a, b) => b.appearances - a.appearances || a.id.localeCompare(b.id));
  const ratings = values(players, "rating").sort((a, b) => a - b);
  const middle = Math.floor(ratings.length / 2);
  const medianRating = ratings.length
    ? ratings.length % 2
      ? ratings[middle]!
      : (ratings[middle - 1]! + ratings[middle]!) / 2
    : null;
  const average = mean(ratings);
  const ratingStdDev =
    average === null
      ? null
      : Math.sqrt(
          ratings.reduce((s, n) => s + (n - average) ** 2, 0) / ratings.length,
        );
  return {
    appearances: rows.length,
    summary,
    summaryCoverage,
    ratios: { conversion, passAccuracy: passing, tackleAccuracy: tackling },
    positions,
    trend,
    sessions,
    teammates,
    consistency: {
      medianRating,
      ratingStdDev,
      ratedAppearances: ratings.length,
    },
  };
}
