import {
  normalizeMatches,
  type ClubData,
  type Member,
  type Role,
} from "./stats";

const rows: [
  string,
  string,
  Role,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
][] = [
  ["andrewszn", "Andrew", "midfielder", 42, 12, 24, 8.2, 81, 38, 62],
  ["luca.wav", "Luca", "forward", 46, 38, 12, 8.6, 78, 52, 34],
  ["noah10", "Noah", "midfielder", 38, 9, 18, 7.8, 89, 35, 68],
  ["saintkai", "Kai", "forward", 41, 29, 15, 8.1, 82, 46, 39],
  ["milesaway", "Miles", "defender", 44, 3, 7, 7.6, 88, 24, 74],
  ["theo.exe", "Theo", "midfielder", 40, 8, 19, 7.9, 87, 31, 65],
  ["olliegloves", "Ollie", "goalkeeper", 39, 0, 2, 7.5, 76, 0, 0],
  ["benji4", "Benji", "defender", 36, 2, 5, 7.4, 85, 20, 71],
];
const members: Member[] = rows.map(
  (
    [
      name,
      proName,
      role,
      games,
      goals,
      assists,
      rating,
      passing,
      shooting,
      tackling,
    ],
    i,
  ) => ({
    name,
    proName,
    role,
    games,
    goals,
    assists,
    rating,
    passing,
    shooting,
    tackling,
    cleanSheets: i === 6 ? 14 : 11,
    motm: i === 0 ? 8 : 4,
  }),
);
const opponents = [
  "Inter Stellar",
  "Sunday Service",
  "Real Unathletic",
  "No Good FC",
  "East End United",
  "The Invincibles",
  "AC Me Rollin",
  "FC Collective",
];

// Illustrative raw-shaped observations go through the same normalizer as live data.
function squad(
  i: number,
  goals: number,
  conceded: number,
  opponentId?: string,
) {
  const scorers = [1, 3, 0, 1];
  const assisters = [0, 2, 5, 3];
  return Object.fromEntries(
    members.map((member, j) => {
      const role = j === 0 && i % 4 === 0 ? "forward" : member.role;
      const scored = scorers
        .slice(0, goals)
        .filter((index) => index === j).length;
      const assists = assisters
        .slice(0, goals)
        .filter((index) => index === j).length;
      const passes = 18 + ((i + j) % 25);
      const tackles = role === "goalkeeper" ? 0 : 2 + ((i + j) % 7);
      return [
        opponentId ? `${opponentId}-player-${j}` : `demo-player-${j}`,
        {
          playername: opponentId
            ? `${opponents[i % 8]} ${member.proName}`
            : member.name,
          pos: role,
          goals: String(scored),
          assists: String(assists),
          rating: String(
            j === 0
              ? [8.8, 8.4, 7.2, 9.1, 8.0, 6.8, 8.6, 8.2][i % 8]
              : Math.round((7 + ((i + j) % 5) * 0.4) * 10) / 10,
          ),
          shots: String(role === "goalkeeper" ? 0 : scored + 1 + ((i + j) % 3)),
          passattempts: String(passes),
          passesmade: String(passes - 2 - ((i + j) % 5)),
          tackleattempts: String(tackles),
          tacklesmade: String(Math.max(0, tackles - ((i + j) % 3))),
          saves: String(role === "goalkeeper" ? 2 + (i % 4) : 0),
          goalsconceded: String(conceded),
          cleansheetsgk: String(
            role === "goalkeeper" && conceded === 0 ? 1 : 0,
          ),
          cleansheetsdef: String(role === "defender" && conceded === 0 ? 1 : 0),
          cleansheetsany: String(conceded === 0 ? 1 : 0),
          redcards: String(i === 14 && j === 3 ? 1 : 0),
          man_of_the_match: String(
            j === 1 && (goals > conceded || (goals === conceded && !opponentId))
              ? 1
              : 0,
          ),
          secondsPlayed: "5400",
        },
      ];
    }),
  );
}

const matches = Array.from({ length: 24 }, (_, i) => {
  const opponentId = `demo-opponent-${i % 8}`;
  const goals = [3, 2, 1, 4, 2, 0, 3, 2][i % 8]!;
  const conceded = [1, 0, 2, 1, 2, 1, 0, 1][i % 8]!;
  return normalizeMatches(
    [
      {
        matchId: `demo-${i}`,
        timestamp:
          Date.UTC(2026, 8, 28 - Math.floor(i / 4), 18, -(i % 4) * 30) / 1000,
        clubs: {
          demo: { goals: String(goals), goalsAgainst: String(conceded) },
          [opponentId]: {
            goals: String(conceded),
            goalsAgainst: String(goals),
            details: { name: opponents[i % 8] },
          },
        },
        players: {
          demo: squad(i, goals, conceded),
          [opponentId]: squad(i, conceded, goals, opponentId),
        },
      },
    ],
    "demo",
    i >= 20 ? "playoffMatch" : i >= 16 ? "friendlyMatch" : "leagueMatch",
  )[0]!;
});

export const demo: ClubData = {
  club: { id: "demo", name: "Northside Athletic" },
  members,
  updatedAt: "2026-09-28T18:00:00.000Z",
  matches,
  overall: {
    games: 52,
    wins: 32,
    draws: 8,
    losses: 12,
    goals: 112,
    conceded: 63,
    skillRating: 1842,
    winStreak: 2,
    unbeatenStreak: 2,
    bestDivision: 2,
    promotions: 4,
    relegations: 1,
    gamesPlayedPlayoff: 8,
    reputationTier: 5,
    leagueAppearances: 6,
  },
  careerMembers: members.map((m) => ({
    name: m.name,
    role: m.role,
    games: m.games,
    goals: m.goals,
    assists: m.assists,
    rating: m.rating,
    motm: m.motm,
  })),
};
