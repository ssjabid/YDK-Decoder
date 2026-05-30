#!/usr/bin/env python3
"""
Turn the extracted meta-decks/*.ydk into ONE importable backup JSON that the
decoder restores (Settings -> Restore, OR the in-app "Load meta decks" button).

For each .ydk it builds:
  - a role:"matchup" deck (v2 shape; _contentHash omitted so the app's dedup
    never flips one of your own decks), and
  - a "Meta - May 2026" format with a fully PRE-FILLED matchup per deck:
    how-they-win, their typical end board (feeds the Board Breaker), the
    chokepoint to Ash, going-first / going-second plans, and recommended
    handtraps / side cards.

Card text + images hydrate automatically from the YGOPRODeck API on first
render. The strategy below is researched + cited (see docs/META_2026-05.md);
confidence is flagged per deck via `tier` (tier1 / tier2 / rogue).

Run:  python scripts/build_meta_backup.py   ->  meta-decks/meta-matchups-backup.json
"""
import os, re, glob, json

TS = "2026-05-30T00:00:00.000Z"
# Bump this whenever the pack content changes — the app auto-refreshes loaded
# meta data to the newest version on launch.
META_VERSION = "2026-05-30-deep-v2"

# Per-deck intelligence. Keyed by .ydk filename (slug).
#   name     -> nice display name (defaults to title-cased slug)
#   tier     -> "tier1" | "tier2" | "rogue"  (meta standing / confidence)
#   how      -> howTheyWin (1-2 sentences)
#   endboard -> [card names] their typical going-first board (Board Breaker)
#   theirs   -> chokepointTheirs: the must-resolve card to Ash + what it does
#   first    -> gameplanFirst: how to play going FIRST vs them
#   second   -> gameplanSecond: how to BREAK their board going second
#   counters -> [(name, "good"|"bad", note)] handtraps / side cards
INTEL = {
  "branded": {
    "name": "Branded / Despia", "tier": "tier1",
    "how": "Albaz Fusion midrange — Branded Fusion / Branded in Red/White summon a wall of Fusion bosses (often on YOUR turn), then grind with recursion + burn. Control/midrange, not an OTK.",
    "endboard": ["Mirrorjade the Iceblade Dragon", "Masquerade the Blazing Dragon", "Branded in Red", "Dramaturge of Despia"],
    "theirs": "Ash Branded Fusion (their best starter) — but they BAIT Ash with Branded Opening / Lubellion first, so save it for the real Branded Fusion. Aluber the Jester of Despia is the secondary Ash target. Droll & Lock Bird kills the search chain.",
    "first": "They run few hard negates, so a clean board usually beats them — but DON'T over-commit LIGHT/DARK monsters into an open Super Polymerization, and respect Bystials (Druiswurm / Lubellion banishing your LIGHT/DARK).",
    "second": "Mirrorjade is the threat and it PUNISHES removal — if it leaves the field by YOUR card it wipes your monsters at the End Phase. Out it with NON-destruction: your own Super Polymerization (eats it as fusion material) is the best tech, or banish/bounce, or spend its banish first then push. Clear Branded backrow.",
    "counters": [("Ash Blossom & Joyous Spring", "good", "On the REAL Branded Fusion, not the bait"),
                 ("Droll & Lock Bird", "good", "Kills the search engine"),
                 ("Nibiru, the Primal Being", "good", "They extend with many summons, few negates"),
                 ("Super Polymerization", "good", "Eats Mirrorjade/Chimera — non-targeting, dodges End-Phase wipe"),
                 ("Bystial Druiswurm", "good", "Banish their Albaz/Despia GY fuel")],
  },
  "dracotail": {
    "name": "Dracotail (Branded)", "tier": "tier1",
    "how": "Fusion combo/control — Dracotail Faimena is a near-one-card starter (discard to Fusion Summon), chaining Dracotail fusions + a trap suite; often splashes the Branded engine for Mirrorjade.",
    "endboard": ["Dracotail Mululu", "Dracotail Shaulas", "Dracotail Arthalion", "Mirrorjade the Iceblade Dragon"],
    "theirs": "Ash / Ghost Belle on Dracotail Faimena (the one-card starter / first Fusion) — deny the first Fusion and they often have NO board. Belle is great: it also shuts their Trap activations.",
    "first": "Their disruption is bounce + negate, not destruction. Summon key monsters in DEFENSE to dodge Dracotail Horn (bounces Attack-position monsters), and don't let your win hinge on one bounce-able body.",
    "second": "Mass monster removal (Raigeki / Dark Hole / DRNM) is WEAK — their answers live in hand/GY/backrow. Stop the backrow + deny Fusion fuel instead. If Mirrorjade is up, out it via Super Poly / banish (not your own destruction). Watch for Red-Eyes Dark Dragoon in some builds.",
    "counters": [("Ghost Belle & Haunted Mansion", "good", "Shuts Trap activations + GY"),
                 ("Ash Blossom & Joyous Spring", "good", "On Faimena / first Fusion"),
                 ("Retaliating \"C\"", "good", "Pseudo-Dimension Shifter; their Spells trigger it"),
                 ("Dimension Shifter", "good", "Denies GY fusion fuel"),
                 ("Droll & Lock Bird", "good", "Caps the search chain")],
  },
  "predaplant": {
    "name": "Predaplant", "tier": "rogue",
    "how": "Albaz/Branded fusion toolbox — spreads Predator Counters (turning your monsters into Lv1 fusion fodder), negates with Dragostapelia, OTKs with Triphyovertum. Mostly a Genesys/OCG/rogue pick in TCG.",
    "endboard": ["Predaplant Dragostapelia", "Mirrorjade the Iceblade Dragon", "Branded Fusion"],
    "theirs": "Ash Branded Fusion / their first big Fusion spell; Imperm the engine Predaplant that makes counters. NOTE: Super Polymerization is NOT Ash-able.",
    "first": "Big danger is their Super Polymerization eating YOUR monsters on your turn (Predator Counters enable it) — avoid presenting two same-attribute monsters that complete a fusion. Their pure board is weak, so a normal board usually holds.",
    "second": "Remove Dragostapelia (the negate) by non-targeting/banish, or attack over it once its negate is spent; Mirrorjade caveat applies (Super Poly/banish, not destruction). Your own Super Poly is great vs their fat fusion bodies.",
    "counters": [("Ash Blossom & Joyous Spring", "good", "On Branded Fusion"),
                 ("Infinite Impermanence", "good", "On the engine Predaplant"),
                 ("Nibiru, the Primal Being", "good", "Low-negate extending board"),
                 ("Dimension Shifter", "good", "Denies GY/fusion fuel"),
                 ("Super Polymerization", "good", "Eats their fusion bodies")],
  },
  "lunalight": {
    "name": "Lunalight", "tier": "rogue",
    "how": "Going-first Fusion combo (post-Duelist Advance) — a one-card Gold Leo line builds a sticky Liger Dancer board, then double-attacks + grinds via GY recursion.",
    "endboard": ["Lunalight Liger Dancer", "Lunalight Silver Hound", "S:P Little Knight"],
    "theirs": "Imperm on Lunalight Gold Leo (one-card starter) + Ash on Lunalight Silver Hound (deck-SS GY effect). Disrupt BEFORE Liger resolves — once Liger lands you usually lose. Droll alone isn't enough.",
    "first": "Hold interaction for the cards that lead to Liger Dancer (don't waste it early). Build a board that survives a Liger wipe — Liger only destroys SPECIAL-Summoned monsters, so a Normal-Summoned body or a continuous floodgate survives.",
    "second": "Liger is unaffected by non-Lunalight effects — targeted removal/negation bounces off. Out it with TRIBUTE-based removal: Kaiju, Lava Golem, or Ra Sphere Mode (tribute its monsters away). Don't flood Special-Summoned monsters into an unanswered Liger (feeds its wipe).",
    "counters": [("Infinite Impermanence", "good", "On Gold Leo"),
                 ("Ash Blossom & Joyous Spring", "good", "On Silver Hound"),
                 ("Lava Golem", "good", "Tribute Liger away — ignores its immunity"),
                 ("Nibiru, the Primal Being", "good", "Punishes the combo"),
                 ("Dimension Shifter", "good", "Hurts GY recursion")],
  },
  "mitsurugi": {
    "name": "Mitsurugi", "tier": "tier1",
    "how": "Reptile Ritual engine — one starter (Ame no Habakiri) becomes a wall of recurring Ritual monsters + searched traps, then grinds behind repeated negates and a board-wipe.",
    "endboard": ["Ame no Murakumo no Mitsurugi", "Futsu no Mitama no Mitsurugi", "Mitsurugi Great Purification", "Mitsurugi Prayers"],
    "theirs": "Droll & Lock Bird is the single best card — they make MULTIPLE searches per turn, and Droll after their first add nearly bricks them. Ash the first searcher (Aramasa/Kusanagi/Saji) also cuts the chain. Belle hits GY revival.",
    "first": "Build a board that doesn't fold to one negate or one wipe. Murakumo's negate is a soft 'discard-or-negate' — keep a SPARE card to feed the discard so your key effect resolves. End on disruption that doesn't need monsters on board (set traps) so Murakumo's re-summon wipe whiffs.",
    "second": "Nibiru is strong (tribute their board after they've used self-revives; discard Nibiru itself to dodge Murakumo's discard gate). Non-targeting/non-destruction wipes (Kaiju/Lava Golem) get under the trap negates. Bait Great Purification with a throwaway effect first.",
    "counters": [("Droll & Lock Bird", "good", "Best card — multi-search turn bricks"),
                 ("Ash Blossom & Joyous Spring", "good", "On the first searcher"),
                 ("Nibiru, the Primal Being", "good", "Tribute the Reptile board"),
                 ("Ghost Belle & Haunted Mansion", "good", "Hits GY revival / trap recursion")],
  },
  "mitsurugi-ryzeal": {
    "name": "Mitsurugi-Ryzeal", "tier": "tier2",
    "how": "Mitsurugi grind core + a Rank-4 Ryzeal package (Ryzeal Detonator = free repeatable destroy). More going-second power and more layers than pure Mitsurugi.",
    "endboard": ["Ame no Murakumo no Mitsurugi", "Ryzeal Detonator", "D/D/D Wave High King Caesar", "Mitsurugi Prayers"],
    "theirs": "Ash/Imperm on ICE Ryzeal — pilots openly fear 'Ash or Imperm on Ice'; it stops the line cold with no follow-up. On the Mitsurugi side, Droll/Ash the search.",
    "first": "Same as Mitsurugi — don't fold to one negate/wipe, keep discard fodder for Murakumo. Respect Ryzeal Detonator's free destroy on YOUR turn; bait its detach with a low-value card first.",
    "second": "Nibiru (same window as Mitsurugi). Detonator is a DESTROY effect — use non-destruction (Kaiju/Lava Golem/bounce) so you don't feed it. Clear Murakumo without triggering its re-summon wipe on yourself.",
    "counters": [("Infinite Impermanence", "good", "Specifically strong on the Ice Ryzeal step"),
                 ("Ash Blossom & Joyous Spring", "good", "On Ice / the search"),
                 ("Droll & Lock Bird", "good", "Punishes the double-engine searching"),
                 ("Nibiru, the Primal Being", "good", "Tribute the board")],
  },
  "clown-crew": {
    "name": "Clown Crew", "tier": "rogue",
    "how": "Tribute-Summon FLOODGATE control — makes disposable tribute fodder, Tribute Summons Clown Crew Biancaviso (draw / negate face-up cards) AND Tribute-Summon-only floodgates (Vanity's Ruler / Vanity's Fiend) to lock you out, then grinds. Splashes a Nouvelles ritual package. Rogue, not tier-1.",
    "endboard": ["Vanity's Fiend", "Vanity's Ruler", "Clown Crew Biancaviso"],
    "theirs": "Ash the Clown Crew Rehearsal / Biancaviso line (the fodder + floodgate engine); Ghost Belle the GY-banish Ritual effect. Droll hurts (it's a draw/search deck). No fodder = no Vanity tribute.",
    "first": "Resolve your board BEFORE they Tribute Summon a Vanity floodgate, and end on disruption that does NOT need to Special Summon (set traps / in-hand handtraps) so a resolved Vanity's Ruler/Fiend doesn't brick your follow-up.",
    "second": "The lock is the Vanity floodgate (SS-lock: Ruler stops only YOUR Special Summons; Fiend stops BOTH). DON'T fight it with Special Summons — use NON-SS outs: Dark Ruler No More / Forbidden Droplet (turn off the body's effect), Evenly Matched (ignores it entirely), or Imperm to open a SS window. Remove the floodgate, THEN commit Special Summons.",
    "counters": [("Ash Blossom & Joyous Spring", "good", "On Rehearsal / Biancaviso"),
                 ("Ghost Belle & Haunted Mansion", "good", "On the GY Ritual effect"),
                 ("Dark Ruler No More", "good", "Turns off Vanity's lock for the turn — no SS needed"),
                 ("Forbidden Droplet", "good", "Non-SS out to the floodgate"),
                 ("Evenly Matched", "good", "Ignores the SS-lock entirely")],
  },
  "vanquish-soul": {
    "name": "Vanquish Soul", "tier": "tier2",
    "how": "Vanquish Soul K9 — a hand-resource 'tag-fighter' beatdown: reveal monsters in hand to fuel attribute effects, tag fighters in/out, grind resources. K9 adds bodies + punishes handtraps.",
    "endboard": ["Vanquish Soul Caesar Valius", "Vanquish Soul Pluton HG", "K9-17 Ripper"],
    "theirs": "Ash Vanquish Soul Razen (main searcher). BUT K9-17 'Ripper' negates monster effects activated in hand/GY — i.e. it negates your Ash/Veiler. So lead with Infinite Impermanence (a Trap — dodges Ripper) or hold the monster handtrap until Ripper is spent. Their tag-out dodges targeted disruption.",
    "first": "They're a grind/beatdown deck, not an OTK — a normal disruptive board is fine. Respect Caesar Valius's free destroy and its EARTH 'unaffected this turn' mode. Force them to commit before you tag interruption (they tag-out to dodge).",
    "second": "Attrition + non-targeting removal. Forbidden Droplet / Dark Ruler No More turn off Caesar/K9 negates for the push; Evenly Matched is great (they go wide). Caesar can become unaffected — prefer mass non-targeting wipes over single-target removal.",
    "counters": [("Infinite Impermanence", "good", "Trap — slips past K9 Ripper's negate"),
                 ("Droll & Lock Bird", "good", "Anti-search"),
                 ("Thunder King Rai-Oh", "good", "Anti-search / anti-reveal"),
                 ("Forbidden Droplet", "good", "Push through Caesar/K9 negates"),
                 ("Evenly Matched", "good", "They go wide")],
  },
  "maliss": {
    "name": "Maliss", "tier": "tier1",
    "how": "Cyberse Link-climbing combo that abuses BANISHMENT — Special Summons monsters back from banish to chain into Link bosses + a self-recurring loop, then grinds with the Maliss <C> disruption traps. Can OTK with Accesscode.",
    "endboard": ["Maliss Q Hearts Crypter", "Maliss in the Mirror", "Maliss <C> TB-11", "Maliss <C> MTP-07"],
    "theirs": "Imperm/Veiler/Ash Maliss P White Rabbit (the one-card starter that sets a Maliss Trap from deck). The engine isn't great at playing through established boards + folds to spot removal. Banish floodgates are WEAK (they recur from banish).",
    "first": "Build HARD negates / spot removal, NOT banish-pile hate (they recur from banish). Their traps need a face-up Maliss monster to fire — pre-emptively removing their first Maliss monster turns off the set traps. Dimension Shifter is strong (deck routes through GY/banish).",
    "second": "Clear the set Maliss <C> traps first (each needs a face-up Maliss monster — removing/banishing their on-board Maliss BRICKS them). The danger card is Hearts Crypter — its banish CAN'T be negated when it points to a monster, so disrupt it on activation/cost or remove it before committing. DRNM/Droplet help push.",
    "counters": [("Maxx \"C\"", "good", "Best — it's a combo deck"),
                 ("Ash Blossom & Joyous Spring", "good", "On White Rabbit / first trap"),
                 ("Infinite Impermanence", "good", "Spot-negate the starter"),
                 ("Dimension Shifter", "good", "Deck routes through GY/banish"),
                 ("Nibiru, the Primal Being", "good", "Punishes the Link climb")],
  },
  "yummy": {
    "name": "Yummy (Azamina)", "tier": "tier1",
    "how": "LIGHT-Beast Synchro combo (Cupsy/Cooky/Lollipo + Yummy Way Synchros) that swarms cheaply and, in the Azamina/Fiendsmith build, converts into multiple Fusion omni-negates.",
    "endboard": ["Azamina Ilia Silvia", "Fiendsmith's Desirae", "S:P Little Knight", "Yummy Snatchy"],
    "theirs": "Maxx C / Imperm on the first Synchro is cleanest. Ash the Cupsy Yummy Way search or (Fiendsmith build) the Engraver/Lacrima GY setup. NOTE: Yummy Snatchy's Field-Spell placement CANNOT be Ash'd.",
    "first": "It's a combo deck — Maxx C / Mulcharmy pressure is strong. The Azamina layer makes them hard to handtrap outside the Standby Phase, so end on disruption that doesn't rely on perfect timing. Dimension Shifter shuts the Fiendsmith GY engine off hard.",
    "second": "'No-negate' sweepers shine — Dark Ruler No More turns off the Fusion negates so you can push; Forbidden Droplet neuters Snatchy + omni-negates. Bystials are great (all Fiendsmith are LIGHT — banish their GY LIGHTs). Remove the omni-negate Fusion (Ilia Silvia / Desirae) before your main play.",
    "counters": [("Maxx \"C\"", "good", "Best vs a combo deck"),
                 ("Ash Blossom & Joyous Spring", "good", "On Cupsy's search / Fiendsmith GY"),
                 ("Dimension Shifter", "good", "Shuts the Fiendsmith GY engine"),
                 ("Bystial Druiswurm", "good", "Banish their LIGHT Fiendsmith GY"),
                 ("Dark Ruler No More", "good", "Turn off the Fusion negates")],
  },
  "fairy-tail-magistus": {
    "name": "Fairy Tail Magistus", "tier": "tier1",
    "how": "Spellcaster engine fusing the Magistus equip package with Fairy Tail control. Fairy Tail - Wiccat 'double Foolish' fuels a search/recursion loop; ends on negates and grinds with Snow recursion + Magistus equips.",
    "endboard": ["Teller of the Magistus", "Zoroa, the Magistus Verethragna", "Fairy Tail - Snow"],
    "theirs": "Ash Fairy Tail - Wiccat's send (it kicks out the main advantage engine). Imperm/Veiler the first Magistus/Fairy Tail effect. Droll is NOT especially good here (deck has low-ceiling plays + Called by / Verre Magic).",
    "first": "They can out-negate your handtraps (Teller/Zoroa negate; Zoroa also pops). Lead with a board they can't simply out-negate and pressure with Maxx C. They recur from GY (Snow + Wiccat sends) so Dimension Shifter is strong.",
    "second": "Deal with Teller (omni-negate) FIRST — bait or remove it before your key play. Watch Zoroa negating + popping. 'No-negate' breakers (Dark Ruler No More, Forbidden Droplet, Evenly Matched into their backrow/equips) push through; clear Magistus equip-spells first.",
    "counters": [("Ash Blossom & Joyous Spring", "good", "On Wiccat's send"),
                 ("Infinite Impermanence", "good", "On the first Magistus/Fairy Tail effect"),
                 ("Nibiru, the Primal Being", "good", "Teller/Zoroa only arrive ~5 summons in"),
                 ("Dimension Shifter", "good", "Hits their GY recursion"),
                 ("Dark Ruler No More", "good", "Break through the negates second")],
  },
  "sky-striker": {
    "name": "Sky Striker", "tier": "tier1",
    "how": "Spell-based control/grind — loops Sky Striker Mobilize - Engage! via the Ace monsters to out-resource you, disrupts with Widow Anchor / Shark Cannon. Wants its OWN monster zones EMPTY (most Quick-Plays need controlling no monsters).",
    "endboard": ["Sky Striker Ace - Shizuku", "Sky Striker Mecha - Widow Anchor", "Sky Striker Mecha - Shark Cannon", "Sky Striker Mecha - Eagle Booster"],
    "theirs": "Droll & Lock Bird is the premier answer — stops the search after their first add and chokes the Engage snowball. Ash negates an Engage. Cursed Seal of the Forbidden Spell permanently locks Engage. Stopping repeated Engages collapses them.",
    "first": "A clogged board punishes THEM, not you — almost every Sky Striker Quick-Play needs THEM to control no monsters, so forcing a monster onto THEIR field (Kaiju / Lava Golem / a token) shuts off Widow Anchor + Shark Cannon on your turn. Set up normally; just respect Widow Anchor on your key monster.",
    "second": "Little to physically 'break' (low board) — the fight is resources + backrow. Clear their set Mecha Spells (Widow Anchor / Shark Cannon are the disruption). Put a monster on their field (Kaiju) to disable Quick-Plays. Ghost Reaper can pre-emptively banish Kagari.",
    "counters": [("Droll & Lock Bird", "good", "Best — chokes the Engage snowball"),
                 ("Ash Blossom & Joyous Spring", "good", "Negate an Engage"),
                 ("Lava Golem", "good", "Force a monster onto their field — shuts off Quick-Plays"),
                 ("Ghost Reaper & Winter Cherries", "good", "Snipe Kagari / Multirole"),
                 ("Lightning Storm", "good", "Their set Mecha Spells")],
  },
  "white-forest": {
    "name": "White Forest (Azamina)", "tier": "tier1",
    "how": "Synchro Spellcasters/Illusions whose Special Summons + Sinful Spoils cards trigger White Forest spells to grind, then lock you out with a stacked multi-disruption board. Azamina splash adds a recyclable negate (Ilia Silvia).",
    "endboard": ["Azamina Ilia Silvia", "Chaos Angel", "S:P Little Knight", "Sinful Spoils of the White Forest"],
    "theirs": "Imperm/Ash the early starter (Elzette / Silvy) before it converts into multiple bodies; Droll & Lock Bird chokes the repeated searching; Ash the Ilia Silvia / Hallowed Azamina line to deny the recyclable negate. They run cards that turn your DEAD handtraps into fuel, so one handtrap rarely ends them.",
    "first": "Play around Ilia Silvia's omni-negate (it costs a tribute — bait it on a non-essential effect first), then resolve your payoff. Expect a non-targeting banish (Chaos Angel / S:P), so don't rely on one fragile board piece.",
    "second": "Clear the omni-negate (Ilia Silvia) first — bait or remove WITHOUT targeting. Use NON-targeting / NON-destruction removal (their Synchros gain protection from Rciela / Illusion effects): Kaiju, Lava Golem, send/banish, or Evenly Matched. Avoid pure destruction. Watch Silvera's Book of Eclipse flipping your board face-down.",
    "counters": [("Droll & Lock Bird", "good", "Chokes the search loop"),
                 ("Ash Blossom & Joyous Spring", "good", "On Elzette / Silvy / Hallowed Azamina"),
                 ("Effect Veiler", "good", "Cleaner than Imperm — they fuel off Imperm"),
                 ("Evenly Matched", "good", "They hold multiple cards"),
                 ("Forbidden Droplet", "good", "Non-targeting out")],
  },
  "elfnote": {
    "name": "Elfnote", "tier": "tier1",
    "how": "'Singer' fairies shuffle into the center zone to trigger + Synchro-climb. Elfnote Power Patron raises a center monster's Level +3 and immediately Synchro Summons — laddering into a wall of Synchro negates capped by Junora's WIDE field-negate.",
    "endboard": ["Junora the Power Patron of Tuning", "Elfnote Seraphim Strelitzia", "Baronne de Fleur", "Rhapsodia of Madness"],
    "theirs": "Elfnote Power Patron is the linchpin (Level-up + immediate Synchro + searches an Elfnote). Imperm/Veiler/Ash it or the first center-zone trigger BEFORE Junora's wide negate comes online. Maxx C / Droll / Fuwalos wreck it (over-extends + searches a lot).",
    "first": "Junora negates your whole FACE-UP field, not one card — so commit interruption as SET/face-down disruption (set traps, held handtraps), NOT a face-up negate they'll shut off. Force them to use Power Patron early, then handtrap it.",
    "second": "Junora only negates EFFECTS of face-up cards — stats remain, so ATTACK over it or use battle/removal that doesn't activate into the negate. Non-chain removal (Lava Golem / Kaiju tribute) works around it. Clear Junora/Strelitzia first (they protect + rebuild). Forbidden Droplet (non-targeting) is strong.",
    "counters": [("Maxx \"C\"", "good", "It over-extends hard"),
                 ("Droll & Lock Bird", "good", "It searches a lot"),
                 ("Nibiru, the Primal Being", "good", "Heavy Special Summoning"),
                 ("Effect Veiler", "good", "On Power Patron"),
                 ("Forbidden Droplet", "good", "Non-targeting board breaker")],
  },
  "power-patron": {
    "name": "Power Patron", "tier": "tier2",
    "how": "Pendulum-flavored Fusion ladder — Medius the Pure adds/Special Summons Artmage Power Patron, Fusion-summons up the line, closes on Nerva (destruction-immune while a Field Spell is active) + the Nervedo Pendulum negate. Usually the Power Patron Artmage hybrid.",
    "endboard": ["Nerva the Power Patron of Creation", "Medius the Pure", "Artmage Power Patron"],
    "theirs": "Ash Blossom / Droll & Lock Bird on Medius the Pure (the search that assembles the Fusion line) — the two best counters. Imperm/Veiler on Medius or the first Power Patron. Disrupting the Field Spell strips Nerva's destruction immunity.",
    "first": "Their main interaction (Nervedo negate) triggers off THEIR plays, so on your turn you mostly fear held handtraps, not a board negate. Set up normally; just don't walk a key effect into a held negate, and be ready to remove the Field Spell next turn.",
    "second": "Nerva is destruction-immune ONLY while a card is active in the Field Spell Zone — clear/disable the Field Spell first (Cosmic Cyclone, Feather Duster), OR just use NON-destruction removal (banish/bounce/Kaiju/Lava Golem) to ignore the immunity. Remove Nerva, then the support.",
    "counters": [("Ash Blossom & Joyous Spring", "good", "On Medius the Pure"),
                 ("Droll & Lock Bird", "good", "Best vs the search engine"),
                 ("Nibiru, the Primal Being", "good", "Multi-SS Fusion lines"),
                 ("Cosmic Cyclone", "good", "Pop the Field Spell -> strips Nerva immunity"),
                 ("Lava Golem", "good", "Tribute Nerva away (ignores immunity)")],
  },
  "artmage": {
    "name": "Artmage", "tier": "tier2",
    "how": "Same shell as Power Patron — Medius the Pure + Artmage Power Patron Fusion line into Artmage Fusion monsters/traps for negation. Pure-Artmage as its own top deck is largely unverified; treat as the Power Patron Artmage hybrid.",
    "endboard": ["Nerva the Power Patron of Creation", "Medius the Pure", "Artmage Power Patron"],
    "theirs": "Ash/Droll Medius the Pure (the search that assembles the Fusion). Veiler/Imperm the first Artmage or Power Patron effect to stop the Fusion + negate sequence.",
    "first": "Their negate triggers off responding to their OWN effects — play around held handtraps rather than a board negate. Bait the Artmage negate trap with a non-essential effect, then resolve your payoff.",
    "second": "Use non-destruction removal (boss leans on Field-Spell destruction immunity) — banish/bounce/tribute. BEWARE the Artmage trap that bounces ALL your Spells/Traps to hand if they control 3+ monster Types — don't over-rely on backrow. Clear the Field Spell, then remove the boss.",
    "counters": [("Ash Blossom & Joyous Spring", "good", "On Medius"),
                 ("Droll & Lock Bird", "good", "On the search engine"),
                 ("Nibiru, the Primal Being", "good", "Multi-SS Fusion lines"),
                 ("Cosmic Cyclone", "good", "Pop the Field Spell"),
                 ("Lava Golem", "good", "Tribute the boss away")],
  },
  "radiant-typhoon": {
    "name": "Radiant Typhoon", "tier": "tier1",
    "how": "Quick-Play-Spell control/grind — its monsters trigger off activating quick-plays (Super Poly, Forbidden Droplet, Called by). Grinds with searchers + a monster-negate boss, recycles quick-plays, wins the long game. Often a Runick hybrid.",
    "endboard": ["Varuroon", "Radiant Typhoon Mandate", "Totem Bird", "Shiina, Twin Tempests of Celestial Thunder"],
    "theirs": "Imperm/Ash Radiant Typhoon Krosea (the double-searcher) and Meghala (the ONLY card that Special Summons from Deck) — deny those and the setup chokes. Ash also hits their search triggers.",
    "first": "They're reactive control holding quick-play breakers (Super Poly, Forbidden Droplet/Crown) — DON'T over-commit into Super Polymerization. Diversify your monster types/attributes to dodge Super Poly, keep a follow-up, and play around Varuroon's monster-effect negate + Mandate (turns MST into an omni-negate).",
    "second": "Watch Shiina (their breaker: a monster trigger bounces all face-up monsters except itself; a S/T trigger bounces all S/T). Respect their set Spells. Bait Varuroon's monster-effect negate first, then deal with backrow. Denko Sekka / Anti-Spell Fragrance / Anti-Magic Arrows shut down their Spell-heavy plan.",
    "counters": [("Ash Blossom & Joyous Spring", "good", "On Krosea / Meghala"),
                 ("Infinite Impermanence", "good", "On Krosea / Meghala"),
                 ("Denko Sekka", "good", "Shuts their set Spells"),
                 ("Anti-Spell Fragrance", "good", "Taxes their Spell-heavy plan"),
                 ("Droll & Lock Bird", "good", "Vs the searching")],
  },
}


