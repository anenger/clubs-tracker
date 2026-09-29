import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { syncClub } from "@/lib/ea";
import { claimTrackedClubs, persistenceEnabled } from "@/lib/persistence";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (
    !secret ||
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!persistenceEnabled())
    return NextResponse.json({ status: "disabled", processed: 0 });
  try {
    const clubs = await claimTrackedClubs();
    const results = [];
    for (const club of clubs) {
      results.push({
        id: club.club_id,
        competition: club.competition,
        ...(await syncClub(club.club_id, club.competition)),
      });
    }
    return NextResponse.json(
      {
        status: results.some((r) => r.status === "error") ? "error" : "ready",
        processed: results.length,
        results,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        status: "error",
        error: "Scheduled collection is temporarily unavailable.",
      },
      { status: 503 },
    );
  }
}
