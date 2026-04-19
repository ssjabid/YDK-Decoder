# Deck Context — DoomZ / Power Patron

This is the specific deck Abid is trying to learn.

## Source article

Quincymccoy's CDP (Creative Deck Profile) on YGOrganization:
https://ygorganization.com/cdp_doomzpatron/

Title: "DoomZ Power Patron Branded, ft. BLZD Support [CDP]"
Published: February 12, 2026

## Current decklist (Abid's build, 42 Main / 15 Extra / 15 Side)

### Main deck (42)
```
Monsters (24):
3 Ash Blossom & Joyous Spring
3 Dodododo Warrior
2 DoomZ V Five - Amalthe
3 DoomZ VII Seven - Elara
1 DoomZ XII Zero - Drastea
2 Ghost Belle & Haunted Mansion
1 Medius the Pure
3 Mulcharmy Fuwalos
1 Onomatokage
1 Power Patron DoomZ
3 Power Patron Shadow Machine Zegredo
1 Therion "King" Regulus
1 Vidrium the Power Patron of Chaos Extermination

Spells (14):
2 DoomZ Change
1 DoomZ Command "A.D.R.A.S.T.E.I.A."
1 DoomZ Command "D.O.O.M.D.U.R.G."
2 DoomZ Raiders
1 Null Power Patron Realm - Vidria (Field Spell)
3 The Fallen & The Virtuous
3 Unleashed Power Patron Portal - Terminus

Traps (4):
1 DoomZ Destruction
3 Infinite Impermanence
```

### Extra deck (15)
```
2 Albion the Branded Dragon (from Fallen & Virtuous)
1 Clockwork Knight
1 DoomZ Break - Diactorus
1 DoomZ XII End - Drastrius
1 DoomZ XIII Over - Graflario (R5 — CONFIRMED not R12)
1 Ecclesia and the Dark Dragon
1 Evilswarm Exciton Knight
1 Gigantic "Champion" Sargas
2 Jupiter the Power Patron of Destruction
1 Number F0: Utopic Draco Future (?)
1 Springans Merrymaker
1 Varudras, the Final Bringer of the End Times (from 2× Zegredo Xyz)
```

### Side deck (15)
```
1 Called by the Grave (CBTG)
2 Droll & Lock Bird
3 Ghost Ogre & Snow Rabbit
1 Harpie's Feather Duster (HFD)
3 Mulcharmy Purulia
1 Solemn Judgment
1 Solemn Warning
3 Triple Tactics Talent
```

## The 6 meta combos to master

