# Tools used

## AI

| Provider | Model (from `.env`) | Where | What it does in Restock |
|---|---|---|---|
| **Google Gemini API** (free tier) via `@google/genai` | `LLM_MODEL`, default **`gemini-2.5-flash`** (with `LLM_PROVIDER=gemini`) | [server/services/llm.js](server/services/llm.js) | Default provider. |
| **Groq API** (free tier, OpenAI-compatible) | `LLM_MODEL`, default **`llama-3.3-70b-versatile`** (with `LLM_PROVIDER=groq`) | [server/services/llm.js](server/services/llm.js) | Drop-in alternative. |

The same model powers four jobs:

1. **Scout, the purchasing agent (tool calling).** It runs a loop of up to 12 tool calls ([server/agent/agent.js](server/agent/agent.js)). Tools: `get_sales_summary`, `get_inventory`, `forecast_stock`, `search_products`, `compare_suppliers`, `get_cash_position`, `propose_purchase`, `log_decision` ([server/agent/tools.js](server/agent/tools.js)). The AI picks what to buy and explains why. All arithmetic (forecasts, savings, limits) is done in code.
2. **Money mandate parsing.** The owner's plain-English rules become JSON, validated by **zod** ([server/services/mandate.js](server/services/mandate.js)).
3. **Weekly briefing.** A 3–4 sentence summary for the owner.
4. **Ask Restock.** Q&A over purchases, the audit ledger, the mandate and cash, with optional voice input via the browser's Web Speech API.

**What the AI is *not* allowed to do:** call PayPal, change rules, or approve anything. Every proposal goes through **Guardian**, which is deterministic code ([server/guardian/guardian.js](server/guardian/guardian.js)).

**Fallback:** if the AI is rate-limited or down, the timeline says *"AI busy, using backup logic"*. A rule-based Scout ([server/agent/planner.js](server/agent/planner.js)) finishes the run under the same Guardian. Demo mode and Story Mode always use this scripted Scout, so the story is identical every time; they say so in the timeline.

## PayPal (sandbox)

| API / SDK | Endpoint | Where | Used for |
|---|---|---|---|
| OAuth 2.0 | `POST /v1/oauth2/token` | [paypal.js](server/services/paypal.js) | Server-side login; token cached. The secret never leaves the server. |
| **Payouts** | `POST /v1/payments/payouts` | `createPayout()` | **Agentic auto-pay** to suppliers, cross-border to India. Idempotent via `PayPal-Request-Id`. One sandbox account per supplier group (`SUPPLIER_EMAIL_*`). |
| Payouts status | `GET /v1/payments/payouts/{batch_id}` | `getPayoutStatus()`, `GET /api/paypal/payouts/:batchId` | Batch and item status, payout item ID and transaction ID, written to the audit chain; "Refresh from PayPal" button. |
| **Orders v2** | `POST /v2/checkout/orders`, `POST /v2/checkout/orders/{id}/capture` | `createOrder()`, `captureOrder()` | Owner approval of over-limit purchases. |
| **JS SDK Smart Buttons** | `https://www.paypal.com/sdk/js` | [PayPalButton.jsx](client/src/components/PayPalButton.jsx) | The approval button on the dashboard and on the phone page (via QR). Only the client ID is sent to the browser. |
| Transaction Search *(optional)* | `GET /v1/reporting/transactions` | [salesSource.js](server/services/salesSource.js) | With `USE_PAYPAL_SALES=true`, Scout reads the café's real sandbox sales. |
| Webhooks *(optional)* | `POST /v1/notifications/verify-webhook-signature` | `verifyWebhookSignature()` | Verifies payout and capture events at `POST /api/paypal/webhook`. |
| Sandbox sales helper | Orders v2 | [scripts/create-sandbox-sales.js](scripts/create-sandbox-sales.js) | Creates café sales for a sandbox buyer to approve (run manually). |

## Sponsor and platform tools

| Tool | How Restock uses it |
|---|---|
| **AG Grid Community** | Purchases, inventory and supplier grids: custom renderers (status badges, flags, SVG sparklines, budget progress bars, trust-score bars), a pinned totals row that follows filters, quick filter, CSV export, column layout saved in `localStorage`, and a theme built from CSS variables. |
| **AG Charts Community** | Daily spend vs. the weekly limit: bars, a rolling line and a dashed limit line on one axis, with a table view. |
| **Render** (free web service) | Hosts the API, the live update stream (SSE) and the React app from one service ([render.yaml](render.yaml)). |
| **GitHub Actions** (free) | Scheduled daily agent check calling the protected `POST /api/cron/daily-run` ([.github/workflows/daily-agent.yml](.github/workflows/daily-agent.yml)). |
| Channel3 | **Not integrated yet.** Product search uses a realistic mock catalog behind the same interface ([channel3.js](server/services/channel3.js), `TODO(Channel3)`). Not claimed. |
| APIMatic | _TODO (Pranay): describe use of the PayPal Context Plugin, or delete this row._ |

## Main frameworks

Node.js 20+, Express 5, helmet, zod, Vitest · React 19, Vite, Tailwind CSS 4, framer-motion, lucide-react, canvas-confetti, qrcode. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for licenses.
