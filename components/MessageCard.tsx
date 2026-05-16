"use client";

import { useEffect, useRef, useState } from "react";
import type {
  Confidence,
  IncomingMessage,
  TriageItem,
} from "@/lib/types";
import { ChannelBadge } from "./ChannelBadge";

const CATEGORY_STYLES: Record<TriageItem["category"], string> = {
  decide: "bg-red-100 text-red-800 ring-red-200",
  delegate: "bg-amber-100 text-amber-800 ring-amber-200",
  ignore: "bg-ink-100 text-ink-700 ring-ink-200",
};

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  high: "",
  medium: "bg-sky-50 text-sky-700 ring-sky-200",
  low: "bg-yellow-50 text-yellow-800 ring-yellow-300",
};

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "",
  medium: "Medium confidence",
  low: "Low confidence — check original",
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function useAutoSizeTextarea(value: string) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return ref;
}

export function MessageCard({
  message,
  triage,
}: {
  message: IncomingMessage;
  triage: TriageItem;
}) {
  const [showBody, setShowBody] = useState(false);
  const [reply, setReply] = useState(triage.drafted_response);
  const [copied, setCopied] = useState(false);
  const textareaRef = useAutoSizeTextarea(reply);

  // If the underlying drafted_response changes (e.g. re-processing), reset edits.
  useEffect(() => {
    setReply(triage.drafted_response);
  }, [triage.drafted_response]);

  const superseded = (triage.superseded_by?.length ?? 0) > 0;
  const confidence: Confidence = triage.confidence ?? "high";
  const showConfidenceBadge = confidence !== "high";

  async function copyReply() {
    if (!reply) return;
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  function resetReply() {
    setReply(triage.drafted_response);
  }

  const replyEdited = reply !== triage.drafted_response;

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm transition ${
        superseded ? "border-ink-200 opacity-70" : "border-ink-200"
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <ChannelBadge channel={message.channel} />
            <span className="text-xs text-ink-500">#{message.id}</span>
            <span className="text-xs text-ink-500">
              {formatTime(message.timestamp)}
            </span>
          </div>
          <div className="truncate font-medium text-ink-900">{message.from}</div>
          {message.subject && (
            <div className="truncate text-sm text-ink-600">
              {message.subject}
            </div>
          )}
          {message.channel_name && (
            <div className="truncate text-sm text-ink-600">
              {message.channel_name}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ring-1 ring-inset ${CATEGORY_STYLES[triage.category]}`}
          >
            {triage.category}
          </span>
          {showConfidenceBadge && (
            <span
              title={CONFIDENCE_LABELS[confidence]}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${CONFIDENCE_STYLES[confidence]}`}
            >
              {confidence === "low" ? "Low confidence" : "Medium confidence"}
            </span>
          )}
        </div>
      </header>

      {superseded && (
        <div className="mt-3 rounded-md bg-ink-100 px-3 py-1.5 text-xs text-ink-700">
          Superseded by{" "}
          {triage.superseded_by!.map((id) => `#${id}`).join(", ")}
        </div>
      )}

      <div className="mt-3 space-y-3 text-sm">
        <button
          type="button"
          onClick={() => setShowBody((v) => !v)}
          className="text-xs font-medium text-ink-500 hover:text-ink-900"
        >
          {showBody ? "Hide original" : "Show original"}
        </button>
        {showBody && (
          <pre className="whitespace-pre-wrap rounded-md bg-ink-50 p-3 font-sans text-[13px] text-ink-800">
            {message.body}
          </pre>
        )}

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
            Why
          </div>
          <p className="mt-0.5 text-ink-800">{triage.reasoning}</p>
        </div>

        {triage.thread_note && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              Thread context
            </div>
            <p className="mt-0.5 text-ink-700">{triage.thread_note}</p>
          </div>
        )}

        {triage.category === "delegate" && triage.assignee && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              Assignee
            </div>
            <p className="mt-0.5 font-medium text-ink-900">{triage.assignee}</p>
          </div>
        )}

        {triage.drafted_response && triage.drafted_response.trim().length > 0 && (
          <div>
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                {triage.category === "delegate"
                  ? "Drafted handoff (editable)"
                  : "Drafted reply (editable)"}
              </div>
              <div className="flex items-center gap-3">
                {replyEdited && (
                  <button
                    type="button"
                    onClick={resetReply}
                    className="text-[11px] font-medium text-ink-500 hover:text-ink-900"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={copyReply}
                  className="text-[11px] font-medium text-ink-500 hover:text-ink-900"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              spellCheck={true}
              rows={3}
              className="mt-1 w-full resize-none rounded-md border border-ink-200 bg-ink-50 p-3 font-sans text-[13px] leading-relaxed text-ink-800 outline-none transition focus:border-ink-400 focus:bg-white focus:ring-2 focus:ring-ink-200"
            />
          </div>
        )}
      </div>
    </article>
  );
}
