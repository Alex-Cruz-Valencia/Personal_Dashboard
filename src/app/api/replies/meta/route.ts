import { NextResponse } from "next/server";
import { features } from "@/lib/config";
import { listGmailLabels } from "@/lib/google/gmail";

/** Existing user labels, for the "move to a folder" picker. Fetched lazily when it opens. */
export async function GET() {
  if (!features.google) {
    return NextResponse.json({ labels: [] });
  }
  try {
    const labels = await listGmailLabels();
    return NextResponse.json({ labels });
  } catch (err) {
    return NextResponse.json(
      { labels: [], error: (err as Error).message },
      { status: 502 },
    );
  }
}
