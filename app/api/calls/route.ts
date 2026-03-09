import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";
  const agentId = searchParams.get("agent_id") || "";

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabaseAdmin
    .from("elevenlabs_calls")
    .select("*", { count: "exact" })
    .order("event_timestamp", { ascending: false })
    .range(from, to);

  if (agentId) query = query.eq("agent_id", agentId);
  if (search) query = query.ilike("conversation_id", `%${search}%`);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ calls: data, total: count, page, limit });
}
