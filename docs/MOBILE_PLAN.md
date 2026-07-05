# Mobile plan — taking YDK Decoder cross-platform

Written 2026-06-21. Goal (Abid's words): a **mobile app** that **cross-functions
with the web app** — analyse on either, same concept and actions, **linked by an
account** so your decks/combos/matchups follow you across devices.

This is a plan, not code yet. It answers the three real questions (how to package
it, how to sync it, one repo or two), lays out a phased roadmap, and is honest
about what needs *you* (accounts, hardware) vs what an AI can build.

> **Progress (2026-06-21):** The **no-login** mobile app is essentially
> complete — live on GitHub Pages, installable, and running on Abid's phone.
> Shipped: **M0** phone-tuning (0 horizontal overflow on every screen; desktop
> untouched, all rules in `@media (max-width:640px)`); **M1** PWA (manifest +
> on-brand card/summon-burst icon + offline SW, PROD-only) + GitHub Pages
> deploy; **mobile list→detail→back navigation** for Decks & Combos (the big
> UX fix — one pane at a time on a phone, side-by-side on desktop); plus mobile
> bug fixes (card preview → bottom sheet, tap-again-to-dismiss via pointerdown,
> equal toolbar button widths). Data still moves by **export/import**. The only
> remaining phase is **M2 (account + sync)** — deliberately deferred until Abid
> wants it.

---

## TL;DR — the recommendation

1. **One repo, one codebase.** Do NOT start a separate mobile repo. The same
   React app becomes the web app *and* the mobile app. Two repos would drift
   apart the moment we fix a bug in one — the opposite of "cross-function, same
   actions."
2. **Package with a PWA first, Capacitor later.** Make the existing app an
   installable Progressive Web App (home-screen icon, offline) — that's 80% of
   "it's a mobile app" for ~0 cost and no app store. If/when you want a real
   App Store / Play Store listing, wrap the *same* app in Capacitor (a native
   shell around our web code). We never rewrite the UI.
3. **Sync with an account via Supabase.** Add a login and a tiny cloud store
   that holds your data (reusing our existing backup format). Local stays the
   source of truth (offline-first); the cloud is the mirror that lets device A
   and device B see the same library.
4. **The web app has to move off `localhost`.** For a phone to load it and sync,
   it must live at a real HTTPS URL (free static hosting). Nice side effect: no
   more `py -m http.server` — the Chrome extension can point at the hosted URL.

**Capability:** every code part of this I (or Fable) can build — nothing here
needs a different model. The parts that need *you* are account/money/hardware:
an Apple Developer account ($99/yr) and Google Play account ($25 once) **only if**
you want store listings, plus a free Supabase and a free hosting account. More
on "me vs Fable" at the bottom.

---

## The three decisions

### 1. Packaging — how it gets onto a phone

| Option | What it is | Reuses our code? | App store? | Effort | Verdict |
|---|---|---|---|---|---|
| **PWA** | Add a manifest + offline cache to the current app; "Add to Home Screen" | 100% | No (installs from the browser) | Low | **Start here** |
| **Capacitor** | Wrap the same web app in a native iOS/Android shell | 100% (UI unchanged) | Yes | Medium | **Phase 3, if you want stores** |
| React Native / Expo | A *separate* native UI written in RN primitives | Only the non-UI logic (`lib/`) | Yes | High | **Avoid** — forks the UI, doubles maintenance |

**Why not React Native:** it can't reuse our JSX + CSS — the whole interface
would be rebuilt in a different system and maintained twice forever. For a
personal tool that must stay in lockstep across web and mobile, that's the wrong
trade. Capacitor gives us native apps from the *exact same* code.

### 2. Sync + account — how the data follows you

Today the app stores everything in the browser's `localStorage` (per-device, no
account). We already serialize the whole library to one JSON (Settings →
Backup). Sync is basically "keep that JSON in the cloud, per account."

**Recommendation: Supabase** (hosted Postgres + Auth, generous free tier).
- **Auth:** email magic-link or email+password login.
- **Store:** one row per user — `user_data(user_id, data jsonb, updated_at)` —
  holding your backup blob.
- **Sync layer:** a thin `lib/sync.js` on top of the existing `storage.js`:
  on change → debounce → push; on app open / focus → pull → merge.
- **Offline-first stays intact:** `localStorage` remains the local source of
  truth; the cloud is a mirror. No network = app still fully works.

**Conflict handling (the one real design point):** our restore is *additive*
(adds things by id, never overwrites), which is perfect for combos/decks/formats
that are append-heavy. For edits to existing items across two devices at once,
we start simple — newest-`updated_at` wins on the whole blob, with the additive
merge as a safety net when you first link a device — and only get fancier if you
ever actually hit a conflict. For one person on a phone + a laptop, this is plenty.

