// ───────────────────────────────────────────────────────────────────
// Combo simulator — replays a combo's log step-by-step, tracking game
// state (hand / field / GY / banished) so each step has a board you can
// scrub through. Ported faithfully from the original decoder's
// simulateCombo + applyStepToState + describeStep. Pure logic.
//
// A field slot: { card, zone, isSet, isField, materials[], stacked[] }.
// ───────────────────────────────────────────────────────────────────
import { lookupCardByName } from "./cardSearch.js";

function cloneState(s) {
  return {
    hand: [...s.hand],
    field: s.field.map((slot) => ({
      card: slot.card, zone: slot.zone, isSet: slot.isSet, isField: slot.isField,
      materials: [...(slot.materials || [])], stacked: [...(slot.stacked || [])],
    })),
    gy: [...s.gy],
    banished: [...s.banished],
  };
}
function arrRemoveFirst(arr, name) {
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v === name || (v && v.card === name)) { arr.splice(i, 1); return true; }
  }
  return false;
}
function fieldRemoveTop(field, name) {
  const i = field.findIndex((s) => s.card === name);
  if (i >= 0) { field.splice(i, 1); return true; }
  return false;
}

// "to M-3" → "M-3"; "to Left Extra Monster Zone" → "EMZ-L"; etc.
export function extractZone(detail) {
  if (!detail) return null;
  const m = detail.match(/\b(?:to|in|onto)\s+(M-\d|S-\d|Left Extra Monster Zone|Right Extra Monster Zone|Left Pendulum Zone|Right Pendulum Zone|Field Spell Zone|Left EMZ|Right EMZ)/i);
  if (!m) return null;
  const raw = m[1];
  if (/Left Extra Monster Zone|Left EMZ/i.test(raw)) return "EMZ-L";
  if (/Right Extra Monster Zone|Right EMZ/i.test(raw)) return "EMZ-R";
  if (/Left Pendulum Zone/i.test(raw)) return "P-L";
  if (/Right Pendulum Zone/i.test(raw)) return "P-R";
  if (/Field Spell Zone/i.test(raw)) return "Field";
  return raw.toUpperCase();
}

export function isEquipSpell(name) {
  const card = lookupCardByName(name);
  if (!card) return false;
  if (card.race === "Equip") return true;
  if (card.type && /equip/i.test(card.type)) return true;
  return false;
}

