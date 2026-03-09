import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data, error } = await supabaseAdmin
    .from("elevenlabs_calls")
    .select("*")
    .eq("conversation_id", params.id)
    .order("event_timestamp", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Merge all events for this conversation
  const merged = data.reduce((acc, row) => {
    return {
      ...acc,
      ...row,
      transcript: row.transcript?.length ? row.transcript : acc.transcript,
      analysis: row.analysis || acc.analysis,
    };
  }, {});

  return NextResponse.json({ call: merged, events: data });
}
