"use client";

import { Icon } from "./Icon";
import type { Sensitivity } from "@/lib/types";

const OPTIONS: { value: Sensitivity; label: string; hint: string }[] = [
  {
    value: "conservative",
    label: "Conservative",
    hint: "Smallest Decide list. Borderline calls drop to delegate.",
  },
  { value: "balanced", label: "Balanced", hint: "Default judgment from the model." },
  {
    value: "aggressive",
    label: "Aggressive",
    hint: "Surface borderline delegates so you see them.",
  },
];

export interface SnoozeRules {
  hideNewsletters: boolean;
  hidePersonal: boolean;
}

export function ControlsPanel({
  sensitivity,
  setSensitivity,
  snooze,
  setSnooze,
  hiddenBreakdown,
}: {
  sensitivity: Sensitivity;
  setSensitivity: (s: Sensitivity) => void;
  snooze: SnoozeRules;
  setSnooze: (updater: (s: SnoozeRules) => SnoozeRules) => void;
  hiddenBreakdown: { newsletters: number; personal: number };
}) {
  return (
    <section className="card controls">
      <div className="card-head">
        <h2>Settings</h2>
      </div>
      <div className="controls-body">
        <div className="field">
          <div className="field-label">Sensitivity</div>
          <div className="seg">
            {OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                data-active={o.value === sensitivity}
                onClick={() => setSensitivity(o.value)}
                title={o.hint}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="field-hint">
            {OPTIONS.find((o) => o.value === sensitivity)?.hint}
          </div>
        </div>

        <div className="field">
          <div className="field-label">Snooze</div>
          <label className="check">
            <input
              type="checkbox"
              checked={snooze.hideNewsletters}
              onChange={(e) =>
                setSnooze((s) => ({ ...s, hideNewsletters: e.target.checked }))
              }
            />
            <span className="box">
              <Icon.check />
            </span>
            <span className="lbl">Newsletters &amp; automated</span>
            <span className="count mono">{hiddenBreakdown.newsletters}</span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={snooze.hidePersonal}
              onChange={(e) =>
                setSnooze((s) => ({ ...s, hidePersonal: e.target.checked }))
              }
            />
            <span className="box">
              <Icon.check />
            </span>
            <span className="lbl">Personal WhatsApps</span>
            <span className="count mono">{hiddenBreakdown.personal}</span>
          </label>
        </div>
      </div>
    </section>
  );
}
