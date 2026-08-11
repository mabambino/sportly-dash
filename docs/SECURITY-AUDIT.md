# sportly-dash — security & data-integrity audit

**Repo:** `mabambino/sportly-dash` (Syncletics) · **Reviewed:** 11 Aug 2026
**Scope:** auth, RLS, secrets handling, race conditions, money-handling correctness
**Status:** applied to `main` in commits `5137822`, `5ca141b`, `a5634b1`, `0083088`, `055f628`
(13 files, +368/−51)

All line references are to the code **as it was before** those commits.

---

## Critical

### 1. The "Pay now" fallback re-opens the hole the migration closed
`src/routes/app.billing.tsx:47–61`

`payNow()` calls the `pay_invoice()` RPC, and **on any error falls back to updating the
`payments` row directly from the browser**. Migration `20260703120000` exists specifically
to stop members writing that table. Two consequences:

- On a database where the migration hasn't been applied, the fallback is the old
  vulnerability, verbatim — a member can mark their own invoice paid.
- Even where it has been applied, a *legitimate* refusal (`Invoice already paid`) triggers
  the fallback, so a correct rejection becomes a second write attempt and the user sees a
  confusing RLS error rather than the real reason.

**Fixed:** fallback removed. A missing RPC is now reported as "migration not applied yet"
instead of being silently worked around.

### 2. Demo seeding creates real accounts with a hardcoded password
`src/lib/seed.functions.ts:26–27, 40–43`

`seedDemoData` calls `auth.admin.createUser` with `password: "demopass123"` and
`email_confirm: true`, twelve times. These are real, confirmed logins into a real club —
anyone who reads the public repo knows the password, and only needs a seeded address
(`trainer1.<timestamp>@demo.clubhaus.app`, where the timestamp is guessable). Any club
owner can trigger it in production.

**Fixed:** each account gets a CSPRNG password that is never returned, seeding is refused
in production unless `ALLOW_DEMO_SEED=true`, and addresses moved to `demo.syncletics.invalid`
(RFC 2606 reserved, so it can never receive mail or collide with a real address). The stale
`clubhaus` domain was a leftover from a previous product name.

### 3. Temporary passwords come from `Math.random()`
`src/lib/members.functions.ts:50–51`

`Math.random()` is a non-cryptographic PRNG. The generated string is also weak in shape:
~8 + ~4 base-36 characters, and V8's generator is well documented. This value is the new
member's actual credential.

**Fixed:** new `src/lib/random.ts` draws from `crypto.getRandomValues` over a 32-character
unambiguous alphabet (power of two, so no modulo bias) — 16 chars ≈ 80 bits.

---

## High

### 4. `.env` is committed and `.gitignore` doesn't exclude it
`.env`, `.gitignore`

Today the file holds only the Supabase URL and the publishable (anon) key, which the README
correctly calls safe to expose. The problem is structural: the file is **tracked**, so the
next person to add `SUPABASE_SERVICE_ROLE_KEY` — the key `client.server.ts` reads, which
bypasses RLS entirely — commits it without noticing.

**Attempted, then reverted — read this before trying again.** `.env` was untracked,
`.gitignore` updated and `.env.example` added. That took production down.

Vite inlines `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` **at build time**,
reading them from `.env` in the repo root. The Cloudflare Worker had no build variables
and no runtime variables configured, so the committed `.env` *was* the deployment's entire
configuration. Removing it shipped a bundle with no Supabase config: the client threw
`Missing Supabase environment variable(s)` on load and the whole app was down — not just
login. `.env` was restored in `16e27e9`.

`.gitignore` and `.env.example` were kept. Note the consequence: `.env` is now listed in
`.gitignore` *and* tracked, so git will not pick up local edits to it. That is deliberate,
but it is a sharp edge — if you change `.env` locally and the deploy does not reflect it,
this is why.

**To finish this properly:**

1. Six build variables are already set on the Worker (`SUPABASE_URL`, `SUPABASE_PROJECT_ID`,
   `SUPABASE_PUBLISHABLE_KEY` and the three `VITE_`-prefixed equivalents), under
   Settings → Build → Variables and secrets.
