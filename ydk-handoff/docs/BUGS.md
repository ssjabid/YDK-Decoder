# Known Bugs

Discovered during testing April 19, 2026. Listed in priority order.

---

## P0

### Bug 1: Endboard over-includes Xyz materials

**Severity:** High — makes the endboard list unusable for memorization
**Location:** `extension/background/service-worker.js` → `deriveEndboard()`
**Discovered:** Both Amalthe and Elara extractions show this

**Example from Elara extraction:**
```json
"endboard": [
  "DoomZ VII Seven - Elara",        // ← WRONG: under Diactorus → Graflario → GY
  "DoomZ Break - Diactorus",         // ← WRONG: under Graflario → GY
  "DoomZ V Five - Amalthe",          // ← WRONG: under Merrymaker → Sargas
  "Springans Merrymaker",            // ← WRONG: under Sargas
  "Gigantic \"Champion\" Sargas",    // ✓ correct
  "Therion \"King\" Regulus",        // ✓ correct
  "DoomZ XII Zero - Drastea",        // ← WRONG: under Drastrius
  "DoomZ XII End - Drastrius",       // ✓ correct
  "Power Patron Shadow Machine Zegredo",  // ← WRONG: under Varudras (also appeared TWICE)
  "Varudras, the Final Bringer of the End Times"  // ✓ correct
]
```

**Correct endboard:**
```
Varudras (R12) with 2× Zegredo material
Sargas (R4) with Merrymaker + Amalthe+Elara material chain
Therion "King" Regulus
Drastrius (R8) with Drastea material
Null Power Patron Realm - Vidria (Field Spell)
```

**Fix:** See P0.3 in ROADMAP.md — requires state-machine tracking of field.

---

## P1

### Bug 2: Opening hand empty when Solo Mode mulligan used

**Severity:** Medium — cosmetic, missing info
**Location:** `extension/background/service-worker.js` → `buildComboFromResult()`
**Discovered:** Amalthe extraction (Solo Mode had "return 5 cards to deck then redraw" setup)

**Symptom:** `"openingHand": []` when it should be the 5 cards in hand after mulligan completes.

**Root cause:** The `buildComboFromResult` pulls `openingHand` from `rawResult.openingHand` which comes from `extension/content/combo-import-helper.js` → `buildFinalResult()`. That function scans first 6 red-player "Drew" lines then stops at first Summon/Activate. But Solo Mode sequence is: Draw 5 → Return 5 → (later) Search/Summon → Actual hand isn't captured.

**Fix:** In `buildFinalResult()`, after the Return sequence finishes, snapshot hand state. Track: for each drawn card, is it still in the hand area when the first action happens? If not, it was returned — exclude from opening hand.

Alternative: skip opening hand detection entirely for Solo Mode replays (when `isSolo === true`), show a "Solo Mode — starting hand manipulated" badge instead.

---

### Bug 3: Draw actions inconsistent — sometimes `cards: null`

**Severity:** Low — detail text is still present
**Location:** `extension/content/combo-import-helper.js`
**Discovered:** Amalthe extraction had `cards: null`, Elara extraction had them populated

**Symptom:**
Amalthe: `{ "action": "Draw", "cards": null, "detail": "Drew \"DoomZ Destruction\"" }`
Elara: `{ "action": "Draw", "cards": ["DoomZ Destruction"], "detail": "Drew DoomZ Destruction" }`

**Root cause:** Likely `font.card_hover` DOM element wasn't rendered in time for first few draws. Probably timing-related — first draws happen before extractor's MutationObserver starts watching.

**Fix:** In `buildFinalResult()`, after parsing all lines, post-process: for any step with `cards: null` but `detail` matching `/^Drew [\"]?(.+?)[\"]?$/`, extract the card name via regex and populate `cards`.

---

## P2

### Bug 4: Decoder shows "VERIFY" flags for placeholder-passcode cards even when localhost API returns real data

**Severity:** Low — aesthetic
**Location:** `decoder/ydk_decoder.html`
**Discovered:** Reported by user in earlier chat

**Symptom:** Cards like Graflario have `id: 55555555` (placeholder, since real passcode wasn't known when cache was written). When user runs on localhost, API lookup for 55555555 returns 404. The `classify()` function falls through to defaults and marks as unverified.

**Fix:** When building the card data map, if a card's placeholder ID is in INLINE_CACHE, use the cache's data and clear the unverified flag. Alternatively, replace placeholder IDs with real ones as they get added to YGOPRODeck API.

**Real passcodes needed:** Graflario, DoomZ Change, A.D.R.A.S.T.E.I.A., Zegredo, Vidrium, Vidria, Terminus, The Fallen & The Virtuous, Varudras. Check YGOPRODeck as API updates.

---

### Bug 5: Terminal 404s on favicon and devtools (harmless)

**Location:** Browser console
**Discovered:** Abid's test run

```
::1 - - [19/Apr/2026 19:21:21] code 404, message File not found
::1 - - [19/Apr/2026 19:21:21] "GET /favicon.ico HTTP/1.1" 404 -
::1 - - [19/Apr/2026 19:27:22] "GET /.well-known/appspecific/com.chrome.devtools.json HTTP/1.1" 404 -
```

**Fix (optional):**
- Add a `favicon.ico` (or link `<link rel="icon" href="data:,">` in HTML to suppress)
- Chrome DevTools self-registration 404 is harmless and can be ignored

---

## Edge cases noticed, not yet bugs

### Pendulum activation sequence

In Elara extraction, Vidrium was "Activated to S-1" (Pendulum Zone), then "Returned S-1 to Extra Deck". The extension captures this correctly, but the renderer in the decoder may need Pendulum-specific display logic.

### Duplicate card names in Overlay step

Step 74 of Elara extraction: Overlay Zegredo onto Zegredo (both have same name). The `cards` array has the same name twice: `["Power Patron Shadow Machine Zegredo", "Power Patron Shadow Machine Zegredo"]`. Renderer needs to handle this — don't dedupe by name in Overlay steps.

### Xyz Summon "onto" notation

Step 75: `"Special Summoned Varudras... from Extra Deck onto Power Patron Shadow Machine Zegredo in M-5"` — the "onto X" part indicates an Xyz Summon where X becomes material. Renderer should detect this substring and style as Xyz Summon even though action is "Special Summon".