# ── DEEP overlay (researched May 2026 from YCS Columbus top cut + Nationals;
#    deep-research pass). Merged OVER INTEL, so these override the shallow
#    fields and add comboLine + weaknesses. Keyed by slug. ──
DEEP = {
  "branded": {
    "comboLine": "Aluber → search Branded Fusion → Branded Fusion (Albaz + a DARK/LIGHT fodder from hand/deck) into Mirrorjade, or Albion the Sanctifire to chain more Branded spells; set Branded Banishment for an opponent-turn fusion + recovery.",
    "theirs": "Branded Fusion is the dream Ash — but good players BAIT it with Aluber / Frightfur Patchwork / Branded Opening first, so hold Ash for the actual Branded Fusion resolution (the fuse-from-deck). Second target: Imperm on Albion's fusion-extender mid-combo. Droll only lands if BEFORE Branded Fusion is searched.",
    "weaknesses": "Midrange, not explosive — loses the race to faster combo (Kewl Tune / Artmage) if it can't land Mirrorjade + backrow. Nibiru mid-combo (5+ summons), Droll before Branded Fusion, and non-targeting outs (Droplet / Evenly) all hurt.",
  },
  "dracotail": {
    "comboLine": "Normal Lukias → add Faimena → discard Faimena (Quick — works on EITHER turn) to Fusion Summon; Lukias/Pan as material SET Dracotail traps (Pan also destroys) → Arthalion (bounces, self-revives) + Branded Fusion for Mirrorjade. Gulamel = a free pop on EVERY Dracotail activation.",
    "theirs": "Ash Branded Fusion (free Mirrorjade) or Ketu's search; Imperm Lukias (starves the set-trap fuel) or Arthalion's bounce. Faimena fuses on YOUR turn from hand — a board they 'pass' still interrupts you.",
    "second": "Neutralise GULAMEL first (it pops a card every time you start a play). Then out Mirrorjade via Droplet / Kaiju / Evenly (NON-destruction). Dracotail Flame negates a Spell's effects — lead with monster/trap interaction, not Cyclone. BANISH their fusions (destroying them feeds the 2-cards-to-GY self-revive).",
    "weaknesses": "Banishment beats it (engine self-revives from GY); Nibiru mid-loop; a precise early Imperm on Lukias starves it; Droll before the search chain. Open Nibiru + Droplet/Evenly going second is its nightmare. (This is the YCS Columbus 2026 WINNING deck — respect it.)",
  },
  "predaplant": {
    "comboLine": "Predaprimitive (send a Predap to GY + tutor Polymerization; locks you to Plant/Dragon) or Verte Anaconda → spread Predator Counters (drop foes to Lv1) → Dragostapelia (negates effects of monsters carrying a counter) + Starving Venom Wing Dragon (sprays more counters) → climb to Predaplant Triphyovertum (negates Extra-Deck SS, gains ATK per counter, self-revives).",
    "theirs": "Ash Predaprimitive / Verte Anaconda (the Fusion-spell hubs); Imperm the first counter-engine fusion BEFORE counters land on your board. Nibiru on the climb to Triphyovertum.",
    "second": "Predator Counters negate YOUR monsters' effects — lead with Spell/Trap or non-monster-effect removal (Lightning Storm / Evenly / Droplet). BANISH or tribute Triphyovertum (it self-revives from GY) — don't destroy. Then clear Dragostapelia / Wing Dragon.",
    "weaknesses": "Reactive setup deck — one Ash/Imperm on Predaprimitive/Verte collapses the turn; slower than top combo; GY-banish hate stops Triphyovertum recursion. ROGUE in TCG (best evidence is an OCG regional Top 8).",
  },
  "lunalight": {
    "comboLine": "Black Sheep (discard → add a Lunalight S/T; banish from GY = Fusion substitute) + Polymerization → Perfume Dancer (search Tiger, recur) → Kaleido Chick sends material, Tiger revives → climb the Dance-Fusion ladder to Liger Dancer.",
    "theirs": "Ash Black Sheep or Kaleido Chick's deck-send (the consistency hubs). Imperm the fusion climb BEFORE Liger resolves — Liger is unaffected by non-Lunalight effects ONCE summoned. D.D. Crow/Belle on the GY loop / to pre-empt Crimson Fox.",
    "second": "Liger Dancer is UNAFFECTED by your non-Lunalight effects — targeted removal/negation does nothing. Out it with a TRIBUTE: Kaiju / Lava Golem (removes it as a cost). Don't waste targeting into an open GY Crimson Fox (it negates + refunds LP). Watch S:P banishing one of yours face-down.",
    "weaknesses": "Far better going SECOND than first — turn-1 interaction outside Liger / S:P is thin. Needs Polymerization live (Solemn / Poly-hate stalls it). Crushed by attribute/type hate (Shadow-Imprisoning Mirror, Archnemeses Protos, Bystials). ROGUE / locals-strong.",
  },
  "mitsurugi": {
    "comboLine": "Searcher (Saji / Aramasa — self-tributing floaters) → add Ame no Habakiri + Mitsurugi Prayers / Ritual → Ritual-Summon up to Ame no Murakumo (on Special Summon: Raigeki-style destroy, once/turn). Tributing Mitsurugi monsters triggers their GY floats, so it reloads as it combos.",
    "theirs": "Droll & Lock Bird is the single best card — after their FIRST search, Droll halts Prayers / Ritual / the second searcher. Ash the first searcher (Saji/Aramasa) or Prayers/Ritual. NOTE Murakumo's destroy is NOT Ash-able — spend Ash early.",
    "second": "Saji/Aramasa make the board destruction-RESISTANT — Lightning Storm / Raigeki / DRNM are blanks. Break with NON-destruction: tribute (Kaiju / Underworld Goddess), banish, or bounce. Bait Murakumo with a throwaway, then push.",
    "weaknesses": "Search-dependent — Droll + double handtraps choke it; lower disruption density than top combo; Special-Summon / Ritual-lock floodgates gut it; non-destruction removal walks through its protection. (YCS Columbus 2026 Top 8.)",
  },
  "mitsurugi-ryzeal": {
    "comboLine": "Ryzeal starter → Rank-4 / King of the Feral Imps (the BRIDGE) → fetch the Mitsurugi enabler → run the ritual chain (Habakiri → Murakumo) AND bank Ryzeal Detonator (free repeatable destroy). Ends ~ Murakumo + Detonator + a Caesar/Photon negate + traps.",
    "theirs": "Ash/Imperm ICE Ryzeal or King of the Feral Imps (the bridge into the Mitsurugi half) — denying it collapses the hybrid to half a deck. Droll after the first add. Nibiru on the summon-heavy line.",
    "second": "Same Mitsurugi caveat — NON-destruction (tribute/banish) gets under the protected Ritual bodies. Detonator is a destroy effect — clear it FIRST or play around it (don't feed it). Mass non-targeting after baiting.",
    "weaknesses": "Combos through a NARROW bridge (King of the Feral Imps / the enabler) — handtrap that point and it folds. Droll brutal (two search engines). Extra-Deck-reliant (Droplet / ED hate bites).",
  },
  "clown-crew": {
    "comboLine": "Special Summon Clown Crew monsters from Deck/Extra Deck ignoring conditions (they are EFFECT-LOCKED until the end of the next turn) → use them as TRIBUTE for Clown Crew Biancaviso + a Vanity-style Special-Summon floodgate. Grinds behind the SS-lock.",
    "theirs": "Ash/Imperm the engine card that GENERATES the tribute fuel — NOT the locked fuel monsters (their effects are off). Handtrap BEFORE the floodgate resolves; once 'cannot Special Summon' is live, YOUR Special-Summon handtraps are dead too.",
    "second": "The lock is a Special-Summon floodgate — DON'T fight it with Special Summons. EVENLY MATCHED is the premier out (non-SS, non-targeting, banishes their board face-down to 1). DRNM / Droplet turn off the body. ⚠ Kaiju / Lava Golem REQUIRE a Special Summon — DEAD if the lock is 'neither player' (verify Biancaviso's wording). Clear the floodgate first, then commit SS.",
    "weaknesses": "Low turn-1 disruption beyond the floodgate (the summoned fuel is effect-locked) — break the lock and the board is fairly inert. Evenly Matched is a near-clean answer. Early Ash/Imperm on the engine stops the plan before the lock exists.",
  },
  "vanquish-soul": {
    "comboLine": "VS monsters (all EARTH / FIRE / DARK) reveal monsters in hand for attribute effects; Razen searches; Stake your Soul! / VS Start! tutor. Heavy Borger / Caesar Valius SS themselves by returning a VS of a different Type. The K9 half bolts on a reactive Rank-5 Xyz toolbox (Ripper / Izuna / Lupus) that punishes the opponent's monster-effect activations.",
    "theirs": "⚠ The K9 half KEYS OFF your monster-effect activations from hand/GY — firing a MONSTER handtrap (Ash / Veiler) can arm K9-17 Ripper + ambush-summon Izuna/Lupus. PREFER Infinite Impermanence (a Trap). Ash Razen / Stake / Start (the search shell) deliberately.",
    "second": "VS bodies are destruction-vulnerable UNLESS Caesar revealed EARTH (then unaffected that turn) — if so, attack over it / wait a turn. Evenly Matched is great (non-targeting). Answer the K9 reactive Xyz FIRST (it's the on-your-turn negate), then the VS boss.",
    "weaknesses": "Grind/control with a modest turn-1 board — combo decks that go UNDER it deny K9 its triggers; it must HOLD reveal fodder; Spell/Trap interaction (Imperm / Evenly / Droplet) avoids feeding K9; Dimension Shifter hurts K9's GY summons. Strong-rogue post-banlist, not Tier-1.",
  },
  "maliss": {
    "comboLine": "Maliss <P> White Rabbit (Normal/SS → SET a Maliss Trap from Deck) → activate that <C> trap THE TURN it's set by banishing a face-up Maliss (which self-revives — free bodies): TB-11 SS from Deck, GWC-06 search + banish, MTP-07 revive → climb to the Queens (Hearts Crypter). The @Ignister package turns leftover bodies into Accesscode / extra Links.",
    "theirs": "Droll is the single best card — drop after their FIRST add/search to collapse the loop. Ash the first <C> trap that SS/searches from Deck (TB-11 / GWC-06). Imperm White Rabbit ON SUMMON (deny the trap set) before a Link exists. They bait with a lesser Maliss — hold for the real set-from-Deck trap.",
    "second": "Hearts Crypter's banish CAN'T be negated while it points to a monster — disrupt on activation/cost or remove it before you commit. Clear the set <C> traps FIRST (remove their on-board Maliss to brick them). Lightning Storm / Evenly are strong; banish-pile hate is WEAK (they recur from banish).",
    "weaknesses": "Post-banlist consistency is shakier; DROLL completely walls it (it adds repeatedly); the turn-1 board is low-impact without @Ignister; folds to spot removal of its on-board Maliss (bricks the <C> traps).",
  },
  "yummy": {
    "comboLine": "Yummy core (Marshmao SS's itself if you control no / only-LIGHT-Beast; Cooky/Cupsy swarm + dig) → pivot to Fiendsmith: Tract (search a LIGHT Fiend + discard; GY-banish to Fusion) → Requiem → tribute to SS Engraver from Deck, equip → Necroquip Princess → Sequence shuffles Lacrima + 2 Engraver for Desirae (negate). Azamina adds Ilia Silvia.",
    "theirs": "Ash Fiendsmith's Tract (the search + GY-Fusion enabler) — highest value. Imperm Engraver (the equip hub). Yummy Snatchy's Field-Spell placement CANNOT be Ash'd. Belle / Mulcharmy Purulia punish the GY-Fusion engine.",
    "second": "No-negate sweepers shine — Dark Ruler No More / Forbidden Droplet turn off the Fusion negates. Bystials banish their LIGHT Fiendsmith GY. Lead NON-targeting (dodges S:P's banish + Desirae protection), then clear S:P, and watch Lacrima's quick summon on your turn.",
    "weaknesses": "GY-DEPENDENT — Dimension Shifter / macro is brutal; handtrap-vulnerable at the Fiendsmith pivot (Ash on Tract / Imperm on Engraver stops the disruption suite); Droll mid-combo; Nibiru on the multi-summon turn.",
  },
  "fairy-tail-magistus": {
    "comboLine": "Fairy Tail (Lv4 Spellcasters + the unbanned Snow; Wiccat 'double Foolish' dumps Snow) feeds Magistus: equip Artemis → add Crowley → SS Crowley → Xyz Rilliona → SS Zoroa of Flame → Synchro into Zoroa of Daimon (Extra-Deck-effect floodgate), recurring Crowley/Rilliona to re-equip Magistus.",
    "endboard": ["Zoroa, the Magistus of Daimon", "Teller of the Magistus", "Zoroa, the Magistus Verethragna", "Fairy Tail - Snow"],
    "theirs": "Ash the Fairy Tail / Wiccat dump or the Artemis → Crowley add (the consistency hinges). Imperm Crowley or Rilliona (breaks the Xyz → Synchro Zoroa chain → no Daimon floodgate). HOLD your handtrap for the Magistus pivot, not the Fairy Tail opener. Droll the search loop.",
    "second": "Zoroa of Daimon LOCKS your Extra Deck — prioritise MAIN-DECK / non-ED outs (Lightning Storm, Evenly, Raigeki-effects). Remove Daimon FIRST (it gates your whole strategy), bait the second Zoroa's negate+pop with a non-essential card, and clear the Field Spell before committing your ED.",
    "weaknesses": "Combo-fragile — one Imperm/Ash at the Crowley/Rilliona pivot leaves only Fairy Tail bodies. Soft going first if it draws too many Fairy Tail bricks. Lightning Storm / Evenly / Cosmic cleanly answer the Zoroa board. Modest raw damage.",
  },
  "sky-striker": {
    "comboLine": "It's a SETUP turn, not a combo: dump 3+ Spells to GY (Engage etc.), keep your OWN monster zones EMPTY (Spells get bonuses when you control no monsters), end on Shizuku + 4–5 set Spells (Widow Anchor / Shark Cannon / Eagle Booster) + Multirole. Raye flips to Kagari (recur Engage) / Shizuku (search) reactively.",
    "theirs": "Droll & Lock Bird is the premier answer (chokes the Engage → Kagari add-loop); Ash the first Engage. Imperm is WEAK (their power is Spell-based, few monster targets). Cursed Seal of the Forbidden Spell permanently locks Engage.",
    "first": "Forcing a monster onto THEIR field genuinely matters — most Sky Striker Quick-Plays need them to control NO monsters, so a Kaiju / Lava Golem / token shuts off Widow Anchor + Afterburners on your turn. Set up normally; bait Widow Anchor with a non-essential monster.",
    "second": "Low board to 'break' — fight over resources + backrow. Clear MULTIROLE first (it shields + reloads their Spells), then the set Mecha Spells (Widow Anchor → Afterburners). Anti-Spell Fragrance / Imperial Order are the hardest counters.",
    "endboard": ["Sky Striker Ace - Shizuku", "Sky Striker Mecha Modules - Multirole", "Sky Striker Mecha - Widow Anchor", "Sky Striker Mecha - Shark Cannon"],
    "weaknesses": "Grind deck with a LOW ceiling — loses to multi-negate boards it can't out one Spell at a time, and to Anti-Spell Fragrance / Imperial Order (its whole deck is Spells). Heavy backrow removal + going-second OTKs that ignore its low board hurt.",
  },
  "elfnote": {
    "comboLine": "Elfnote 'Singer' fairies (Lucina / Tinia / Regina / Fortuna) + the Power Patron engine (Elfnote Power Patron, Medius the Pure, Terminus portal) Synchro-climb through the Resonator / Red-Dragon-Archfiend package into RDA / Crimson King / Crystal Wing + Junoldo, recurring with Welcome Home / Rhapsodia traps.",
    "theirs": "Imperm/Veiler/Ash Elfnote Power Patron or Medius the Pure (the Synchro/Fusion enablers) BEFORE the negate wall comes online. Droll after the first search. Ghost Belle on the GY recursion. (NOTE: this is the current Blazing Dominion build WITH 3× Regina.)",
    "first": "Commit interruption as SET / face-down disruption — they end on multiple Synchro negates (omni-negates like Baronne / Crystal Wing). Force Power Patron out early, then handtrap it.",
    "second": "Clear the omni-negate (Baronne / Crystal Wing) first; use non-targeting / non-destruction, or just attack over the negate body once it's spent. Lava Golem / Nibiru side in; Evenly / DRNM / Droplet (the list itself fears these).",
    "endboard": ["Red Dragon Archfiend", "Crystal Wing Synchro Dragon", "Elfnote Seraphim Strelitzia", "Elfnotes: Rhapsodia of Madness"],
    "weaknesses": "Over-extends + searches a LOT — Maxx C / Droll / Fuwalos / Purulia wreck it (the list mains 3 Fuwalos + 2 Droll ITSELF). Bystials hit its DARK/LIGHT Synchro GY. Nibiru on the climb.",
    "counters": [("Maxx \"C\"", "good", "It over-extends + searches hard"),
                 ("Droll & Lock Bird", "good", "Chokes the search loop"),
                 ("Nibiru, the Primal Being", "good", "Heavy Special Summoning on the climb"),
                 ("Bystial Druiswurm", "good", "Banish its DARK/LIGHT Synchro GY"),
                 ("Forbidden Droplet", "good", "Non-targeting board breaker")],
  },
  "white-forest": {
    "comboLine": "White Forest spells (Silvy / Elzette / Rciela) trigger off Synchro Summons + Sinful Spoils to grind cards, Synchro-climbing (Diabellstar / Azamina) into negates + non-targeting banish; the Azamina splash adds Ilia Silvia (a recyclable omni-negate).",
    "theirs": "Imperm/Ash the early starter (Elzette / Silvy) before it converts into multiple bodies; Droll the search loop; Ash the Ilia Silvia / Hallowed Azamina recycle. Effect VEILER is cleaner than Imperm (they fuel off Imperm).",
    "first": "Bait Ilia Silvia's omni-negate (it costs a tribute) on a non-essential effect, then resolve your payoff; expect a non-targeting banish (Chaos Angel / S:P) so don't rely on one fragile piece.",
    "second": "Clear the omni-negate first. NON-targeting / NON-destruction removal (Kaiju, Lava Golem, send/banish, Evenly) — avoid pure destruction (their Synchros gain protection). Watch Silvera's Book of Eclipse flipping your board face-down.",
    "endboard": ["Azamina Ilia Silvia", "Chaos Angel", "S:P Little Knight", "Sinful Spoils of the White Forest"],
    "weaknesses": "Turns your DEAD handtraps into fuel, so ONE rarely ends them — but Droll chokes the search loop, non-targeting/non-destruction is needed, and Bystials hit their GY.",
  },
  "power-patron": {
    "comboLine": "Medius the Pure adds/SS Artmage Power Patron → Fusion-summon up the Power Patron ladder (Vidolium / Nervedo) → Nerva the Power Patron of Creation (destruction-immune while a card is active in the Field Spell Zone) + the Nervedo Pendulum negate; Artmage Fusion/traps add negation. (YCS Columbus 2026 Top 8.)",
    "weaknesses": "Reactive — its negate triggers off ITS plays, so on YOUR turn you mostly fear held handtraps. Ash / Droll on Medius collapses it. Clearing the Field Spell strips Nerva's immunity.",
  },
  "artmage": {
    "comboLine": "Same shell as Power Patron — Medius the Pure + Artmage Power Patron Fusion line into Artmage Fusion monsters/traps for negation, closing on Nerva + the Nervedo negate. (The YCS Columbus Top 8 deck was 'Power Patron Artmage'.)",
    "weaknesses": "Reactive Fusion ladder — Ash/Droll on Medius collapses it; clear the Field Spell to strip Nerva's destruction immunity; the Artmage trap that bounces all your S/T (with 3+ monster Types) means don't over-rely on backrow.",
  },
  "radiant-typhoon": {
    "comboLine": "Radiant Typhoon + Sky Striker HYBRID (YCS Columbus Top 4) — quick-play Spells (Super Poly, Droplet, MST) trigger Radiant Typhoon monsters; the Sky Striker engine (Engage) draws + grinds. Ends on a low board with set Spells + a monster-negate boss; Mandate turns MST into an omni-negate.",
    "theirs": "Imperm/Ash Radiant Typhoon Krosea (the double-searcher) AND the Sky Striker Engage — deny the searchers and the grind chokes. Droll the search loop.",
    "first": "DON'T over-commit into Super Polymerization — diversify monster types/attributes to dodge it. Play around Varuroon's monster-negate + Mandate (MST omni-negate). Forcing a monster onto their field hurts the Sky Striker half (Quick-Plays want them with no monsters).",
    "second": "Clear set Spells / Multirole; Anti-Spell Fragrance + Denko Sekka shut their Spell plan down hard. Bait Varuroon's negate, then push.",
    "endboard": ["Varuroon", "Radiant Typhoon Mandate", "Sky Striker Ace - Shizuku", "Sky Striker Mecha - Widow Anchor"],
    "weaknesses": "Control/grind — loses to multi-negate boards and to Anti-Spell Fragrance (Spell-heavy). It folds if its searchers (Krosea / Engage) are denied.",
  },
}


