import { useMemo, type ReactNode } from "react";
import type { DateLine } from "./TopBar";

export interface HeroCounts {
  decide: number;
  delegate: number;
  ignore: number;
}

export function Hero({
  dateline,
  counts,
  total,
  flagsCount,
  hiddenCount,
  hasOutput,
  onProcess,
  processing,
}: {
  dateline: DateLine;
  counts: HeroCounts;
  total: number;
  flagsCount: number;
  hiddenCount: number;
  hasOutput: boolean;
  onProcess: () => void;
  processing: boolean;
}) {
  const headline: ReactNode = useMemo(() => {
    if (!hasOutput) {
      return (
        <>
          Your morning, <em>waiting for you.</em>
        </>
      );
    }
    const c = counts.decide;
    const f = flagsCount;
    if (c === 0)
      return (
        <>
          Quiet morning, <em>nothing urgent.</em>
        </>
      );
    if (c === 1)
      return (
        <>
          One call to make, <em>rest is handled.</em>
        </>
      );
    if (f >= 5)
      return (
        <>
          {wordForCount(c)} calls, <em>one collision,</em> rest is handled.
        </>
      );
    return (
      <>
        Your morning, <em>triaged.</em>
      </>
    );
  }, [counts.decide, flagsCount, hasOutput]);

  return (
    <section className="hero">
      <div className="hero-inner">
        <div>
          <div className="eyebrow">
            <span className="line" />
            <span>
              {dateline.day ? `${dateline.day} · ${dateline.time}` : "Awaiting batch"}
            </span>
          </div>
          <h1 className="serif">{headline}</h1>
          <p className="hero-sub">
            {total} {total === 1 ? "message" : "messages"} across email, Slack, and WhatsApp
            {hasOutput ? (
              " — read together, cross-referenced, and reduced to what actually needs you."
            ) : (
              " — click Process inbox to triage them."
            )}
            {hiddenCount > 0 ? ` ${hiddenCount} hidden by filters.` : null}
          </p>
        </div>
        {hasOutput ? (
          <div className="hero-stats">
            <Stat
              label="Decide"
              value={counts.decide}
              of={total}
              swatch="var(--cat-decide)"
              hint="you, personally"
            />
            <Stat
              label="Delegate"
              value={counts.delegate}
              of={total}
              swatch="var(--cat-delegate)"
              hint="handed off"
            />
            <Stat
              label="Ignore"
              value={counts.ignore}
              of={total}
              swatch="var(--cat-ignore)"
              hint="absorbed"
            />
            <Stat
              label="Flags"
              value={flagsCount}
              swatch="var(--sev-critical)"
              hint="surfaced"
            />
          </div>
        ) : (
          <div className="hero-cta">
            <div className="h">Ready when you are</div>
            <p>
              The model reads all {total} messages together to spot threads, supersession,
              and what genuinely needs you. Takes about 30 seconds.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={onProcess}
              disabled={processing || total === 0}
            >
              {processing ? (
                <>
                  <span className="spinner" />
                  Streaming
                </>
              ) : (
                "Process inbox"
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  of,
  swatch,
  hint,
}: {
  label: string;
  value: number;
  of?: number;
  swatch: string;
  hint: string;
}) {
  return (
    <div className="stat">
      <div className="label">
        <span className="swatch" style={{ background: swatch }} />
        {label}
      </div>
      <div className="value">
        <span>{value}</span>
        {of != null ? <span className="of">of {of}</span> : null}
      </div>
      <div className="hint">{hint}</div>
    </div>
  );
}

function wordForCount(n: number): string {
  if (n === 2) return "Two";
  if (n === 3) return "Three";
  if (n === 4) return "Four";
  return String(n);
}
