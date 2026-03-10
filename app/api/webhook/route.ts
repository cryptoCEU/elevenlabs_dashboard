import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ElevenLabsWebhookPayload } from "@/types/elevenlabs";

function deepGet(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (obj == null) return null;
    if (key in obj) return obj[key];
    for (const v of Object.values(obj)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const found = (v as Record<string, unknown>)[key];
        if (found !== undefined) return found;
      }
    }
  }
  return null;
}

function extractMetadata(eventData: Record<string, unknown>) {
  const meta = (eventData.metadata || {}) as Record<string, unknown>;
  return {
    call_duration_secs:
      meta.call_duration_secs ||
      deepGet(eventData, "call_duration_secs", "duration_secs") ||
      null,
    cost:
      meta.cost ||
      deepGet(eventData, "cost", "cost_credits") ||
      null,
    termination_reason:
      meta.termination_reason ||
      deepGet(eventData, "termination_reason", "call_termination_reason") ||
      null,
    start_time_unix_secs:
      meta.start_time_unix_secs ||
      deepGet(eventData, "start_time_unix_secs", "start_time") ||
      null,
    latency:
      meta.latency ||
      eventData.latency ||
      null,
    agent_response_latency_secs:
      meta.agent_response_latency_secs ||
      deepGet(eventData, "agent_response_latency_secs", "response_latency_secs") ||
      null,
    llm_response_latency_secs:
      meta.llm_response_latency_secs ||
      deepGet(eventData, "llm_response_latency_secs", "llm_latency_secs") ||
      null,
    tts_latency_secs:
      meta.tts_latency_secs ||
      deepGet(eventData, "tts_latency_secs", "tts_latency") ||
      null,
    phone_call:
      meta.phone_call ||
      eventData.phone_call ||
      null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature =
        request.headers.get("xi-webhook-secret") ||
        request.headers.get("x-webhook-secret");
      if (signature !== webhookSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body: ElevenLabsWebhookPayload = await request.json();
    const eventData = body.data as Record<string, unknown>;

    const record = {
      conversation_id: eventData.conversation_id || `unknown-${Date.now()}`,
      agent_id: eventData.agent_id || "unknown",
      event_type: body.type,
      status: eventData.status || "unknown",
      transcript: eventData.transcript || [],
      metadata: extractMetadata(eventData),
      analysis: eventData.analysis || null,
      raw_payload: body,
      event_timestamp: body.event_timestamp
        ? new Date(body.event_timestamp * 1000).toISOString()
        : new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("elevenlabs_calls")
      .upsert(record, { onConflict: "conversation_id,event_type" });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ received: true, type: body.type });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Webhook endpoint active" });
}
