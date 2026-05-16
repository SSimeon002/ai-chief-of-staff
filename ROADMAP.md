# Product Roadmap

The current build is a working morning-inbox triage system. This document is the path from "demo that works" to "tool the CEO opens every morning." Ordered by cost-to-value, not by ambition.

---

## ✅ Shipped — v0.1 (the assessment build)

The starting point.

- **Triage** — every message classified as Ignore / Delegate / Decide with a reasoning line and a drafted reply.
- **Flags** — severity-ranked alerts (critical / high / medium) the CEO should see before reading anything else.
- **Daily briefing** — markdown one-pager with `Today at a glance` / `Needs your call today` / `Already handled` / `Heads-up` sections.
- **Batch reasoning** — single LLM call over all messages so the model can spot threads, supersession, conflicts, and time pressure across the inbox (not classify each message in isolation).
- **Structured output** — Gemini `responseSchema` guarantees the JSON contract; no prompt-engineering fragility.
- **Upload JSON** — drop in a different inbox for live-demo testing.

## ✅ Shipped — v0.2 (Tier 1 quick wins)

Implemented in [app/page.tsx](app/page.tsx), [components/MessageCard.tsx](components/MessageCard.tsx), [lib/prompt.ts](lib/prompt.ts), [lib/gemini.ts](lib/gemini.ts), [app/api/process/route.ts](app/api/process/route.ts).