From the Greenview Yugioh Club spreadsheet (https://docs.google.com/spreadsheets/d/1Vo1xHyHOvcrU1kmKP8F9jSJ6JTusqrMnXmISZ-S7F9g/edit)

| # | Category | DuelingBook Replay URL | Status |
|---|---|---|---|
| 1 | Amalthe + Discard | https://www.duelingbook.com/replay?id=1345419-80595527 | ✅ Extracted (81 steps) |
| 2 | Elara + Discard | https://www.duelingbook.com/replay?id=1345419-80595939 | ✅ Extracted (75 steps) |
| 3 | Change (with trap) | https://www.duelingbook.com/replay?id=1345419-80596178 | ⬜ Not yet |
| 4 | Change (without trap) | https://www.duelingbook.com/replay?id=1345419-80597029 | ⬜ Not yet |
| 5 | Terminus | https://www.duelingbook.com/replay?id=1345419-80596390 | ⬜ Not yet |
| 6 | Raiders + Any name | https://www.duelingbook.com/replay?id=1345419-80597291 | ⬜ Not yet |

Extractions 1 and 2 are in `sample-data/`.

## Deck strategy summary

**Core mechanic:** DoomZ monsters are DARK Dragons that "upgrade" (Xyz Summon) into WIND Machine Xyz monsters of matching Rank, while equipped with Equip Spells.

**Key plays:**

1. **1-card Zegredo → Jupiter R10:** Zegredo banishes top 3 deck → destroys self → SS Jupiter from Extra Deck → attaches 1 hand card as material. Jupiter gets +3000 ATK while having Xyz material = 6500 ATK.

2. **1-card Amalthe → Rank 4 Diactorus:** NS Amalthe → search DoomZ monster → bridge via Power Patron DoomZ → Diactorus. If destruction happens (DoomZ Change, Raiders, DOOMDURG self-destroy), Amalthe triggers AGAIN on destruction for double search.

3. **1-card Elara → set Raiders → destroy Elara → SS from deck:** Elara sets Raiders directly from deck → Raiders destroys Elara → SS DoomZ from deck → Elara's destruction trigger sets another S/T.

4. **Medius bridge:** Medius SS Power Patron from deck → Power Patron brings out DoomZ Xyz.

5. **Varudras R12 finisher:** Xyz Summon Zegredo (Lv10) using 2 monsters → alt-Xyz Varudras using 2 Zegredo Xyz as material. End-game closer.

6. **Branded engine recovery:** The Fallen & The Virtuous → sends Albion (Fusion) + Ecclesia (Synchro) to GY → unlocks Vidrium summon conditions from Extra Deck.

**Key interactions:**
- **Equip Spells chain** — DOOMDURG + ADRASTEIA + Power Patron = 3 equips on one monster = triggers Jupiter's alt-summon
- **Graflario (R5) evolves from any DoomZ Xyz** — detach → search + pop, then on destruction SS non-Xyz DoomZ from deck/GY
- **ADRASTEIA GY loop** — self-equip from GY, self-destroy to SS from hand/GY/banish
- **DoomZ Destruction floodgate** — opp can't add from Main Deck to hand except by drawing

## Verified card effects (from research + extraction testing)

### DoomZ archetype — confirmed
- **Medius the Pure** (Lv4 DARK Dragon, 1500/1500) — NS/SS: SS Power Patron from deck. In GY: shuffle monster from hand/field into deck, SS self (banish when leaves)
- **Power Patron DoomZ** (Lv1 WIND Machine, 0/0) — Xyz-only Extra Deck lock, target monster → SS DoomZ/Jupiter Xyz same-Rank via it, equip self. GY: add DoomZ from deck
- **DoomZ XII Zero - Drastea** (Lv8 DARK Dragon, 2800/2400) — destroy 1 DoomZ → SS self + equip Equip Spell from deck. Quick while equipped: SS WIND Machine Xyz same-Rank using self
- **DoomZ V Five - Amalthe** (Lv4 DARK Dragon, 1600/1200) — NS/SS/destroyed: add 1 DoomZ from deck (not self). Quick while equipped: SS same-Rank Xyz
- **DoomZ VII Seven - Elara** (Lv4 DARK Dragon, 1400/1200) — NS/SS/destroyed: Set 1 DoomZ S/T from deck. Quick while equipped: SS same-Rank Xyz
- **DoomZ Raiders** (Continuous Spell) — destroy 1 DoomZ (hand/field) → search OR SS 1 DoomZ from deck, Xyz-only lock. On destruction: pop face-up monster. 1/2 per turn.
- **DoomZ Command "D.O.O.M.D.U.R.G."** (Equip Spell) — 500 Standby burn. Equipped DoomZ/WIND-Machine-Xyz: untargetable. Once/turn Quick: destroy another face-up → this gains Lv/Rank×100 ATK, direct attack, dies end of damage step.
- **DoomZ Destruction** (Trap) — equip to DoomZ Xyz: opp can't add from Main Deck to hand except by drawing. On destruction: equip DoomZ monster from deck as Equip Spell.
- **DoomZ Break - Diactorus** (R4 WIND Machine, 2300/1500) — SS: destroy DoomZ in hand/field → pop opp monster. Destroyed with DoomZ/Medius material: tutor Equip Spell (hand or GY).
- **DoomZ XII End - Drastrius** (R8 WIND Machine, 3000/2500) — Xyz Summoned: equip another face-up monster. Once/turn not destroyed. Opp activates monster effect (Quick): detach → negate + equip target.

### BLZD cards — partially confirmed
- **DoomZ XIII Over - Graflario** (R5 WIND Machine, 2400/1500, 3 Lv5) — CONFIRMED R5. Alt-Xyz using 1 DoomZ Xyz (transfer materials). Detach: search DoomZ S/T → pop. On destruction: SS non-Xyz DoomZ from deck OR GY.
- **DoomZ Command "A.D.R.A.S.T.E.I.A."** (Equip Spell) — 1st destruction/turn by battle negated. Main: destroy equipped → SS other DoomZ from hand/GY/banish (DEF). GY: equip self to face-up monster + take Lv/Rank×100 damage.
- **Power Patron Shadow Machine Zegredo** (Lv10 DARK Machine Pendulum, scale 1) — Pendulum: destroy self + 1 DoomZ/Power Patron → pop card on field. Monster (treated as DoomZ): banish top 3 deck face-down → destroy self → SS Jupiter from Extra Deck + attach 1 from hand. Added face-up to Extra: search Power Patron/DoomZ S/T.
- **DoomZ Change** (Spell) — destroy 1 DoomZ (hand/deck/face-up field, not self). On destruction: add 1 DoomZ from GY (not self) → SS 1 DoomZ from hand.

### Power Patron cards — partial
- **Jupiter the Power Patron of Destruction** (R10 WIND Machine, 3500/2500) — 3 Lv10 monsters OR alt: use 1 monster equipped with 3+ Equip Spells (transfer materials). Xyz Summoned: equip any # appropriate Equip Spells from GY. +3000 ATK while has Xyz material. Detach: SS DoomZ from GY → pop opp card.
- **Vidrium the Power Patron of Chaos Extermination** (Lv12 Pendulum) — effect seen in extraction: activate Pendulum → SS Power Patron from GY → return to Extra Deck → search Power Patron card from deck.
- **Null Power Patron Realm - Vidria** (Field Spell) — effect seen: reveal 1 Xyz Monster from Extra Deck → SS 1 Power Patron from deck. Supports Jupiter alt-summon path.
- **Unleashed Power Patron Portal - Terminus** (Field Spell) — effect seen: send 1 Power Patron/DoomZ card from Extra Deck to GY → search Power Patron/DoomZ card. Self-destructs/goes to GY as cost somewhere in the chain.

### Not yet verified (need to check YGOPRODeck or card reveals)
- The Fallen & The Virtuous (Branded engine card)
- Dodododo Warrior
- Onomatokage
- Varudras — final boss, needs stats/effect
- Clockwork Knight, Number F0
- Albion the Branded Dragon
- Ecclesia and the Dark Dragon

## Extracted combo structures (patterns seen)

### Pattern 1: Amalthe opener (from extraction #1)
```
1. Normal Summon Amalthe (search first DoomZ)
2. Amalthe searches Drastea
3. Drastea destroys Amalthe → SS Drastea + equip A.D.R.A.S.T.E.I.A.
4. Drastea → Drastrius (R8)
5. Drastrius → Graflario (R5 via Xyz evolution)
6. Graflario detach → search Raiders
7. Raiders destroys Graflario → SS Elara
8. Graflario GY trigger → SS non-Xyz DoomZ
9. Elara sets DOOMDURG
10. Power Patron Shadow Machine Zegredo → SS from deck (via Terminus or similar)
11. Zegredo effect → SS Jupiter from Extra
12. Change + Destruction recovery loop
```

### Pattern 2: Elara opener (from extraction #2)
```
1. Normal Summon Elara (set A.D.R.A.S.T.E.I.A. from deck)
2. Activate set A.D.R.A.S.T.E.I.A. → equip Elara
3. Elara Xyz → Diactorus (R4)
4. Diactorus → Graflario (R5 via evolution)
5. Graflario detach → search Raiders
6. Raiders destroys Graflario → SS Amalthe
7. Amalthe search → Drastea
8. Power Patron → Power Patron DoomZ trigger
9. Branded/Terminus engine → search Vidrium
10. Vidrium → SS Zegredo from GY, plus deck SS
11. Double Zegredo Xyz → Varudras (R12)
```

**Both patterns end with full recovery via DoomZ Change + DoomZ Destruction in GY.**
