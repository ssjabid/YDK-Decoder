// ───────────────────────────────────────────────────────────────────
// Curated card knowledge base — authored, accurate role/category tags for
// the cards the heuristic text-classifier gets wrong (handtraps that don't
// say "Quick Effect", board breakers, floodgates, generic Extra-Deck
// bosses). Keyed by EXACT lowercased YGOPRODeck name.
//
//   roles -> canonical roles for the stripe + preview chips
//   cat   -> key-card bucket (Boss/Starter/Extender/Handtrap/Floodgate/Tech)
//
// This is a maintained seed of the competitive staple pool (May 2026); it
// overrides classify() so these cards are always tagged correctly. Grow it
// as the format shifts — add a line per card, no logic changes needed.
// ───────────────────────────────────────────────────────────────────
const HT = (extra = []) => ({ roles: ["Handtrap", ...extra], cat: "Handtrap" });
const BB = () => ({ roles: ["Board breaker"], cat: "Tech" });
const FG = () => ({ roles: ["Floodgate"], cat: "Floodgate" });
const BOSS = () => ({ roles: ["Engine"], cat: "Boss" });
const TECH = (roles = ["Engine"]) => ({ roles, cat: "Tech" });

export const CARD_KB = {
  // ── Handtraps ──────────────────────────────────────────────────────
  "ash blossom & joyous spring": HT(),
  "maxx \"c\"": HT(),
  "ghost belle & haunted mansion": HT(),
  "ghost ogre & snow rabbit": HT(),
  "effect veiler": HT(),
  "infinite impermanence": HT(),            // trap handtrap
  "droll & lock bird": HT(),
  "nibiru, the primal being": HT(),
  "d.d. crow": HT(),
  "skull meister": HT(),
  "ghost mourner & moonlit chill": HT(),
  "mulcharmy fuwalos": HT(),
  "mulcharmy purulia": HT(),
  "mulcharmy meowls": HT(),
  "psy-framegear gamma": HT(),
  "psy-framegear delta": HT(),
  "retaliating \"c\"": HT(["Floodgate"]),
  "dimension shifter": HT(["Floodgate"]),   // played from hand, GY floodgate
  "gnomaterial": HT(),
  "called by the grave": TECH(),            // handtrap counter (tech, not a HT itself)
  "crossout designator": TECH(),

  // ── Board breakers (going second) ───────────────────────────────────
  "forbidden droplet": BB(),
  "dark ruler no more": BB(),
  "evenly matched": BB(),
  "lightning storm": BB(),
  "harpie's feather duster": BB(),
  "raigeki": BB(),
  "dark hole": BB(),
  "super polymerization": BB(),
  "triple tactics talent": TECH(["Board breaker"]),
  "triple tactics thrust": TECH(),
  "cosmic cyclone": TECH(),
  "mystical space typhoon": TECH(),
  "lava golem": BB(),
  "kaiju": BB(),
  "gameciel, the sea turtle kaiju": BB(),
  "radian, the multidimensional kaiju": BB(),
  "thunder king the lightningstrike kaiju": BB(),
  "interrupted kaiju slumber": BB(),
  "book of eclipse": BB(),
  "forbidden crown": TECH(),

  // ── Floodgates ──────────────────────────────────────────────────────
  "skill drain": FG(),
  "there can be only one": FG(),
  "dimensional barrier": FG(),
  "anti-spell fragrance": FG(),
  "imperial order": FG(),
  "summon limit": FG(),
  "mistake": FG(),
  "rivalry of warlords": FG(),
  "gozen match": FG(),
  "the monarchs stormforth": FG(),
  "macro cosmos": FG(),

  // ── Generic Extra-Deck bosses / negates ─────────────────────────────
  "baronne de fleur": BOSS(),
  "chaos angel": BOSS(),
  "s:p little knight": BOSS(),
  "accesscode talker": BOSS(),
  "apollousa, bow of the goddess": BOSS(),
  "borreload savage dragon": BOSS(),
  "crystal wing synchro dragon": BOSS(),
  "red-eyes dark dragoon": BOSS(),
  "underworld goddess of the closed world": BOSS(),
  "super starslayer ty-phon - sky crisis": BOSS(),
  "mirrorjade the iceblade dragon": BOSS(),
  "garura, wings of resonant life": BOSS(),
  "i:p masquerena": BOSS(),
  "selene, queen of the master magicians": BOSS(),
  "the winged dragon of ra - sphere mode": BB(),

  // ── Archetype boss monsters (2025–2026 meta, web-researched) ────────
  // Branded / Despia
  "lubellion the searing dragon": BOSS(),
  "granguignol the dusk dragon": BOSS(),
  "albion the branded dragon": BOSS(),
  "masquerade the blazing dragon": BOSS(),
  "despian quaeritis": BOSS(),
  // Dracotail (Branded pair)
  "dracotail arthalion": BOSS(),
  "dracotail gulamel": BOSS(),
  "dracotail shaulas": BOSS(),
  // Maliss
  "maliss <q> hearts crypter": BOSS(),
  "maliss <q> white binder": BOSS(),
  "maliss <q> red ransom": BOSS(),
  "number 41: bagooska the terribly tired tapir": FG(),
  "number f0: utopic future": BOSS(),
  // Mitsurugi / Ryzeal
  "ame no murakumo no mitsurugi": BOSS(),
  "ame no habakiri no mitsurugi": BOSS(),
  "futsu no mitama no mitsurugi": BOSS(),
  "ryzeal detonator": BOSS(),
  "ryzeal duo drive": BOSS(),
  // White Forest / Azamina
  "diabell, queen of the white forest": BOSS(),
  "rciela, sinister soul of the white forest": BOSS(),
  "silvera, wolf tamer of the white forest": BOSS(),
  "saint azamina": FG(),
  "azamina mu rcielago": BOSS(),
  "azamina ilia silvia": BOSS(),
  // Sky Striker
  "sky striker ace - kagari": BOSS(),
  "sky striker ace - shizuku": BOSS(),
  "sky striker ace - hayate": BOSS(),
  "sky striker ace - kaina": BOSS(),
  "sky striker ace - azalea": BOSS(),
  // Vanquish Soul
  "vanquish soul caesar valius": BOSS(),
  "vanquish soul heavy borger": BOSS(),
  "vanquish soul pluton hg": FG(),
  "vanquish soul dr. mad love": BOSS(),
  // Predaplant
  "predaplant dragostapelia": BOSS(),
  "predaplant triphyoverutum": BOSS(),
  "starving venom predapower fusion dragon": BOSS(),
  "greedy venom fusion dragon": BOSS(),
  "predaplant chimerafflesia": BOSS(),
  // Lunalight
  "lunalight leo dancer": BOSS(),
  "lunalight cat dancer": BOSS(),
  "lunalight sabre dancer": BOSS(),
  "lunalight panther dancer": BOSS(),
  "lunalight liger dancer": BOSS(),
  // Fairy Tail
  "fairy tail - rochka": BOSS(),
  "fairy tail - wiccat": BOSS(),
  // Radiant Typhoon
  "radiant typhoon varuroon, the marine eidolon": BOSS(),
  "radiant typhoon fonix, the great flame": BOSS(),
  // Medius the Pure cluster — Power Patron / DoomZ / Artmage / Elfnote / Kewl Tune / Clown Crew
  "doomz xii end - drastrius": BOSS(),
  "doomz xiii over - graflareio": BOSS(),
  "doomz xii zero - drastea": BOSS(),
  "doomz break - diactorus": BOSS(),
  "doomz vii seven - elara": BOSS(),
  "power patron doomz": FG(),
  "jupiter the power patron of destruction": BOSS(),
  "nerva the power patron of creation": BOSS(),
  "junora the power patron of tuning": BOSS(),
  "artmage diactorus": BOSS(),
  "artmage non-finito": BOSS(),
  "artmage finmel": BOSS(),
  "june pride - elfnotes": BOSS(),
  "elfnote seraphim strelitzia": BOSS(),
  "kewl tune loudness war": BOSS(),
  "kewl tune b2b": BOSS(),
  "clown crew diabolo": BOSS(),
  "clown crew meteor": BOSS(),
  "clown crew drish": BOSS(),
};

export function lookupKB(name) {
  if (!name) return null;
  return CARD_KB[String(name).toLowerCase()] || null;
}
