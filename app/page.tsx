"use client";

import { parse as parsePartial, Allow } from "partial-json";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Briefing } from "@/components/Briefing";
import { ControlsPanel, type SnoozeRules } from "@/components/ControlsPanel";
import { ErrorCard } from "@/components/ErrorCard";
import { FlagsPanel } from "@/components/FlagsPanel";
import { Hero } from "@/components/Hero";
import { MobileApp } from "@/components/MobileApp";
import { TopBar, type DateLine, type DeviceMode } from "@/components/TopBar";
import { TriagePanel } from "@/components/TriagePanel";
import { classifyError, type ClassifiedError } from "@/lib/error-classify";
import type {
  ChiefOfStaffOutput,
  Flag,
  IncomingMessage,
  ProcessErrorBody,
  Sensitivity,
  TriageItem,
} from "@/lib/types";

type Status = "idle" | "loading" | "processing" | "error";

/* ───────────── theme + accent ───────────── */

const ACCENTS = {
  indigo: { name: "Indigo", light: "oklch(0.55 0.18 264)", dark: "oklch(0.72 0.16 264)" },
  forest: { name: "Forest", light: "oklch(0.50 0.13 155)", dark: "oklch(0.72 0.13 155)" },
  ember: { name: "Ember", light: "oklch(0.58 0.17 35)", dark: "oklch(0.76 0.15 35)" },
  rose: { name: "Rose", light: "oklch(0.58 0.18 0)", dark: "oklch(0.76 0.16 0)" },
  slate: { name: "Graphite", light: "oklch(0.38 0.020 260)", dark: "oklch(0.78 0.010 260)" },
} as const;
type AccentKey = keyof typeof ACCENTS;
const ACCENT_KEYS = Object.keys(ACCENTS) as AccentKey[];

/* ───────────── snooze filters ───────────── */

function isNewsletter(m: IncomingMessage): boolean {
  if (m.channel !== "email") return false;
  const senderAuto = /noreply|no-reply|newsletter|digest|notifications?@/i.test(
    m.from
  );
  const hasUnsub = /unsubscribe/i.test(m.body);
  return senderAuto && hasUnsub;
}
function isPersonal(m: IncomingMessage): boolean {
  if (m.channel !== "whatsapp") return false;
  return !/\(.+\)/.test(m.from);
}

/* ───────────── inbox helpers ───────────── */