- **Streaming briefing** — Gemini output streams via `generateContentStream`; the client uses [`partial-json`](https://www.npmjs.com/package/partial-json) to progressively parse and render. The briefing appears as it's generated rather than after a 30s wait.
- **Editable drafted replies** — each drafted reply is now an auto-sizing textarea with a Reset button. Edit before copying. No more "the AI got the tone slightly wrong" friction.
- **Confidence + uncertainty** — every triage item carries `confidence: "high" | "medium" | "low"`. Medium and low items show a badge so the CEO knows which calls to actually read the source for. Calibrated honestly: a 20-message inbox typically produces 2–3 medium items.
- **Time-of-day awareness** — the client passes the current local time to the model; "respond by EOD" sent at 8am vs. 4pm are interpreted differently.
- **Tunable sensitivity** — three-position toggle (Conservative / Balanced / Aggressive) controls how aggressively the system marks things as Decide vs. delegates them. On the sample inbox this swings the Decide count from 0 (conservative) to 8 (aggressive).
- **Snooze rules** — client-side pre-filter removes noise before the LLM sees it. Toggles for "newsletters & automated" and "personal WhatsApps". Saves API tokens and reduces clutter.

---

## 📋 Tier 2 — Real integrations (1–2 weeks)

The jump from "demo with a JSON file" to "production tool the CEO actually uses."

### Live inbound
- **Gmail API** — OAuth + Gmail watch, pull new emails into the same `IncomingMessage` shape.
- **Slack** — Events API for DMs + watched channels.
- **WhatsApp Business Cloud API** — webhook for inbound messages.

Each adapter normalises into the existing `IncomingMessage` type. The LLM layer doesn't change at all — that's the payoff of the abstraction in [lib/types.ts](lib/types.ts).

### Outbound (close the loop)
- Each "Send" button hits the right channel's API (Gmail send / `chat.postMessage` / WhatsApp send).
- Every sent reply gets logged for the personalisation loop (Tier 4).

### Calendar
- Google Calendar / Outlook OAuth.
- Conflicts like the Thursday 2pm sample wouldn't be inferred from text — the system would *know*.
- Drastically reduces false negatives on scheduling.

### Push delivery
The web UI is the wrong primary surface. Better:
1. **Slack DM** of the briefing at 8am every weekday (most likely default).
2. **Email digest** for those who prefer email.
3. **iOS/Android push** if you want to go further.

The web app becomes the drill-in view.

---

## 📋 Tier 3 — Memory (the thing that makes it feel like a real CoS)

A human Chief of Staff is mostly valuable because they *remember*. They know "James pushes meetings half the time and reinstates them" and "Tom's eng estimates run 40% optimistic." None of this is in the current system.

Add a persistent store (Postgres or SQLite to start) with three tables:

1. **Decisions log** — every Decide and how the CEO actually resolved it. Lets us answer "what did we do last time?"
2. **Sender profiles** — running stats per person. "James cancels/reinstates 6 out of 10 times — wait 90 minutes before treating his cancellation as final."
3. **Pattern log** — recurring issues. "This is the 3rd payment-service outage in 6 weeks — flag as structural, not one-off."

Feed a compact relevant-memory summary into the prompt at runtime — don't bloat context, pull only what relates to today's senders and topics.

This is where the system shifts from "smart classifier" to "actual chief of staff."

---

## 📋 Tier 4 — Personalisation

The drafted replies are currently in a generic "decisive CEO" voice. They should be in *this* CEO's voice.

- **Style learning** — log every reply the CEO has actually sent, distil periodically into a voice profile (warmth, signature phrases, sign-offs, first-name vs. full-name).
- **Approval-loop fine-tuning** — when the CEO edits a draft before sending, log the diff. After a few weeks, the model has a personalised behaviour model — *for free*.
- **Per-relationship register** — formal with the board, terse with eng leads, warm with family.

---

## 📋 Tier 5 — Eval suite + safety

For a system the CEO relies on, you can't ship prompt changes blind.

- **Golden set** — 10–20 hand-labelled inboxes with the "right" triage / flags / briefing. Run on every prompt change, track regression on key metrics: *did it catch the phishing email, did it spot the supersession, did it surface the time-critical decision*.
- **Hallucination guardrails** — model invents an assignee → validate against a known org chart. Model fabricates a deadline → cross-check against the source text.
- **Cost + latency dashboards** — Langfuse or Helicone. Catches a prompt change that makes the system 3× more expensive without making it better.
- **Multi-model fallback** — Gemini primary, Claude or GPT backup if primary fails. Same prompt, same schema (the swap is already a small refactor).

---

## 📋 Tier 6 — UX upgrades the CEO would actually notice

- **Voice briefing** — TTS the daily brief to a 90-second audio file the CEO listens to during their commute. Transformative for executives who don't sit at a desk in the morning.
- **"Why isn't this a Decide?"** — click any Ignore item, get a deeper explanation. Builds trust faster than any other feature.
- **Auto-calendar-block decisions** — "Decide on Northwind deal" gets a 5-min slot blocked at 11am. CEO opens calendar and the day is already scheduled.
- **End-of-day reconciliation** — at 5pm, "Here's what you decided today, here's what's still open." Closes the loop.
- **Mobile-first layout** — the current UI is desktop-centric; CEOs read this on phones.

---

## 📋 Tier 7 — Production architecture

What changes when this isn't just a demo:

| Layer | Now | Production |
|---|---|---|
| Storage | In-memory | Postgres (messages, briefings, decisions, sender profiles) |
| Processing | Sync request/response | Background worker (Inngest / Trigger.dev) — briefing pre-generates before CEO wakes up |
| Auth | None | Clerk / NextAuth, multi-tenant |
| Secrets | `.env.local` | Vault / Doppler |
| Observability | `console.log` | Langfuse for prompts, Sentry for errors |
| Deployment | `npm run dev` | Vercel / Fly, cron at 7am |
| Tests | None | Vitest unit + Playwright E2E against the golden set |

---

## 📋 Tier 8 — The 6-month vision

Where this product genuinely changes the CEO's day:

- **Pre-emptive drafting** — system has already drafted *and queued* delegate replies by 8am; CEO reviews one "approve all" screen and they fire off.
- **Cross-exec coordination** — same system runs for CFO, COO. When the CEO delegates *to* the COO, it lands in their CoS too. The system understands priorities across the leadership team.
- **Weekly patterns** — Monday brief includes "shape of your week" from inbox + calendar. Friday brief includes "what's open going into the weekend."
- **Slack/email participation** — for delegate items, the system can post the handoff in the relevant Slack channel directly, tagging the assignee, on the CEO's behalf. The CEO never copy-pastes again.
- **Memory becomes the moat** — six months of decision history, sender profiles, and CEO-edited replies turns this into something a new entrant can't easily replicate.

---

## Where I'd start, given one week post-this-assessment

1. **Day 1** — Gmail + Slack integrations (move off `messages.json`). Biggest credibility unlock.
2. **Day 2** — Persist decisions + send-log to Postgres. Foundation for memory.
3. **Day 3** — Slack DM delivery at 8am via cron. Kill the web app as the primary surface.
4. **Day 4–5** — Eval suite + golden set. Makes every future change safe.
5. **Day 6–7** — First pass at memory: sender profiles + decision history fed into the prompt.

Memory and personalisation come in week 2–4, once there's enough logged data to feed them.

**Key insight:** what makes this product valuable in month 6 is not better prompts — it's accumulated context the AI gets to use. Every architectural decision should optimise for capturing that context cheaply from day one.