function applyStepToState(state, step) {
  const action = step.action || "";
  const detail = step.detail || "";
  const cards = step.cards || [];
  const primary = cards[0];
  const fromHand = /from\s+hand/i.test(detail);
  const fromGy = /from\s+GY\b/i.test(detail);
  const fromBanish = /from\s+banish/i.test(detail);
  const fromField = /from\s+(?:[MS]-\d|(?:Left|Right)\s+(?:Extra Monster Zone|Pendulum Zone)|Field Spell Zone)/i.test(detail);
  const placedZone = extractZone(detail);

  if (action === "Draw" || action === "Search") {
    for (const n of cards) if (n) state.hand.push(n); // multi-card draws keep every card
  } else if (action === "Normal Summon" || action === "Tribute Summon" || action === "Flip Summon") {
    if (primary) { arrRemoveFirst(state.hand, primary); state.field.push({ card: primary, materials: [], zone: placedZone }); }
  } else if (action === "Special Summon") {
    if (!primary) return;
    if (fromHand) arrRemoveFirst(state.hand, primary);
    if (fromGy) arrRemoveFirst(state.gy, primary);
    if (fromBanish) arrRemoveFirst(state.banished, primary);
    const onto = / onto /.test(detail);
    if (onto && cards.length >= 2) {
      const targetName = cards[1];
      const targetIdx = state.field.findIndex((s) => s.card === targetName);
      if (targetIdx >= 0) {
        const target = state.field[targetIdx];
        const newMaterials = [
          targetName,
          ...((target.materials || []).map((m) => (typeof m === "string" ? m : m.card || m))),
          ...((target.stacked || []).map((m) => (typeof m === "string" ? m : m.card || m))),
        ];
        state.field[targetIdx] = { card: primary, materials: newMaterials, zone: placedZone || target.zone };
      } else {
        let ownerIdx = -1;
        for (let i = 0; i < state.field.length; i++) {
          const stacked = state.field[i].stacked || [];
          if (stacked.some((s) => (typeof s === "string" ? s : s && s.card) === targetName)) { ownerIdx = i; break; }
        }
        if (ownerIdx >= 0) {
          const owner = state.field[ownerIdx];
          const stackedNames = (owner.stacked || []).map((s) => (typeof s === "string" ? s : s && s.card));
          const ownerMats = (owner.materials || []).map((m) => (typeof m === "string" ? m : m && m.card));
          state.field[ownerIdx] = { card: primary, materials: [...stackedNames, owner.card, ...ownerMats], zone: placedZone || owner.zone };
        } else {
          state.field.push({ card: primary, materials: [targetName], zone: placedZone });
        }
      }
    } else {
      state.field.push({ card: primary, materials: [], zone: placedZone });
    }
  } else if (["Pendulum Summon", "Link Summon", "Synchro Summon", "Fusion Summon", "Xyz Summon"].includes(action)) {
    if (primary) state.field.push({ card: primary, materials: [], zone: placedZone });
  } else if (action === "Set") {
    if (primary) {
      if (state.field.some((s) => s.card === primary)) return;
      if (!arrRemoveFirst(state.hand, primary)) { if (!arrRemoveFirst(state.gy, primary)) arrRemoveFirst(state.banished, primary); }
      const isField = /Field Spell/i.test(detail);
      const isPendulumZone = /Pendulum Zone/i.test(detail);
      const card = lookupCardByName(primary);
      const isPendulumByScale = card && card.scale !== undefined && /to\s+S-[15]\b/i.test(detail);
      const isEffectPlace = /^Placed\b/i.test(detail) && /from\s+(?:Deck|GY|banished)\b/i.test(detail);
      state.field.push({ card: primary, isSet: !isField && !isPendulumZone && !isPendulumByScale && !isEffectPlace, isField, materials: [], zone: placedZone });
    }
  } else if (action === "Activate") {
    if (/Declared effect/i.test(detail)) {
      const declaredOnField = /in\s+(?:S-\d|(?:Left|Right)\s+Pendulum Zone|Field Spell Zone)/i.test(detail);
      if (declaredOnField && primary && !state.field.some((s) => s.card === primary)) {
        if (!arrRemoveFirst(state.hand, primary)) { if (!arrRemoveFirst(state.gy, primary)) arrRemoveFirst(state.banished, primary); }
        const isField = /Field Spell/i.test(detail);
        state.field.push({ card: primary, materials: [], isField, zone: placedZone });
      }
      return;
    }
    const placesOnField = /Activated\b.*from\s+hand.*to\s+(?:S-\d|Field Spell Zone|Pendulum Zone|Right Pendulum Zone|Left Pendulum Zone)/i.test(detail) ||
      /Activated\s+Field Spell\b.*from\s+hand/i.test(detail);
    const togglesSet = /Activated Set\b/i.test(detail);
    if (togglesSet && primary) {
      const slot = state.field.find((s) => s.card === primary);
      if (slot) slot.isSet = false;
    } else if (placesOnField && primary) {
      arrRemoveFirst(state.hand, primary);
      const isField = /Field Spell/i.test(detail);
      state.field.push({ card: primary, materials: [], isField, zone: placedZone || (isField ? "Field" : null) });
    }
  } else if (action === "Move") {
    if (primary && placedZone) { const slot = state.field.find((s) => s.card === primary); if (slot) slot.zone = placedZone; }
  } else if (action === "Send to GY" || action === "Destroy" || action === "Tribute" || action === "Discard") {
    if (!primary) return;
    let removed = false;
    if (fromField) removed = fieldRemoveTop(state.field, primary);
    if (fromHand) removed = arrRemoveFirst(state.hand, primary) || removed;
    // No source marker (and not from Deck/banish, where nothing is tracked):
    // remove the copy from where it most plausibly was, so the card isn't
    // duplicated into the GY while also sitting in hand/field.
    if (!removed && !fromField && !fromHand && !/from\s+(?:Deck|Extra Deck|banish)/i.test(detail)) {
      if (action === "Discard") arrRemoveFirst(state.hand, primary) || fieldRemoveTop(state.field, primary);
      else fieldRemoveTop(state.field, primary) || arrRemoveFirst(state.hand, primary);
    }
    state.gy.push(primary);
  } else if (action === "Banish") {
    if (!primary) return;
    if (isEquipSpell(primary) && /from\s+S-\d/i.test(detail)) {
      let xyzSlot = null;
      for (let i = state.field.length - 1; i >= 0; i--) {
        const s = state.field[i];
        if (s.isSet || s.isField || s.card === primary) continue;
        const card = lookupCardByName(s.card);
        const looksXyz = (s.materials || []).length > 0 || (card && /xyz/i.test(card.type || ""));
        if (looksXyz) { xyzSlot = s; break; }
      }
      if (xyzSlot) {
        fieldRemoveTop(state.field, primary);
        xyzSlot.materials = xyzSlot.materials || [];
        if (!xyzSlot.materials.some((m) => (typeof m === "string" ? m : m && m.card) === primary)) xyzSlot.materials.push(primary);
        return;
      }
    }
    if (fromField) fieldRemoveTop(state.field, primary);
    if (fromGy) arrRemoveFirst(state.gy, primary);
    if (fromHand) arrRemoveFirst(state.hand, primary); // e.g. banish a cost from hand
    state.banished.push(primary);
  } else if (action === "AttachMaterial") {
    if (cards.length >= 2) {
      const matName = cards[0], ownerName = cards[1];
      if (/banished/i.test(detail)) arrRemoveFirst(state.banished, matName);
      else if (fromGy) arrRemoveFirst(state.gy, matName);
      else if (fromHand) arrRemoveFirst(state.hand, matName);
      else fieldRemoveTop(state.field, matName);
      const ownerSlot = state.field.find((s) => s.card === ownerName);
      if (ownerSlot) {
        ownerSlot.materials = ownerSlot.materials || [];
        if (!ownerSlot.materials.some((m) => (typeof m === "string" ? m : m && m.card) === matName)) ownerSlot.materials.push(matName);
      }
    }
  } else if (action === "Return") {
    if (!primary) return;
    const toHand = /to\s+hand/i.test(detail);
    if (fromField) fieldRemoveTop(state.field, primary);
    if (fromGy) arrRemoveFirst(state.gy, primary);
    if (fromBanish) arrRemoveFirst(state.banished, primary);
    if (fromHand) arrRemoveFirst(state.hand, primary);
    if (toHand) state.hand.push(primary);
  } else if (action === "Overlay") {
    if (cards.length >= 2) {
      const moved = cards[0], target = cards[1];
      const movedIdx = state.field.findIndex((s) => s.card === moved);
      let targetIdx = -1;
      for (let i = 0; i < state.field.length; i++) { if (state.field[i].card === target && i !== movedIdx) { targetIdx = i; break; } }
      if (movedIdx >= 0 && targetIdx >= 0) {
        const targetSlot = state.field[targetIdx];
        targetSlot.stacked = targetSlot.stacked || [];
        targetSlot.stacked.push(state.field[movedIdx].card);
        state.field.splice(movedIdx, 1);
      }
    }
  } else if (action === "Detach") {
    if (cards.length >= 2) {
      const matName = cards[0], parentName = cards[1];
      const parentSlot = state.field.find((s) => s.card === parentName);
      if (parentSlot && Array.isArray(parentSlot.materials)) {
        const i = parentSlot.materials.findIndex((m) => (typeof m === "string" ? m : m && m.card) === matName);
        if (i >= 0) parentSlot.materials.splice(i, 1);
      }
      state.gy.push(matName);
    }
  }
}

