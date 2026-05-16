"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ClassifiedError } from "@/lib/error-classify";
import type {
  ChiefOfStaffOutput,
  Flag,
  FlagSeverity,
  IncomingMessage,
  Sensitivity,
  TriageCategory,
  TriageItem,
} from "@/lib/types";
import { CategoryBadge } from "./CategoryBadge";
import { ChannelBadge } from "./ChannelBadge";
import { Icon } from "./Icon";
import { IosFrame } from "./IosFrame";

const MOB_ERROR_ICON: Record<ClassifiedError["kind"], () => JSX.Element> = {
  quota_daily: Icon.clock,
  quota_minute: Icon.clock,
  network: Icon.alert,
  server: Icon.alert,
  auth: Icon.shield,
  generic: Icon.alert,
};

function MobErrorState({
  error,
  onRetry,
}: {
  error: ClassifiedError;
  onRetry: () => void;
}) {
  const [remaining, setRemaining] = useState<number | undefined>(error.retryAfter);
  useEffect(() => {
    if (error.retryAfter == null) {
      setRemaining(undefined);
      return;
    }
    setRemaining(error.retryAfter);
    const id = window.setInterval(() => {
      setRemaining((v) => {
        if (v == null) return v;
        if (v <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [error.retryAfter, error.raw]);

  const canRetryNow =
    error.retryable && (remaining == null || remaining === 0);
  const Ico = MOB_ERROR_ICON[error.kind] ?? Icon.alert;

  return (
    <div className="mob-error" data-kind={error.kind}>
      <div className="mob-error-icon">
        <Ico />
      </div>
      <div>
        <div className="mob-error-kind">
          {labelForKind(error.kind)}
          {remaining != null && remaining > 0 ? ` · retry in ${remaining}s` : null}
        </div>
        <h2 className="mob-error-title">{error.title}</h2>
      </div>
      <p className="mob-error-body">{error.body}</p>
      <div className="mob-error-actions">
        {error.retryable ? (
          <button
            type="button"
            className="mob-btn mob-btn-primary"
            onClick={onRetry}
            disabled={!canRetryNow}
          >
            {canRetryNow ? "Try again" : `Try again in ${remaining}s`}
          </button>
        ) : null}
        <details className="mob-error-details">
          <summary>Show technical details</summary>
          <pre>{error.raw}</pre>
        </details>
      </div>
    </div>
  );
}

function labelForKind(kind: ClassifiedError["kind"]): string {
  switch (kind) {
    case "quota_daily":
    case "quota_minute":
      return "Service";
    case "network":
      return "Network";
    case "server":
      return "Service";
    case "auth":
      return "Auth";
    default:
      return "Error";
  }
}

/* ───────────── shared types ───────────── */

type AccentKey = "indigo" | "forest" | "ember" | "rose" | "slate";

interface SnoozeRules {
  hideNewsletters: boolean;
  hidePersonal: boolean;
}

type Tab = "today" | "triage" | "flags" | "settings";

/* ───────────── helpers ───────────── */

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function avatarInitials(name: string): string {
  const cleaned = name
    .replace(/<[^>]+>/g, "")
    .replace(/\(.*?\)/g, "")
    .trim();
  const tokens = cleaned.split(/[\s.@_-]+/).filter(Boolean);
  const a = tokens[0]?.[0] || "?";
  const b = tokens[1]?.[0] || "";
  return (a + b).toUpperCase();
}

function useAutoSize(value: string) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return ref;
}

const SENSITIVITY_OPTIONS: { value: Sensitivity; label: string; hint: string }[] = [
  { value: "conservative", label: "Conservative", hint: "Smallest Decide list." },
  { value: "balanced", label: "Balanced", hint: "Default judgment." },
  { value: "aggressive", label: "Aggressive", hint: "Maximum visibility." },
];

const SEV_ORDER: Record<FlagSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

const FLAG_ICON: Record<FlagSeverity, () => JSX.Element> = {
  critical: Icon.alert,
  high: Icon.clock,
  medium: Icon.shield,
};

/* ───────────── briefing markdown (compact) ───────────── */

function mobInlineFormat(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[(#\d+(?:\s*,\s*#\d+)*)\]/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) out.push(text.slice(lastIdx, m.index));
    if (m[1] != null) {
      out.push(<strong key={`b${key++}`}>{m[1]}</strong>);
    } else if (m[2] != null) {
      const ids = m[2].split(/\s*,\s*/).map((s) => s.replace(/^#/, ""));
      ids.forEach((id, i) => {
        if (i > 0)
          out.push(
            <span
              key={`s${key++}`}
              style={{ margin: "0 2px", color: "var(--ink-4)" }}
            >
              ·
            </span>
          );
        out.push(
          <span key={`r${key++}`} className="ref">
            #{id}
          </span>
        );
      });
    }
    lastIdx = re.lastIndex;
  }
  if (lastIdx < text.length) out.push(text.slice(lastIdx));
  return out;
}

type Block =
  | { kind: "h2"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] };

function MobBriefing({ markdown }: { markdown: string }) {
  const blocks: Block[] = useMemo(() => {
    const lines = markdown.split(/\n/);
    const out: Block[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith("## ")) {
        out.push({ kind: "h2", text: line.slice(3).trim() });
        i++;
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        const items: string[] = [];
        while (
          i < lines.length &&
          (lines[i].startsWith("- ") || lines[i].startsWith("* "))
        ) {
          items.push(lines[i].slice(2));
          i++;
        }
        out.push({ kind: "ul", items });
      } else if (line.trim() === "") {
        i++;
      } else {
        const buf = [line];
        i++;
        while (
          i < lines.length &&
          lines[i].trim() !== "" &&
          !lines[i].startsWith("## ") &&
          !lines[i].startsWith("- ") &&
          !lines[i].startsWith("* ")
        ) {
          buf.push(lines[i]);
          i++;
        }
        out.push({ kind: "p", text: buf.join(" ") });
      }
    }
    return out;
  }, [markdown]);
  return (
    <div className="mob-brief">
      {blocks.map((b, i) => {
        if (b.kind === "h2") return <h2 key={i}>{b.text}</h2>;
        if (b.kind === "p")
          return (
            <p key={i}>
              {mobInlineFormat(b.text).map((node, j) => (
                <Fragment key={j}>{node}</Fragment>
              ))}
            </p>
          );
        if (b.kind === "ul")
          return (
            <ul key={i}>
              {b.items.map((it, j) => (
                <li key={j}>
                  {mobInlineFormat(it).map((node, k) => (
                    <Fragment key={k}>{node}</Fragment>
                  ))}
                </li>
              ))}
            </ul>
          );
        return null;
      })}
    </div>
  );
}

/* ───────────── flag ───────────── */

function MobFlag({ flag }: { flag: Flag }) {
  const I = FLAG_ICON[flag.severity] ?? Icon.alert;
  return (
    <div className="mob-flag" data-sev={flag.severity}>
      <div className="ico">
        <I />
      </div>
      <div className="body">
        <div className="lbl">{flag.severity}</div>
        <h4>{flag.title}</h4>
        <p>{flag.detail}</p>
      </div>
    </div>
  );
}

/* ───────────── message row + sheet ───────────── */

function MobMsgRow({
  message,
  triage,
  onOpen,
}: {
  message: IncomingMessage;
  triage: TriageItem;
  onOpen: (id: number) => void;
}) {
  const superseded = (triage.superseded_by?.length ?? 0) > 0;
  const displayFrom = message.from.replace(/<[^>]+>/g, "").trim();
  return (
    <button
      type="button"
      className="mob-msg"
      data-superseded={superseded}
      onClick={() => onOpen(triage.message_id)}
    >
      <div className="top">
        <span className="id">#{message.id}</span>
        <ChannelBadge channel={message.channel} />
        <span style={{ marginLeft: "auto" }} className="mono">
          {formatTime(message.timestamp)}
        </span>
      </div>
      <div className="from">{displayFrom}</div>
      {message.subject ? <div className="sub">{message.subject}</div> : null}
      <div className="why">{triage.reasoning}</div>
    </button>
  );
}

function MobSheet({
  open,
  message,
  triage,
  onClose,
  onToast,
}: {
  open: boolean;
  message: IncomingMessage | null;
  triage: TriageItem | null;
  onClose: () => void;
  onToast: (text: string) => void;
}) {
  const [reply, setReply] = useState("");
  const taRef = useAutoSize(reply);

  useEffect(() => {
    if (open && triage) setReply(triage.drafted_response || "");
  }, [open, triage]);

  if (!message || !triage) {
    return (
      <>
        <div
          className="mob-sheet-backdrop"
          data-open={open ? "true" : "false"}
          onClick={onClose}
        />
        <div className="mob-sheet" data-open={open ? "true" : "false"} />
      </>
    );
  }

  const edited = reply !== (triage.drafted_response || "");
  const superseded = (triage.superseded_by?.length ?? 0) > 0;
  const displayFrom = message.from.replace(/<[^>]+>/g, "").trim();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reply);
      onToast("Copied");
    } catch {
      onToast("Copy failed");
    }
  };

  return (
    <>
      <div
        className="mob-sheet-backdrop"
        data-open={open ? "true" : "false"}
        onClick={onClose}
      />
      <div className="mob-sheet" data-open={open ? "true" : "false"}>
        <div className="mob-sheet-grab" />
        <div className="mob-sheet-head">
          <div className="row1">
            <span
              className="mono"
              style={{
                fontSize: 10,
                padding: "2px 6px",
                background: "var(--surface-2)",
                borderRadius: 4,
                color: "var(--ink-3)",
              }}
            >
              #{message.id}
            </span>
            <ChannelBadge channel={message.channel} />
            <CategoryBadge category={triage.category} />
            <span style={{ marginLeft: "auto" }} className="mono">
              {formatTime(message.timestamp)}
            </span>
          </div>
          <div className="from">{displayFrom}</div>
          {message.subject ? <div className="sub">{message.subject}</div> : null}
        </div>
        <div className="mob-sheet-body">
          {superseded ? (
            <div
              style={{
                padding: "8px 12px",
                background: "var(--bg-2)",
                border: "1px dashed var(--border-strong)",
                borderRadius: 10,
                fontSize: 12.5,
                color: "var(--ink-3)",
                alignSelf: "flex-start",
              }}
            >
              Resolved by{" "}
              {triage.superseded_by!.map((id) => `#${id}`).join(", ")}
            </div>
          ) : null}

          <div className="mob-section">
            <div className="h">Why</div>
            <div className="p">{triage.reasoning}</div>
          </div>

          {triage.thread_note ? (
            <div className="mob-section">
              <div className="h">Thread context</div>
              <div className="p" style={{ color: "var(--ink-2)" }}>
                {triage.thread_note}
              </div>
            </div>
          ) : null}

          {triage.category === "delegate" && triage.assignee ? (
            <div className="mob-section">
              <div className="h">Assignee</div>
              <div>
                <span className="mob-assignee">
                  <span className="avatar">
                    {avatarInitials(triage.assignee)}
                  </span>
                  {triage.assignee}
                </span>
              </div>
            </div>
          ) : null}

          {triage.drafted_response && triage.drafted_response.trim() ? (
            <div className="mob-draft">
              <div className="draft-head">
                <span className="h">
                  <span
                    style={{ width: 11, height: 11, color: "var(--accent)" }}
                  >
                    <Icon.sparkle />
                  </span>
                  {triage.category === "delegate"
                    ? "Drafted handoff"
                    : "Drafted reply"}
                  {edited ? (
                    <span style={{ marginLeft: 6, color: "var(--ink-3)" }}>
                      · edited
                    </span>
                  ) : null}
                </span>
                {edited ? (
                  <button
                    type="button"
                    onClick={() => setReply(triage.drafted_response)}
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: "var(--ink-3)",
                      padding: "3px 8px",
                      borderRadius: 6,
                    }}
                  >
                    Reset
                  </button>
                ) : null}
              </div>
              <textarea
                ref={taRef}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                spellCheck
                rows={3}
              />
              <div className="actions">
                <button
                  type="button"
                  className="mob-btn mob-btn-primary"
                  onClick={copy}
                >
                  <Icon.copy /> Copy reply
                </button>
              </div>
            </div>
          ) : null}

          <details
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: 12,
            }}
          >
            <summary
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--ink-3)",
                cursor: "pointer",
              }}
            >
              Show original
            </summary>
            <div
              style={{
                marginTop: 10,
                padding: 12,
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--ink-2)",
                whiteSpace: "pre-wrap",
              }}
            >
              {message.body}
            </div>
          </details>
        </div>
      </div>
    </>
  );
}

