import { NextResponse } from "next/server";
import { runChiefOfStaffStream } from "@/lib/gemini";
import type {
  IncomingMessage,
  ProcessErrorBody,
  ProcessRequestBody,
  Sensitivity,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isIncomingMessage(value: unknown): value is IncomingMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "number" &&
    typeof v.channel === "string" &&
    typeof v.from === "string" &&
    typeof v.timestamp === "string" &&
    typeof v.body === "string"
  );
}

const VALID_SENSITIVITY: Sensitivity[] = [
  "conservative",
  "balanced",
  "aggressive",
];

export async function POST(request: Request) {
  let body: ProcessRequestBody;
  try {
    body = (await request.json()) as ProcessRequestBody;
  } catch {
    return NextResponse.json<ProcessErrorBody>(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json<ProcessErrorBody>(
      { error: "Provide a non-empty `messages` array." },
      { status: 400 }
    );
  }

  if (!body.messages.every(isIncomingMessage)) {
    return NextResponse.json<ProcessErrorBody>(
      {
        error:
          "Every message must have id, channel, from, timestamp, and body fields.",
      },
      { status: 400 }
    );
  }

  const sensitivity: Sensitivity =
    body.sensitivity && VALID_SENSITIVITY.includes(body.sensitivity)
      ? body.sensitivity
      : "balanced";

  // Stream Gemini's JSON output back to the client as raw text. The client
  // uses partial-json to progressively parse and render.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of runChiefOfStaffStream(body.messages, {
          sensitivity,
          current_time: body.current_time,
        })) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error.";
        console.error("[/api/process] streaming failed:", err);
        // Inject a sentinel the client can detect after final JSON.parse fails.
        controller.enqueue(
          encoder.encode(`\n__STREAM_ERROR__${message}__STREAM_ERROR__`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
