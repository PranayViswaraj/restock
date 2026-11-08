# Restock: Devpost submission text

_Ready to paste. Replace the two links at the bottom._

## Inspiration

AI agents are about to buy things for businesses, but every small-business owner we imagined asked the same question: *"Would I hand my PayPal account to an AI?"* The answer is no. Agents are capable enough already. What's missing is the **trust layer** between an AI's decision and real money moving. We wanted to build that layer, for the kind of business PayPal serves every day: a small café with thin margins, suppliers at home and abroad, and no time to reorder cups by hand.

## What it does

Restock is an AI purchasing agent for **Pranay's Café in Austin, Texas**, split into three roles:

- **Scout (AI).** Reads 30 days of sales, notices that a heat wave pushed cold coffee up 40%, forecasts days of stock left, and compares local Texas suppliers with suppliers in India. Then it *proposes* purchases with a plain-English reason.
- **Guardian (code, never AI).** Checks every proposal against the owner's **signed money mandate**: approved categories, per-order and weekly limits, price vs. the 30-day average, new suppliers, and the cash buffer. Its verdict is final: auto-pay, ask the owner, delay, or block.
- **Treasurer (code + PayPal).** Pays through **PayPal Payouts** (agentic auto-pay, including cross-border to India), sends bigger orders to **PayPal checkout** for one-tap owner approval (also from a phone via QR code), delays payments that would break the cash buffer, and writes hash-stamped receipts.

Everything is visible and reversible:
- a live timeline and agent "brain" graph;
- a Decision Trace for every purchase, in an owner view and a technical view;
- a kill switch;
- a tamper-evident, hash-chained audit ledger;
- a **Scenario Lab** where you can try to trick the Guardian.

## How we built it

- **Server:** Node.js + Express, one free Render web service. **Guardian** is a set of pure, unit-tested functions. **Scout** uses Gemini 2.5 Flash tool calling (Groq Llama 3.3 also supported), with a hard cap of 12 tool calls and a rule-based fallback.
- **PayPal:** OAuth, Payouts (create + status), Orders v2 (create + capture), JS SDK Smart Buttons, optional Transaction Search to read the café's own sandbox sales, and optional verified webhooks. All in the sandbox.
- **Dashboard:** React + Vite + Tailwind + framer-motion. **AG Grid** for purchases, inventory and suppliers (custom renderers, pinned totals, saved layouts, CSV). **AG Charts** for spend vs. the weekly limit.
- **Trust primitives:**
  - a mandate signed with a SHA-256 hash, versioned and revocable;
  - an audit chain where each entry hashes the previous one;
  - receipts with their own hash;
  - helmet + Content-Security-Policy, zod validation everywhere, and rate limits to protect the free quotas.
- **Tests:** 51 Vitest tests, covering every Guardian rule and verdict, the 30-day simulation, ledger tamper detection, the Scenario Lab and the PayPal mappings.

## Challenges we ran into

- **Keeping the AI away from money without making it useless.** Our answer: the AI can only call `propose_purchase`, and offers must come from the real catalog, so the AI can't invent a price.
- **Cash-flow logic.** A purchase can be fine on every rule except that it would drain the balance. We added a **DELAY** verdict that computes the earliest date an incoming settlement covers it.
- **Free tiers.** Rate limits and sleeping servers led us to build retries, a calm fallback, a "waking up the server" screen, and per-IP limits.
- **Honesty.** The demo uses seeded data and a sandbox, so every simulated or seeded number is labeled as such in the UI.

## Accomplishments that we're proud of

- **0 rule violations** in every test and simulation. Guardian blocks the 280%-price trap every time.
- Real **cross-border** payouts to India-based sandbox accounts, with savings shown per order.
- A Decision Trace that explains any purchase end to end: the AI's reason, all 7 checks, the PayPal IDs and the audit hashes.
- **Story Mode:** a captioned 60-second walkthrough that runs on the real pipeline.

## What we learned

- Trust is a product feature, not a disclaimer. Owners need to *see* the rules being enforced.
- Splitting "decide" (AI) from "guard" (code) from "pay" (PayPal) made the system simpler to test and easier to explain.
- PayPal already has the primitives agentic commerce needs: Payouts for autonomy, and Orders + Smart Buttons for human-in-the-loop approval.

## What's next for Restock

- Real product search through Channel3, and real supplier onboarding.
- Reading the live PayPal balance with the right permissions, instead of a simulated one.
- Multi-store and multi-owner mandates, with spend policies per category.
- Push notifications for approvals, and a native mobile shell.

## Built with

`paypal` `paypal-payouts` `paypal-orders-v2` `paypal-js-sdk` `gemini` `groq` `node.js` `express` `react` `vite` `tailwindcss` `framer-motion` `ag-grid` `ag-charts` `zod` `vitest` `helmet` `render` `github-actions`

**Try it:** <Render link> · **Code:** <GitHub link> · **Video:** <YouTube link>

> Honest note: payments run in the PayPal **sandbox** (no real money). Sales and suppliers are **seeded demo data** unless PayPal sales input is enabled, and the cash balance is simulated. Story Mode and Demo mode use a scripted Scout, while **Run agent** uses the live AI.
