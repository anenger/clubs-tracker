import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { normalizeMatches } from "./stats";
import type { HistoryData, MatchType } from "./history-types";

export const PLATFORM = "common-gen5";
export const competitionSchema = z.enum([
  "leagueMatch",
  "friendlyMatch",
  "playoffMatch",
]);
export const clubIdSchema = z.string().regex(/^\d{1,20}$/);
export type Observation = {
  endpoint: string;
  data: unknown;
  fetchedAt: number;
};
const object = z.record(z.string(), z.unknown());
const rawMatchSchema = z
  .object({
    matchId: z.union([
      z.string().min(1).max(100),
      z.number().finite().nonnegative(),
    ]),
    timestamp: z.coerce.number().finite().nonnegative().max(253402300799),
    clubs: z.record(z.string(), object),
    players: z.record(z.string(), z.record(z.string(), object)).optional(),
  })
  .passthrough();

export function persistenceEnabled() {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    process.env.SUPABASE_SECRET_KEY,
  );
}
function database() {
  if (!persistenceEnabled()) return null;
  return createClient(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      db: { retry: false, timeout: 5000 },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal
              ? AbortSignal.any([init.signal, AbortSignal.timeout(5000)])
              : AbortSignal.timeout(5000),
          }),
      },
    },
  );
}

// Source and stored JSON are both untrusted inputs.
export function validatedRawMatches(raw: unknown, clubId: string) {
  return z
    .array(rawMatchSchema)
    .max(200)
    .refine(
      (matches) => matches.every((m) => Boolean(m.clubs[clubId])),
      "Match does not contain the requested club",
    )
    .parse(raw ?? []);
}

export async function persistObservations(
  clubId: string,
  competition: MatchType,
  observations: Observation[],
  complete: boolean,
): Promise<{
  status: "disabled" | "ready" | "error";
  collection?: "complete" | "partial" | "failed";
  warning?: string;
}> {
  if (!persistenceEnabled()) return { status: "disabled" };
  try {
    const db = database()!;
    clubIdSchema.parse(clubId);
    competitionSchema.parse(competition);
    const matchObservation = observations.find(
      (o) => o.endpoint === "clubs/matches",
    );
    let rawMatches: ReturnType<typeof validatedRawMatches> = [];
    let matchesValid = false;
    if (matchObservation) {
      try {
        rawMatches = validatedRawMatches(matchObservation.data, clubId);
        normalizeMatches(rawMatches, clubId, competition);
        matchesValid = true;
      } catch {
        complete = false;
      }
    }
    const info = observations.find((o) => o.endpoint === "clubs/info")?.data;
    const clubInfo =
      info && typeof info === "object"
        ? (info as Record<string, unknown>)[clubId]
        : undefined;
    const verifiedClub =
      Boolean(
        clubInfo &&
        typeof clubInfo === "object" &&
        "name" in clubInfo &&
        typeof clubInfo.name === "string",
      ) || rawMatches.length > 0;
    if (!verifiedClub) {
      // Failed public requests must not enroll arbitrary IDs for perpetual polling.
      const existing = await db
        .from("tracked_clubs")
        .select("club_id")
        .eq("platform", PLATFORM)
        .eq("club_id", clubId)
        .eq("competition", competition)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (!existing.data)
        return {
          status: "ready",
          collection: "failed",
          warning:
            "EA could not verify this club; history tracking has not started.",
        };
    }
    const collection =
      complete && matchesValid
        ? "complete"
        : observations.length
          ? "partial"
          : "failed";
    const { error } = await db.rpc("ingest_club_observations", {
      p_platform: PLATFORM,
      p_club_id: clubId,
      p_competition: competition,
      p_observations: observations.map((o) => ({
        endpoint: o.endpoint,
        payload: o.data,
        fetched_at: new Date(o.fetchedAt).toISOString(),
      })),
      p_matches: matchesValid ? rawMatches : [],
      p_matches_fetched_at: matchesValid
        ? new Date(matchObservation!.fetchedAt).toISOString()
        : null,
      p_status: collection,
    });
    if (error) throw error;
    return { status: "ready", collection };
  } catch {
    return {
      status: "error",
      warning: "Live data is available, but history could not be saved.",
    };
  }
}

const trackedSchema = z.object({
  tracking_started_at: z.string().datetime({ offset: true }),
  last_synced_at: z.string().datetime({ offset: true }).nullable(),
  sync_status: z.enum(["pending", "complete", "partial", "failed"]),
});
export async function getHistory(
  clubId: string,
  competition: MatchType,
  limit: number,
): Promise<HistoryData> {
  const empty = {
    matches: [],
    trackingStartedAt: null,
    lastSyncedAt: null,
    hasMore: false,
  };
  if (!persistenceEnabled())
    return {
      ...empty,
      status: "disabled",
      warning: "History collection is not configured.",
    };
  try {
    clubIdSchema.parse(clubId);
    competitionSchema.parse(competition);
    z.number().int().min(1).max(200).parse(limit);
    const db = database()!;
    const [tracking, matches] = await Promise.all([
      db
        .from("tracked_clubs")
        .select("tracking_started_at,last_synced_at,sync_status")
        .eq("platform", PLATFORM)
        .eq("club_id", clubId)
        .eq("competition", competition)
        .maybeSingle(),
      db
        .from("club_matches")
        .select("payload")
        .eq("platform", PLATFORM)
        .eq("club_id", clubId)
        .eq("competition", competition)
        .order("match_timestamp", { ascending: false })
        .order("match_id", { ascending: false })
        .limit(limit + 1),
    ]);
    if (tracking.error || matches.error) throw new Error("History read failed");
    const meta = tracking.data ? trackedSchema.parse(tracking.data) : null;
    const rows = z
      .array(z.object({ payload: z.unknown() }))
      .max(201)
      .parse(matches.data);
    return {
      status: "ready",
      matches: normalizeMatches(
        validatedRawMatches(
          rows.slice(0, limit).map((r) => r.payload),
          clubId,
        ),
        clubId,
        competition,
      ).slice(0, limit),
      trackingStartedAt: meta?.tracking_started_at ?? null,
      lastSyncedAt: meta?.last_synced_at ?? null,
      hasMore: rows.length > limit,
      warning: `${!meta ? "This competition has not been tracked yet. " : meta.sync_status !== "complete" ? `Latest collection is ${meta.sync_status}. ` : ""}Collected observations only; EA exposes recent matches, so gaps and earlier matches may be missing.`,
    };
  } catch {
    return {
      ...empty,
      status: "error",
      warning: "Stored history is temporarily unavailable.",
    };
  }
}

export async function claimTrackedClubs() {
  const db = database();
  if (!db) return [];
  const { data, error } = await db.rpc("claim_tracked_clubs", { p_limit: 2 });
  if (error) throw error;
  return z
    .array(z.object({ club_id: clubIdSchema, competition: competitionSchema }))
    .max(2)
    .parse(data);
}