def merged_intel(slug):
    out = dict(INTEL.get(slug, {}))
    out.update(DEEP.get(slug, {}))
    return out


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


def deck_obj(name, slug, ydk_text, main, extra, side, intel):
    counts = {"main": len(main), "extra": len(extra), "side": len(side),
              "total": len(main) + len(extra) + len(side)}
    dl_id = "dl_meta_" + slug + "_main"
    endboard_summary = ", ".join(intel.get("endboard", []))
    return {
        "deckId": "deck_meta_" + slug, "name": name, "role": "matchup",
        "ydkContent": ydk_text, "counts": counts,
        "main": main, "extra": extra, "side": side,
        "decklists": [{"decklistId": dl_id, "name": "Main build", "ydkContent": ydk_text,
                       "counts": counts, "main": main, "extra": extra, "side": side,
                       "notes": "", "createdAt": TS, "updatedAt": TS}],
        "primaryDecklistId": dl_id,
        "methodology": {"summary": intel.get("comboLine", ""), "endboard": endboard_summary,
                        "howItWins": intel.get("how", ""),
                        "strengths": "", "weaknesses": intel.get("weaknesses", ""),
                        "keyRatios": "", "techCards": []},
        "keyCards": [], "source": "meta-import",
        "notes": "Imported from a ygoprodeck tournament list (May 2026). Refine as the meta shifts.",
        "createdAt": TS, "updatedAt": TS,
        # _contentHash intentionally omitted (matchup decks bypass dedup)
    }


