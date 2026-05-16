"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { IncomingMessage, TriageItem } from "@/lib/types";
import { ChannelBadge } from "./ChannelBadge";
import { CategoryBadge } from "./CategoryBadge";
import { Icon } from "./Icon";

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

export function MessageCard({
  message,
  triage,
  highlight,
  initiallyOpen,
  onRefClick,
  onToast,
}: {
  message: IncomingMessage;
  triage: TriageItem;
  highlight?: boolean;
  initiallyOpen?: boolean;
  onRefClick?: (id: number) => void;
  onToast?: (text: string) => void;
}) {
  const [open, setOpen] = useState(!!initiallyOpen);
  const [showOriginal, setShowOriginal] = useState(false);
  const [reply, setReply] = useState(triage.drafted_response);
  const textareaRef = useAutoSize(reply);

  useEffect(() => {
    setReply(triage.drafted_response);
  }, [triage.drafted_response]);

  // If the user clicks a [#N] reference, this card should pop open so the
  // briefing-to-message hop feels continuous.
  useEffect(() => {
    if (highlight) setOpen(true);
  }, [highlight]);

  const superseded = (triage.superseded_by?.length ?? 0) > 0;
  const edited = reply !== triage.drafted_response;

  const copy = async () => {
    if (!reply) return;
    try {
      await navigator.clipboard.writeText(reply);
      onToast?.("Reply copied");
    } catch {
      onToast?.("Copy failed");
    }
  };

  const displayFrom = message.from.replace(/<[^>]+>/g, "").trim();
  const emailAddr = message.from.match(/<([^>]+)>/)?.[1];

  return (
    <article
      className="msg"
      data-superseded={superseded}
      data-highlight={highlight ? "true" : "false"}
      id={`msg-${message.id}`}
    >
      <button
        type="button"
        className="msg-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="msg-id mono">#{message.id}</span>
        <div className="msg-main">
          <div className="msg-meta">
            <ChannelBadge channel={message.channel} />
            <span className="sep">·</span>
            <span className="mono">{formatTime(message.timestamp)}</span>
            {message.channel_name ? (
              <>
                <span className="sep">·</span>
                <span>{message.channel_name}</span>
              </>
            ) : null}
          </div>
          <div className="msg-from" title={emailAddr || displayFrom}>
            {displayFrom}
          </div>
          {message.subject ? (
            <div className="msg-subject">{message.subject}</div>
          ) : null}
        </div>
        <div className="msg-right">
          <CategoryBadge category={triage.category} />
          {triage.confidence && triage.confidence !== "high" ? (
            <span className="conf">
              <b>{triage.confidence}</b> confidence
            </span>
          ) : null}
        </div>
      </button>

      {open ? (
        <div className="msg-body">
          {superseded ? (
            <div className="supersede">
              Resolved by{" "}
              {triage.superseded_by!.map((id, i) => (
                <Fragment key={id}>
                  {i > 0 ? ", " : null}
                  <a className="ref" onClick={() => onRefClick?.(id)}>
                    #{id}
                  </a>
                </Fragment>
              ))}
            </div>
          ) : null}

          <div className="msg-section">
            <div className="h">Why</div>
            <div className="p">{triage.reasoning}</div>
          </div>

          {triage.thread_note ? (
            <div className="msg-section">
              <div className="h">Thread context</div>
              <div className="p" style={{ color: "var(--ink-2)" }}>
                {triage.thread_note}
              </div>
            </div>
          ) : null}

          {triage.category === "delegate" && triage.assignee ? (
            <div className="msg-section">
              <div className="h">Assignee</div>
              <div>
                <span className="assignee">
                  <span className="avatar">
                    {avatarInitials(triage.assignee)}
                  </span>
                  {triage.assignee}
                </span>
              </div>
            </div>
          ) : null}

          {triage.drafted_response && triage.drafted_response.trim() ? (
            <div className="draft">
              <div className="draft-head">
                <span className="h">
                  <span className="sparkle">
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
                <div className="draft-actions">
                  {edited ? (
                    <button
                      type="button"
                      className="micro"
                      onClick={() => setReply(triage.drafted_response)}
                    >
                      Reset
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="micro primary"
                    onClick={copy}
                  >
                    Copy
                  </button>
                </div>
              </div>
              <textarea
                ref={textareaRef}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                spellCheck
                rows={3}
              />
            </div>
          ) : null}

          <button
            type="button"
            className="toggle-original"
            onClick={() => setShowOriginal((v) => !v)}
          >
            {showOriginal ? "Hide original" : "Show original"}
            <Icon.chevron />
          </button>
          {showOriginal ? <div className="original">{message.body}</div> : null}
        </div>
      ) : null}
    </article>
  );
}
