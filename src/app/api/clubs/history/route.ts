import { type NextRequest, NextResponse } from "next/server";
import { clubIdSchema, competitionSchema, getHistory } from "@/lib/persistence";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const id = clubIdSchema.safeParse(params.get("id"));
  const competition = competitionSchema.safeParse(
    params.get("competition") ?? "leagueMatch",
  );
  const rawLimit = params.get("limit") ?? "100";
  const limit = Number(rawLimit);
  if (
    !id.success ||
    !competition.success ||
    !/^\d{1,3}$/.test(rawLimit) ||
    limit < 1 ||
    limit > 200
  ) {
    return NextResponse.json(
      { error: "Invalid club ID, competition, or limit (1–200)." },
      { status: 400 },
    );
  }
  return NextResponse.json(await getHistory(id.data, competition.data, limit), {
    headers: { "Cache-Control": "no-store" },
  });
}