def matchup_obj(slug, intel):
    return {
        "matchupId": "m_meta_" + slug, "opponentDeckId": "deck_meta_" + slug,
        "tier": intel.get("tier", "tier1"),
        "howTheyWin": intel.get("how", ""),
        "gameplanFirst": intel.get("first", ""),
        "gameplanSecond": intel.get("second", ""),
        "keyTargets": [], "techCardsThatShine": [],
        "counterCards": [{"name": n, "side": s, "notes": note}
                         for (n, s, note) in intel.get("counters", [])],
        "relatedComboIds": [], "freeformNotes": "",
        "chokepointTheirs": intel.get("theirs", ""), "chokepointOurs": "",
        "comboLine": intel.get("comboLine", ""),
        "weaknesses": intel.get("weaknesses", ""),
        "priorityFirst": [], "prioritySecond": [],
        "targetEndboard": list(intel.get("endboard", [])),
        "sideboard": {"goingFirst": {"in": [], "out": []}, "goingSecond": {"in": [], "out": []}},
    }


def main():
    files = sorted(glob.glob("meta-decks/*.ydk"))
    decks, matchups = [], []
    for f in files:
        slug = os.path.splitext(os.path.basename(f))[0]
        intel = merged_intel(slug)
        name = intel.get("name") or slug.replace("-", " ").title()
        m, e, s = parse(f)
        ydk = open(f, encoding="utf-8").read()
        decks.append(deck_obj(name, slug, ydk, m, e, s, intel))
        matchups.append(matchup_obj(slug, intel))
    fmt = {
        "formatId": "fmt_meta_may2026", "name": "Meta - May 2026",
        "startDate": "2026-05-01", "endDate": None, "primaryDeckId": None,
        "matchups": matchups, "tournaments": [],
        "notes": "Auto-built from ygoprodeck tournament lists + researched strategy "
                 "(see docs/META_2026-05.md). Pick your deck as primary, then refine "
                 "each matchup. Each opponent's typical end board is pre-filled — open "
                 "Testing -> Going second to practise breaking it.",
        "createdAt": TS, "updatedAt": TS,
    }
    backup = {"version": 1, "exportedAt": TS, "appBuild": "meta-import",
              "metaVersion": META_VERSION,
              "counts": {"decks": len(decks), "combos": 0, "cachedCards": 0},
              "data": {"decks": decks, "formats": [fmt], "activeFormatId": "fmt_meta_may2026"}}
    out = "meta-decks/meta-matchups-backup.json"
    json.dump(backup, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("Wrote", out, "-", len(decks), "matchup decks +", len(matchups), "fully pre-filled matchups")


if __name__ == "__main__":
    main()
