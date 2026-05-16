# AI Chief of Staff

An assistant that reads a CEO's morning inbox across email, Slack, and WhatsApp and produces three things:

1. **Triage** — every message classified as **Ignore**, **Delegate**, or **Decide**, with a reason and a drafted reply.
2. **Flags** — the handful of things the CEO needs to know up-front, ranked by severity.
3. **Daily briefing** — a one-page Markdown brief readable in under two minutes.

Built for the Innate AI developer assessment.

## Features

- **Batch reasoning** — all 20 messages go to the LLM in one call so it can spot threads, supersession, conflicts, and time pressure across the inbox.
- **Streaming output** — the briefing appears as it's generated rather than after a 30s wait.
- **Editable drafted replies** — auto-sizing textarea per reply, with one-click copy and reset.
- **Confidence levels** — each triage call is tagged `high` / `medium` / `low`; low-confidence items show a badge so the CEO knows when to glance at the original.
- **Tunable sensitivity** — Conservative / Balanced / Aggressive toggle controls how aggressively the system surfaces things vs. delegates them.
- **Time-of-day awareness** — current local time is passed to the model; "by EOD" sent at 8am vs. 4pm is interpreted differently.
- **Snooze rules** — pre-filter newsletters/automated emails and personal WhatsApps before they hit the LLM (saves tokens, reduces clutter).
- **Upload JSON** — drop in a different inbox for live-demo testing.

See [EVALUATION.md](EVALUATION.md) for a structured evaluation of model output against pre-committed expected answers, and [ROADMAP.md](ROADMAP.md) for what's next.

---

## Stack

- **Next.js 14** (App Router) + **TypeScript** end-to-end
- **Tailwind CSS** for the UI
- **Google Gemini** (`gemini-2.5-flash`) called server-side via `@google/generative-ai`, with **`responseSchema`** to guarantee structured JSON output. Free-tier eligible — no payment method needed.
- No database — state is in memory, sample data lives in `public/messages.json`

---

## Setup

Requires Node.js 18.17+ (or 20+).

```bash
# 1. Install dependencies
npm install

# 2. Add your Google AI Studio key
cp .env.example .env.local
# then edit .env.local and paste your key

# 3. Run the dev server
npm run dev
```

Open <http://localhost:3000>. Click **Process inbox** to triage the sample of 20 messages. Takes ~5–15 seconds.

To test with new data (e.g. for the live interview), click **Upload JSON** and pick a file with the same shape as `public/messages.json` (an array of objects with `id`, `channel`, `from`, `timestamp`, `body`, plus optional `to`/`subject`/`channel_name`).

### Getting an API key (free)

Grab a Google AI Studio key in ~60 seconds at <https://aistudio.google.com/apikey>. Sign in with any Google account, click **Create API key**, paste it into `.env.local`. The free tier covers 15 requests/min and 1,500 requests/day on `gemini-2.5-flash` — far more than you'll need.

The default model is `gemini-2.5-flash`. Override via `GEMINI_MODEL` in `.env.local` if you want to try `gemini-2.5-pro` (also free-tier eligible, slower, marginally better) or `gemini-2.0-flash`.

---

## How I approached it

The temptation with a brief like this is to write a classifier: one message in, one label out. But the real intelligence in a CEO's inbox is *between* the messages. Examples from the sample data:

- Message 3 ("can we push the board deck?") is **cancelled by message 10** ("ignore my earlier message"). Classifying #3 in isolation produces a wrong, anxiety-inducing "Decide" — the CEO doesn't need to think about it at all.
- Message 6 ("Horizon timeline concerns") is **resolved by message 17** ("we've aligned, no action needed").
- Message 12 ("closed Northwind 120k ARR 2-year") is **materially changed by message 19** (legal pushed back, deal halved to 60k 1-year — that's the one the CEO actually decides on).
- Message 2 → 9 → 16 is a **single thread** that escalates from "API migration on track" to "we need a decision in the next hour because 3% of checkouts are failing in production". Treating these as three independent Slack updates buries the real signal.
- Message 4 looks urgent but is a **phishing attempt** (typo-squatted domain `seczure-verify.com`, urgency hook, suspicious link).
- Messages 1, 10, 15, 18, 20 collectively describe a **Thursday 2pm scheduling conflict** between an investor (Sarah at Meridian) and the internal leadership sync — that's a Decide item the CEO can resolve in 30 seconds if surfaced cleanly.

So the system is built around **batch reasoning**: the prompt instructs the model to read the full batch first, identify threads, supersessions, conflicts, time pressure, and risk signals, and only then classify. Each triage item can declare a `superseded_by` list, so the UI can dim resolved items rather than asking the CEO to re-decide.

The output schema is enforced via Gemini's `responseSchema` + `responseMimeType: "application/json"` mode, which constrains the model to return JSON matching exactly the shape defined in [`lib/prompt.ts`](lib/prompt.ts). More reliable than asking for JSON in prose. Swapping to Claude or GPT later is a small refactor in [`lib/gemini.ts`](lib/gemini.ts) — the prompt and schema are model-agnostic.

### What "Decide" should mean

I tuned the system prompt so **Decide** is reserved for things that (a) genuinely can't be delegated and (b) haven't been superseded. Everything that can credibly be handled by James (COO), Tom (Eng), Alex (People), Priya (Sales), Laura (EA), Mark (Marketing), or Rachel (recruiter) gets delegated with a drafted handoff in the CEO's voice. The bar for stealing the CEO's attention should be high — that's the whole point of a Chief of Staff.

### The briefing

The briefing follows a fixed structure: "Today at a glance" → "Needs your call today" → "Already handled" → "Heads-up". Every bullet in "Needs your call" includes the deadline and references the source message id (e.g. `[#16]`). The aim is for the CEO to scan it in 60–90 seconds and know exactly which three or four things they own this morning.

---

## Assumptions

- **Reviewer can plug in their own API key.** Nothing is hardcoded, no key is shipped.
- **Identifiable senders in the sample are real people.** The system uses the names visible in the messages (James/COO, Tom Bradley, Alex/People, Priya, Laura, etc.) when drafting delegations, rather than inventing assignees.
- **All messages in one batch are from the same morning.** The system uses timestamp order to detect supersession but doesn't try to handle multi-day inboxes.
- **No persistence is needed.** Each "Process inbox" run is a fresh call; the reviewer can re-upload new data via the UI.
- **Single user (the CEO).** No auth, no per-user state.
- **Trust the LLM's structured output but validate the request.** The API route validates that each message has the minimum required fields before forwarding to Claude.

---

## Project layout

```
app/
  api/process/route.ts   # POST endpoint → calls Gemini, returns structured output
  layout.tsx
  page.tsx               # Main UI (client component)
  globals.css
components/
  BriefingCard.tsx       # Markdown briefing
  FlagsList.tsx          # Severity-ranked flags
  TriageList.tsx         # Tabbed Decide / Delegate / Ignore view
  MessageCard.tsx        # Single message + classification + drafted reply
  ChannelBadge.tsx
lib/
  types.ts               # Shared TypeScript types
  prompt.ts              # System prompt + tool schema (the heart of the system)
  anthropic.ts           # SDK wrapper, parses the tool_use block
public/
  messages.json          # The 20-message sample inbox
```

The system prompt in `lib/prompt.ts` is the most important file — that's where most of the "quality of thinking" lives. Treat it as the spec.

---

## Trade-offs and what I'd do next

- **One LLM call per batch.** Simple and lets the model see everything at once. For a much larger inbox I'd add a clustering step first.
- **No real integrations yet.** Inputs come from `messages.json` or a user-uploaded file; drafted replies are copy-paste rather than one-click send. The whole point of Tier 2 in [ROADMAP.md](ROADMAP.md) is wiring Gmail / Slack / WhatsApp / Calendar to make this a real morning tool — out of scope for an evaluation build but the abstraction in [lib/types.ts](lib/types.ts) is shaped to make it a small refactor.
- **No memory across mornings.** A real Chief of Staff would learn that "James pushes meetings half the time and reinstates them" — that pattern lives across days. Trivial to add with a small store, but it needs accumulated data to be useful. See Tier 3 in the roadmap.
- **No eval suite.** Prompt changes are currently validated by eyeballing the output. Tier 5 in the roadmap covers the golden-set + regression-tracking pipeline you'd want before relying on this in production.
