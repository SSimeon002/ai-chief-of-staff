import {
  GoogleGenerativeAI,
  type GenerativeModel,
} from "@google/generative-ai";
import { RESPONSE_SCHEMA, SYSTEM_PROMPT, buildUserMessage } from "./prompt";
import type {
  ChiefOfStaffOutput,
  Flag,
  IncomingMessage,
  ProcessOptions,
  TriageItem,
} from "./types";

const DEFAULT_MODEL = "gemini-2.5-flash";

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_API_KEY is not set. Copy .env.example to .env.local and add your key from https://aistudio.google.com/apikey"
    );
  }
  return new GoogleGenerativeAI(apiKey);
}

function buildModel(): GenerativeModel {
  const client = getClient();
  const modelName = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  return client.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.2,
      // gemini-2.5-flash uses internal "thinking" tokens that count against this
      // budget along with the actual output. 32k is generous for 20 messages.
      maxOutputTokens: 32000,
    },
  });
}

interface RawOutput {
  briefing?: unknown;
  flags?: unknown;
  triage?: unknown;
}

// Non-streaming version, kept for completeness / potential future caller.
export async function runChiefOfStaff(
  messages: IncomingMessage[],
  options: ProcessOptions = {}
): Promise<ChiefOfStaffOutput> {
  const model = buildModel();

  const result = await model.generateContent(buildUserMessage(messages, options));
  const candidate = result.response.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const text = result.response.text();

  if (finishReason && finishReason !== "STOP") {
    throw new Error(
      `Gemini stopped early (finishReason: ${finishReason}). Increase maxOutputTokens or shorten the input.`
    );
  }

  let parsed: RawOutput;
  try {
    parsed = JSON.parse(text) as RawOutput;
  } catch {
    throw new Error(
      `Model returned non-JSON output. First 200 chars: ${text.slice(0, 200)}`
    );
  }

  const briefing = typeof parsed.briefing === "string" ? parsed.briefing : "";
  const flags = Array.isArray(parsed.flags) ? (parsed.flags as Flag[]) : [];
  const triage = Array.isArray(parsed.triage)
    ? (parsed.triage as TriageItem[])
    : [];

  return {
    briefing,
    flags,
    triage,
    generated_at: new Date().toISOString(),
  };
}

// Streaming variant — yields raw text chunks of the JSON output as they generate.
// The client uses partial-json to progressively render whatever's complete.
export async function* runChiefOfStaffStream(
  messages: IncomingMessage[],
  options: ProcessOptions = {}
): AsyncGenerator<string, void, void> {
  const model = buildModel();
  const result = await model.generateContentStream(
    buildUserMessage(messages, options)
  );
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}
