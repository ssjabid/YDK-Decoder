// ───────────────────────────────────────────────────────────────────
// Card breakdowns — curated, plain-English "in short" summaries to make
// each card easy to understand + memorize. The full Konami text always
// shows from the API; this is the simplified memorization layer (ported +
// extended from the HTML app's CARD_FX). Keyed by exact card name.
//
// PRINCIPLE: accuracy over coverage — only cards whose effect is confirmed
// get a summary. Unsummarised cards fall back to their full text. Grow this
// by adding lines; no logic changes needed.
// ───────────────────────────────────────────────────────────────────
export const CARD_FX = {
  // ── DoomZ / Power Patron (the user's deck + meta Power Patron/Artmage) ──
  "Medius the Pure": "On Normal/Special Summon: SS 1 \"Power Patron\" from Deck. In GY: shuffle 1 monster (hand/field) into Deck → SS itself (banished when it leaves). Each once/turn.",
  "Power Patron DoomZ": "Locks Extra Deck to Xyz only. Target 1 other Effect Monster you control → SS a \"DoomZ\" Xyz of equal Rank using it as material, equip this to it. If destroyed: add 1 \"DoomZ\" from Deck. Each once/turn.",
  "DoomZ XII Zero - Drastea": "Target a \"DoomZ\" you control, destroy it → SS this from hand + equip an Equip Spell from Deck. While equipped (Quick): make a WIND Machine Xyz using this + its equips. Each HOPT.",
  "DoomZ V Five - Amalthe": "On Summon or when destroyed by effect: add 1 \"DoomZ\" monster from Deck (not Amalthe). While equipped (Quick): make a WIND Machine Xyz. The main searcher / 1-card starter. Each HOPT.",
  "DoomZ VII Seven - Elara": "On Summon or when destroyed: Set 1 \"DoomZ\" Spell/Trap straight from Deck. While equipped (Quick): make a WIND Machine Xyz. Each HOPT.",
  "DoomZ Raiders": "Continuous Spell. Destroy a \"DoomZ\" in hand/field → take a \"DoomZ\" monster from Deck (hand or SS), then Extra Deck is Xyz-only. If destroyed: pop a face-up monster. 1 of 2 effects/turn.",
  "DoomZ Change": "Normal Spell. Destroy a \"DoomZ\" in hand/Deck/field. If destroyed by effect: add a \"DoomZ\" from GY → SS a \"DoomZ\" from hand. Each HOPT.",
  "DoomZ Destruction": "Trap. Equip to a \"DoomZ\" Xyz: opponent can't add Main-Deck cards to hand except by drawing. If destroyed: equip a \"DoomZ\" monster from Deck to your monster. The floodgate piece.",
  "Jupiter the Power Patron of Destruction": "Xyz boss (3× Lv10, or over a 3-equip monster). Gains 3000 ATK with material. Detach 1: SS a \"DoomZ\" from GY → destroy a card. The finisher.",
  "Nerva the Power Patron of Creation": "Power Patron Fusion boss — destruction-immune while a card is in the Field Spell Zone. Clear/disable the Field Spell, OR use non-destruction removal, to out it.",

  // ── Generic Extra-Deck bosses / breakers ──
  "Divine Arsenal AA-ZEUS - Sky Thunder": "Xyz (2× Lv12, or over any Xyz that battled). Detach 2 → send ALL other cards on the field to GY. The premier board wipe / mirror-breaker.",
  "Super Starslayer TY-PHON - Sky Crisis": "Xyz (2× Lv12) you can drop if the opponent made 2+ Extra-Deck SS. Floodgate: neither player can use effects of 3000+ ATK monsters. Detach 1: bounce a monster. Caps the board + locks your summons.",
  "Varudras, the Final Bringer of the End Times": "Xyz (2+ Lv10). Quick: detach 1 → negate a card/effect, then optionally detach 1 more → destroy a card. Negates on attack + on its own destruction. A multi-negate boss.",
  "Baronne de Fleur": "Synchro (Lv10). Once: negate + destroy a card/effect. Once: target + destroy a card. Recurs a monster from GY. Generic omni-negate.",
  "Chaos Angel": "Synchro (Lv10) — non-targeting banish of a face-up card (each turn), and Synchros it points at gain protection. Out it with non-targeting/non-destruction.",
  "S:P Little Knight": "Link-2 — on summon banish a card face-down (yours + theirs) until end of turn; also banishes a monster during interaction. Generic disruption.",
  "Accesscode Talker": "Link-4 finisher — repeatedly banish from GY to destroy cards by attribute; big direct damage. The OTK button.",
  "Red-Eyes Dark Dragoon": "Fusion boss — Spell/Trap + monster-effect negate (destroy), and a burn/attack-gain. Out it with non-destruction.",

  // ── Handtraps ──
  "Ash Blossom & Joyous Spring": "Discard → negate a card/effect that adds from Deck to hand, SS from Deck, or sends Deck→GY. The universal anti-search/anti-SS handtrap. Once/turn.",
  "Maxx \"C\"": "On the opponent's turn: reveal → every time they Special Summon, you draw 1 (rest of turn). Punishes combo decks for going off. Once/turn.",
  "Effect Veiler": "Quick: discard → negate the effects of 1 face-up monster the opponent controls (this turn). Stops a key combo monster. Once/turn.",
  "Ghost Belle & Haunted Mansion": "Discard → negate an effect that uses the GY (targets it, banishes from it, or revives). Great vs GY engines. Once/turn.",
  "Ghost Ogre & Snow Rabbit": "When a face-up card activates an effect: send this (hand/field) → destroy that card. Flexible spot removal. Once/turn.",
  "Ghost Mourner & Moonlit Chill": "Quick: discard → a face-up SPECIAL-Summoned monster the opponent controls has its effects negated; if it later leaves, they take damage. Once/turn.",
  "Infinite Impermanence": "Negate 1 face-up monster's effects (until end of turn); if Set + discarded, also locks Spell/Trap effects in that column. A Trap — slips past in-hand negates. Once/turn.",
  "Droll & Lock Bird": "After a card is added from the Main Deck to hand (Quick): discard → NOBODY can add from the Main Deck to hand the rest of the turn. Wrecks search engines. Once/turn.",
  "Nibiru, the Primal Being": "If the opponent summoned 5+ this turn (your... their turn): tribute ALL their face-up monsters → SS a big token to them. Punishes long combos. Once/turn.",
  "D.D. Crow": "Discard → banish 1 card in a GY. Stops GY revival / fuel. Once/turn.",
  "Skull Meister": "Discard → negate an effect activating in the GY (and destroy it). Once/turn.",
  "Mulcharmy Fuwalos": "If your hand is empty and the opponent SS 2+ on their turn: reveal → draw up to 5 (drawn monsters get locked out). Anti-combo draw engine. Once/turn.",
  "Mulcharmy Purulia": "If the opponent adds 2+ from the Main Deck on their turn (not by drawing): reveal → draw (special rules). Anti-search draw engine. Once/turn.",
  "PSY-Framegear Gamma": "If you control no monsters: target a monster effect the opponent just activated → negate + destroy it, and SS this + PSY-Frame Driver. A free negate (dodges Ash). Once/turn.",
  "Retaliating \"C\"": "If the opponent activates a Spell/Trap: SS this from hand → it becomes a pseudo-Dimension-Shifter (banish-instead). Anti-Spell decks. Once/turn.",
  "Dimension Shifter": "If your GY is empty and it's not your turn: send to GY → for this turn + the entire next turn, cards go to banishment face-down instead of the GY. Shuts off GY engines. Once/turn.",

  // ── Board breakers (going second) ──
  "Forbidden Droplet": "Send any number of other cards from hand/field → that many face-up monsters the opponent controls have their effects negated + lose ATK; the chain can't respond with the same card types. Non-targeting boss-breaker.",
  "Dark Ruler No More": "Negate the effects of ALL the opponent's face-up monsters this turn (they can't respond). No battle damage from those monsters this turn. The go-to 'turn off the negates' card.",
  "Evenly Matched": "End Phase (or going second), if you control fewer cards: opponent banishes their face-up cards until they have as many as you (their choice). Crushes wide boards. Non-targeting.",
  "Lightning Storm": "If you control no face-up cards: destroy all the opponent's face-up Attack-position monsters, OR all their Spells/Traps. Once/turn.",
  "Harpie's Feather Duster": "Destroy ALL Spells & Traps the opponent controls. The backrow nuke.",
  "Raigeki": "Destroy all monsters the opponent controls.",
  "Dark Hole": "Destroy all monsters on the field (both players).",
  "Super Polymerization": "Cost 1 card; Fusion Summon using monsters from BOTH fields as material — the opponent CANNOT respond. Eats their boss (non-targeting, non-destruction out).",
  "Book of Eclipse": "Set all face-up monsters face-down (both sides); at the End Phase their controllers draw 1 per monster flipped. Turns off negates for a turn / resets a board.",
  "Forbidden Crown": "Quick-Play. Until end of turn, 1 face-up monster: effects negated, can't attack/be destroyed/be tributed/be material, unaffected by other effects. A flexible protect-or-neuter. Once/turn.",
  "Triple Tactics Talent": "If the opponent used a monster effect on YOUR turn: draw 2, OR mind-control 1 of their monsters till the End Phase, OR peek their hand + take a card. Punishes handtraps. Once/turn.",
  "Triple Tactics Thrust": "If the opponent used a monster effect on your turn: add 1 'Normal Spell that searches'-type card (or a few archetype hubs) from Deck. Consistency tech. Once/turn.",
  "Cosmic Cyclone": "Pay 1000 LP → banish 1 Spell/Trap on the field. Hits continuous floodgates + Field Spells (banish dodges GY triggers).",

  // ── Counters / tech ──
  "Called by the Grave": "Banish 1 monster in the opponent's GY; its (and same-named cards') effects are negated until the end of next turn. The handtrap-counter.",
  "Crossout Designator": "Declare a card name; banish a copy from YOUR Deck → negate all effects of that card (incl. in hand) this turn. Universal handtrap-counter.",
  "Solemn Judgment": "Counter Trap. Pay half your LP → negate any Summon OR Spell/Trap activation and destroy it.",
  "Solemn Warning": "Counter Trap. Pay 2000 LP → negate a Summon (or an effect that summons) and destroy it.",

  // ── Floodgates ──
  "Skill Drain": "Continuous. Pay 1000 → negate the effects of all face-up monsters on the field while they're face-up. Shuts off effect-reliant decks.",
  "There Can Be Only One": "Continuous. Each player can control only 1 monster of each card Type (Spellcaster, Machine, etc.). Strangles Type-focused decks.",
  "Anti-Spell Fragrance": "Continuous. Spells must be Set first and can't activate until your next turn. Taxes Spell-heavy decks (Sky Striker / Runick) hard.",
  "Dimensional Barrier": "Trap. Declare 1 monster card type (Fusion/Synchro/Xyz/Link/Ritual/Pendulum); this turn neither player can summon that type, and its monsters' effects are negated. Combo-killer.",

  // ── White Forest (Azamina) — confirmed staples in the matchup ──
  "Diabellstar the Black Witch": "SS itself if you control no monster (or by sending a Spell/Trap). Sets a 'Sinful Spoils' card (like WANTED) from Deck. The engine's flexible starter / payoff.",
  "WANTED: Seeker of Sinful Spoils": "Sinful Spoils Spell — searches/recurs the Diabellstar package and SS Diabellstar. The consistency hub; Ash it.",
};

// Resolve a breakdown summary for a card name (exact match, lowercased fallback).
const _lc = {};
for (const k in CARD_FX) _lc[k.toLowerCase()] = CARD_FX[k];
export function getCardSummary(name) {
  if (!name) return null;
  return CARD_FX[name] || _lc[String(name).toLowerCase()] || null;
}
