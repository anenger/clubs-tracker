import type { ClubData, Member, Role } from "./stats";

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
export const demo: ClubData = {
  club: { id: "demo", name: "Northside Athletic" },
  members,
  updatedAt: "2026-09-28T18:00:00.000Z",
  matches: [
    "Inter Stellar",
    "Sunday Service",
    "Real Unathletic",
    "No Good FC",
    "East End United",
    "The Invincibles",
    "AC Me Rollin",
    "FC Collective",
  ].map((opponent, i) => ({
    id: `demo-${i}`,
    timestamp: Date.UTC(2026, 8, 28 - Math.floor(i / 3), 18 - (i % 3)),
    opponent,
    goals: [3, 2, 1, 4, 2, 0, 3, 2][i] ?? null,
    conceded: [1, 0, 2, 1, 2, 1, 0, 1][i] ?? null,
    players: members.map((m, j) => ({
      id: `demo-player-${j}`,
      name: m.name,
      rating:
        j === 0
          ? ([8.8, 8.4, 7.2, 9.1, 8.0, 6.8, 8.6, 8.2][i] ?? null)
          : Math.round((7 + ((i + j) % 5) * 0.4) * 10) / 10,
      goals: j === 0 ? ([1, 0, 0, 1, 0, 0, 1, 0][i] ?? null) : 0,
      assists: j === 0 ? ([1, 2, 0, 2, 1, 0, 1, 1][i] ?? null) : 0,
    })),
  })),
};
