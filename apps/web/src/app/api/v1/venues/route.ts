import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listVenues } from "@opr/venues";

export async function GET(request: NextRequest) {
  const session = await requireAuth(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const venues = listVenues();

  return NextResponse.json(venues.map(v => ({
    id: v.id,
    conferenceId: v.conferenceId,
    track: v.track,
    year: v.year,
    version: v.version,
    status: v.status,
    scoreScale: v.scoreScale,
    reviewSections: v.reviewSections,
    source: v.source,
  })));
}
