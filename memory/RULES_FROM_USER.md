# User Rules — MUST FOLLOW

## Rule 1 — Never claim a fix is done until 150% verified
- User explicitly said: "never tell me anything is fixed until you know 150% that it is fixed"
- Before saying "fixed" or "working":
  1. Reproduce the bug exactly as the user sees it (phone/client side, not just curl)
  2. Apply fix
  3. Reproduce the EXACT same flow end-to-end and confirm success
  4. If client-side involved, acknowledge that client bundle may be stale and explicitly surface that
- If I only verified server-side via curl, I must say so explicitly and NOT claim the phone will work

## Rule 2 — Luna Group VIP QR codes MUST work first try
- QR flows are revenue-critical — user loses trust if staff scanning fails in front of customers
- Every QR validation path must be bug-tested end-to-end:
  - Complimentary drink/cocktail redemptions
  - Milestone tickets (LUNA-TKT-)
  - Entry tickets (LUNA-ENT-)
  - Birthday rewards (LUNA-BDAY-)
  - Wallet passes
