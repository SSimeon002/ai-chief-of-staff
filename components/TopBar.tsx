"use client";

import { Icon } from "./Icon";

export interface DateLine {
  day: string;
  time: string;
}

export type DeviceMode = "desktop" | "mobile" | "auto";

const DEVICE_OPTIONS: { value: DeviceMode; label: string; icon: () => JSX.Element }[] = [
  { value: "desktop", label: "Desktop", icon: Icon.desktop },
  { value: "mobile", label: "Mobile", icon: Icon.mobile },
  { value: "auto", label: "Auto", icon: Icon.check },
];

export function TopBar({
  dateline,
  dark,
  onToggleDark,
  onCycleAccent,
  onProcess,
  onUpload,
  onReset,
  processing,
  hasData,
  ready,
  device,
  setDevice,
  compact,
}: {
  dateline: DateLine;
  dark: boolean;
  onToggleDark: () => void;
  onCycleAccent: () => void;
  onProcess: () => void;
  onUpload: () => void;
  onReset: () => void;
  processing: boolean;
  hasData: boolean;
  ready: boolean;
  device: DeviceMode;
  setDevice: (m: DeviceMode) => void;
  compact?: boolean; // when true, the dateline is hidden (used in mobile mode)
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" />
        <span>Chief of Staff</span>
      </div>
      <div className="spacer" />

      {!compact && (
        <div className="meta">
          <span className="live-dot" />
          <span>Live</span>
          {dateline.day ? (
            <>
              <span className="dot" />
              <span>{dateline.day}</span>
            </>
          ) : null}
          {dateline.time ? (
            <>
              <span className="dot" />
              <span className="mono">{dateline.time}</span>
            </>
          ) : null}
        </div>
      )}

      <div className="device-seg" role="tablist" aria-label="Device view">
        {DEVICE_OPTIONS.map((opt) => {
          const Ic = opt.icon;
          const active = opt.value === device;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={active}
              data-active={active}
              onClick={() => setDevice(opt.value)}
              title={`View: ${opt.label}`}
            >
              <Ic />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      <div className="row" style={{ gap: 6 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={onProcess}
          disabled={!ready || processing}
          title={
            processing
              ? "Streaming briefing…"
              : hasData
                ? "Re-process inbox"
                : "Process inbox"
          }
        >
          {processing ? (
            <>
              <span className="spinner" />
              Streaming
            </>
          ) : hasData ? (
            "Re-process"
          ) : (
            "Process inbox"
          )}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={onUpload}
          disabled={processing}
          title="Upload a different messages.json"
        >
          Upload
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={onReset}
          disabled={processing}
          title="Reset to bundled sample"
        >
          Reset
        </button>
      </div>

      <div style={{ width: 4 }} />
      <button
        className="icon-btn"
        onClick={onCycleAccent}
        title="Cycle accent colour"
        aria-label="Cycle accent colour"
        type="button"
      >
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            background: "var(--accent)",
            boxShadow: "inset 0 0 0 1px oklch(0 0 0 / 0.15)",
          }}
        />
      </button>
      <button
        className="icon-btn"
        onClick={onToggleDark}
        aria-label="Toggle theme"
        title={dark ? "Switch to light" : "Switch to dark"}
        type="button"
      >
        {dark ? <Icon.sun /> : <Icon.moon />}
      </button>
    </header>
  );
}
