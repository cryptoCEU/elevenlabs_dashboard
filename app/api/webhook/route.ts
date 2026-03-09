import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ElevenLabsWebhookPayload } from "@/types/elevenlabs";

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret if configured
    const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = request.headers.get("xi-webhook-secret") ||
        request.headers.get("x-webhook-secret");
      if (signature !== webhookSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body: ElevenLabsWebhookPayload = await request.json();

    // Store every event type but focus on conversation_ended for full data
    const { data: eventData } = body;

    const record = {
      conversation_id: eventData.conversation_id || `unknown-${Date.now()}`,
      agent_id: eventData.agent_id || "unknown",
      event_type: body.type,
      status: eventData.status || "unknown",
      transcript: eventData.transcript || [],
      metadata: eventData.metadata || {},
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

// ElevenLabs may send GET to verify endpoint
export async function GET() {
  return NextResponse.json({ status: "Webhook endpoint active" });
}