2. Add the three non-`VITE_` names as **runtime** variables too (Settings → Variables and
   secrets, the section at the top — still empty). `auth-middleware.ts` and
   `client.server.ts` read them from `process.env` at request time, and build variables are
   not available then.
3. Only once a deploy has succeeded and the app verified working should `.env` be deleted
   again. Delete it on its own, and check the app immediately afterwards.

The values in question are the project URL and the publishable anon key, both designed to be
public. The reason to move them is not that they are secret — it is that a tracked `.env` is
how a `SUPABASE_SERVICE_ROLE_KEY` eventually gets committed by accident.

### 5. Unauthenticated public write through the service-role client
`src/lib/embed.functions.ts:41–63`

`submitEmbedLead` has no auth middleware (correct — it backs the public embed widget) but
writes with `supabaseAdmin`, which bypasses RLS. There was no club-existence check, no
length limits on any field, and no rate limiting. Anyone with a club UUID could fill the
`leads` table with 2 GB strings.

**Fixed:** club is verified first, fields capped (name 120, email 254, phone 40, notes 2000),
and a 20-per-club-per-hour throttle added.

### 6. `pay_invoice()` has no row lock
`supabase/migrations/20260703120000_improvements.sql:28–44`

The function reads `status` without `FOR UPDATE`, so two concurrent calls — a double-clicked
button, a retry, two tabs — can both observe "not paid" and both run the UPDATE. Harmless
while checkout is simulated; a double charge the moment Stripe is wired into this function,
which is exactly what the code comment invites. `set_session_rsvp()` in the very next
migration already locks correctly, so the pattern was known.

**Fixed:** `SELECT ... FOR UPDATE` (new migration).

### 7. Team codes are guessable and joining is unthrottled
`20260618165604_….sql:77–82` (and the redefinition in `20260712175434_….sql:33`)

`generate_team_code()` uses `random()` (non-cryptographic) over 6 characters of a 31-symbol
alphabet — about 29.7 bits. `join_club_by_code()` accepts unlimited attempts from any signed-in
user, and a correct guess grants membership: the roster, schedule and chat of a club whose
members are frequently minors.

**Fixed:** `gen_random_bytes()` over 8 characters (≈39.6 bits) plus a 10-attempts-per-hour
throttle on `join_club_by_code` (new `join_attempts` table, RLS on, no policies — reachable
only from SECURITY DEFINER functions). Existing 6-character codes keep working; the join
input now accepts 6–8 (`src/routes/onboarding.tsx:158–159`).

**Also repaired in passing:** `set_team_code()` is not SECURITY DEFINER, so its collision
check `EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clubs …)` runs under the inserting user's
RLS. Since tenant isolation landed, that user sees only their own clubs — the check has been
looking at an effectively empty table and exiting on the first iteration ever since.
Collisions were falling through to the UNIQUE constraint as a raw error during club creation.
The new `generate_team_code()` does its own uniqueness loop with owner privileges.

---

## Medium — data integrity

### 8. Public embed enquiries always fail
`src/lib/embed.functions.ts:53–61`

The insert sets `status: "new"`, but the `leads` CHECK constraint allows only
`lead | trial | converted | lost`, and it sets a `source` column the schema never defined.
Every submission from the public widget is rejected by the database. The Leads board
(`app.leads.tsx:25–28`) confirms the intended starting status is `lead`.

**Fixed:** status corrected to `lead`; `leads.source` added by migration (provenance is
worth keeping) along with a `(club_id, created_at)` index for the throttle query.

### 9. Multi-club users land in an arbitrary club
`src/lib/auth-context.tsx:55`

`.select("*").eq("user_id", uid).limit(1)` with no `ORDER BY`. Postgres is free to return a
different row between page loads, so a user in two clubs can silently switch tenants.

**Fixed:** ordered by `joined_at`, then `id` as a tiebreak.

### 10. Tax rate stored per browser, not per club
`src/routes/app.revenue.tsx:38–63`