// Returns the combo's steps each annotated with stateAfter (the board after
// that step). Hand starts EMPTY — opener cards arrive via Draw steps.
export function simulateCombo(combo) {
  const state = { hand: [], field: [], gy: [], banished: [] };
  const out = [];
  for (const step of ((combo && combo.steps) || [])) {
    if (step._truncated) { out.push(step); continue; }
    applyStepToState(state, step);
    out.push({ ...step, stateAfter: cloneState(state) });
  }
  return out;
}

// Field slots → EndBoardView items.
export function fieldToBoard(field) {
  return (field || []).map((s) => ({ name: s.card, zone: s.zone, isSet: s.isSet, materials: s.materials }));
}

// Plain-English narration of a single step.
export function describeStep(step) {
  const action = step.action || "";
  const detail = step.detail || "";
  const cards = step.cards || [];
  const c0 = cards[0], c1 = cards[1];

  if (action === "Normal Summon" && c0) return `Normal Summon ${c0}`;
  if (action === "Tribute Summon" && c0) return `Tribute Summon ${c0}`;
  if (action === "Flip Summon" && c0) return `Flip Summon ${c0}`;
  if (action === "Special Summon" && c0) {
    if (/ onto /.test(detail) && c1) {
      const t = (lookupCardByName(c0) || {}).type || "";
      if (/xyz/i.test(t)) return `Xyz Summon ${c0} using ${c1}`;
      if (/link/i.test(t)) return `Link Summon ${c0} using ${c1}`;
      if (/synchro/i.test(t)) return `Synchro Summon ${c0} using ${c1}`;
      if (/fusion/i.test(t)) return `Fusion Summon ${c0} using ${c1}`;
      return `Special Summon ${c0} on top of ${c1}`;
    }
    if (/from\s+hand/i.test(detail)) return `Special Summon ${c0} from hand`;
    if (/from\s+Deck/i.test(detail)) return `Special Summon ${c0} from Deck`;
    if (/from\s+GY/i.test(detail)) return `Special Summon ${c0} from GY`;
    if (/from\s+Extra Deck/i.test(detail)) return `Special Summon ${c0} from Extra Deck`;
    if (/from\s+banish/i.test(detail)) return `Special Summon ${c0} from banished`;
    return `Special Summon ${c0}`;
  }
  if (action === "Xyz Summon" && c0) return `Xyz Summon ${c0}`;
  if (action === "Link Summon" && c0) return `Link Summon ${c0}`;
  if (action === "Synchro Summon" && c0) return `Synchro Summon ${c0}`;
  if (action === "Fusion Summon" && c0) return `Fusion Summon ${c0}`;
  if (action === "Pendulum Summon" && c0) return `Pendulum Summon ${c0}`;
  if (action === "Search" && c0) return `Add ${c0} from Deck to hand`;
  if (action === "Set" && c0) {
    if (/Pendulum Zone/i.test(detail)) return `Activate ${c0} as Pendulum scale`;
    if (/Field Spell/i.test(detail)) return `Set Field Spell ${c0}`;
    return `Set ${c0}`;
  }
  if (action === "Activate" && c0) {
    if (/Activated Set/i.test(detail)) return `Activate set ${c0}`;
    if (/Pendulum Zone/i.test(detail)) return `Place ${c0} in Pendulum Zone`;
    if (/Activated Field Spell/i.test(detail)) return `Activate Field Spell ${c0}`;
    if (/Activated\b.*from\s+hand/i.test(detail)) return `Activate ${c0} from hand`;
    if (/Declared effect.*from\s+GY/i.test(detail)) return `Activate ${c0}'s effect from GY`;
    if (/Declared effect/i.test(detail)) return `Activate ${c0}'s effect`;
    return `Activate ${c0}`;
  }
  if (action === "Overlay" && c0 && c1) return `Stack ${c0} with ${c1} (preparing Xyz)`;
  if (action === "Detach" && c0 && c1) return `Detach ${c0} (Xyz cost on ${c1})`;
  if (action === "Send to GY" && c0) {
    if (/from\s+Deck/i.test(detail)) return `Send ${c0} from Deck to GY`;
    if (/from\s+hand/i.test(detail)) return `Send ${c0} from hand to GY`;
    return `Send ${c0} to GY`;
  }
  if (action === "Destroy" && c0) return `Destroy ${c0}`;
  if (action === "Banish" && c0) {
    if (/from\s+GY/i.test(detail)) return `Banish ${c0} from GY`;
    return `Banish ${c0}`;
  }
  if (action === "AttachMaterial" && c0 && c1) return `${c0} attaches as Xyz material on ${c1}`;
  if (action === "Discard" && c0) return `Discard ${c0}`;
  if (action === "Tribute" && c0) return `Tribute ${c0}`;
  if (action === "Return" && c0) {
    if (/to\s+hand/i.test(detail)) return `Return ${c0} to hand`;
    if (/to\s+Extra Deck/i.test(detail)) return `Return ${c0} to Extra Deck`;
    if (/to\s+(?:top|bottom)?\s*(?:of\s+)?deck/i.test(detail)) return `Return ${c0} to Deck`;
    return `Return ${c0}`;
  }
  if (action === "Draw" && c0) return `Draw ${c0}`;
  if (action === "Reveal" && c0) return `Reveal ${c0}`;
  return (detail || `${action} ${c0 || ""}`).replace(/\s*\(\d+\/\d+\)/g, "").replace(/\s+to [MS]-\d+/g, "").trim();
}