/* ───────────── tabs ───────────── */

interface Counts {
  decide: number;
  delegate: number;
  ignore: number;
}

function TodayTab({
  counts,
  flagsCount,
  output,
}: {
  counts: Counts;
  total: number;
  flagsCount: number;
  output: ChiefOfStaffOutput;
}) {
  const topFlags = useMemo(
    () =>
      [...output.flags]
        .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])
        .slice(0, 3),
    [output.flags]
  );
  return (
    <>
      <div className="mob-stats">
        <div className="mob-stat">
          <span className="dot" style={{ background: "var(--cat-decide)" }} />
          <div className="v">{counts.decide}</div>
          <div className="l">Decide</div>
        </div>
        <div className="mob-stat">
          <span className="dot" style={{ background: "var(--cat-delegate)" }} />
          <div className="v">{counts.delegate}</div>
          <div className="l">Delegate</div>
        </div>
        <div className="mob-stat">
          <span className="dot" style={{ background: "var(--cat-ignore)" }} />
          <div className="v">{counts.ignore}</div>
          <div className="l">Ignore</div>
        </div>
        <div className="mob-stat">
          <span className="dot" style={{ background: "var(--sev-critical)" }} />
          <div className="v">{flagsCount}</div>
          <div className="l">Flags</div>
        </div>
      </div>

      <div className="mob-card">
        <div className="mob-card-head">
          <h3>Daily briefing</h3>
          <span className="meta">&lt; 2 min</span>
        </div>
        <div className="mob-card-body">
          <MobBriefing markdown={output.briefing} />
        </div>
      </div>

      {topFlags.length ? (
        <div className="mob-card">
          <div className="mob-card-head">
            <h3>Top flags</h3>
            <span className="meta">{output.flags.length} total</span>
          </div>
          <div className="mob-card-body">
            {topFlags.map((f, i) => (
              <MobFlag key={i} flag={f} />
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function TriageTab({
  messages,
  triage,
  onOpen,
}: {
  messages: IncomingMessage[];
  triage: TriageItem[];
  onOpen: (id: number) => void;
}) {
  const [active, setActive] = useState<TriageCategory>("decide");
  const counts = useMemo(
    () => ({
      decide: triage.filter((t) => t.category === "decide").length,
      delegate: triage.filter((t) => t.category === "delegate").length,
      ignore: triage.filter((t) => t.category === "ignore").length,
    }),
    [triage]
  );
  const msgsById = useMemo(() => {
    const m = new Map<number, IncomingMessage>();
    for (const x of messages) m.set(x.id, x);
    return m;
  }, [messages]);
  const visible = useMemo(
    () => triage.filter((t) => t.category === active),
    [triage, active]
  );

  return (
    <>
      <div className="mob-seg">
        <button
          type="button"
          data-active={active === "decide"}
          onClick={() => setActive("decide")}
        >
          Decide <span className="c mono">{counts.decide}</span>
        </button>
        <button
          type="button"
          data-active={active === "delegate"}
          onClick={() => setActive("delegate")}
        >
          Delegate <span className="c mono">{counts.delegate}</span>
        </button>
        <button
          type="button"
          data-active={active === "ignore"}
          onClick={() => setActive("ignore")}
        >
          Ignore <span className="c mono">{counts.ignore}</span>
        </button>
      </div>
      {visible.length === 0 ? (
        <div
          style={{
            padding: "40px 20px",
            textAlign: "center",
            color: "var(--ink-3)",
          }}
        >
          <div className="serif" style={{ fontSize: 22, marginBottom: 4 }}>
            Nothing here.
          </div>
          <div style={{ fontSize: 13 }}>This bucket is empty.</div>
        </div>
      ) : (
        visible.map((t) => {
          const m = msgsById.get(t.message_id);
          if (!m) return null;
          return (
            <MobMsgRow
              key={t.message_id}
              message={m}
              triage={t}
              onOpen={onOpen}
            />
          );
        })
      )}
    </>
  );
}

function FlagsTab({ flags }: { flags: Flag[] }) {
  const sorted = useMemo(
    () => [...flags].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]),
    [flags]
  );
  if (!sorted.length)
    return (
      <div
        style={{
          padding: "40px 20px",
          textAlign: "center",
          color: "var(--ink-3)",
        }}
      >
        <div className="serif" style={{ fontSize: 22, marginBottom: 4 }}>
          All clear.
        </div>
        <div style={{ fontSize: 13 }}>Nothing critical surfaced.</div>
      </div>
    );
  return (
    <>
      {sorted.map((f, i) => (
        <MobFlag key={i} flag={f} />
      ))}
    </>
  );
}

const ACCENTS: Record<AccentKey, { name: string; light: string; dark: string }> = {
  indigo: { name: "Indigo", light: "oklch(0.55 0.18 264)", dark: "oklch(0.72 0.16 264)" },
  forest: { name: "Forest", light: "oklch(0.50 0.13 155)", dark: "oklch(0.72 0.13 155)" },
  ember: { name: "Ember", light: "oklch(0.58 0.17 35)", dark: "oklch(0.76 0.15 35)" },
  rose: { name: "Rose", light: "oklch(0.58 0.18 0)", dark: "oklch(0.76 0.16 0)" },
  slate: { name: "Graphite", light: "oklch(0.38 0.020 260)", dark: "oklch(0.78 0.010 260)" },
};

function SettingsTab({
  sensitivity,
  setSensitivity,
  snooze,
  setSnooze,
  dark,
  setDark,
  accentKey,
  setAccent,
  hiddenBreakdown,
  onProcess,
  onReset,
  hasOutput,
  processing,
}: {
  sensitivity: Sensitivity;
  setSensitivity: (s: Sensitivity) => void;
  snooze: SnoozeRules;
  setSnooze: (updater: (s: SnoozeRules) => SnoozeRules) => void;
  dark: boolean;
  setDark: (v: boolean) => void;
  accentKey: AccentKey;
  setAccent: (a: AccentKey) => void;
  hiddenBreakdown: { newsletters: number; personal: number };
  onProcess: () => void;
  onReset: () => void;
  hasOutput: boolean;
  processing: boolean;
}) {
  return (
    <>
      <div className="mob-card">
        <div className="mob-card-head">
          <h3>Inbox</h3>
        </div>
        <div className="mob-field">
          <button
            type="button"
            className="mob-btn mob-btn-primary"
            onClick={onProcess}
            disabled={processing}
            style={{ width: "100%" }}
          >
            {processing
              ? "Streaming…"
              : hasOutput
                ? "Re-process inbox"
                : "Process inbox"}
          </button>
          <button
            type="button"
            className="mob-btn mob-btn-ghost"
            onClick={onReset}
            disabled={processing}
            style={{ width: "100%" }}
          >
            Reset to sample
          </button>
        </div>
      </div>

      <div className="mob-card">
        <div className="mob-card-head">
          <h3>Sensitivity</h3>
        </div>
        <div className="mob-field">
          <div className="mob-seg">
            {SENSITIVITY_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                data-active={o.value === sensitivity}
                onClick={() => setSensitivity(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
            {SENSITIVITY_OPTIONS.find((o) => o.value === sensitivity)?.hint}
          </div>
        </div>
      </div>

      <div className="mob-card">
        <div className="mob-card-head">
          <h3>Snooze</h3>
        </div>
        <button
          type="button"
          className="mob-list-row"
          onClick={() =>
            setSnooze((s) => ({ ...s, hideNewsletters: !s.hideNewsletters }))
          }
        >
          <div className="lbl">
            <div className="title">Newsletters &amp; automated</div>
            <div className="sub">{hiddenBreakdown.newsletters} would be hidden</div>
          </div>
          <span
            className="mob-switch"
            data-on={snooze.hideNewsletters ? "true" : "false"}
          />
        </button>
        <button
          type="button"
          className="mob-list-row"
          onClick={() =>
            setSnooze((s) => ({ ...s, hidePersonal: !s.hidePersonal }))
          }
        >
          <div className="lbl">
            <div className="title">Personal WhatsApps</div>
            <div className="sub">{hiddenBreakdown.personal} would be hidden</div>
          </div>
          <span
            className="mob-switch"
            data-on={snooze.hidePersonal ? "true" : "false"}
          />
        </button>
      </div>

      <div className="mob-card">
        <div className="mob-card-head">
          <h3>Appearance</h3>
        </div>
        <button
          type="button"
          className="mob-list-row"
          onClick={() => setDark(!dark)}
        >
          <div className="lbl">
            <div className="title">Dark mode</div>
            <div className="sub">Switch to a calmer evening palette</div>
          </div>
          <span className="mob-switch" data-on={dark ? "true" : "false"} />
        </button>
        <div style={{ padding: "12px 16px 6px" }}>
          <div className="mob-field-label">Accent</div>
        </div>
        <div className="mob-swatches">
          {(Object.keys(ACCENTS) as AccentKey[]).map((k) => (
            <button
              key={k}
              type="button"
              className="mob-swatch"
              data-active={k === accentKey ? "true" : "false"}
              onClick={() => setAccent(k)}
              style={{ background: ACCENTS[k][dark ? "dark" : "light"] }}
              title={ACCENTS[k].name}
              aria-label={`Accent: ${ACCENTS[k].name}`}
            />
          ))}
        </div>
      </div>
    </>
  );
}

/* ───────────── main mobile shell ───────────── */

interface MobileAppProps {
  messages: IncomingMessage[];
  output: ChiefOfStaffOutput | null;
  visibleFlags: Flag[];
  counts: Counts;
  hiddenBreakdown: { newsletters: number; personal: number };
  dateline: { day: string; long: string; time: string };
  sensitivity: Sensitivity;
  setSensitivity: (s: Sensitivity) => void;
  snooze: SnoozeRules;
  setSnooze: (updater: (s: SnoozeRules) => SnoozeRules) => void;
  dark: boolean;
  setDark: (v: boolean) => void;
  accent: AccentKey;
  setAccent: (a: AccentKey) => void;
  onProcess: () => void;
  onReset: () => void;
  processing: boolean;
  reweighted: TriageItem[];
  filteredMessages: IncomingMessage[];
  framed?: boolean; // when true, wrap in IosFrame; otherwise render bare
  error?: ClassifiedError | null;
}

export function MobileApp(props: MobileAppProps) {
  const {
    output,
    visibleFlags,
    counts,
    hiddenBreakdown,
    dateline,
    sensitivity,
    setSensitivity,
    snooze,
    setSnooze,
    dark,
    setDark,
    accent,
    setAccent,
    onProcess,
    onReset,
    processing,
    reweighted,
    filteredMessages,
    framed = true,
    error,
  } = props;

  const [tab, setTab] = useState<Tab>("today");
  const [openId, setOpenId] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);

  const headline = useMemo(() => {
    if (!output) {
      return (
        <>
          Your morning, <em>waiting.</em>
        </>
      );
    }
    const c = counts.decide;
    if (c === 0)
      return (
        <>
          Quiet morning, <em>nothing urgent.</em>
        </>
      );
    if (c === 1)
      return (
        <>
          One call, <em>rest handled.</em>
        </>
      );
    if (c >= 3)
      return (
        <>
          Three calls, <em>then breathe.</em>
        </>
      );
    return (
      <>
        Your morning, <em>triaged.</em>
      </>
    );
  }, [counts.decide, output]);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1500);
  }, []);

  const openTriage =
    openId != null ? reweighted.find((x) => x.message_id === openId) ?? null : null;
  const openMsg =
    openId != null ? filteredMessages.find((x) => x.id === openId) ?? null : null;

  const flagsBadge = visibleFlags.filter((f) => f.severity === "critical").length;
  const triageBadge = counts.decide;

  const SettingsIcon = Icon.gear;
  const TABS: { id: Tab; label: string; Icon: () => JSX.Element }[] = [
    { id: "today", label: "Today", Icon: Icon.sparkle },
    { id: "triage", label: "Triage", Icon: Icon.filter },
    { id: "flags", label: "Flags", Icon: Icon.alert },
    { id: "settings", label: "Settings", Icon: SettingsIcon },
  ];

  const Inner = (
    <div className="mob-app">
      <header className="mob-header">
        <div className="mob-header-row">
          <div>
            <div className="mob-eyebrow">
              <span className="live" />
              <span>
                {dateline.long}
                {dateline.time ? ` · ${dateline.time}` : ""}
              </span>
            </div>
            <h1 className="mob-header-title">
              {tab === "today" && headline}
              {tab === "triage" && "Triage"}
              {tab === "flags" && "Flags"}
              {tab === "settings" && "Settings"}
            </h1>
          </div>
          {tab === "today" ? (
            <button
              type="button"
              className="mob-icon-btn"
              onClick={() => setDark(!dark)}
              aria-label="Toggle theme"
            >
              {dark ? <Icon.sun /> : <Icon.moon />}
            </button>
          ) : null}
        </div>
      </header>

      <div className="mob-content">
        {error ? (
          <MobErrorState error={error} onRetry={onProcess} />
        ) : !output ? (
          <div
            style={{
              padding: "40px 8px",
              textAlign: "center",
              color: "var(--ink-3)",
            }}
          >
            <div className="serif" style={{ fontSize: 24, marginBottom: 6 }}>
              Nothing yet.
            </div>
            <div style={{ fontSize: 13, marginBottom: 18 }}>
              Tap Process to triage {filteredMessages.length} messages.
            </div>
            <button
              type="button"
              className="mob-btn mob-btn-primary"
              onClick={onProcess}
              disabled={processing}
              style={{ display: "inline-flex" }}
            >
              {processing ? "Streaming…" : "Process inbox"}
            </button>
          </div>
        ) : tab === "today" ? (
          <TodayTab
            counts={counts}
            total={filteredMessages.length}
            flagsCount={visibleFlags.length}
            output={{ ...output, flags: visibleFlags }}
          />
        ) : tab === "triage" ? (
          <TriageTab
            messages={filteredMessages}
            triage={reweighted}
            onOpen={(id) => setOpenId(id)}
          />
        ) : tab === "flags" ? (
          <FlagsTab flags={visibleFlags} />
        ) : (
          <SettingsTab
            sensitivity={sensitivity}
            setSensitivity={setSensitivity}
            snooze={snooze}
            setSnooze={setSnooze}
            dark={dark}
            setDark={setDark}
            accentKey={accent}
            setAccent={setAccent}
            hiddenBreakdown={hiddenBreakdown}
            onProcess={onProcess}
            onReset={onReset}
            hasOutput={output != null}
            processing={processing}
          />
        )}
      </div>

      <nav className="mob-tabbar">
        {TABS.map(({ id, label, Icon: I }) => {
          const badgeN =
            id === "flags" ? flagsBadge : id === "triage" ? triageBadge : 0;
          return (
            <button
              key={id}
              type="button"
              className="mob-tab"
              data-active={tab === id ? "true" : "false"}
              onClick={() => setTab(id)}
            >
              <I />
              <span>{label}</span>
              {badgeN > 0 && id !== tab ? (
                <span className="badge">{badgeN}</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <MobSheet
        open={openId != null}
        message={openMsg}
        triage={openTriage}
        onClose={() => setOpenId(null)}
        onToast={showToast}
      />

      <div className="mob-toast" data-show={toast ? "true" : "false"}>
        {toast}
      </div>
    </div>
  );

  if (!framed) {
    // Render bare — used when the actual device viewport is small enough.
    return <div style={{ height: "100vh", overflow: "hidden" }}>{Inner}</div>;
  }

  return <IosFrame dark={dark}>{Inner}</IosFrame>;
}
