# Focused test checklist — only the changes since your last test round

Reload the app first. Tick each; "Expected" is a pass. Note the number if it fails.

## A. Dropdowns & navigation (foundational)
- [ ] **A1** Every dropdown is the dark custom one (no grey OS dropdowns anywhere).
- [ ] **A2** Open a long dropdown (Testing "Test with", or Combos deck filter) and **scroll inside it** with the mouse wheel / its scrollbar → it stays open (doesn't snap shut).
- [ ] **A3** Settings is now the **gear icon top-right of the header** (not a 5th tab). Tabs are just Decks / Format / Combos / Testing. Click the gear → Settings opens; click again → back.
- [ ] **A4** Settings page content is **centred** on the screen (not hugging the left).

## B. Grouped deck pickers (this round's main ask)
- [ ] **B1** Testing → **"Test with"** dropdown shows two sections: **My decks** and **Matchup decks** (each a scrollable list). Headings are labels only (not clickable).
- [ ] **B2** Pick a deck from each group → it loads for testing and sticks as the default next time you open Testing.
- [ ] **B3** Combos → the deck-filter dropdown (top-left) also groups **My decks / Matchup decks** (with "All decks" on top).

## C. Adding cards
- [ ] **C1** Decks → a **matchup** deck → Playbook → **Their end boards** → "+ Add": the picker lists **that deck's own cards** immediately (no typing, no global search). Type to filter within the deck. Pick one → it lands on the playmat.
- [ ] **C2** Decks → Playbook → **Cards that are really good here** → "+ Add": this one still searches **all** cards live (type "Fallen of the…" → API results), since those are your own tech.
- [ ] **C3** Key cards → "+ Add card" also live-searches any card.

## D. Boss-monster tagging
- [ ] **D1** Decks → a matchup deck (e.g. Branded / Despia, Lunalight, Predaplant) → **Key cards → Extract** → the **Boss** bucket contains that deck's actual bosses (Mirrorjade, Lunalight Leo Dancer, Predaplant Dragostapelia, etc.), not lumped into Starter.
- [ ] **D2** If a card is mis-tagged, you can recategorise it in Key cards. (Tell me the exact card name and I'll fix the KB.)

## E. Hover / preview
- [ ] **E1** Hover a card (anywhere — playmat, chips, hand, key-card mini) → preview shows; **move the mouse off it → preview disappears** (no stuck card).
- [ ] **E2** Click a card → preview pins; click anywhere outside it → it closes.

## F. Format
- [ ] **F1** "Edit in Decks → <deck>" in a matchup breakdown is a **button**: clicking it jumps to the Decks tab and selects that deck.
- [ ] **F2** Format bar has **⤓ Export** / **⤒ Import**: Export downloads the format (+ its decks); Import re-adds a format from a file.
- [ ] **F3** Make a **new format** (+ New) → its list head shows **"+ Add from library"** to add existing decks as matchups (instead of only importing .ydk). (Hidden when every deck is already a matchup.)
- [ ] **F4** Side-deck plan shows a **visual OUT/IN summary** (card thumbnails + counts), red for out, green for in.
- [ ] **F5** Side-deck supports **multiple named patterns** (pattern bar with "New plan"); each has Going first/second + the dot editor; they save on the matchup.
- [ ] **F6** Tournament journal → "+ Log a new event": there's an **Event name** field; the event shows as **Name · Type · Date**.

## G. Combos
- [ ] **G1** "+ New combo" opens a **builder**: name, deck, opener size, opener + end-board cards (live search), notes → Create. It appears grouped by opener size.
- [ ] **G2** **List / Gallery** toggle: Gallery shows each combo as an image card (Starting hand → End board); "Open →" jumps to its detail.
- [ ] **G3** A combo's detail still has Line / Simulate / Drill.

## H. Testing siding
- [ ] **H1** Going second → if the matchup has a saved side pattern, a **side-plan picker** appears; selecting one draws your **sided** hand (out the OUT cards, in the IN cards).
- [ ] **H2** A pattern card no longer in your deck is **flagged as missing** rather than breaking.

## I. Regression
- [ ] **I1** Reload on every tab → no blank screens; DevTools console clean.
- [ ] **I2** Your existing decks / formats / combos are all still present (data untouched).
