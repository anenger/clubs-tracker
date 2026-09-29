import { z } from "zod";

export type Role =
  "forward" | "midfielder" | "defender" | "goalkeeper" | "unknown";
export type Member = {
  name: string;
  proName: string;
  role: Role;
  games: number | null;
  goals: number | null;
  assists: number | null;
  rating: number | null;
  passing: number | null;
  shooting: number | null;
  tackling: number | null;
  cleanSheets: number | null;
  motm: number | null;
};
export type Club = { id: string; name: string };
export type Competition = "leagueMatch" | "friendlyMatch" | "playoffMatch";
export type MatchPlayer = {
  id: string;
  name: string;
  rating: number | null;
  goals: number | null;
  assists: number | null;
  role?: Role | null;
  shots?: number | null;
  passAttempts?: number | null;
  passesMade?: number | null;
  tackleAttempts?: number | null;
  tacklesMade?: number | null;
  saves?: number | null;
  goalsConceded?: number | null;
  cleanSheets?: number | null;
  redCards?: number | null;
  motm?: number | null;
  secondsPlayed?: number | null;
};
export type ClubOverall = {
  games: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goals: number | null;
  conceded: number | null;
  skillRating: number | null;
  winStreak: number | null;
  unbeatenStreak: number | null;
  bestDivision: number | null;
  promotions: number | null;
  relegations: number | null;
  gamesPlayedPlayoff: number | null;
  reputationTier: number | null;
  leagueAppearances: number | null;
};
export type CareerMember = Pick<
  Member,
  "name" | "role" | "games" | "goals" | "assists" | "rating" | "motm"
>;
export type Match = {
  id: string;
  timestamp: number;
  opponent: string;
  goals: number | null;
  conceded: number | null;
  outcome?: "W" | "D" | "L";
  awardedByDnf?: boolean;
  dnf?: boolean;
  competition?: Competition;
  opponentId?: string | null;
  players: MatchPlayer[];
  opponentPlayers?: MatchPlayer[];
};
export type ClubData = {
  club: Club;
  members: Member[];
  matches: Match[];
  updatedAt: string;
  warning?: string;
  overall?: ClubOverall | null;
  careerMembers?: CareerMember[];
};

const record = z.record(z.string(), z.unknown());
export function number(value: unknown): number | null {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    value === "" ||
    (typeof value === "string" && !value.trim())
  )
    return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
export function normalizeMembers(raw: unknown): Member[] {
  if (raw == null || (Array.isArray(raw) && raw.length === 0)) return [];
  const data = z.object({ members: z.array(record) }).parse(raw);
  return data.members
    .filter((m) => typeof m.name === "string" && m.name)
    .map((m) => ({
      name: text(m.name),
      proName: text(m.proName),
      role: ["forward", "midfielder", "defender", "goalkeeper"].includes(
        text(m.favoritePosition),
      )
        ? (m.favoritePosition as Role)
        : "unknown",
      games: number(m.gamesPlayed),
      goals: number(m.goals),
      assists: number(m.assists),
      rating: number(m.ratingAve),
      passing: number(m.passSuccessRate),
      shooting: number(m.shotSuccessRate),
      tackling: number(m.tackleSuccessRate),
      cleanSheets: number(
        m.favoritePosition === "goalkeeper"
          ? m.cleanSheetsGK
          : m.cleanSheetsDef,
      ),
      motm: number(m.manOfTheMatch),
    }));
}
export function normalizeClubs(raw: unknown): Club[] {
  return z
    .array(
      z.object({
        clubId: z.union([z.string(), z.number()]),
        clubInfo: z.object({ name: z.string() }).optional(),
        clubName: z.string().optional(),
      }),
    )
    .parse(raw ?? [])
    .map((c) => ({
      id: String(c.clubId),
      name: c.clubInfo?.name ?? c.clubName ?? `Club ${c.clubId}`,
    }));
}
function role(value: unknown): Role {
  return ["forward", "midfielder", "defender", "goalkeeper"].includes(
    text(value),
  )
    ? (value as Role)
    : "unknown";
}

