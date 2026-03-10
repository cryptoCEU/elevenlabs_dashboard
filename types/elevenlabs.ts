export interface TranscriptMessage {
  role: "agent" | "user";
  message: string | null;
  time_in_call_secs?: number;
  conversation_turn_metrics?: {
    metrics?: {
      convai_llm_service_ttfb?: { elapsed_time: number };
      convai_llm_service_ttf_sentence?: { elapsed_time: number };
      convai_llm_service_tt_last_sentence?: { elapsed_time: number };
      convai_tts_service_ttfb?: { elapsed_time: number };
    };
  } | null;
  tool_calls?: unknown[];
  tool_results?: unknown[];
}

export interface CallAnalysis {
  call_successful?: string;
  transcript_summary?: string;
  data_collection_results?: Record<string, unknown>;
  evaluation_criteria_results?: Record<string, unknown>;
}

export interface CallMetadata {
  start_time_unix_secs?: number;
  call_duration_secs?: number;
  cost?: number;
  termination_reason?: string;
  latency?: {
    p50?: number;
    p90?: number;
    p95?: number;
    p99?: number;
    mean?: number;
    max?: number;
  };
  agent_response_latency_secs?: number;
  llm_response_latency_secs?: number;
  tts_latency_secs?: number;
  user_wait_time_secs?: number;
  phone_call?: {
    direction?: string;
    from?: string;
    to?: string;
  };
}

export interface ElevenLabsCall {
  id: string;
  conversation_id: string;
  agent_id: string;
  status: string;
  transcript: TranscriptMessage[];
  metadata: CallMetadata;
  analysis: CallAnalysis | null;
  raw_payload: Record<string, unknown>;
  event_timestamp: string | null;
  created_at: string;
}

export interface ElevenLabsWebhookPayload {
  type: string;
  event_timestamp: number;
  data: {
    conversation_id: string;
    agent_id: string;
    status: string;
    transcript?: TranscriptMessage[];
    metadata?: CallMetadata;
    analysis?: CallAnalysis;
    [key: string]: unknown;
  };
}
