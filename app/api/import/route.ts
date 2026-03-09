import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

async function fetchConversations(
  apiKey: string,
  cursor?: string,
  agentId?: string
) {
  const params = new URLSearchParams({ page_size: "100" });
  if (cursor) params.set("cursor", cursor);
  if (agentId) params.set("agent_id", agentId);

  const res = await fetch(
    `${ELEVENLABS_BASE}/convai/conversations?${params}`,
    {
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs API error ${res.status}: ${err}`);
  }

  return res.json();
}

async function fetchConversationDetail(apiKey: string, conversationId: string) {
  const res = await fetch(
    `${ELEVENLABS_BASE}/convai/conversations/${conversationId}`,
    {
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) return null;
  return res.json();
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

    // 1. Fetch list of conversations
    const listData = await fetchConversations(apiKey, cursor, agent_id);

    const conversations = listData.conversations || [];
    const nextCursor = listData.next_cursor || null;
    const hasMore = listData.has_more ?? false;

    if (conversations.length === 0) {
      return NextResponse.json({
        imported: 0,
        skipped: 0,
        next_cursor: null,
        has_more: false,
      });
    }

    // 2. Fetch details and upsert each conversation
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const conv of conversations) {
      try {
        const detail = await fetchConversationDetail(
          apiKey,
          conv.conversation_id
        );

        const source = detail || conv;

        const record = {
          conversation_id: source.conversation_id,
          agent_id: source.agent_id || conv.agent_id || "unknown",
          event_type: "imported",
          status: source.status || conv.status || "unknown",
          transcript: source.transcript || [],
          metadata: {
            call_duration_secs:
              source.metadata?.call_duration_secs ||
              conv.call_duration_secs ||
              null,
            termination_reason:
              source.metadata?.termination_reason ||
              conv.call_termination_reason ||
              null,
            phone_call: source.metadata?.phone_call || null,
            cost: source.metadata?.cost || null,
            start_time_unix_secs:
              source.metadata?.start_time_unix_secs ||
              conv.start_time_unix_secs ||
              null,
          },
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
          errors.push(`${source.conversation_id}: ${error.message}`);
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
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

// GET: Check if API key is configured
export async function GET() {
  const hasKey = !!process.env.ELEVENLABS_API_KEY;
  return NextResponse.json({ configured: hasKey });
}
