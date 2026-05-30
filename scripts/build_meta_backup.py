#!/usr/bin/env python3
"""
Turn the extracted meta-decks/*.ydk into ONE importable backup JSON that the
decoder restores (Settings -> Restore). It creates:
  - a role:"matchup" deck for each .ydk (v2 shape; _contentHash omitted so the
    app's dedup never flips one of your own decks — same rule createMatchupDeck
    uses), and
  - a "Meta - May 2026" format with a matchup per deck, with how-they-win +
    chokepoints pre-filled where known (refine in the app).

Card text/images hydrate automatically from the YGOPRODeck API on first render.
Run:  python scripts/build_meta_backup.py   ->  meta-decks/meta-matchups-backup.json
"""
import os, re, glob, json

TS = "2026-05-30T00:00:00.000Z"

# how-they-win + chokepoints, best-effort (refine in-app). slug -> dict
INTEL = {
  "branded": {"how": "Fusion midrange; ends on Mirrorjade (non-targeting banish each turn) + backrow, grinds with GY recursion.",
              "theirs": "Ash Branded Fusion / Aluber's search; Ghost Belle the GY recursion.",
              "ours": "Mirrorjade survives battle/floats — bounce or banish it, don't try to destroy it; Duster/Storm their backrow."},
  "despia-branded": {"how": "Branded Fusion midrange (Despia engine) into Mirrorjade + backrow.",
              "theirs": "Ash Branded Fusion / Aluber; Belle their GY plays.", "ours": "Non-destruction removal on Mirrorjade; clear backrow."},
  "mitsurugi": {"how": "Ritual DARK warriors; floats + grinds with traps (Great Purification / Tempest).",
              "theirs": "Ash the Magatama / Prayers search; bait or clear their traps.", "ours": "Backrow removal first, then push through the bodies."},
  "mitsurugi-ryzeal": {"how": "Ritual control + Ryzeal Rank-4 Xyz package; disruption via traps + detaches.",
              "theirs": "Ash the first Ryzeal/Mitsurugi search; Droll caps the chains.", "ours": "Handtraps over breakers game 1; side breakers for the backrow."},
  "sky-striker": {"how": "Spell-based control; Engage draws, Kagari/Shizuku grind, Hornet Drones tokens, Widow Anchor steals.",
              "theirs": "Droll / Ash the Engage chain; they want an EMPTY board — clog it.", "ours": "Don't over-extend into their Spells; go wide and fast."},
  "yummy": {"how": "Fiend/Azamina swarm into Fusion negates (often Fiendsmith).",
              "theirs": "Ash the first search; Belle the Fiendsmith/Azamina GY plays.", "ours": "Break the Fusion board with non-targeting removal."},
  "maliss": {"how": "Banish-and-return Link combos + the Maliss <C> trap set as disruption.",
              "theirs": "Ash the first <P> search; bait the <C> traps before your real play.", "ours": "Clear the <C> traps, then push."},
  "dracotail": {"how": "Fast Fusion dragons + floats (frequently Branded engine).",
              "theirs": "Ash the Ketu/Rahu (or Branded Fusion) search.", "ours": "Break the boss; watch for fusion floats on removal."},
  "branded-dracotail": {"how": "Branded + Dracotail fusions into Mirrorjade + dragon bosses.",
              "theirs": "Ash Branded Fusion / the Dracotail search.", "ours": "Non-destruction on Mirrorjade; clear backrow, then push."},
  "elfnote": {"how": "Synchro fairies (Power Patron engine) climbing into negates/removal + traps.",
              "theirs": "Ash the Power Patron / Elfnote search; Imperm the Synchro body.", "ours": "Stop the first Synchro; break the board going second."},
  "predaplant": {"how": "Fusion (Albaz/Branded) toolbox; contact-fusion into big bodies.",
              "theirs": "Ash the Fusion starter (Branded Fusion / Predaplant search).", "ours": "Break the fusion board."},
  "lunalight": {"how": "Fusion beatdown (Sabre Dancer / Cat Dancer) + GY recursion.",
              "theirs": "Ash the first searcher.", "ours": "Remove the boss; they fold to disruption + board breakers."},
  "vanquish-soul": {"how": "Attribute-toolbox beatdown (Razen / Caesar) + K9 engine; resource grind.",
              "theirs": "Ash the K9 / VS search.", "ours": "Their bosses are beatdown-y — out-grind + remove Caesar."},
  "power-patron": {"how": "Power Patron engine (DoomZ cousins) into Xyz negates; Artmage splash.",
              "theirs": "Ash the Power Patron / Artmage search.", "ours": "Break the Xyz board; remove the equipped boss."},
  "artmage": {"how": "Artmage spellcaster combo into negates.",
              "theirs": "Ash the first Artmage search.", "ours": "Break the board going second."},
  "white-forest": {"how": "Synchro engine — White Forest spells trigger off Synchro/Sinful Spoils; Azamina splash.",
              "theirs": "Ash the White Forest / Sinful Spoils search.", "ours": "Stop the first Synchro; clear the board."},
  "radiant-typhoon": {"how": "Engine/control splash (Radiant Typhoon enables an Xyz/Synchro shell).",
              "theirs": "Confirm from a guide — newer; Ash the enabler search.", "ours": "Break the board; play around its disruption (verify)."},
  "fairy-tail-magistus": {"how": "Magistus equip engine + Fairy Tail - Snow control; loops Snow + Magistus equips.",
              "theirs": "Ash the Magistus / Snow search; Imperm the equip target.", "ours": "Remove the equipped boss; out-grind."},
}