function validateMessages(value: unknown): IncomingMessage[] {
  if (!Array.isArray(value)) throw new Error("File must contain a JSON array.");
  const out: IncomingMessage[] = [];
  value.forEach((raw, idx) => {
    if (!raw || typeof raw !== "object")
      throw new Error(`Entry ${idx} is not an object.`);
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

function deriveDateline(messages: IncomingMessage[]): DateLine {
  const ts = messages
    .map((m) => Date.parse(m.timestamp))
    .filter((n) => Number.isFinite(n));
  if (ts.length === 0) return { day: "", time: "" };
  const max = Math.max(...ts);
  const now = Date.now();
  const ref =
    now - max > 24 * 60 * 60 * 1000 ? new Date(max + 60 * 60 * 1000) : new Date();
  return {
    day: ref.toLocaleString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    time: ref.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

function deriveMobileDateline(messages: IncomingMessage[]) {
  const ts = messages
    .map((m) => Date.parse(m.timestamp))
    .filter((n) => Number.isFinite(n));
  const max = ts.length ? Math.max(...ts) + 60 * 60 * 1000 : Date.now();
  const d = new Date(max);
  return {
    day: d.toLocaleString(undefined, { weekday: "long" }),
    long: d.toLocaleString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    }),
    time: d.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

function formatCurrentTime(messages: IncomingMessage[]): string {
  const ts = messages
    .map((m) => Date.parse(m.timestamp))
    .filter((n) => Number.isFinite(n));
  const now = Date.now();
  let refMs = now;
  if (ts.length > 0) {
    const latest = Math.max(...ts);
    if (now - latest > 24 * 60 * 60 * 1000) refMs = latest + 60 * 60 * 1000;
  }
  return new Date(refMs).toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ───────────── partial JSON sanitisers ───────────── */

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

/* ───────────── client-side sensitivity reweighting ───────────── */

function reweight(triage: TriageItem[], sensitivity: Sensitivity): TriageItem[] {
  return triage.map((t) => {
    if (
      sensitivity === "conservative" &&
      t.category === "decide" &&
      t.confidence === "medium"
    ) {
      return {
        ...t,
        category: "delegate",
        assignee: t.assignee || "Laura Singh (EA)",
      };
    }
    if (
      sensitivity === "aggressive" &&
      t.category === "delegate" &&
      t.confidence === "medium"
    ) {
      return { ...t, category: "decide" };
    }
    return t;
  });
}

/* ───────────── main page ───────────── */

export default function HomePage() {
  const [messages, setMessages] = useState<IncomingMessage[]>([]);
  const [output, setOutput] = useState<ChiefOfStaffOutput | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const classifiedError: ClassifiedError | null = useMemo(
    () => (errorMsg ? classifyError(errorMsg) : null),
    [errorMsg]
  );

  const [sensitivity, setSensitivity] = useState<Sensitivity>("balanced");
  const [snooze, setSnooze] = useState<SnoozeRules>({
    hideNewsletters: false,
    hidePersonal: false,
  });

  const [dark, setDark] = useState(false);
  const [accent, setAccent] = useState<AccentKey>("indigo");

  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [viewportNarrow, setViewportNarrow] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Track viewport size for "auto" mode.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setViewportNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Apply theme + accent.
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = dark ? "dark" : "light";
    const a = ACCENTS[accent];
    const color = dark ? a.dark : a.light;
    html.style.setProperty("--accent", color);
    html.style.setProperty(
      "--accent-soft",
      `color-mix(in oklab, ${color} 12%, transparent)`
    );
    html.style.setProperty(
      "--accent-fg",
      dark ? "oklch(0.15 0.012 260)" : "oklch(0.99 0 0)"
    );
  }, [dark, accent]);

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

  /* ───── filtering ───── */
  const filtered = useMemo(() => {
    const kept = messages.filter((m) => {
      if (snooze.hideNewsletters && isNewsletter(m)) return false;
      if (snooze.hidePersonal && isPersonal(m)) return false;
      return true;
    });
    return { kept, hidden: messages.length - kept.length };
  }, [messages, snooze]);

  const visibleTriage = useMemo(() => {
    if (!output) return [] as TriageItem[];
    const ids = new Set(filtered.kept.map((m) => m.id));
    return output.triage.filter((t) => ids.has(t.message_id));
  }, [output, filtered.kept]);

  const reweighted = useMemo(
    () => reweight(visibleTriage, sensitivity),
    [visibleTriage, sensitivity]
  );

  const counts = useMemo(
    () => ({
      decide: reweighted.filter((t) => t.category === "decide").length,
      delegate: reweighted.filter((t) => t.category === "delegate").length,
      ignore: reweighted.filter((t) => t.category === "ignore").length,
    }),
    [reweighted]
  );

  const hiddenBreakdown = useMemo(
    () => ({
      newsletters: messages.filter(isNewsletter).length,
      personal: messages.filter(isPersonal).length,
    }),
    [messages]
  );

  const visibleFlags = useMemo(() => {
    if (!output) return [] as Flag[];
    const keptIds = new Set(filtered.kept.map((m) => m.id));
    return output.flags.filter(
      (f) =>
        f.related_message_ids.length === 0 ||
        f.related_message_ids.some((id) => keptIds.has(id))
    );
  }, [output, filtered.kept]);

  const dateline = useMemo(
    () => deriveDateline(filtered.kept.length ? filtered.kept : messages),
    [filtered.kept, messages]
  );
  const mobileDateline = useMemo(
    () => deriveMobileDateline(filtered.kept.length ? filtered.kept : messages),
    [filtered.kept, messages]
  );

  /* ───── shared toast (desktop) ───── */
  const [toast, setToast] = useState("");
  const [highlight, setHighlight] = useState<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimerRef.current != null)
      window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 1700);
  }, []);

  const onRefClick = useCallback((id: number) => {
    setHighlight(id);
    window.setTimeout(() => {
      const el = document.getElementById(`msg-${id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    window.setTimeout(() => setHighlight(null), 2200);
  }, []);

  /* ───── processing ───── */
  const onProcess = useCallback(async () => {
    if (filtered.kept.length === 0) return;
    setStatus("processing");
    setErrorMsg(null);
    setOutput(null);

    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: filtered.kept,
          current_time: formatCurrentTime(filtered.kept),
          sensitivity: "balanced",
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

      // Throttle partial-JSON parses and React re-renders during streaming.
      // Gemini emits many small chunks; without throttling we'd parse a
      // growing buffer hundreds of times and re-render the whole page each
      // time, which makes the UI feel laggy. 120ms is the sweet spot.
      let lastUpdate = 0;
      const UPDATE_INTERVAL_MS = 120;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const errMatch = buffer.match(
          /__STREAM_ERROR__([\s\S]*?)__STREAM_ERROR__/
        );
        if (errMatch) throw new Error(errMatch[1]);

        const now =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        if (now - lastUpdate < UPDATE_INTERVAL_MS) continue;
        lastUpdate = now;

        try {
          const partial = parsePartial(buffer, Allow.ALL);
          const cleaned = sanitizePartial(partial);
          if (cleaned) setOutput(cleaned);
        } catch {
          // try again next chunk
        }
      }

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
      showToast("Briefing ready");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Processing failed.");
      setOutput(null);
    }
  }, [filtered.kept, showToast]);

  /* ───── upload / reset ───── */
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
      setStatus("idle");
      setErrorMsg(null);
      showToast(`Loaded ${parsed.length} messages from ${file.name}`);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Invalid JSON file.");
    }
  };
  const onResetSample = async () => {
    setStatus("loading");
    setErrorMsg(null);
    setOutput(null);
    try {
      const res = await fetch("/messages.json", { cache: "no-store" });
      const json = await res.json();
      setMessages(validateMessages(json));
      setStatus("idle");
      showToast("Reset to sample inbox");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to load sample.");
    }
  };

  const onCycleAccent = () => {
    const i = ACCENT_KEYS.indexOf(accent);
    setAccent(ACCENT_KEYS[(i + 1) % ACCENT_KEYS.length]);
  };

  const processing = status === "processing";
  const hasOutput = output != null && output.triage.length > 0;
  const ready = filtered.kept.length > 0 && status !== "loading";

  // Effective layout: "auto" picks based on viewport width.
  const effective: "desktop" | "mobile" =
    device === "auto" ? (viewportNarrow ? "mobile" : "desktop") : device;
  const showFrame = device === "mobile"; // bare layout only in "auto" mode on a narrow viewport

  /* ───── render ───── */

  return (
    <div className="shell">
      <TopBar
        dateline={dateline}
        dark={dark}
        onToggleDark={() => setDark((v) => !v)}
        onCycleAccent={onCycleAccent}
        onProcess={onProcess}
        onUpload={onUploadClick}
        onReset={onResetSample}
        processing={processing}
        hasData={hasOutput}
        ready={ready}
        device={device}
        setDevice={setDevice}
        compact={effective === "mobile"}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={onFileChosen}
      />

      {effective === "mobile" ? (
        <div className="mob-stage">
          <MobileApp
            messages={messages}
            output={output}
            visibleFlags={visibleFlags}
            counts={counts}
            hiddenBreakdown={hiddenBreakdown}
            dateline={mobileDateline}
            sensitivity={sensitivity}
            setSensitivity={setSensitivity}
            snooze={snooze}
            setSnooze={setSnooze}
            dark={dark}
            setDark={setDark}
            accent={accent}
            setAccent={setAccent}
            onProcess={onProcess}
            onReset={onResetSample}
            processing={processing}
            reweighted={reweighted}
            filteredMessages={filtered.kept}
            framed={showFrame}
            error={classifiedError}
          />
        </div>
      ) : (
        <main className="page">
          <Hero
            dateline={dateline}
            counts={counts}
            total={filtered.kept.length}
            flagsCount={visibleFlags.length}
            hiddenCount={filtered.hidden}
            hasOutput={hasOutput}
            onProcess={onProcess}
            processing={processing}
          />

          {classifiedError ? (
            <ErrorCard
              error={classifiedError}
              onRetry={onProcess}
              onDismiss={() => setErrorMsg(null)}
            />
          ) : null}

          <div className="grid">
            <div className="col-main">
              {hasOutput && output ? (
                <section className="card">
                  <div className="card-head">
                    <h2>Daily briefing</h2>
                    <span className="head-meta">
                      <span>&lt; 2 min read</span>
                      <span>·</span>
                      <span>
                        generated{" "}
                        {new Date(output.generated_at).toLocaleString(
                          undefined,
                          {
                            hour: "numeric",
                            minute: "2-digit",
                          }
                        )}
                      </span>
                    </span>
                  </div>
                  <Briefing
                    markdown={output.briefing}
                    onRefClick={onRefClick}
                  />
                </section>
              ) : null}

              {hasOutput ? (
                <TriagePanel
                  messages={filtered.kept}
                  triage={reweighted}
                  highlight={highlight}
                  onRefClick={onRefClick}
                  onToast={showToast}
                />
              ) : null}
            </div>

            <aside className="col-side">
              {hasOutput ? (
                <FlagsPanel flags={visibleFlags} onRefClick={onRefClick} />
              ) : null}
              <ControlsPanel
                sensitivity={sensitivity}
                setSensitivity={setSensitivity}
                snooze={snooze}
                setSnooze={setSnooze}
                hiddenBreakdown={hiddenBreakdown}
              />
            </aside>
          </div>

          <footer className="foot">
            Read together, not one by one. Powered by Gemini · designed for calm
            mornings.
          </footer>
        </main>
      )}

      <div className="toast" data-show={toast ? "true" : "false"}>
        {toast}
      </div>
    </div>
  );
}
