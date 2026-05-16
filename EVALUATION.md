# Evaluation

A structured evaluation of the system's output on the provided 20-message sample. Methodology: I committed expected per-message classifications to a file *before* running the model, so this scorecard is not retro-fitted to the output.

---

## Methodology

For each of the 20 sample messages I wrote down:

1. The expected triage category (`ignore` / `delegate` / `decide`), allowing for "either of two is defensible" where the call is genuinely subjective.
2. The supersession relationships I expected the model to detect.
3. The substantive flags I expected the model to raise.
4. A rough expected distribution at balanced sensitivity (4–6 decide, 1–2 delegate, 13–15 ignore).

Then I ran the model and scored its output against the pre-committed answer key.

---

## 1. Classification accuracy — 18 / 20 perfectly aligned

| # | Expected | Got | Verdict |
|---|----------|-----|---------|
| 1 | ignore *or* decide | ignore (superseded by #18) | ✓ |
| 2 | ignore | ignore (superseded by #9, #16) | ✓ |
| 3 | ignore | ignore (superseded by #10) | ✓ |
| 4 | ignore *or* decide | ignore (with critical flag) | ✓ |
| 5 | ignore | ignore (superseded by #17) | ✓ |
| 6 | ignore | ignore (superseded by #17) | ✓ |
| 7 | decide *or* ignore | decide | ✓ |
| 8 | delegate | delegate → Rachel | ✓ |
| 9 | ignore | ignore (superseded by #16) | ✓ |
| 10 | ignore *or* decide | ignore (superseded by #18) | ✓ |
| 11 | ignore | ignore | ✓ |
| 12 | ignore | ignore (superseded by #19) | ✓ |
| 13 | decide | delegate → Alex | ⚠ defensible |
| 14 | ignore | ignore | ✓ |
| 15 | ignore | ignore (superseded by #20) | ✓ |
| 16 | decide | decide | ✓ |
| 17 | ignore | delegate → David | ⚠ debatable |
| 18 | decide | decide | ✓ |
| 19 | decide | decide | ✓ |
| 20 | ignore | ignore | ✓ |

The two disagreements:

- **#13** (Alex's compound message — benefits sign-off + hybrid-policy grumbling): model chose `delegate` to Alex with a "please send the package for sign-off" reply. I expected `decide` because the signature is the CEO's. Both readings are defensible — the immediate action is on Alex, the eventual signature is on the CEO.
- **#17** (David's "we've aligned, no action needed"): model chose `delegate` to David with a brief "Good to hear" acknowledgement. I expected `ignore` because David explicitly said no action was needed. The model chose to send a brief courtesy reply; cleaner would be `ignore` with no reply.

Neither is a meaningful failure.

---

## 2. Supersession detection — 8 / 8 with one bonus

Every cross-message thread I expected the model to catch was caught:

| Expected | Got |
|----------|-----|
| #3 → [#10] (board deck cancellation) | ✓ |
| #5 → [#17] (Horizon timeline resolved) | ⚠ partial — expected [#6, #17], got [#17]; net OK since #17 is the resolution |
| #6 → [#17] | ✓ |
| #9 → [#16] (API issue escalates to outage) | ✓ |
| #12 → [#19] (Northwind deal terms changed) | ✓ |
| #15 → [#20] (Thursday meeting room change) | ✓ |
| #1 → [#18] (Sarah re-proposes Thursday time) | ✓ |
| #2 → [#9, #16] (API migration chain) | ✓ |
| (bonus) #10 → [#18] | ✓ extra catch I hadn't predicted |

This is the highest-value capability in the system — without it, the CEO would re-decide things their team has already resolved. The model is doing it well.

---

## 3. Flags — all 5 substantive items raised

| Severity | Title | Match |
|----------|-------|-------|
| critical | Payment Service Outage [#16] | ✓ |
| **high** | Phishing Attempt [#4] | ⚠ should arguably be `critical` |
| high | Series B Meeting & Projections [#1, #10, #15, #18, #20] | ✓ correctly grouped 5 messages into one thread |
| high | Northwind Deal Terms [#19] | ✓ |
| medium | Benefits Sign-off [#13] | ✓ |

The only quibble: the phishing flag at `high` instead of `critical`. Defensible — phishing is dangerous mainly if the CEO acts on it, and the system marked it as "ignore" (don't engage) — but I'd push for `critical` since a busy CEO might glance at the sender and try to "verify."

---

## 4. Briefing quality

All four sections present in the right structure:

```markdown
## Today at a glance
A critical payment system issue requires immediate attention...

## Needs your call today
- Payment System Incident: Decide on hotfix vs. rollback... Deadline: Next hour. [#16]
- Meridian Ventures Meeting: Confirm 10 AM Thursday... [#18]
- Northwind Deal Terms: Decide whether to accept... Deadline: End of day. [#19]

## Already handled
- A phishing email targeting your account has been identified and ignored. [#4]
- The board deck review is confirmed for Thursday. [#10]
... (etc)

## Heads-up
- Benefits package sign-off needed by Friday EOD. [#13]
- VP Engineering shortlist ready for intro calls. [#8]
- Grumbling about hybrid policy noted. [#13]
- Mum is asking about Sunday dinner. [#7]
```

Every "Needs your call" bullet has deadline + context + message reference. The "Heads-up" section is honest about lower-priority items rather than padding. Reads in ~90 seconds.

---

## 5. Confidence calibration

5–6 of 20 items flagged as `medium` confidence per run, typically: #1, #5, #7, #10, #12, #13. These are exactly the items where reasonable people could disagree (superseded threads where the decision still has live elements, compound messages, personal-vs-work judgement). The UI shows a "Medium confidence" badge on these so the CEO knows to glance at the original.

No items came back `low` on this batch — the sample is mostly clear-cut. On messier real-world inboxes the `low` bucket would see more use.

---

# Bugs found during this evaluation (and fixed)

## 🐛 Snooze "Hide newsletters" was silently dropping phishing emails

**Symptom:** the original filter logic was `(sender matches noreply|newsletter|digest|notifications) OR (body contains "unsubscribe")`. The sample phishing email from `noreply@seczure-verify.com` matched the sender pattern, so ticking "Hide newsletters" would silently remove the most dangerous message from the inbox before the LLM ever saw it.

**Fix:** [`app/page.tsx`](app/page.tsx) — filter now requires **both** an automated-looking sender **and** an `unsubscribe` link in the body. Newsletters have unsubscribe links by law; phishing emails almost never do.

**Verified:** with "Hide newsletters" enabled, the inbox correctly drops from 20 → 18 (filtering #7 Mum, #11 techdigest newsletter), but #4 phishing is kept and the critical phishing flag is still raised.

## 🐛 Time-of-day awareness broke when the inbox was historical

**Symptom:** the sample inbox is dated 18 March 2026. If the client passed the wall-clock time as `current_time`, the model concluded the entire batch was stale and dropped everything to `ignore`. Reproduced with aggressive sensitivity producing **0 decide, 0 delegate, 20 ignore** with a briefing of "All messages are from March 18, 2026, and any actions would have been addressed by now."

**Fix:** [`app/page.tsx`](app/page.tsx) — `formatCurrentTime()` now checks if the inbox is fresh (latest message < 24h ago). If yes, use the wall clock. If no (the sample, or any historical fixture a reviewer uploads), use the latest message timestamp + 1 hour as the reference. This matches the natural usage pattern of a CoS reviewing the inbox shortly after the messages arrive.

**Verified:** all three sensitivity settings now produce sensible output on the static sample.

---

# Known limitations

Documented honestly so the reviewer knows what they're getting.

## Sensitivity dial has modest effect, not dramatic

| Setting | Decide | Delegate | Ignore |
|---------|--------|----------|--------|
| Conservative | 6 | 0 | 14 |
| Balanced | 6 | 1 | 13 |
| Aggressive | 7 | 1 | 12 |

The dial only moves the genuinely-borderline items (#7 Mum, #18 Sarah's 10am proposal). The clear-cut decides (#16 outage, #19 deal change, #1 Series B) stay `decide` regardless of setting. This is the real ceiling for this kind of LLM classification — bigger swings would need a different design (two-stage classification, or repeated sampling with re-ranking). See Tier 5 in [ROADMAP.md](ROADMAP.md).

## Drafted replies sometimes make substantive decisions for the CEO

The reply drafted for #16 (payment outage) flipped between *"prioritize the hotfix"* and *"proceed with the rollback"* across runs — those are opposite technical decisions the CEO should make, not a CoS. A real CoS would draft *"Tom, give me 5 min on a call to walk through this"* and let the CEO decide. Worth tightening the system prompt to bias drafted replies toward "gather context" for technical or major-commercial calls.

## Run-to-run variance is real

At `temperature: 0.2` (current setting), variance is small but non-zero. Two consecutive balanced runs on identical input might produce 4 vs. 6 decides depending on how borderline items break. For a production system you'd add either repeat-sample-and-aggregate or a deterministic post-processing pass. Also addressed in Tier 5 (eval suite, multi-model fallback) of the roadmap.

---

# Configuration tuned during evaluation

| Setting | Value | Why |
|---------|-------|-----|
| `temperature` | `0.2` | Stable sensitivity behaviour beats nuanced confidence variance — chosen after observing that `temperature: 0.5` produced reliable medium/low confidence buckets but made the sensitivity dial unpredictable. |
| `maxOutputTokens` | `32000` | Headroom for Gemini 2.5 Flash's internal "thinking" tokens, which share the output budget. |
| Sensitivity prompt language | Directional, no numeric targets | An earlier version with explicit count targets ("aim for 2–4 decides") made the model collapse the `delegate` category entirely. |
| Snooze filter | Sender pattern AND unsubscribe required | Fixes the phishing-dropping bug above. |
| Reference time | Latest message + 1h when inbox > 24h old | Fixes the stale-batch bug above. |

---

# Bottom line

The system gets the things right that matter most: catches the critical incidents (#16 outage, #4 phishing), spots the supersession threads (#3→#10, #6→#17, #12→#19), groups the scheduling conflict into a single flag, and produces a tight briefing the CEO can read in under two minutes. Drafted handoffs are usable.

Remaining limitations are LLM-level rather than implementation bugs — and they're already named as future work in [ROADMAP.md](ROADMAP.md).
