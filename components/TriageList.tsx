"use client";

import { useMemo, useState } from "react";
import type { IncomingMessage, TriageItem } from "@/lib/types";
import { MessageCard } from "./MessageCard";

const TABS = [
  {
    id: "decide" as const,
    label: "Decide",
    description: "CEO must act personally",
  },
  {
    id: "delegate" as const,
    label: "Delegate",
    description: "Handed off with a drafted reply",
  },
  {
    id: "ignore" as const,
    label: "Ignore",
    description: "No action needed",
  },
];

const PILL_STYLES: Record<TriageItem["category"], string> = {
  decide: "bg-red-100 text-red-800",
  delegate: "bg-amber-100 text-amber-800",
  ignore: "bg-ink-100 text-ink-700",
};

export function TriageList({
  messages,
  triage,
}: {
  messages: IncomingMessage[];
  triage: TriageItem[];
}) {
  const messagesById = useMemo(() => {
    const map = new Map<number, IncomingMessage>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  const counts = useMemo(() => {
    return {
      decide: triage.filter((t) => t.category === "decide").length,
      delegate: triage.filter((t) => t.category === "delegate").length,
      ignore: triage.filter((t) => t.category === "ignore").length,
    };
  }, [triage]);

  const [active, setActive] = useState<TriageItem["category"]>("decide");

  const visible = useMemo(
    () => triage.filter((t) => t.category === active),
    [triage, active]
  );

  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-6 shadow-card">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-ink-900">Triage</h2>
        <span className="text-xs text-ink-500">{triage.length} messages</span>
      </div>

      <div role="tablist" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(tab.id)}
              className={`group flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                isActive
                  ? "bg-ink-900 text-white"
                  : "bg-ink-100 text-ink-700 hover:bg-ink-200"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  isActive ? "bg-white/15 text-white" : PILL_STYLES[tab.id]
                }`}
              >
                {counts[tab.id]}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mb-4 text-sm text-ink-500">
        {TABS.find((t) => t.id === active)?.description}
      </p>

      {visible.length === 0 ? (
        <p className="rounded-xl bg-ink-50 p-6 text-center text-sm text-ink-500">
          No messages in this category.
        </p>
      ) : (
        <ul className="grid gap-3">
          {visible.map((t) => {
            const message = messagesById.get(t.message_id);
            if (!message) return null;
            return (
              <li key={t.message_id}>
                <MessageCard message={message} triage={t} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
