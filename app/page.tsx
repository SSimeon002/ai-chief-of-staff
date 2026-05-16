"use client";

import { parse as parsePartial, Allow } from "partial-json";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BriefingCard } from "@/components/BriefingCard";
import { FlagsList } from "@/components/FlagsList";
import { TriageList } from "@/components/TriageList";
import type {
  ChiefOfStaffOutput,
  Flag,
  IncomingMessage,
  ProcessErrorBody,
  Sensitivity,
  TriageItem,
} from "@/lib/types";

type Status = "idle" | "loading" | "processing" | "error";

interface SnoozeRules {
  hideNewsletters: boolean;
  hidePersonal: boolean;
}

const DEFAULT_SNOOZE: SnoozeRules = {
  hideNewsletters: false,
  hidePersonal: false,
};

function validateMessages(value: unknown): IncomingMessage[] {
  if (!Array.isArray(value)) {
    throw new Error("File must contain a JSON array.");
  }
  const out: IncomingMessage[] = [];
  value.forEach((raw, idx) => {
    if (!raw || typeof raw !== "object") {
      throw new Error(`Entry ${idx} is not an object.`);
    }
    const v = raw as Record<string, unknown>;
    const missing = ["id", "channel", "from", "timestamp", "body"].filter(
      (k) => !(k in v)
    );
    if (missing.length > 0) {
      throw new Error(
        `Entry ${idx} is missing required fields: ${missing.join(", ")}.`
      );
    }
    out.push(v as unknown as IncomingMessage);
  });
  return out;
}

function isNewsletterOrAutomated(m: IncomingMessage): boolean {
  if (m.channel !== "email") return false;
  // Require BOTH an automated-looking sender AND an unsubscribe link.
  // This is what distinguishes a real newsletter from a phishing email
  // (which often uses noreply@ but never includes an unsubscribe link).
  const from = m.from.toLowerCase();
  const senderLooksAutomated =
    /noreply|no-reply|newsletter|digest|notifications?@/.test(from);
  const hasUnsubscribe = /unsubscribe/i.test(m.body);
  return senderLooksAutomated && hasUnsubscribe;
}

function isPersonal(m: IncomingMessage): boolean {
  // Heuristic: WhatsApp from someone without a parenthetical work title
  // (e.g. "James (COO)" → work, "Mum" → personal).
  if (m.channel !== "whatsapp") return false;
  return !/\(.+\)/.test(m.from);
}

function applySnooze(
  messages: IncomingMessage[],
  rules: SnoozeRules
): { kept: IncomingMessage[]; hidden: number } {
  const kept = messages.filter((m) => {
    if (rules.hideNewsletters && isNewsletterOrAutomated(m)) return false;
    if (rules.hidePersonal && isPersonal(m)) return false;
    return true;
  });
  return { kept, hidden: messages.length - kept.length };
}

function channelCounts(messages: IncomingMessage[]) {
  const c = { email: 0, slack: 0, whatsapp: 0 };
  for (const m of messages) {
    if (m.channel in c) c[m.channel] += 1;
  }
  return c;
}

// Pick a "current time" the model can sensibly reason about.
// If the inbox is fresh (latest message in the last 24h), use the wall clock.
// If the inbox is older (e.g. the static sample dated months ago, or a
// historical fixture the reviewer uploaded), use the latest message
// timestamp + 1 hour. This stops the model from concluding "everything is
// stale, ignore it all" — which is a real failure mode at temperature > 0.
function formatCurrentTime(messages: IncomingMessage[]): string {
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  let referenceMs = now;
  if (messages.length > 0) {
    const latest = Math.max(
      ...messages.map((m) => {
        const t = Date.parse(m.timestamp);
        return Number.isFinite(t) ? t : 0;
      })
    );
    if (latest > 0 && now - latest > ONE_DAY_MS) {
      referenceMs = latest + 60 * 60 * 1000; // 1h after the latest message
    }
  }
  return new Date(referenceMs).toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isValidFlag(f: unknown): f is Flag {
  if (!f || typeof f !== "object") return false;
  const v = f as Record<string, unknown>;
  return (
    typeof v.severity === "string" &&
    typeof v.title === "string" &&
    typeof v.detail === "string" &&
    Array.isArray(v.related_message_ids)
  );
}

function isValidTriage(t: unknown): t is TriageItem {
  if (!t || typeof t !== "object") return false;
  const v = t as Record<string, unknown>;
  return (
    typeof v.message_id === "number" &&
    typeof v.category === "string" &&
    typeof v.reasoning === "string"
  );
}

function sanitizePartial(raw: unknown): ChiefOfStaffOutput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  return {
    briefing: typeof v.briefing === "string" ? v.briefing : "",
    flags: Array.isArray(v.flags) ? v.flags.filter(isValidFlag) : [],
    triage: Array.isArray(v.triage) ? v.triage.filter(isValidTriage) : [],
    generated_at: new Date().toISOString(),
  };
}

