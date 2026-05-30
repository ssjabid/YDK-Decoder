# Meta matchup decks — TCG, May 2026

Auto-extracted from **ygoprodeck.com** tournament lists (mostly YCS Columbus,
May 23 2026, + YCS Cartagena May 2). Every card resolves in the YGOPRODeck API,
so when you import these the decoder hydrates each card's **full text + image**
automatically — that's your "card breakdown / library" done.

## ⚡ Fastest way in — one import
1. Run the decoder on localhost (`py -m http.server 8000`).
2. **Settings (⚙) → Restore** → browse to this folder → pick
   **`meta-matchups-backup.json`**.
3. You now have **16 opponent decks** (role: matchup) + a **"Meta - May 2026"
   format** with a matchup for each, with *how-they-win* + *chokepoints*
   pre-filled where known. Pick your deck as the format's primary and refine.

   *(Restore is conservative — it won't touch your own decks/combos/formats.)*

## Or import decks one at a time
**Format → + Import opponent .ydk** → pick any `.ydk` in this folder.

## What's here (16 decks)
fairy-tail-magistus · mitsurugi · mitsurugi-ryzeal · yummy (Azamina) ·
maliss (@Ignister) · branded (Despia) · sky-striker · radiant-typhoon ·
dracotail (Branded) · vanquish-soul · lunalight · predaplant ·
power-patron (Artmage) · artmage · white-forest (Azamina) · elfnote (White Forest)

**You already have:** DoomZ, Kewl Tune.
**Couldn't find a recent TCG list for:** Clown Clan (no current tournament list
on ygoprodeck — give me a URL and I'll add it).

## ⚠ Honest caveats
- Each is **one specific recent tournament list** (a representative build), not
  "the" list — variants exist. Swap in your own with the extractor below.
- **Chokepoints / how-they-win are best-effort** (some new archetypes are
  low-confidence — flagged in the matchup notes). Refine in the app.
- The meta shifts weekly; re-run when it does.

## The tools (reusable)
- `scripts/extract_ygopro_deck.py <ygoprodeck-deck-url>` → prints a `.ydk`.
  Batch: `python scripts/extract_ygopro_deck.py --batch < urls.txt`
  (lines of `Name<TAB>https://ygoprodeck.com/deck/...`).
- `scripts/build_meta_backup.py` → rebuilds `meta-matchups-backup.json` from
  every `.ydk` in this folder.

To add/replace a deck: drop its ygoprodeck URL into the batch, re-extract,
re-run the backup builder, re-import.

See **`docs/META_2026-05.md`** for the full strategic breakdown.