// Raw EA fields: 1erkandogan/fc27-clubs-api/docs/endpoints.md.
// Keep secondsPlayed verbatim: gameTime/realtimegame are not interchangeable.
function normalizePlayers(
  players: Record<string, Record<string, unknown>> = {},
): MatchPlayer[] {
  return Object.entries(players).map(([id, p]) => {
    const position = role(p.pos);
    return {
      id,
      name: text(p.playername),
      role: position,
      rating: number(p.rating),
      goals: number(p.goals),
      assists: number(p.assists),
      shots: number(p.shots),
      passAttempts: number(p.passattempts),
      passesMade: number(p.passesmade),
      tackleAttempts: number(p.tackleattempts),
      tacklesMade: number(p.tacklesmade),
      saves: number(p.saves),
      goalsConceded: number(p.goalsconceded),
      cleanSheets: number(
        position === "goalkeeper"
          ? p.cleansheetsgk
          : position === "defender"
            ? p.cleansheetsdef
            : p.cleansheetsany,
      ),
      redCards: number(p.redcards),
      motm: number(p.man_of_the_match) ?? number(p.mom),
      secondsPlayed: number(p.secondsPlayed),
    };
  });
}

export function normalizeOverall(raw: unknown): ClubOverall | null {
  const parsed = record.safeParse(Array.isArray(raw) ? raw[0] : raw);
  if (!parsed.success || !Object.keys(parsed.data).length) return null;
  const p = parsed.data;
  return {
    games: number(p.gamesPlayed),
    wins: number(p.wins),
    draws: number(p.ties),
    losses: number(p.losses),
    goals: number(p.goals),
    conceded: number(p.goalsAgainst),
    skillRating: number(p.skillRating),
    winStreak: number(p.wstreak),
    unbeatenStreak: number(p.unbeatenstreak),
    bestDivision: number(p.bestDivision),
    promotions: number(p.promotions),
    relegations: number(p.relegations),
    gamesPlayedPlayoff: number(p.gamesPlayedPlayoff),
    reputationTier: number(p.reputationtier),
    leagueAppearances: number(p.leagueAppearances),
  };
}

export function normalizeCareer(raw: unknown): CareerMember[] {
  if (raw == null || (Array.isArray(raw) && raw.length === 0)) return [];
  return z
    .object({ members: z.array(record) })
    .parse(raw)
    .members.filter((p) => typeof p.name === "string" && p.name)
    .map((p) => ({
      name: text(p.name),
      role: role(p.favoritePosition),
      games: number(p.gamesPlayed),
      goals: number(p.goals),
      assists: number(p.assists),
      rating: number(p.ratingAve),
      motm: number(p.manOfTheMatch),
    }));
}

