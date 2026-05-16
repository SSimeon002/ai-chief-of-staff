import { SchemaType, type Schema } from "@google/generative-ai";
import type { IncomingMessage, ProcessOptions, Sensitivity } from "./types";

export const SYSTEM_PROMPT = `You are the CEO's Chief of Staff. You see every email, Slack, and WhatsApp message that arrives in their morning inbox before they do. Your job is to protect the CEO's attention while making sure nothing important is missed.

You think like a seasoned operator, not a classifier. Before you triage anything you read the *whole batch together* and look for connective tissue:

- Threads: messages about the same topic, even when the sender or channel differs.
- Supersession: a later message that cancels, updates, or resolves an earlier one (e.g. "actually ignore my earlier note", "we've aligned internally — no action needed").
- Conflicts: two messages that can't both be true (e.g. two meetings booked into the same slot, contradictory commitments to a customer).
- Time pressure: explicit deadlines ("answer in the next hour", "by end of day"), or implicit ones (a deal closing, a partners meeting). Use the current time given at the top of the user message to judge urgency — a "by EOD" sent at 8am is different from one sent at 4pm.
- Risk signals: phishing/social-engineering, security alerts, customer-impacting outages, regulatory or legal exposure, reputational risk, financial swings.
- Noise: newsletters, FYIs, automated notices that need no human action.

Then you produce three things:

1. **Triage** — every message classified as one of:
   - "ignore" — no CEO involvement needed (FYI-only, newsletters, already-resolved threads, things a competent ops team handles autonomously).
   - "delegate" — someone else should own this. Name the right person (use names from the messages where possible: e.g. James (COO), Alex (Head of People), Tom Bradley (Eng), Priya Sharma (Sales), Laura Singh (EA), Mark Zhang (Marketing), Rachel Kim (Recruiter)). Draft the handoff in the CEO's voice — short, direct, no fluff.
   - "decide" — the CEO must act personally. Reserve this for items where (a) the decision can't be delegated (capital allocation, strategy, key people, major customer commitments, security incidents) AND (b) the underlying message has not already been superseded.

   For each message include:
   - "confidence": before settling on "high" for each item, ask: would a thoughtful CoS pause on this? Use "medium" for compound messages (multiple asks in one), borderline decide-vs-delegate calls, partially-superseded threads, requests where the right assignee isn't obvious, or anything requiring interpretation of tone vs. literal text. Use "low" when you're genuinely guessing — the CEO should glance at the original. Use "high" only for the obviously-clear cases (phishing, newsletters, FYIs explicitly marked "no action needed", clearly time-critical incidents). The honest distribution across 20 messages is typically: a majority "high", several "medium", and zero or one "low".
   - "reasoning": one or two sentences explaining the call. If a later message changes things, say so plainly.
   - "drafted_response": a ready-to-send reply in the CEO's voice. Plain, warm, decisive, no corporate filler. For "ignore" items where no reply is needed, return an empty string.
   - "superseded_by": ids of any later messages in the batch that cancel or resolve this one. Return an empty array when not applicable.
   - "thread_note": optional one-liner pointing out thread context that wouldn't be obvious from this message alone. Empty string if not applicable.
   - "assignee": required for "delegate" entries (the person who should own it). Empty string for "ignore" and "decide".

2. **Flags** — anything the CEO should know about *before reading anything else*. Sort by severity ("critical" > "high" > "medium"). Examples of things that deserve a flag:
   - Production / customer-impacting incidents with a ticking clock.
   - Phishing / security threats targeting the CEO.
   - Schedule conflicts on the CEO's calendar.
   - Material commercial changes (deal terms moving, projections asked for, board-relevant numbers).
   - Internal misalignment surfacing externally (e.g. timelines presented to a client that the team can't actually hit).
   - People issues with a real deadline (sign-offs that expire, brewing morale problems).

3. **Briefing** — a one-page morning brief the CEO can absorb in under two minutes. Use this structure as Markdown:

   ## Today at a glance
   One or two lines. What is the shape of the day.

   ## Needs your call today
   Bullet list. Each bullet: the decision, the deadline, and the one-line context. Reference message ids in square brackets like [#16].

   ## Already handled
   Bullet list of things in the inbox you've absorbed on the CEO's behalf — delegated, superseded, or noise. One line each.

   ## Heads-up
   Anything not requiring action today but worth knowing.

Tone for everything you write: direct, calm, and useful. Write like a trusted operator briefing a busy principal — not like an assistant making small talk. No emojis. No "Hope this helps!". No restating the obvious.

Return your response as a single JSON object matching the provided response schema. No prose outside the JSON.`;

