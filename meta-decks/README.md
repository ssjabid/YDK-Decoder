# Meta matchup decks — TCG, May 2026

Auto-extracted from **ygoprodeck.com** tournament lists (mostly YCS Columbus,
May 23 2026, + YCS Cartagena May 2). Every card resolves in the YGOPRODeck API,
so when you import these the decoder hydrates each card's **full text + image**
automatically — that's your "card breakdown / library" done.

## ⚡ Fastest way in — one click, in the app
1. Run the decoder on localhost (`py -m http.server 8000`) and open
   `http://localhost:8000/decoder/ydk_decoder.html`.
2. **Settings (⚙) → Meta decks → ⚡ Load meta decks.** Confirm.
3. Done — **17 opponent decks** (role: matchup) + a **"Meta - May 2026" format**
   where every matchup is **pre-filled**: how-they-win, their typical **end board**,
   the **chokepoint** to Ash, **going-first / going-second** plans, and recommended
   **handtraps / side cards**.
4. Pick your deck as the format's primary and refine.

   *(The button fetches `meta-matchups-backup.json` from this folder over localhost.
   Re-click anytime to **refresh** to the latest research — it keeps your own decks
   and tournament journal, and keeps any freeform notes / side plans you added.)*

### Manual fallbacks
- **Settings → ↓ Restore** → pick `meta-matchups-backup.json` (only adds decks/
  formats you don't already have — won't refresh existing ones).
- **Format → + Import opponent .ydk** → pick any single `.ydk` in this folder.

## What's here (17 decks)
branded (Despia) · dracotail (Branded) · mitsurugi · mitsurugi-ryzeal ·
maliss (@Ignister) · yummy (Azamina) · white-forest (Azamina) · sky-striker ·
fairy-tail-magistus · radiant-typhoon · elfnote · power-patron · artmage ·
vanquish-soul (K9) · lunalight · predaplant · **clown-crew** (new)

**You already have:** DoomZ, Kewl Tune.

## ⚠ Honest caveats
- Each is **one specific recent tournament list** (a representative build), not
  "the" list — variants exist. Swap in your own with the extractor below.
- **Chokepoints / game-plans are researched + cited** (`docs/META_2026-05.md`),
  but the meta shifts and some newer archetypes are lower-confidence — flagged in
  the doc. Refine in the app after you play the matchups.
- Disruption tags on a pulled end board are best-effort (mostly "negate") — adjust
  in *Testing → Going second → Edit boards* if one's wrong.

## The tools (reusable)
- `scripts/extract_ygopro_deck.py <ygoprodeck-deck-url> [out.ydk]` → a `.ydk`.
  Batch: `python scripts/extract_ygopro_deck.py --batch < urls.txt`
  (lines of `Name<TAB>https://ygoprodeck.com/deck/...`).
- `scripts/resolve_ydk.py <file.ydk>` → prints the deck's card names (API lookup) —
  handy for understanding a freshly-extracted list.
- `scripts/build_meta_backup.py` → rebuilds `meta-matchups-backup.json` from every
  `.ydk` here, using the researched `INTEL` dict in that script.

To add/replace a deck: extract its ygoprodeck URL → add an `INTEL` entry in
`build_meta_backup.py` → re-run the builder → in the app, **⚡ Load meta decks**.

See **`docs/META_2026-05.md`** for the full strategic breakdown and the MST.TV
"How to Beat" video links.
