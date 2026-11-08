# Submission checklist

Tick these off in order. ☐ = to do. Items marked **(you)** need your accounts or hands; the rest are already done in the repo.

## 1. Rules (you)
- [ ] Read the Official Rules on Devpost: eligibility from India, team rules, required fields.
- [ ] Write down the **exact deadline time and time zone**: ____________
- [ ] Check the video length limit (we target 2:45) and whether the repo must be public (we assume yes).

## 2. Keys and sandbox accounts (you, all free)
- [ ] developer.paypal.com → Apps & Credentials (**Sandbox**) → copy the **Client ID** and **Secret** into `.env`.
- [ ] Same app → Features → tick **Payouts** (and **Transaction search** if you'll use PayPal sales input).
- [ ] Sandbox accounts → create 3 **Personal** accounts: one in the United States, two with **India** as the country.
- [ ] Put their emails in `SUPPLIER_EMAIL_LOCAL`, `SUPPLIER_EMAIL_COORG` and `SUPPLIER_EMAIL_CHENNAI`.
- [ ] Gemini key from aistudio.google.com/apikey → `GEMINI_API_KEY` (or a Groq key with `LLM_PROVIDER=groq`).
- [ ] `npm run dev`. All three header pills should say **Live / Sandbox** (Channel3 stays Mock).
- [ ] Click **Run agent**. Check that payouts appear in sandbox.paypal.com → Activity, and that the India payouts don't come back BLOCKED or UNCLAIMED.
- [ ] Approve the lids order with a sandbox buyer through the PayPal button and through the QR code on your phone.
- [ ] Optional: `npm run sandbox-sales`, approve the links, `npm run sandbox-sales -- capture`, then set `USE_PAYPAL_SALES=true` (allow about 3 hours).
- [ ] Channel3: claim the credits only if free, and paste their docs into the agent. Otherwise leave the mock and **don't claim the Channel3 prize**.
- [ ] APIMatic: try the Context Plugin only if free. Fill in the README and TOOLS.md sections, or delete them.

## 3. Repository
- [x] MIT `LICENSE` at the repo root.
- [x] `THIRD_PARTY_NOTICES.md` listing every font, icon set and library with its license.
- [x] `.env` is git-ignored, no secrets are in any commit, and `.env.example` documents every key.
- [x] README covers setup (Windows + macOS/Linux), the no-keys demo mode, troubleshooting and honest limitations.
- [x] `TOOLS.md`, `SUBMISSION.md` and `VIDEO_SCRIPT.md` are written.
- [ ] **(you)** Create an empty **public** GitHub repo, then push (commands are in the README, "Push to GitHub").
- [ ] **(you)** Open the repo while logged out: the README renders, and no `.env` file is listed.

## 4. Deploy (you)
- [ ] Render → New → **Blueprint** → pick the repo. Fill in the secrets it asks for.
- [ ] Set `PUBLIC_URL` to the Render URL, then redeploy.
- [ ] GitHub → Settings → Secrets → Actions: add `RESTOCK_URL` and `CRON_SECRET` (copy the value Render generated). Run *Daily agent check* once by hand.
- [ ] Test the live link on your phone, in an incognito window, and on mobile data (a different network).
- [ ] Optional: keep `keep-warm.yml` for 1–15 December. Read its 750-hour note first.

## 5. Video and media (you)
- [ ] Rehearse `VIDEO_SCRIPT.md` 3–4 times; record with OBS or Clipchamp. Keep it **under 2:50**.
- [ ] No music, or royalty-free only. No third-party logos.
- [ ] Upload to YouTube as **Public**. Check that it plays while logged out.
- [ ] Record a short shield-moment GIF with ScreenToGif → save it as `docs/demo.gif`.
- [ ] Replace the screenshots in `docs/screenshots/` with live-key versions, if you want the pills to read "Live".
- [ ] Fill in the README placeholders: live demo link, YouTube link, GIF.

## 6. Devpost (you)
- [ ] Paste `SUBMISSION.md` into the matching fields. Add the repo link, live link and video link.
- [ ] Select the prize categories you qualify for:
  - Best Overall, Agentic Commerce, PayPal + AI, Most Impactful, Most Creative, Best Demo, AG Grid, Render.
  - Channel3 and APIMatic **only if they're really used**.
- [ ] **Submit several hours before the deadline.** Re-open the submission page while logged out and check every link.

## 7. During judging (1–15 December)
- [ ] Keep the sandbox keys and the AI key valid. Don't rotate or delete them.
- [ ] Don't push breaking changes. If you must change something, test locally first.
- [ ] Check the live link every few days.
