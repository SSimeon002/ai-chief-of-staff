// Turns raw error strings from Gemini / the network into something the UI
// can render as a friendly card. Detects the failure modes we actually see:
// 429 rate limits, daily quota exhaustion, network drops, 5xx outages.

export type ErrorKind =
  | "quota_daily"
  | "quota_minute"
  | "network"
  | "server"
  | "auth"
  | "generic";

export interface ClassifiedError {
  kind: ErrorKind;
  title: string;
  body: string;
  /** Seconds until the user should retry, when the server told us. */
  retryAfter?: number;
  /** Whether a "Try again" button makes sense for this kind. */
  retryable: boolean;
  /** The original message — useful for the collapsible details. */
  raw: string;
}

export function classifyError(rawMessage: string | null | undefined): ClassifiedError {
  const message = (rawMessage ?? "").trim() || "Unknown error";
  const lower = message.toLowerCase();

  // 429 / rate limit / quota — treated as a flat "service down" because on the
  // free tier the daily cap is the practical bound; the retry-in-N-seconds
  // value Google returns refers to the per-minute window, but the daily quota
  // won't actually let another request through until the daily reset. So we
  // never offer a retry that's likely to just fail again.
  if (
    lower.includes("429") ||
    lower.includes("too many requests") ||
    lower.includes("quota") ||
    /rate.?limit/.test(lower) ||
    lower.includes("exceeded your current quota")
  ) {
    const isPerDay = /per.?day|requests_per_day|rpd/i.test(message);

    if (isPerDay) {
      return {
        kind: "quota_daily",
        title: "Service is currently down",
        body:
          "We've hit the free-tier daily limit on the Gemini API. " +
          "Service will resume once the daily quota resets " +
          "(midnight Pacific Time).",
        retryable: false,
        raw: message,
      };
    }

    return {
      kind: "quota_minute",
      title: "Service is currently down",
      body:
        "The Gemini API is rate-limited or over quota. Please try again later.",
      retryable: false,
      raw: message,
    };
  }

  // Auth — bad key, missing key, permission denied
  if (
    lower.includes("api key") ||
    lower.includes("api_key") ||
    lower.includes("permission denied") ||
    lower.includes("unauthenticated") ||
    lower.includes("401") ||
    lower.includes("403")
  ) {
    return {
      kind: "auth",
      title: "API key problem",
      body:
        "The Gemini API key wasn't accepted. Make sure GOOGLE_API_KEY is set in .env.local and the key is valid (https://aistudio.google.com/apikey).",
      retryable: false,
      raw: message,
    };
  }

  // Network
  if (
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("econnreset") ||
    lower.includes("enotfound") ||
    lower.includes("connect timeout") ||
    lower.includes("getaddrinfo")
  ) {
    return {
      kind: "network",
      title: "Couldn't reach the model",
      body: "We couldn't reach Gemini. Check your internet connection and try again.",
      retryable: true,
      raw: message,
    };
  }

  // 5xx — model unavailable
  if (
    /5\d\d/.test(lower) ||
    lower.includes("service unavailable") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("internal error")
  ) {
    return {
      kind: "server",
      title: "Gemini is unavailable",
      body: "The model is having a moment. Try again in a few seconds.",
      retryable: true,
      raw: message,
    };
  }

  return {
    kind: "generic",
    title: "Something went wrong",
    body:
      message.length > 220
        ? "An unexpected error happened. Open the details below for the full message."
        : message,
    retryable: true,
    raw: message,
  };
}
