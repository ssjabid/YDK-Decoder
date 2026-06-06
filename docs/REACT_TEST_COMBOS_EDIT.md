# Combos — test checklist (editing, multi-deck, opener-size fix)

Reload the app first, go to the **Combos** tab. Tick each; "Expected" is a pass.

## A. Opener-size naming (the "1-card combo shows as 3+" bug)
- [ ] **A1** Open any combo → its detail bar now has **✎ Edit** and **× Delete**.
- [ ] **A2** In the meta row, **Opener size** controls which group the combo lands in. Set it to **1-card** → the combo immediately moves under the **"1-card openers"** group in the left list. Set it to 3-card → it moves to "3+ card openers". You're fully in control of the label now (it no longer guesses from your drawn hand).
- [ ] **A3** Set it back to **Auto** → it falls back to counting your opening-hand cards.

## B. Multiple decks per combo (e.g. two DoomZ variants)
- [ ] **B1** In a combo's detail, the **Decks** field shows linked-deck **chips** + a **"+ link a deck"** dropdown (grouped My decks / Matchup decks).
- [ ] **B2** Link a **second** deck → a second chip appears. The combo now shows up when you filter the list by **either** deck (top-left deck filter).
- [ ] **B3** Click the **×** on a deck chip → it unlinks (combo stays).
- [ ] **B4** In the left list / Gallery, a combo linked to 2+ decks shows e.g. **"DoomZ (Maxx C build) +1"**.

## C. Full combo editor (✎ Edit)
- [ ] **C1** Click **✎ Edit** → a full editor opens: Name, Opener size, Linked decks, Opening hand, **Steps**, End board, a live **"Board after these steps"**, and Notes.
- [ ] **C2** **Delete the draw noise:** click the **×** on the first few "Draw …" steps → they're removed and the rest renumber. (This fixes "the first 5 draw cards".)
- [ ] **C3** **Retext a step:** type new text in any step's detail box (e.g. fix wording). 
- [ ] **C4** **Reorder:** use **↑ / ↓** on a step to move it. The numbers update.
- [ ] **C5** **Edit a step's action:** the action dropdown (Normal Summon / Activate / Special Summon / …) — change it and the colored tag updates.
- [ ] **C6** **Edit the cards a step touches:** add/remove cards in the chip row under each step.
- [ ] **C7** **+ Add step** appends a blank step you can fill in.
- [ ] **C8** **Opening hand** and **End board** are editable chip rows (search any card to add, × to remove).
- [ ] **C9** As you edit steps, the **"Board after these steps"** playmat updates live — that's the simulated result.
- [ ] **C10** **Save changes** → back to the detail view with everything applied. **Cancel** → discards your edits.

## D. Simulate + Drill respect your edits
- [ ] **D1** After deleting the draw steps and saving, open **Simulate** → the step counter reflects only the steps you kept (no more draw steps), and the board builds to your end board.
- [ ] **D2** Open **Drill** → it reveals only your kept plays, in your order, and ends with "✓ That's the full line".

## E. Manual builder also supports multiple decks
- [ ] **E1** **+ New combo** → the builder now has a **Linked decks** multi-picker (link it to several decks at once before creating).

## F. Regression
- [ ] **F1** Existing extracted combos still open, show their line / Simulate / Drill, and their end board (with zones) is preserved if you don't touch it in the editor.
- [ ] **F2** Console clean, no blank screens.