export function normalizeMatches(
  raw: unknown,
  clubId: string,
  competition: Competition = "leagueMatch",
): Match[] {
  const matches = z
    .array(
      z.object({
        matchId: z.union([z.string(), z.number()]),
        timestamp: z.coerce.number().finite().nonnegative(),
        clubs: z.record(z.string(), record),
        players: z.record(z.string(), z.record(z.string(), record)).optional(),
      }),
    )
    .parse(raw ?? []);
  return matches
    .flatMap((m) => {
      const own = m.clubs[clubId];
      if (!own) return [];
      const opponentEntry = Object.entries(m.clubs).find(
        ([id]) => id !== clubId,
      );
      const opponent = opponentEntry?.[1];
      const details = record.safeParse(opponent?.details);
      return {
        id: String(m.matchId),
        competition,
        opponentId: opponentEntry?.[0] ?? null,
        timestamp: m.timestamp * 1000,
        opponent: details.success
          ? text(details.data.name, "Unknown club")
          : "Unknown club",
        goals: number(own.goals),
        conceded: number(own.goalsAgainst) ?? number(opponent?.goals),
        outcome:
          number(own.wins) === 1 || number(own.winnerByDnf) === 1
            ? ("W" as const)
            : number(own.losses) === 1
              ? ("L" as const)
              : number(own.ties) === 1
                ? ("D" as const)
                : undefined,
        awardedByDnf: number(own.winnerByDnf) === 1,
        dnf:
          number(own.winnerByDnf) === 1 ||
          number(opponent?.winnerByDnf) === 1 ||
          [10, 16385].includes(number(own.result) ?? -1),
        players: normalizePlayers(m.players?.[clubId]),
        opponentPlayers: normalizePlayers(
          opponentEntry ? m.players?.[opponentEntry[0]] : undefined,
        ),
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}
export function perGame(value: number | null, games: number | null) {
  return value !== null && games !== null && games > 0 ? value / games : null;
}
export const metrics = [
  {
    key: "rating",
    label: "Match rating",
    unit: "",
    get: (m: Member) => m.rating,
  },
  {
    key: "goals",
    label: "Goals / match",
    unit: "",
    get: (m: Member) => perGame(m.goals, m.games),
  },
  {
    key: "assists",
    label: "Assists / match",
    unit: "",
    get: (m: Member) => perGame(m.assists, m.games),
  },
  {
    key: "passing",
    label: "Pass accuracy",
    unit: "%",
    get: (m: Member) => m.passing,
  },
  {
    key: "shooting",
    label: "Shot conversion",
    unit: "%",
    get: (m: Member) => m.shooting,
  },
  {
    key: "tackling",
    label: "Tackle success",
    unit: "%",
    get: (m: Member) => m.tackling,
  },
  {
    key: "cleanSheets",
    label: "Clean sheets / match",
    unit: "",
    get: (m: Member) => perGame(m.cleanSheets, m.games),
  },
] as const;
export type MetricKey = (typeof metrics)[number]["key"];

export function matchResult(match: Match): "W" | "D" | "L" | "—" {
  if (match.outcome) return match.outcome;
  if (match.goals === null || match.conceded === null) return "—";
  return match.goals > match.conceded
    ? "W"
    : match.goals < match.conceded
      ? "L"
      : "D";
}
export function format(value: number | null, digits = 1) {
  return value === null
    ? "—"
    : value.toLocaleString("en-GB", { maximumFractionDigits: digits });
}
export function insights(member: Member, members: Member[]) {
  const peers = members.filter(
    (m) =>
      m.name !== member.name && m.role === member.role && (m.games ?? 0) >= 5,
  );
  if (member.role === "unknown" || (member.games ?? 0) < 5 || !peers.length)
    return [];
  const relevant =
    member.role === "goalkeeper"
      ? ["rating", "passing", "cleanSheets"]
      : member.role === "defender"
        ? ["rating", "passing", "tackling", "cleanSheets"]
        : member.role === "midfielder"
          ? ["rating", "assists", "passing", "tackling"]
          : ["rating", "goals", "assists", "shooting"];
  return metrics
    .filter((m) => relevant.includes(m.key))
    .flatMap((metric) => {
      const value = metric.get(member);
      const values = peers
        .map(metric.get)
        .filter((n): n is number => n !== null);
      if (value === null || !values.length) return [];
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      if (average === 0) return [];
      return [
        {
          key: metric.key,
          label: metric.label,
          unit: metric.unit,
          value,
          average,
          gap: (value - average) / average,
          peers: values.length,
        },
      ];
    })
    .sort((a, b) => a.gap - b.gap);
}

// Member responses lack player IDs. Only associate a unique exact gamertag;
// do not imply this verifies ownership or survives account renames.
export function matchPlayer(match: Match, name: string) {
  const found = match.players.filter(
    (p) => p.name.toLowerCase() === name.toLowerCase(),
  );
  return found.length === 1 ? found[0] : undefined;
}