def parse(path):
    main, extra, side = [], [], []
    cur = None
    for line in open(path, encoding="utf-8"):
        t = line.strip()
        if t.startswith("#main"): cur = main; continue
        if t.startswith("#extra"): cur = extra; continue
        if t.startswith("!side") or t.startswith("#side"): cur = side; continue
        if t.startswith("#") or not t: continue
        if t.isdigit() and cur is not None: cur.append(t)
    return main, extra, side

def deck_obj(name, slug, ydk_text, main, extra, side):
    counts = {"main": len(main), "extra": len(extra), "side": len(side), "total": len(main)+len(extra)+len(side)}
    dl_id = "dl_meta_" + slug + "_main"
    return {
        "deckId": "deck_meta_" + slug, "name": name, "role": "matchup",
        "ydkContent": ydk_text, "counts": counts,
        "main": main, "extra": extra, "side": side,
        "decklists": [{"decklistId": dl_id, "name": "Main build", "ydkContent": ydk_text,
                       "counts": counts, "main": main, "extra": extra, "side": side,
                       "notes": "", "createdAt": TS, "updatedAt": TS}],
        "primaryDecklistId": dl_id,
        "methodology": {"summary": "", "endboard": "", "howItWins": INTEL.get(slug, {}).get("how", ""),
                        "strengths": "", "weaknesses": "", "keyRatios": "", "techCards": []},
        "keyCards": [], "source": "meta-import",
        "notes": "Imported from a ygoprodeck tournament list (May 2026). Refine as the meta shifts.",
        "createdAt": TS, "updatedAt": TS,
        # _contentHash intentionally omitted (matchup decks bypass dedup)
    }

def matchup_obj(slug):
    intel = INTEL.get(slug, {})
    return {
        "matchupId": "m_meta_" + slug, "opponentDeckId": "deck_meta_" + slug, "tier": "tier1",
        "howTheyWin": intel.get("how", ""), "gameplanFirst": "", "gameplanSecond": "",
        "keyTargets": [], "techCardsThatShine": [], "counterCards": [], "relatedComboIds": [],
        "freeformNotes": "",
        "chokepointTheirs": intel.get("theirs", ""), "chokepointOurs": intel.get("ours", ""),
        "priorityFirst": [], "prioritySecond": [], "targetEndboard": [],
        "sideboard": {"goingFirst": {"in": [], "out": []}, "goingSecond": {"in": [], "out": []}},
    }

def main():
    files = sorted(glob.glob("meta-decks/*.ydk"))
    decks, matchups = [], []
    for f in files:
        slug = os.path.splitext(os.path.basename(f))[0]
        name = slug.replace("-", " ").title()
        m, e, s = parse(f)
        ydk = open(f, encoding="utf-8").read()
        decks.append(deck_obj(name, slug, ydk, m, e, s))
        matchups.append(matchup_obj(slug))
    fmt = {
        "formatId": "fmt_meta_may2026", "name": "Meta - May 2026",
        "startDate": "2026-05-01", "endDate": None, "primaryDeckId": None,
        "matchups": matchups, "tournaments": [],
        "notes": "Auto-built from ygoprodeck tournament lists. Pick your deck as primary, "
                 "then refine each matchup's plan. Define their end boards in Testing -> "
                 "Going second to practise breaking them.",
        "createdAt": TS, "updatedAt": TS,
    }
    backup = {"version": 1, "exportedAt": TS, "appBuild": "meta-import",
              "counts": {"decks": len(decks), "combos": 0, "cachedCards": 0},
              "data": {"decks": decks, "formats": [fmt], "activeFormatId": "fmt_meta_may2026"}}
    out = "meta-decks/meta-matchups-backup.json"
    json.dump(backup, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("Wrote", out, "-", len(decks), "matchup decks +", len(matchups), "matchups")

if __name__ == "__main__":
    main()
