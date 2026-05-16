"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  IncomingMessage,
  TriageCategory,
  TriageItem,
} from "@/lib/types";
import { MessageCard } from "./MessageCard";

const TABS: { id: TriageCategory; label: string; hint: string }[] = [
  { id: "decide", label: "Decide", hint: "These need you, personally." },
  { id: "delegate", label: "Delegate", hint: "Handed off with a drafted note." },
  { id: "ignore", label: "Ignore", hint: "Absorbed on your behalf." },
];

// Rename to TriageList replacement.
// File kept at this filename for clarity ("TriageList" was the v0.2 name).
export function TriagePanel({
  messages,
  triage,
  highlight,
  onRefClick,
  onToast,
}: {
  messages: IncomingMessage[];
  triage: TriageItem[];
  highlight: number | null;
  onRefClick: (id: number) => void;
  onToast: (text: string) => void;
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

  // When a user clicks a [#N] ref, jump to the right tab automatically.
  useEffect(() => {
    if (highlight == null) return;
    const t = triage.find((x) => x.message_id === highlight);
    if (t) setActive(t.category);
  }, [highlight, triage]);

  const messagesById = useMemo(() => {
    const map = new Map<number, IncomingMessage>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  const visible = useMemo(
    () => triage.filter((t) => t.category === active),
    [triage, active]
  );

  const tabHint = TABS.find((t) => t.id === active)?.hint;

  return (
    <section className="card">
      <div className="card-head">
        <div className="row" style={{ gap: 16 }}>
          <h2>Triage</h2>
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                className="tab"
                data-active={t.id === active}
                aria-selected={t.id === active}
                onClick={() => setActive(t.id)}
              >
                {t.label}
                <span className="count mono">{counts[t.id]}</span>
              </button>
            ))}
          </div>
        </div>
        <span className="head-meta">{triage.length} messages</span>
      </div>
      <p className="tab-hint">{tabHint}</p>
      {visible.length === 0 ? (
        <div className="empty">
          <div className="big">Nothing here.</div>
          <div>This bucket is empty for the current sensitivity.</div>
        </div>
      ) : (
        <div className="triage-list">
          {visible.map((t) => {
            const m = messagesById.get(t.message_id);
            if (!m) return null;
            return (
              <MessageCard
                key={t.message_id}
                message={m}
                triage={t}
                highlight={highlight === t.message_id}
                onRefClick={onRefClick}
                onToast={onToast}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