const SENSITIVITY_OPTIONS: { value: Sensitivity; label: string; hint: string }[] = [
  {
    value: "conservative",
    label: "Conservative",
    hint: "Smallest Decide list. Maximize protection.",
  },
  {
    value: "balanced",
    label: "Balanced",
    hint: "Default judgment.",
  },
  {
    value: "aggressive",
    label: "Aggressive",
    hint: "Surface borderline items for CEO visibility.",
  },
];

export default function HomePage() {
  const [messages, setMessages] = useState<IncomingMessage[]>([]);
  const [output, setOutput] = useState<ChiefOfStaffOutput | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string>("Sample inbox");
  const [sensitivity, setSensitivity] = useState<Sensitivity>("balanced");
  const [snooze, setSnooze] = useState<SnoozeRules>(DEFAULT_SNOOZE);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load sample on first paint.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/messages.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load sample (${res.status}).`);
        const json = await res.json();
        const parsed = validateMessages(json);
        if (cancelled) return;
        setMessages(parsed);
        setStatus("idle");
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Failed to load sample.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => channelCounts(messages), [messages]);
  const filteredView = useMemo(
    () => applySnooze(messages, snooze),
    [messages, snooze]
  );

  const onProcess = useCallback(async () => {
    if (filteredView.kept.length === 0) return;
    setStatus("processing");
    setErrorMsg(null);
    setOutput(null);

    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: filteredView.kept,
          sensitivity,
          current_time: formatCurrentTime(filteredView.kept),
        }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as
          | ProcessErrorBody
          | null;
        throw new Error(errBody?.error ?? `Request failed (${res.status}).`);
      }
      if (!res.body) throw new Error("Empty response body.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Did the server inject an error sentinel mid-stream?
        const errMatch = buffer.match(
          /__STREAM_ERROR__([\s\S]*?)__STREAM_ERROR__/
        );
        if (errMatch) throw new Error(errMatch[1]);

        // Best-effort progressive render.
        try {
          const partial = parsePartial(buffer, Allow.ALL);
          const cleaned = sanitizePartial(partial);
          if (cleaned) setOutput(cleaned);
        } catch {
          // ignore; will succeed on a later chunk
        }
      }

      // Final, strict parse.
      let final: ChiefOfStaffOutput;
      try {
        const parsed = JSON.parse(buffer);
        final = {
          briefing: parsed.briefing ?? "",
          flags: Array.isArray(parsed.flags) ? parsed.flags : [],
          triage: Array.isArray(parsed.triage) ? parsed.triage : [],
          generated_at: new Date().toISOString(),
        };
      } catch {
        throw new Error("Model output was truncated or malformed.");
      }
      setOutput(final);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Processing failed.");
      setOutput(null);
    }
  }, [filteredView.kept, sensitivity]);

  const onUploadClick = () => fileInputRef.current?.click();

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = validateMessages(JSON.parse(text));
      setMessages(parsed);
      setOutput(null);
      setSourceLabel(file.name);
      setStatus("idle");
      setErrorMsg(null);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Invalid JSON file.");
    }
  };

  const onResetSample = async () => {
    setStatus("loading");
    setErrorMsg(null);
    setOutput(null);
    setSourceLabel("Sample inbox");
    try {
      const res = await fetch("/messages.json", { cache: "no-store" });
      const json = await res.json();
      setMessages(validateMessages(json));
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to load sample.");
    }
  };

  const busy = status === "loading" || status === "processing";
  const hiddenCount = filteredView.hidden;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
          AI Chief of Staff
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
          Your morning, triaged.
        </h1>
        <p className="mt-2 max-w-2xl text-ink-600">
          Every email, Slack message, and WhatsApp from the morning &mdash; read
          together, cross-referenced, and reduced to what actually needs you.
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-ink-200 bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-ink-900">
              {sourceLabel}
            </div>
            <div className="mt-1 text-sm text-ink-500">
              {messages.length} messages &middot; {counts.email} email &middot;{" "}
              {counts.slack} Slack &middot; {counts.whatsapp} WhatsApp
              {hiddenCount > 0 && (
                <span className="ml-1 text-ink-400">
                  &middot; {hiddenCount} hidden by filters
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onProcess}
              disabled={busy || filteredView.kept.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "processing" ? (
                <>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  Streaming…
                </>
              ) : (
                <>Process inbox</>
              )}
            </button>
            <button
              type="button"
              onClick={onUploadClick}
              disabled={busy}
              className="rounded-lg border border-ink-300 bg-white px-4 py-2 text-sm font-medium text-ink-800 transition hover:bg-ink-50 disabled:opacity-50"
            >
              Upload JSON
            </button>
            <button
              type="button"
              onClick={onResetSample}
              disabled={busy}
              className="rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-ink-500 transition hover:text-ink-900 disabled:opacity-50"
            >
              Reset to sample
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onFileChosen}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-4 border-t border-ink-100 pt-5 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              Sensitivity
            </div>
            <div className="inline-flex rounded-lg bg-ink-100 p-1">
              {SENSITIVITY_OPTIONS.map((opt) => {
                const active = opt.value === sensitivity;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSensitivity(opt.value)}
                    title={opt.hint}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                      active
                        ? "bg-white text-ink-900 shadow-sm"
                        : "text-ink-600 hover:text-ink-900"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-ink-500">
              {SENSITIVITY_OPTIONS.find((o) => o.value === sensitivity)?.hint}
            </p>
          </div>
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              Snooze
            </div>
            <div className="flex flex-col gap-2 text-sm text-ink-700">
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={snooze.hideNewsletters}
                  onChange={(e) =>
                    setSnooze((s) => ({
                      ...s,
                      hideNewsletters: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 cursor-pointer rounded border-ink-300 text-ink-900 focus:ring-ink-400"
                />
                Hide newsletters & automated emails
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={snooze.hidePersonal}
                  onChange={(e) =>
                    setSnooze((s) => ({ ...s, hidePersonal: e.target.checked }))
                  }
                  className="h-4 w-4 cursor-pointer rounded border-ink-300 text-ink-900 focus:ring-ink-400"
                />
                Hide personal WhatsApps
              </label>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </div>
        )}
      </section>

      {status === "processing" && !output && (
        <div className="mb-8 rounded-2xl border border-dashed border-ink-300 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center">
            <span className="h-3 w-3 animate-ping rounded-full bg-ink-900" />
          </div>
          <p className="text-sm text-ink-600">
            Reading {filteredView.kept.length} messages, cross-referencing
            threads, and drafting responses…
          </p>
        </div>
      )}

      {output && (
        <div className="grid gap-6">
          {output.briefing && (
            <BriefingCard
              briefing={output.briefing}
              generatedAt={output.generated_at}
            />
          )}
          <FlagsList flags={output.flags} />
          <TriageList messages={filteredView.kept} triage={output.triage} />
        </div>
      )}

      {!output && status === "idle" && messages.length > 0 && <EmptyState />}

      <footer className="mt-12 text-center text-xs text-ink-400">
        Built for the Innate AI developer assessment. Powered by Gemini.
      </footer>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-10 text-center shadow-sm">
      <h2 className="text-base font-semibold text-ink-900">
        Ready when you are.
      </h2>
      <p className="mt-2 text-sm text-ink-500">
        Click <span className="font-medium text-ink-800">Process inbox</span> to
        triage the morning. The briefing streams in as it generates.
      </p>
    </div>
  );
}
