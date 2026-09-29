import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Postgres history schema: idempotent ingestion, public reads, private writes and scheduler leases", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon, authenticated, service_role;",
    );
    await db.exec(
      await readFile(
        new URL(
          "../../supabase/migrations/20260928000100_club_history.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../../supabase/migrations/20260929015351_public_history_reads.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../../supabase/migrations/20260929020247_club_refresh_leases.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec("set role service_role");
    const firstTime = "2026-09-28T12:00:00.000Z";
    const laterTime = "2026-09-28T12:05:00.000Z";
    const rawMatch = {
      matchId: "match-1",
      timestamp: 1790590000,
      clubs: { "42": { goals: "1" } },
      players: {},
    };
    async function ingest(
      clubId = "42",
      competition = "leagueMatch",
      fetchedAt = firstTime,
      goals = "1",
    ) {
      const payload = { ...rawMatch, clubs: { [clubId]: { goals } } };
      return db.query(
        "select public.ingest_club_observations($1,$2,$3,$4::jsonb,$5::jsonb,$6::timestamptz,$7)",
        [
          "common-gen5",
          clubId,
          competition,
          JSON.stringify([
            {
              endpoint: "members/stats",
              fetched_at: firstTime,
              payload: { members: [] },
            },
            {
              endpoint: "clubs/matches",
              fetched_at: fetchedAt,
              payload: [payload],
            },
          ]),
          JSON.stringify([payload]),
          fetchedAt,
          "complete",
        ],
      );
    }

    await t.test(
      "cached responses deduplicate; newer observations win and preserve tracking start",
      async () => {
        await ingest();
        const before = await db.query<{ tracking_started_at: Date }>(
          "select tracking_started_at from tracked_clubs",
        );
        await ingest();
        assert.equal(
          (
            await db.query<{ n: number }>(
              "select count(*)::int as n from club_snapshots",
            )
          ).rows[0]?.n,
          2,
        );
        assert.equal(
          (
            await db.query<{ n: number }>(
              "select count(*)::int as n from club_matches",
            )
          ).rows[0]?.n,
          1,
        );
        await ingest("42", "leagueMatch", laterTime, "2");
        await ingest();
        const row = (
          await db.query<{
            payload: typeof rawMatch;
            first_seen_at: Date;
            last_seen_at: Date;
          }>("select payload,first_seen_at,last_seen_at from club_matches")
        ).rows[0];
        assert.equal(row?.payload.clubs["42"].goals, "2");
        assert.equal(row?.first_seen_at.toISOString(), firstTime);
        assert.equal(row?.last_seen_at.toISOString(), laterTime);
        const after = await db.query<{ tracking_started_at: Date }>(
          "select tracking_started_at from tracked_clubs",
        );
        assert.equal(
          after.rows[0]?.tracking_started_at.toISOString(),
          before.rows[0]?.tracking_started_at.toISOString(),
        );
        await ingest("42", "friendlyMatch");
        assert.equal(
          (
            await db.query<{ n: number }>(
              "select count(*)::int as n from club_snapshots where endpoint='members/stats'",
            )
          ).rows[0]?.n,
          1,
        );
        assert.equal(
          (
            await db.query<{ n: number }>(
              "select count(*)::int as n from club_matches",
            )
          ).rows[0]?.n,
          2,
        );
      },
    );

    await t.test(
      "malformed ingestion rolls back tracking and all dependent writes",
      async () => {
        await assert.rejects(
          db.query(
            "select public.ingest_club_observations($1,$2,$3,$4::jsonb,$5::jsonb,$6::timestamptz,$7)",
            [
              "common-gen5",
              "999",
              "leagueMatch",
              JSON.stringify([
                { endpoint: "not-allowed", fetched_at: firstTime, payload: {} },
              ]),
              "[]",
              null,
              "partial",
            ],
          ),
        );
        assert.equal(
          (
            await db.query<{ n: number }>(
              "select count(*)::int as n from tracked_clubs where club_id='999'",
            )
          ).rows[0]?.n,
          0,
        );
        await assert.rejects(
          db.query(
            "select public.ingest_club_observations('common-gen5','999','leagueMatch',null,'[]',null,'failed')",
          ),
        );
      },
    );

    await t.test(
      "public roles read bounded history columns but cannot inspect snapshots or write",
      async () => {
        await db.exec("reset role");
        const rls = await db.query<{ relrowsecurity: boolean }>(
          "select relrowsecurity from pg_class where oid in ('public.tracked_clubs'::regclass,'public.club_matches'::regclass,'public.club_snapshots'::regclass)",
        );
        assert.equal(rls.rows.length, 3);
        assert.ok(rls.rows.every((r) => r.relrowsecurity));
        for (const role of ["anon", "authenticated"]) {
          await db.exec(`set role ${role}`);
          assert.equal(
            (
              await db.query(
                "select club_id,competition,tracking_started_at,last_synced_at,sync_status from public.tracked_clubs",
              )
            ).rows.length,
            2,
          );
          assert.equal(
            (
              await db.query(
                "select match_id,match_timestamp,payload from public.club_matches",
              )
            ).rows.length,
            2,
          );
          await assert.rejects(db.query("select * from public.club_matches"));
          await assert.rejects(db.query("select * from public.club_snapshots"));
          await assert.rejects(
            db.query("select public.claim_tracked_clubs(2)"),
          );
          await assert.rejects(
            db.query("select public.claim_club_refresh('42','leagueMatch')"),
          );
          await assert.rejects(ingest());
          await db.exec("reset role");
        }
        await db.exec("set role service_role");
      },
    );

    await t.test(
      "refresh leases allow one live refresh per club and competition per window",
      async () => {
        const claim = async (club: string, competition = "leagueMatch") =>
          (
            await db.query<{ claimed: boolean }>(
              "select public.claim_club_refresh($1,$2) as claimed",
              [club, competition],
            )
          ).rows[0]?.claimed;
        assert.equal(await claim("77"), true);
        assert.equal(await claim("77"), false);
        assert.equal(await claim("77", "friendlyMatch"), true);
        assert.equal(await claim("78"), true);
        await db.exec(
          "update club_refresh_leases set refreshed_at=now()-interval '6 minutes' where club_id='77'",
        );
        assert.equal(await claim("77"), true);
        await assert.rejects(claim("not-a-club"));
      },
    );

    await t.test(
      "scheduler claims at most two, leases exclude repeats and oldest pairs advance",
      async () => {
        await ingest("43");
        await ingest("44");
        await db.exec(
          "update tracked_clubs set last_attempt_at=now()-interval '20 minutes'",
        );
        const first = await db.query<{ club_id: string; competition: string }>(
          "select * from public.claim_tracked_clubs(999)",
        );
        assert.equal(first.rows.length, 2);
        const next = await db.query<{ club_id: string; competition: string }>(
          "select * from public.claim_tracked_clubs(999)",
        );
        assert.equal(next.rows.length, 2);
        assert.ok(
          next.rows.every(
            (row) =>
              !first.rows.some(
                (previous) =>
                  previous.club_id === row.club_id &&
                  previous.competition === row.competition,
              ),
          ),
        );
        assert.equal(
          (await db.query("select * from public.claim_tracked_clubs(2)")).rows
            .length,
          0,
        );
      },
    );
  } finally {
    await db.close();
  }
});
