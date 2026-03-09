export interface TranscriptMessage {
  role: "agent" | "user";
  message: string;
  time_in_call_secs?: number;
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