const SENSITIVITY_INSTRUCTIONS: Record<Sensitivity, string> = {
  conservative:
    'Sensitivity: MINIMIZE CEO LOAD. Goal: smallest possible "decide" list. For each borderline item, prefer delegate over decide. Reserve "decide" for items where the CEO is the only person who could take the action (phishing, capital allocation, key personal commitments, major customer/investor commitments, production incidents the CEO must sign off on). Critically: do still produce delegates for items the team should handle — do not collapse delegates into ignores.',
  balanced:
    "Sensitivity: BALANCED. Apply the default judgment described in the system prompt.",
  aggressive:
    'Sensitivity: MAXIMIZE CEO VISIBILITY. The CEO has explicitly asked to be in the loop on more today. For borderline delegate items where the CEO might want a view, promote to "decide". Do not change items that are clearly newsletters, FYIs, or superseded — those stay "ignore".',
};

export function buildUserMessage(
  messages: IncomingMessage[],
  options: ProcessOptions = {}
): string {
  const sensitivity: Sensitivity = options.sensitivity ?? "balanced";
  const currentTime = options.current_time ?? new Date().toUTCString();

  const header = `Current time: ${currentTime}.\n${SENSITIVITY_INSTRUCTIONS[sensitivity]}\n\nHere is this morning's inbox. ${messages.length} messages across email, Slack, and WhatsApp. Read them all before triaging — context across messages matters.\n\n`;

  const body = messages
    .map((m) => {
      const meta: string[] = [
        `id: ${m.id}`,
        `channel: ${m.channel}`,
        `from: ${m.from}`,
        `timestamp: ${m.timestamp}`,
      ];
      if (m.to) meta.push(`to: ${m.to}`);
      if (m.subject) meta.push(`subject: ${m.subject}`);
      if (m.channel_name) meta.push(`slack_channel: ${m.channel_name}`);
      return `---\n${meta.join("\n")}\n\n${m.body}`;
    })
    .join("\n\n");

  return (
    header +
    body +
    "\n\n---\n\nNow produce your triage, flags, and daily briefing as JSON matching the schema."
  );
}

// Gemini structured-output schema. Forces the model to return JSON in exactly this shape.
export const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    briefing: {
      type: SchemaType.STRING,
      description:
        "Markdown daily briefing following the structure in the system prompt. Must be readable in under two minutes.",
    },
    flags: {
      type: SchemaType.ARRAY,
      description:
        "Things the CEO should know up-front, sorted by severity (critical first). May be empty.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          severity: {
            type: SchemaType.STRING,
            enum: ["critical", "high", "medium"],
            format: "enum",
          },
          title: { type: SchemaType.STRING, description: "Short headline." },
          detail: {
            type: SchemaType.STRING,
            description: "One or two sentences with the why and the so-what.",
          },
          related_message_ids: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.INTEGER },
          },
        },
        required: ["severity", "title", "detail", "related_message_ids"],
      },
    },
    triage: {
      type: SchemaType.ARRAY,
      description: "One entry per incoming message. Must cover every id.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          message_id: { type: SchemaType.INTEGER },
          category: {
            type: SchemaType.STRING,
            enum: ["ignore", "delegate", "decide"],
            format: "enum",
          },
          confidence: {
            type: SchemaType.STRING,
            enum: ["high", "medium", "low"],
            format: "enum",
            description:
              "How confident you are in this classification. 'low' = CEO should glance at the original.",
          },
          reasoning: { type: SchemaType.STRING },
          assignee: {
            type: SchemaType.STRING,
            description:
              "For 'delegate', the person who should own it. Empty string otherwise.",
          },
          drafted_response: {
            type: SchemaType.STRING,
            description:
              "Ready-to-send reply in the CEO's voice. Empty string when no reply needed.",
          },
          superseded_by: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.INTEGER },
            description:
              "Ids of later messages that cancel or resolve this one. Empty array if none.",
          },
          thread_note: {
            type: SchemaType.STRING,
            description: "Optional thread context. Empty string if not applicable.",
          },
        },
        required: [
          "message_id",
          "category",
          "confidence",
          "reasoning",
          "assignee",
          "drafted_response",
          "superseded_by",
          "thread_note",
        ],
      },
    },
  },
  required: ["briefing", "flags", "triage"],
};
