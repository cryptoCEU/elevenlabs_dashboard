import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

async function fetchConversations(apiKey: string, cursor?: string, agentId?: string) {
  const params = new URLSearchParams({ page_size: "100" });
  if (cursor) params.set("cursor", cursor);
  if (agentId) params.set("agent_id", agentId);

  const res = await fetch(`${ELEVENLABS_BASE}/convai/conversations?${params}`, {
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs API error ${res.status}: ${err}`);
  }
  return res.json();
}

async function fetchConversationDetail(apiKey: string, conversationId: string) {
  const res = await fetch(`${ELEVENLABS_BASE}/convai/conversations/${conversationId}`, {
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
  });
  if (!res.ok) return null;
  return res.json();
}

// Recursively search for a key in a nested object
function deepGet(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (obj == null) return null;
    if (key in obj) return obj[key];
    // Search one level deeper
    for (const v of Object.values(obj)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const found = (v as Record<string, unknown>)[key];
        if (found !== undefined) return found;
      }
    }
  }
  return null;
}

function extractMetadata(source: Record<string, unknown>, conv: Record<string, unknown>) {
  // ElevenLabs can nest data differently for failed vs completed calls
  // Try multiple paths for each field
  const raw = source as Record<string, unknown>;

  const duration =
    deepGet(raw, "call_duration_secs") ||
    deepGet(raw, "duration_secs") ||
    deepGet(raw, "duration") ||
    conv.call_duration_secs ||
    null;

  const cost =
    deepGet(raw, "cost") ||
    deepGet(raw, "cost_credits") ||
    null;

  const terminationReason =
    deepGet(raw, "termination_reason") ||
    deepGet(raw, "call_termination_reason") ||
    conv.call_termination_reason ||
    null;

  const startTime =
    deepGet(raw, "start_time_unix_secs") ||
    deepGet(raw, "start_time") ||
    conv.start_time_unix_secs ||
    null;

  // Latency — can be nested under metadata.latency or at top level
  const metaObj = (raw.metadata || {}) as Record<string, unknown>;
  const latency =
    metaObj.latency ||
    raw.latency ||
    null;

  const agentLatency =
    deepGet(raw, "agent_response_latency_secs") ||
    deepGet(raw, "response_latency_secs") ||
    null;

  const llmLatency =
    deepGet(raw, "llm_response_latency_secs") ||
    deepGet(raw, "llm_latency_secs") ||
    null;

  const ttsLatency =
    deepGet(raw, "tts_latency_secs") ||
    deepGet(raw, "tts_latency") ||
    null;

  // Phone — try multiple locations
  const phoneCall =
    metaObj.phone_call ||
    raw.phone_call ||
    (conv.caller_id ? { from: conv.caller_id } : null) ||
    null;

  return {
    call_duration_secs: duration,
    termination_reason: terminationReason,
    phone_call: phoneCall,
    cost: cost,
    start_time_unix_secs: startTime,
    latency: latency,
    agent_response_latency_secs: agentLatency,
    llm_response_latency_secs: llmLatency,
    tts_latency_secs: ttsLatency,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cursor, agent_id } = body;

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY no configurada en las variables de entorno" },
        { status: 500 }
      );
    }

    const listData = await fetchConversations(apiKey, cursor, agent_id);
    const conversations = listData.conversations || [];
    const nextCursor = listData.next_cursor || null;
    const hasMore = listData.has_more ?? false;

    if (conversations.length === 0) {
      return NextResponse.json({ imported: 0, skipped: 0, next_cursor: null, has_more: false });
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const conv of conversations) {
      try {
        const detail = await fetchConversationDetail(apiKey, conv.conversation_id);
        const source = detail || conv;

        const record = {
          conversation_id: source.conversation_id || conv.conversation_id,
          agent_id: source.agent_id || conv.agent_id || "unknown",
          event_type: "imported",
          status: source.status || conv.status || "unknown",
          transcript: source.transcript || [],
          metadata: extractMetadata(source, conv),
          analysis: source.analysis || null,
          raw_payload: source,
          event_timestamp: conv.start_time_unix_secs
            ? new Date(conv.start_time_unix_secs * 1000).toISOString()
            : new Date().toISOString(),
        };

        const { error } = await supabaseAdmin
          .from("elevenlabs_calls")
          .upsert(record, { onConflict: "conversation_id,event_type" });

        if (error) {
          errors.push(`${record.conversation_id}: ${error.message}`);
          skipped++;
        } else {
          imported++;
        }
      } catch (e) {
        skipped++;
        errors.push(`${conv.conversation_id}: ${String(e)}`);
      }
    }

    return NextResponse.json({
      imported,
      skipped,
      next_cursor: hasMore ? nextCursor : null,
      has_more: hasMore,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("Import error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  const hasKey = !!process.env.ELEVENLABS_API_KEY;
  return NextResponse.json({ configured: hasKey });
}