**Trade-off to be honest about:** this adds a backend, which is a shift from the
current "pure client, nothing phones home" design. But cross-device sync
*requires* a server — there's no way around it. It's your own private data store
(no analytics, no tracking — that principle holds), and the app keeps working
fully offline. Alternatives (Firebase) are equivalent; Supabase just fits best.

### 3. One repo or two — **one.**

Keep everything in this repo:
- The web app (`app/`) is the shared codebase.
- PWA files live in `app/` (manifest + service worker).
- Capacitor adds `ios/` and `android/` folders here later — they're just native
  wrappers around the web build, not separate code.
- Supabase is a hosted service, not a repo; its config (URL + public key) lives
  in env, and the sync code is `app/src/lib/sync.js`.

One repo = web and mobile can never drift. That is exactly the "same concept and
actions everywhere" you asked for.

---

## Roadmap (phased, each phase independently useful)

### M0 · Responsive pass — *the real work, do this first*
The app currently breaks below ~800px (it was designed for desktop). Before any
packaging, make it feel right on a phone:
- Stack the two-column master/detail layouts (Decks sidebar+panel, Combos
  list+detail) into one column on narrow screens.
- Bottom tab bar on mobile (native pattern) instead of the top tabs.
- Finger-sized tap targets (bump the 26px minis where needed; 44px is the touch
  guideline).
- Card grids reflow to 2–3 across; hover-only previews become tap-to-open (we
  already pin on tap, so this mostly works).
- Test the Testing/Combos/Format flows with touch.

> This is the biggest chunk — bigger than the packaging. It also *immediately*
> improves the web app on a phone browser, before we install anything.

### M1 · PWA + hosting — "it's an app on my phone"
- Host the web app on free static hosting (Netlify / Vercel / GitHub Pages) at
  an HTTPS URL. Point the Chrome extension at that URL (retires `localhost`).
- Add a web manifest (name, icon, theme) + a service worker for offline.
- Result: "Add to Home Screen" on iOS/Android → launches full-screen, works
  offline, updates when you reopen. **No app store, ~$0.**

### M2 · Account + sync — "same library on laptop and phone"
- Supabase project (free). Add a Login screen.
- `lib/sync.js`: push on change, pull+merge on open/focus.
- Migration: first login offers "upload this device's data" so your existing
  local library seeds the cloud.
- Result: extract a combo on the laptop → it appears on the phone.

### M3 · Native apps + stores — *optional, only if you want listings*
- Add Capacitor; produce real iOS + Android apps from the same code.
- Needs your accounts: Apple Developer ($99/yr), Google Play ($25 once).
- Device testing + store submission (I guide, you click through).
- For personal use you can skip this entirely — the PWA already installs.

---

## What needs *you* (an AI can't do these)
- **Money/accounts:** Supabase (free), a hosting account (free), and — only for
  M3 — Apple Developer ($99/yr) + Google Play ($25 once).
- **A phone to test on**, and for iOS builds specifically, a Mac (or a cloud Mac
  service) — Apple only lets you build iOS apps on macOS. Android builds work
  anywhere. (This is the one place your Windows machine is a limitation, and
  only at M3.)
- **Clicking through** store submission + on-device install prompts.

Everything else — the responsive rewrite, PWA setup, the sync layer, auth wiring,
Capacitor config — is code I can write and verify.

## Who should build it — me or Fable?
- **Capability:** identical. Fable 5 is Opus with faster output, not a different
  brain. There is no part of this only one of us can do.
- **For a big multi-session build like this, Fable's speed helps you iterate
  faster** — but if you'd rather keep continuity with me, that's fine too.
- **My honest suggestion:** do **M0 + M1 + M2 first** (responsive → PWA → sync).
  That gets you a real, installable, cross-device app with **no app-store
  accounts and ~$0**, and it's the 80% you actually want ("analyse on either
  device, same actions, linked by account"). Only reach for M3 (native store
  apps) if you specifically want a store listing. Whether I or Fable drives it,
  keep it phased and verify each phase on your phone before the next.

## Rough cost
- **M0–M2:** ~$0 (Supabase free tier + free static hosting easily cover a
  personal tool — your whole library is a small JSON blob).
- **M3 (optional):** $99/yr Apple + $25 once Google, only for store listings.

---

## One thing that stays desktop-only
The **combo extractor is a Chrome extension** and DuelingBook replays are a
desktop-browser thing — you can't run the extension on a phone. That's fine and
actually a clean split: **capture on desktop** (extension → cloud), **study
anywhere** (phone pulls from the account). The mobile app focuses on reviewing,
drilling, and matchup analysis; new-combo capture stays on the laptop, and sync
bridges the two.
