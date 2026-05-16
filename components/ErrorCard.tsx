"use client";

import { useEffect, useState } from "react";
import type { ClassifiedError } from "@/lib/error-classify";
import { Icon } from "./Icon";

const ICON_FOR_KIND: Record<ClassifiedError["kind"], () => JSX.Element> = {
  quota_daily: Icon.clock,
  quota_minute: Icon.clock,
  network: Icon.alert,
  server: Icon.alert,
  auth: Icon.shield,
  generic: Icon.alert,
};

export function ErrorCard({
  error,
  onRetry,
  onDismiss,
}: {
  error: ClassifiedError;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  const [remaining, setRemaining] = useState<number | undefined>(
    error.retryAfter
  );

  // Tick down a retry countdown when the server told us how long to wait.
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

  const Ico = ICON_FOR_KIND[error.kind] ?? Icon.alert;
  const canRetryNow =
    error.retryable && (remaining == null || remaining === 0);

  return (
    <section className="error-card" data-kind={error.kind}>
      <div className="error-card-head">
        <div className="error-icon">
          <Ico />
        </div>
        <div className="error-meta">
          <div className="error-kind">
            {labelForKind(error.kind)}
            {remaining != null && remaining > 0
              ? ` · retry in ${remaining}s`
              : null}
          </div>
          <h2 className="error-title">{error.title}</h2>
        </div>
        {onDismiss ? (
          <button
            type="button"
            className="error-dismiss"
            onClick={onDismiss}
            aria-label="Dismiss error"
          >
            ×
          </button>
        ) : null}
      </div>
      <p className="error-body">{error.body}</p>
      <div className="error-actions">
        {error.retryable && onRetry ? (
          <button
            type="button"
            className="btn-primary"
            onClick={onRetry}
            disabled={!canRetryNow}
          >
            {canRetryNow
              ? "Try again"
              : `Try again in ${remaining}s`}
          </button>
        ) : null}
        <details className="error-details">
          <summary>Show technical details</summary>
          <pre>{error.raw}</pre>
        </details>
      </div>
    </section>
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