Settings were kept in `localStorage` under `syncletics-tax-${clubId}`, even though migration
`20260703120000` added `clubs.tax_country` and `clubs.tax_rate_bps` for exactly this. Each
staff member therefore saw a different tax figure for the same club, and clearing the cache
silently reset a number that feeds reported revenue.

**Fixed:** reads and writes the club row; the old localStorage value is still read once as a
fallback so nobody's setting vanishes before it's been written back.

### 11. Fixed fee charged on zero-value invoices
`src/lib/fees.ts:17–19`

`computeFeeCents(0, …)` returns 30 — so `computeNetCents` goes negative and a $0 invoice
shows a fee. **Fixed:** returns 0 for non-positive or non-finite amounts, and the fee can
never exceed the amount collected.

### 12. Orphaned auth users on failed member add
`src/lib/members.functions.ts:52–76`

If the membership insert fails after `createUser` succeeded, the account is left behind. The
admin can't retry — the e-mail is now taken but has no membership. **Fixed:** rollback deletes
only an account created in that same request.

### 13. Negative array index in seed
`src/lib/seed.functions.ts:58`

`trainers[day % trainers.length]` with `day` from −3: JS `%` keeps the sign, so this indexes
`trainers[-1]` → `undefined`, masked by `?? trainers[0]`. Every past session got the same
trainer. **Fixed** with a proper modulo.

---

## Checked and found sound

- **Tenant isolation** — the `USING (true)` policies on `profiles`/`clubs`/`memberships` in
  the initial schema look alarming but are correctly replaced in
  `20260624120000_tenant_isolation_rls.sql`, using SECURITY DEFINER helpers to avoid RLS recursion.
- **`requireSupabaseAuth`** — validates the bearer token via `getClaims` and scopes the client
  to the caller. `addMember` re-checks staff status through the caller's own RLS-scoped client
  rather than the admin client, which is the right instinct.
- **`set_session_rsvp()`** — locks the session row before the capacity check.
- **`describeFee()`** — the trailing-zero regex is correct across the range I tested.

---

## Verification

- `npx tsc --noEmit` — **passes** (0 errors) before and after.
- `npx eslint` — the repo has 1,674 pre-existing errors, almost all `prettier/prettier`
  (it has never been formatted). Per-file comparison against the base: the patch adds 2
  prettier complaints in `embed.functions.ts` and 1 in `app.revenue.tsx`, all inside blocks
  prettier already rejected. No new logic-rule violations. `src/lib/random.ts` is clean.
- SQL: dollar-quoting balanced, all three function bodies closed, parses under a Postgres
  dialect parser. **Not executed** — no Postgres available in this sandbox.

## Outstanding

The code is on `main`. These are not done.

1. **Run the migration** — `supabase/migrations/20260805120000_audit_fixes.sql`, by hand in the
   Supabase SQL editor. Per the README, migrations in this repo are never applied automatically.
   Items 1, 6, 7 and 8 above are only half fixed until it runs, and item 8 means the public
   embed form keeps failing exactly as before. It is idempotent, so re-running is safe.
2. **Confirm `20260703120000` is applied too, before anyone pays.** Removing the client-side
   fallback means a missing `pay_invoice()` RPC now fails loudly where it previously succeeded
   through the unsafe path. That is the intended behaviour, but it changes what a stale database
   looks like from the outside.
3. **Decide on demo seeding** — blocked in production unless `ALLOW_DEMO_SEED=true` is set.
4. **Consider gating `getEmbedStats`** on a per-club "embed enabled" flag. It returns member
   counts and upcoming session locations for any club UUID, without auth. Defensible for a widget
   you chose to publish, less so as the default for every club.
5. **`SUPABASE_SERVICE_ROLE_KEY` is not set anywhere** — not in `.env`, not in the Cloudflare
   build or runtime variables. `client.server.ts` throws without it, which means every code
   path touching `supabaseAdmin` (staff "Add member", demo seeding, both embed endpoints) has
   been failing in production independently of anything in this audit. Worth confirming
   against your own expectations of what works today.
6. **`.env` remains in git history.** The committed values are the publishable anon key and
   project URL, which are designed to be public, so this is optional — but if you ever want a
   clean history, that is a separate rewrite.
