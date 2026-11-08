# Restock: 3-minute demo script

**Before you start:**
- Open the deployed URL a minute early (Render free instances sleep).
- Click **Reset demo** (Ctrl+K → "Reset demo data").
- Keep a phone ready for the QR step.
- Use Demo mode for a guaranteed run. It works with zero keys.

---

### 0:00 · The problem: the trust gap (20s)
*Landing page.*
> "AI agents are about to spend money for businesses. But would you hand your PayPal to an AI? No owner would, and that trust gap is the real blocker for agentic commerce. Restock is the trust layer: **the AI decides, the code guards the money, PayPal moves it.**"

Point at the Scout → Guardian → Treasurer → PayPal diagram.

### 0:20 · Pranay signs his money mandate (20s)
*Mandate page.*
> "Pranay runs a café in Austin. He writes his rules in plain English. AI turns them into rules, and zod validates them."

Click **Turn into rules**, then **Sign as Pranay**. The signature draws itself and the card shows a SHA-256 hash.
> "Signed, versioned, hashed. Guardian enforces exactly this. Nothing more."

### 0:40 · Run the agent: local buy + cross-border buy (40s)
*Dashboard → **Demo mode**.*
> "A heat wave pushed cold coffee up 40%. Scout reads the sales and forecasts that milk and cups run out in two days."

- Milk from a **local** dairy: Guardian runs 7 checks, all green, and Treasurer pays $27 via **PayPal Payouts**.
- Cups: **Chennai EcoPack in India** is $0.02/cup cheaper. Point at the **payment arc** from Austin to Chennai: "$22 paid cross-border, **saved $10 vs local**."

### 1:20 · Treasurer protects the cash buffer (15s)
> "Coffee beans from Coorg, India, cost $84. All the rules pass except one: paying now would drop the balance below Pranay's $500 buffer. So the Treasurer **delays** the order until Tuesday's card settlement lands."

Optional: click **Land next (demo)** and the delayed order gets re-checked.

### 1:35 · Guardian blocks the trap (20s)
> "Caramel syrup. The usual supplier is out of stock. A brand-new supplier, QuickSupply Deals, offers it at 280% of the normal price. The AI proposes it…"

**Shield moment.**
> "…and the code says no. Blocked by Guardian. No money moved. The AI cannot talk its way past this."

Click the blocked row in the grid to open the **Decision Trace**. All 7 checks are listed, with the red cross on price.

### 1:55 · Approve from your phone (30s)
> "Lids cost $32, which is over Pranay's $30 auto-approve limit, so they wait for him."

Scan the **QR code** on the approval card with your phone. The mobile page shows the reason and Guardian's checks. Tap the **PayPal** button and approve in sandbox checkout. The dashboard updates live: the card turns into "Approved & paid", with confetti and the receipt hash.

### 2:25 · Simulate 30 days (25s)
*Simulate page.*
> "Same demand, two cafés. Without Restock: late reorders, stockouts, lost sales. With Restock: zero stockouts, $125 saved, $250 saved cross-border, 3 traps blocked, **0 rule violations**, cash buffer kept 30 of 30 days."

Click **Skip to end** if you're short on time. Point at the label: *simulated on seeded demo data*.

### 2:50 · Close (10s)
> "Restock. **The AI decides. The code guards the money. PayPal moves it.**"

Optional finisher: flip the **kill switch**, then show **Ledger → Verify integrity → Chain intact**.

---
**Backup plan:** if the network or PayPal fails, the app keeps working on mocks (the Live/Mock pills say so honestly). Demo mode needs no keys at all.
