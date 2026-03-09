import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from"); // ISO date string
  const to = searchParams.get("to");
  const granularity = searchParams.get("granularity") || "day"; // day | week | month

  const truncMap: Record<string, string> = {
    day: "day",
    week: "week",
    month: "month",
  };
  const trunc = truncMap[granularity] || "day";

  // Build date filter
  let fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let toDate = to ? new Date(to) : new Date();

  // Raw query for aggregated data
  const { data: volumeData, error: volError } = await supabaseAdmin.rpc(
    "get_calls_analytics",
    {
      p_from: fromDate.toISOString(),
      p_to: toDate.toISOString(),
      p_trunc: trunc,
    }
  );

  if (volError) {
    // Fallback: fetch raw data and aggregate in JS
    const { data: rawData, error: rawError } = await supabaseAdmin
      .from("elevenlabs_calls")
      .select("event_timestamp, status, metadata, transcript")
      .gte("event_timestamp", fromDate.toISOString())
      .lte("event_timestamp", toDate.toISOString())
      .order("event_timestamp", { ascending: true });

    if (rawError) {
      return NextResponse.json({ error: rawError.message }, { status: 500 });
    }

    const aggregated = aggregateInJS(rawData || [], trunc);
    return NextResponse.json(aggregated);
  }

  return NextResponse.json(volumeData);
}

type CallRow = {
  event_timestamp: string;
  status: string;
  metadata: {
    call_duration_secs?: number;
    cost?: number;
    latency?: { p50?: number; mean?: number };
    agent_response_latency_secs?: number;
  };
  transcript: unknown[];
};

function aggregateInJS(rows: CallRow[], trunc: string) {
  const buckets: Record<string, {
    date: string;
    total: number;
    completed: number;
    failed: number;
    avg_duration: number;
    avg_latency: number;
    total_cost: number;
    avg_messages: number;
    _duration_sum: number;
    _latency_sum: number;
    _latency_count: number;
    _messages_sum: number;
  }> = {};

  for (const row of rows) {
    const d = new Date(row.event_timestamp);
    let key: string;

    if (trunc === "month") {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    } else if (trunc === "week") {
      // Get monday of the week
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      key = monday.toISOString().split("T")[0];
    } else {
      key = d.toISOString().split("T")[0];
    }

    if (!buckets[key]) {
      buckets[key] = {
        date: key,
        total: 0,
        completed: 0,
        failed: 0,
        avg_duration: 0,
        avg_latency: 0,
        total_cost: 0,
        avg_messages: 0,
        _duration_sum: 0,
        _latency_sum: 0,
        _latency_count: 0,
        _messages_sum: 0,
      };
    }

    const b = buckets[key];
    b.total++;

    if (["done", "completed"].includes(row.status)) b.completed++;
    if (["failed", "error"].includes(row.status)) b.failed++;

    const dur = row.metadata?.call_duration_secs || 0;
    b._duration_sum += dur;

    const lat =
      row.metadata?.latency?.p50 ||
      row.metadata?.latency?.mean ||
      (row.metadata?.agent_response_latency_secs
        ? row.metadata.agent_response_latency_secs * 1000
        : 0);
    if (lat > 0) {
      b._latency_sum += lat;
      b._latency_count++;
    }

    b.total_cost += row.metadata?.cost || 0;
    b._messages_sum += Array.isArray(row.transcript) ? row.transcript.length : 0;
  }

  // Compute averages
  const result = Object.values(buckets).map((b) => ({
    date: b.date,
    total: b.total,
    completed: b.completed,
    failed: b.failed,
    avg_duration: b.total > 0 ? Math.round(b._duration_sum / b.total) : 0,
    avg_latency: b._latency_count > 0 ? Math.round(b._latency_sum / b._latency_count) : 0,
    total_cost: Math.round(b.total_cost * 10000) / 10000,
    avg_messages: b.total > 0 ? Math.round(b._messages_sum / b.total) : 0,
  }));

  result.sort((a, b) => a.date.localeCompare(b.date));
  return { data: result };
}
