"use client";

import { useMemo } from "react";
import type { Flag, FlagSeverity } from "@/lib/types";
import { Icon } from "./Icon";

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

export function FlagsPanel({
  flags,
  onRefClick,
}: {
  flags: Flag[];
  onRefClick: (id: number) => void;
}) {
  const sorted = useMemo(
    () => [...flags].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]),
    [flags]
  );
  const critCount = flags.filter((f) => f.severity === "critical").length;

  return (
    <section className="card">
      <div className="card-head">
        <h2>Flags</h2>
        <span className="head-meta">
          {critCount > 0 ? (
            <span style={{ color: "var(--sev-critical)", fontWeight: 600 }}>
              {critCount} critical
            </span>
          ) : null}
          {critCount > 0 ? <span>·</span> : null}
          <span>{flags.length} total</span>
        </span>
      </div>
      <div
        style={{
          padding: "16px 18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {sorted.length === 0 ? (
          <div className="empty">
            <div className="big">All clear.</div>
            <div>Nothing critical surfaced this morning.</div>
          </div>
        ) : (
          sorted.map((f, i) => (
            <FlagCard key={i} flag={f} onRefClick={onRefClick} />
          ))
        )}
      </div>
    </section>
  );
}

function FlagCard({
  flag,
  onRefClick,
}: {
  flag: Flag;
  onRefClick: (id: number) => void;
}) {
  const I = FLAG_ICON[flag.severity] ?? Icon.alert;
  return (
    <button
      type="button"
      className="flag"
      data-sev={flag.severity}
      onClick={() => {
        const first = flag.related_message_ids?.[0];
        if (first != null) onRefClick(first);
      }}
    >
      <div className="flag-icon">
        <I />
      </div>
      <div className="flag-body">
        <div className="flag-meta">
          <span className="sev-dot" />
          {flag.severity}
        </div>
        <h3 className="flag-title">{flag.title}</h3>
        <p className="flag-detail">{flag.detail}</p>
        {flag.related_message_ids?.length ? (
          <div className="flag-refs">
            {flag.related_message_ids.map((id) => (
              <span key={id} className="ref">
                #{id}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}
