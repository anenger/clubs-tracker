import "server-only";
import { ApiError } from "./api-error";
import {
  normalizeClubs,
  normalizeMatches,
  normalizeMembers,
  type ClubData,
} from "./stats";

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
  const task = queue.then(async () => {
    try {
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
export async function getClub(id: string): Promise<ClubData> {
  const [info, members, matches] = await Promise.allSettled([
    ea("clubs/info", { clubIds: id }),
    ea("members/stats", { clubId: id }),
    ea("clubs/matches", {
      clubIds: id,
      matchType: "leagueMatch",
      maxResultCount: "10",
    }),
  ]);
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
    normalizedMatches = normalizeMatches(matches.value.data, id);
  } catch {
    warning =
      "Recent matches are unavailable. Your member stats are still available.";
  }
  return {
    club: {
      id,
      name: typeof clubInfo?.name === "string" ? clubInfo.name : `Club ${id}`,
    },
    members: normalizeMembers(members.value.data),
    matches: normalizedMatches,
    updatedAt: new Date(
      Math.min(
        members.value.fetchedAt,
        matches.status === "fulfilled" ? matches.value.fetchedAt : Infinity,
      ),
    ).toISOString(),
    warning,
  };
}
