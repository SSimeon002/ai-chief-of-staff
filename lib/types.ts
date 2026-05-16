// Inbound message shape (from messages.json).
export type Channel = "email" | "slack" | "whatsapp";

export interface IncomingMessage {
  id: number;
  channel: Channel;
  from: string;
  to?: string;
  subject?: string;
  channel_name?: string; // Slack channel
  timestamp: string; // ISO
  body: string;
}

// Output shapes produced by the LLM.
export type TriageCategory = "ignore" | "delegate" | "decide";
export type FlagSeverity = "critical" | "high" | "medium";
export type Confidence = "high" | "medium" | "low";

export interface TriageItem {
  message_id: number;
  category: TriageCategory;
  confidence: Confidence;
  reasoning: string;
  assignee?: string; // present for delegate
  drafted_response: string;
  superseded_by?: number[]; // ids of later messages that replace/cancel this one
  thread_note?: string; // optional human note about thread context
}

export interface Flag {
  severity: FlagSeverity;
  title: string;
  detail: string;
  related_message_ids: number[];
}

export interface ChiefOfStaffOutput {
  briefing: string; // markdown
  flags: Flag[];
  triage: TriageItem[];
  generated_at: string; // ISO, filled in server-side
}

// Triage sensitivity — how aggressively the system should surface things.
// "conservative" → bias toward Ignore/Delegate, smaller Decide list.
// "balanced" → default judgment.
// "aggressive" → bias toward Decide, surface borderline items.
export type Sensitivity = "conservative" | "balanced" | "aggressive";

export interface ProcessOptions {
  sensitivity?: Sensitivity;
  current_time?: string; // pre-formatted human-readable, e.g. "Friday, May 15, 2026, 9:32 AM"
}

export interface ProcessRequestBody extends ProcessOptions {
  messages: IncomingMessage[];
}

export interface ProcessErrorBody {
  error: string;
}
