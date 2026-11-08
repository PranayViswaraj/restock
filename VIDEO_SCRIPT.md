# Restock: demo video script (2:45)

**Target length:** 2:45, under 3:00 with margin. **Record at** 1920×1080 with browser zoom at 110%, light theme, and Settings → UI sounds off (the narration carries it).

**Before recording:**
1. Real keys in `.env` (or on Render): the Gemini key, PayPal sandbox client ID and secret, and the three `SUPPLIER_EMAIL_*` accounts. All three pills in the header should read **Live / Sandbox**.
2. Ctrl+K → **Reset demo data**.
3. In a second tab, log into **sandbox.paypal.com** as the café's sandbox *business* account and open **Activity**.
4. Keep your phone ready, with the QR approval page open on the same network or on the Render URL.
5. Rehearse 3–4 times. If the live AI run picks a different order of items, that's fine: Guardian's verdicts depend only on the numbers.

**Two ways to drive the screen:**
- **A (recommended, real AI):** click **Run agent** and narrate over it.
- **B (backup, identical every time):** **Story Mode** ("Watch Restock work (60s)"). The Scout is *scripted* in Story Mode, so say "the agent", not "the AI decided", on that take. Guardian and PayPal are real in both.

---

| Time | Screen (what to click) | Narration (say exactly) |
|---|---|---|
| **0:00–0:15** · The trust gap | Landing page. Slowly scroll to the Scout → Guardian → Treasurer diagram. | "AI agents are about to spend money for businesses. But would you hand your PayPal account to an AI? No owner would. That trust gap is the real blocker for agentic commerce. Restock is the trust layer." |
| **0:15–0:30** · Sign the mandate | **Mandate** page. Click **Turn into rules**, then **Sign as Pranay**. Let the ribbon play. | "Pranay runs a café in Austin. He writes his money rules in plain English. Gemini turns them into rules, zod validates them, and he signs. It's versioned and hashed. Guardian enforces exactly this." |
| **0:30–1:10** · Run the agent: local and cross-border | **Dashboard** → **Run agent**. Point at the Agent brain lighting up, then the timeline. When cups are paid, scroll to **Payment routes** and let the coin fly to Chennai. | "A heat wave pushed cold coffee up forty percent. Scout, the AI, reads the sales, forecasts that milk and cups run out in two days, and compares suppliers. Milk from a local dairy: Guardian runs seven checks in code, all green, and Treasurer pays through PayPal Payouts. Cups: Chennai EcoPack in India is cheaper. Paid cross-border, saving ten dollars against the local supplier." |
| **1:10–1:20** · Proof in PayPal | Switch to the **sandbox.paypal.com** tab and refresh Activity. Show the payout. Then click the cups row in the grid to open the Decision Trace, showing the same payout batch ID. | "And here's the real payout in the PayPal sandbox. Same batch ID as in Restock's decision trace." |
| **1:20–1:30** · Cash guardian | Point at the beans row (Delayed) and the cash strip. | "Coffee beans from Coorg would drop the balance below Pranay's five-hundred-dollar buffer, so Treasurer delays them until Tuesday's card sales settle." |
| **1:30–1:50** · The 280% trap | The shield appears. Then open the blocked syrup row → **Technical view**. | "Caramel syrup. The usual supplier is out of stock. A brand-new supplier offers it at two hundred eighty percent of normal. The AI proposes it… and the code says no. Blocked by Guardian. No money moved. The AI cannot talk its way past this." |
| **1:50–2:20** · Approve from the phone | Lids card → scan the **QR** with your phone (screen-record or film the phone). Tap the PayPal button, log in with the sandbox buyer, approve. Cut back to the dashboard: confetti and "Approved & paid". | "Lids cost thirty-two dollars, over Pranay's thirty-dollar auto-approve limit, so they wait for him. He scans the code, approves in PayPal checkout on his phone, and the dashboard updates live with a hash-stamped receipt." |
| **2:20–2:35** · 30 days and KPIs | **Simulate** → **Skip to end**. Point at the KPI cards and the "simulated on seeded demo data" label. | "Over thirty simulated days on the same demand: stockouts prevented, money saved, traps blocked, and zero rule violations. Cash buffer kept every day." |
| **2:35–2:45** · Close | Back to the landing hero. | "Restock. The AI decides. The code guards the money. PayPal moves it." |

---

## YouTube

**Title:** Restock: the trust layer for agentic commerce (PayPal + AI hackathon demo)

**Description:**
> Restock is an AI purchasing agent for small businesses that owners can actually trust with money.
> Scout (AI, Gemini) decides what to buy; Guardian (deterministic code) enforces the owner's signed money mandate; Treasurer pays suppliers worldwide through PayPal (Payouts for agentic auto-pay, Orders v2 + Smart Buttons for owner approval).
> Demo: a café in Austin, Texas, with suppliers in Texas and India. All payments run in the PayPal sandbox; sales are seeded demo data, and simulated numbers are labeled.
>
> Code: <GitHub link> · Live demo: <Render link>
> Built for the PayPal AI Hackathon.

**Visibility:** Public. **Category:** Science & Technology.

## Rules for the video

- **Music:** none, or royalty-free only (for example the YouTube Audio Library). No copyrighted songs.
- **Logos:** no third-party logos or trademarks, apart from PayPal's own interface as it appears in the sandbox and checkout. Don't add brand logos in editing.
- Keep the Live/Mock pills visible at least once, so judges can see the services are live.
- Free tools: **OBS Studio** or Windows **Clipchamp** to record and edit, and **ScreenToGif** for the README GIF.
