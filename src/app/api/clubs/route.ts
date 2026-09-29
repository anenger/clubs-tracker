import { type NextRequest, NextResponse } from "next/server";
import { getClub, searchClubs } from "@/lib/ea";
import { ApiError } from "@/lib/api-error";
import { competitionSchema } from "@/lib/persistence";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const competition = competitionSchema.safeParse(
    request.nextUrl.searchParams.get("competition") ?? "leagueMatch",
  );
  if (!competition.success)
    return NextResponse.json(
      { error: "Invalid competition." },
      { status: 400 },
    );
  if (
    !(id && /^\d{1,20}$/.test(id)) &&
    !(query && query.length >= 2 && query.length <= 60 && !id)
  ) {
    return NextResponse.json(
      {
        error:
          "Enter a club name between 2 and 60 characters, or a valid club ID.",
      },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      id ? await getClub(id, competition.data) : await searchClubs(query!),
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : "EA returned an unexpected response. Please try again later.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
