import "server-only";
import { ApiError } from "./api-error";
import {
  normalizeClubs,
  normalizeMatches,
  normalizeMembers,
  normalizeOverall,
  normalizeCareer,
  type ClubData,
} from "./stats";
import type { MatchType } from "./history-types";
import {
  clubIdSchema,
  competitionSchema,
  persistObservations,
  type Observation,
} from "./persistence";

const BASE = "https://proclubs.ea.com/api/fc/";
type CachedResponse = { data: unknown; fetchedAt: number; expires: number };
const pending = new Map<string, Promise<CachedResponse>>();
const cache = new Map<string, CachedResponse>();
let queue = Promise.resolve();

async function ea(
  endpoint: string,
  params: Record<string, string>,
): Promise<CachedResponse> {
  const url = `${BASE}${endpoint}?${new URLSearchParams({ platform: "common-gen5", ...params })}`;
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return cached;
  const existing = pending.get(url);
  if (existing) return existing;
  if (pending.size >= 20)
    throw new ApiError("Live data is busy. Please try again shortly.");
  const queuedAt = Date.now();
  const task = queue.then(async () => {
    try {
      if (Date.now() - queuedAt > 60_000)
        throw new ApiError("Live data is busy. Please try again shortly.");
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": "Mozilla/5.0",
          Referer: "https://www.ea.com/",
        },
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      });
      if (!response.ok)
        throw new ApiError(
          `EA returned ${response.status}. Live club data is temporarily unavailable.`,
        );
      const data: unknown = await response.json();
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      const result = {
        data,
        fetchedAt: Date.now(),
        expires: Date.now() + 5 * 60_000,
      };
      cache.set(url, result);
      return result;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("EA could not be reached. Please try again shortly.");
    }
  });
  queue = task.then(
    () => new Promise<void>((r) => setTimeout(r, 1000)),
    () => new Promise<void>((r) => setTimeout(r, 1000)),
  );
  pending.set(url, task);
  try {
    return await task;
  } finally {
    pending.delete(url);
  }
}
export async function searchClubs(name: string) {
  return normalizeClubs(
    (await ea("allTimeLeaderboard/search", { clubName: name })).data,
  );
}
async function collectClub(id: string, competition: MatchType) {
  clubIdSchema.parse(id);
  competitionSchema.parse(competition);
  const endpoints = [
    "clubs/info",
    "members/stats",
    "clubs/matches",
    "clubs/overallStats",
    "members/career/stats",
  ];
  const responses = await Promise.allSettled([
    ea("clubs/info", { clubIds: id }),
    ea("members/stats", { clubId: id }),
    ea("clubs/matches", {
      clubIds: id,
      matchType: competition,
      maxResultCount: "10",
    }),
    ea("clubs/overallStats", { clubIds: id }),
    ea("members/career/stats", { clubId: id }),
  ]);
  const observations: Observation[] = endpoints.flatMap((endpoint, index) => {
    const response = responses[index];
    return response?.status === "fulfilled"
      ? [{ endpoint, ...response.value }]
      : [];
  });
  const complete =
    responses.every((r) => r.status === "fulfilled") &&
    observations.every((observation) => {
      try {
        switch (observation.endpoint) {
          case "members/stats":
            normalizeMembers(observation.data);
            return true;
          case "members/career/stats":
            if (observation.data == null) return false;
            normalizeCareer(observation.data);
            return true;
          case "clubs/overallStats":
            return normalizeOverall(observation.data) !== null;
          case "clubs/info": {
            const info = observation.data;
            if (!info || typeof info !== "object" || !(id in info))
              return false;
            const club = (info as Record<string, unknown>)[id];
            return Boolean(
              club &&
              typeof club === "object" &&
              "name" in club &&
              typeof club.name === "string",
            );
          }
          default:
            return true; // Match payloads are validated by persistence before ingestion.
        }
      } catch {
        return false;
      }
    });
  const persistence = await persistObservations(
    id,
    competition,
    observations,
    complete,
  );
  return { responses, persistence };
}

export async function syncClub(
  id: string,
  competition: MatchType = "leagueMatch",
) {
  const { persistence } = await collectClub(id, competition);
  return persistence;
}

export async function getClub(
  id: string,
  competition: MatchType = "leagueMatch",
): Promise<ClubData> {
  const {
    responses: [info, members, matches, overall, career],
    persistence,
  } = await collectClub(id, competition);
  if (members.status === "rejected") throw members.reason;
  const clubInfo =
    info.status === "fulfilled" &&
    info.value.data &&
    typeof info.value.data === "object"
      ? (info.value.data as Record<string, { name?: string }>)[id]
      : undefined;
  let normalizedMatches: ReturnType<typeof normalizeMatches> = [];
  let warning: string | undefined;
  try {
    if (matches.status === "rejected") throw matches.reason;
    normalizedMatches = normalizeMatches(
      matches.value.data,
      id,
      competition,
    ).slice(0, 200);
  } catch {
    warning =
      "Recent matches are unavailable. Your member stats are still available.";
  }
  let normalizedOverall: ReturnType<typeof normalizeOverall> = null;
  let careerMembers: ReturnType<typeof normalizeCareer> = [];
  try {
    if (overall.status === "fulfilled")
      normalizedOverall = normalizeOverall(overall.value.data);
  } catch {
    /* Optional endpoint. */
  }
  try {
    if (career.status === "fulfilled")
      careerMembers = normalizeCareer(career.value.data);
  } catch {
    /* Optional endpoint. */
  }
  if (persistence.warning)
    warning = [warning, persistence.warning].filter(Boolean).join(" ");
  return {
    club: {
      id,
      name: typeof clubInfo?.name === "string" ? clubInfo.name : `Club ${id}`,
    },
    members: normalizeMembers(members.value.data),
    matches: normalizedMatches,
    overall: normalizedOverall,
    careerMembers,
    updatedAt: new Date(
      Math.min(
        members.value.fetchedAt,
        matches.status === "fulfilled" ? matches.value.fetchedAt : Infinity,
      ),
    ).toISOString(),
    warning,
  };
}
