import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  normalizeCareer,
  normalizeMatches,
  normalizeMembers,
  normalizeOverall,
  type Club,
  type ClubData,
} from "./stats";
import type { HistoryData, MatchType } from "./history-types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let client: SupabaseClient | null = null;

function config() {
  if (!url || !publishableKey)
    throw new Error("Public data access is not configured.");
  return { url, publishableKey };
}

function database() {
  const { url: databaseUrl, publishableKey: key } = config();
  client ??= createClient(databaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return client;
}

async function edge<T>(params: URLSearchParams, signal: AbortSignal) {
  const { url: databaseUrl, publishableKey: key } = config();
  const response = await fetch(
    `${databaseUrl}/functions/v1/clubs-api?${params}`,
    { headers: { apikey: key }, signal },
  );
  const data: unknown = await response.json();
  if (!response.ok) {
    const parsed = z.object({ error: z.string() }).safeParse(data);
    throw new Error(
      parsed.success ? parsed.data.error : "Unable to load club data.",
    );
  }
  return data as T;
}

const clubSchema = z.object({ id: z.string(), name: z.string() });

export async function searchClubs(name: string, signal: AbortSignal) {
  const data = await edge<unknown>(new URLSearchParams({ q: name }), signal);
  return z.array(clubSchema).max(50).parse(data) satisfies Club[];
}

const clubPayloadSchema = z.object({
  club: clubSchema,
  members: z.unknown(),
  matches: z.unknown(),
  overall: z.unknown().nullable(),
  career: z.unknown().nullable(),
  updatedAt: z.string().datetime({ offset: true }),
  warning: z.string().optional(),
});

export async function getClub(
  clubId: string,
  competition: MatchType,
  signal: AbortSignal,
): Promise<ClubData> {
  const raw = clubPayloadSchema.parse(
    await edge<unknown>(
      new URLSearchParams({ id: clubId, competition }),
      signal,
    ),
  );
  return {
    club: raw.club,
    members: normalizeMembers(raw.members),
    matches: normalizeMatches(raw.matches, clubId, competition),
    overall: normalizeOverall(raw.overall),
    careerMembers: normalizeCareer(raw.career),
    updatedAt: raw.updatedAt,
    warning: raw.warning,
  };
}

const trackingSchema = z.object({
  tracking_started_at: z.string().datetime({ offset: true }),
  last_synced_at: z.string().datetime({ offset: true }).nullable(),
  sync_status: z.enum(["pending", "complete", "partial", "failed"]),
});
const rowsSchema = z.array(z.object({ payload: z.unknown() })).max(201);

export async function getHistory(
  clubId: string,
  competition: MatchType,
  signal: AbortSignal,
  limit = 200,
): Promise<HistoryData> {
  if (!/^\d{1,20}$/.test(clubId) || limit < 1 || limit > 200)
    throw new Error("Invalid history request.");
  const db = database();
  const [trackingResult, matchesResult] = await Promise.all([
    db
      .from("tracked_clubs")
      .select("tracking_started_at,last_synced_at,sync_status")
      .eq("platform", "common-gen5")
      .eq("club_id", clubId)
      .eq("competition", competition)
      .abortSignal(signal)
      .maybeSingle(),
    db
      .from("club_matches")
      .select("payload")
      .eq("platform", "common-gen5")
      .eq("club_id", clubId)
      .eq("competition", competition)
      .order("match_timestamp", { ascending: false })
      .order("match_id", { ascending: false })
      .limit(limit + 1)
      .abortSignal(signal),
  ]);
  if (trackingResult.error || matchesResult.error)
    throw new Error("Collected history is temporarily unavailable.");
  const tracking = trackingResult.data
    ? trackingSchema.parse(trackingResult.data)
    : null;
  const rows = rowsSchema.parse(matchesResult.data);
  return {
    status: "ready",
    matches: normalizeMatches(
      rows.slice(0, limit).map((row) => row.payload),
      clubId,
      competition,
    ),
    trackingStartedAt: tracking?.tracking_started_at ?? null,
    lastSyncedAt: tracking?.last_synced_at ?? null,
    hasMore: rows.length > limit,
    warning: `${!tracking ? "This competition has not been tracked yet. " : tracking.sync_status !== "complete" ? `Latest collection is ${tracking.sync_status}. ` : ""}Collected observations only; EA exposes recent matches, so gaps and earlier matches may be missing.`,
  };
}
