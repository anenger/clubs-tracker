import { withSupabase } from "npm:@supabase/server@1.8.1";

const BASE = "https://proclubs.ea.com/api/fc/";
const PLATFORM = "common-gen5";
const competitions = new Set(["leagueMatch", "friendlyMatch", "playoffMatch"]);
const endpoints = [
  "clubs/info",
  "members/stats",
  "clubs/matches",
  "clubs/overallStats",
  "members/career/stats",
] as const;

type Observation = { endpoint: string; payload: unknown; fetched_at: string };
type Result = { data: unknown; fetchedAt: string };

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validMatches(value: unknown, clubId: string) {
  return (
    Array.isArray(value) &&
    value.length <= 200 &&
    value.every(
      (match) =>
        record(match) &&
        (typeof match.matchId === "string" ||
          (typeof match.matchId === "number" &&
            Number.isFinite(match.matchId))) &&
        Number.isFinite(Number(match.timestamp)) &&
        Number(match.timestamp) >= 0 &&
        record(match.clubs) &&
        record(match.clubs[clubId]),
    )
  );
}

function clubName(info: unknown, clubId: string) {
  if (!record(info) || !record(info[clubId])) return null;
  const name = info[clubId].name;
  return typeof name === "string" && name ? name : null;
}

async function ea(endpoint: string, params: Record<string, string>) {
  const response = await fetch(
    `${BASE}${endpoint}?${new URLSearchParams({ platform: PLATFORM, ...params })}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0",
        Referer: "https://www.ea.com/",
      },
      signal: AbortSignal.timeout(12_000),
    },
  );
  if (!response.ok) throw new Error(`EA ${response.status}`);
  return { data: await response.json(), fetchedAt: new Date().toISOString() };
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "public, max-age=300" },
  });
}

export default {
  fetch: withSupabase({ auth: "publishable" }, async (request, context) => {
    if (request.method !== "GET")
      return json({ error: "Method not allowed." }, 405);

    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim();
    const clubId = url.searchParams.get("id");
    const competition = url.searchParams.get("competition") ?? "leagueMatch";

    if (query && !clubId) {
      if (query.length < 2 || query.length > 60)
        return json({ error: "Club names must be 2–60 characters." }, 400);
      try {
        const result = await ea("allTimeLeaderboard/search", {
          clubName: query,
        });
        const clubs = Array.isArray(result.data)
          ? result.data.flatMap((item) => {
              if (!record(item)) return [];
              const id = item.clubId;
              const info = record(item.clubInfo) ? item.clubInfo : null;
              const name = info?.name ?? item.clubName;
              return (typeof id === "string" || typeof id === "number") &&
                typeof name === "string"
                ? [{ id: String(id), name }]
                : [];
            })
          : [];
        return json(clubs.slice(0, 50));
      } catch {
        return json(
          { error: "EA club search is temporarily unavailable." },
          502,
        );
      }
    }

    if (
      !clubId ||
      !/^\d{1,20}$/.test(clubId) ||
      !competitions.has(competition)
    ) {
      return json({ error: "Invalid club ID or competition." }, 400);
    }

    const params = [
      { clubIds: clubId },
      { clubId },
      { clubIds: clubId, matchType: competition, maxResultCount: "10" },
      { clubIds: clubId },
      { clubId },
    ];
    const lease = await context.supabaseAdmin.rpc("claim_club_refresh", {
      p_club_id: clubId,
      p_competition: competition,
    });
    // Fail open on lease errors: an outage should not take live data down.
    if (!lease.error && lease.data === false) {
      const { data: rows, error } = await context.supabaseAdmin
        .from("club_snapshots")
        .select("endpoint,payload,fetched_at")
        .eq("platform", PLATFORM)
        .eq("club_id", clubId)
        .in("request_scope", ["", competition])
        .order("fetched_at", { ascending: false })
        .limit(50);
      const stored = endpoints.map((endpoint) => {
        const row = Array.isArray(rows)
          ? rows.find((item) => item.endpoint === endpoint)
          : undefined;
        return row ? { data: row.payload, fetchedAt: row.fetched_at } : null;
      });
      const [info, members, matches, overall, career] = stored;
      if (
        error ||
        !members ||
        !record(members.data) ||
        !Array.isArray(members.data.members)
      )
        return json(
          { error: "This club was refreshed moments ago. Try again shortly." },
          429,
        );
      const name = clubName(info?.data, clubId);
      return json({
        club: { id: clubId, name: name ?? `Club ${clubId}` },
        members: members.data,
        matches:
          matches && validMatches(matches.data, clubId) ? matches.data : [],
        overall: overall?.data ?? null,
        career: career?.data ?? null,
        updatedAt: members.fetchedAt,
      });
    }

    const results: Array<Result | null> = [];
    for (let index = 0; index < endpoints.length; index += 1) {
      try {
        results.push(await ea(endpoints[index], params[index]));
      } catch {
        results.push(null);
      }
      if (index < endpoints.length - 1)
        await new Promise((resolve) => setTimeout(resolve, 750));
    }

    const observations: Observation[] = results.flatMap((result, index) =>
      result
        ? [
            {
              endpoint: endpoints[index],
              payload: result.data,
              fetched_at: result.fetchedAt,
            },
          ]
        : [],
    );
    const [info, members, matches, overall, career] = results;
    const rawMatches =
      matches && validMatches(matches.data, clubId) ? matches.data : [];
    const name = clubName(info?.data, clubId);
    const membersValid =
      members && record(members.data) && Array.isArray(members.data.members);
    const shapesValid =
      Boolean(name) &&
      membersValid &&
      validMatches(matches?.data, clubId) &&
      Boolean(overall) &&
      Boolean(
        career && record(career.data) && Array.isArray(career.data.members),
      );
    const collection =
      results.every(Boolean) && shapesValid
        ? "complete"
        : observations.length
          ? "partial"
          : "failed";
    let persistenceWarning: string | undefined;
    if (name || rawMatches.length) {
      const { error } = await context.supabaseAdmin.rpc(
        "ingest_club_observations",
        {
          p_platform: PLATFORM,
          p_club_id: clubId,
          p_competition: competition,
          p_observations: observations,
          p_matches: rawMatches,
          p_matches_fetched_at: matches?.fetchedAt ?? null,
          p_status: collection,
        },
      );
      if (error)
        persistenceWarning =
          "Live data loaded, but this refresh could not be saved.";
    }

    if (!membersValid)
      return json(
        { error: "EA member stats are temporarily unavailable." },
        502,
      );

    return json({
      club: { id: clubId, name: name ?? `Club ${clubId}` },
      members: members.data,
      matches: rawMatches,
      overall: overall?.data ?? null,
      career: career?.data ?? null,
      updatedAt: members.fetchedAt,
      warning:
        [
          !matches || !validMatches(matches.data, clubId)
            ? "Recent matches are unavailable."
            : null,
          persistenceWarning,
        ]
          .filter(Boolean)
          .join(" ") || undefined,
    });
  }),
};
