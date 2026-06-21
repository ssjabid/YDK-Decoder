// YDK Decoder Extension — Minimal Service Worker
// Orchestrates replay extraction: open tab → inject script → poll for result → clean up
// Based on proven logic from DuelMetrics v4.0 (stripped to essentials)

// BUILD MARKER — bump this string whenever you make any change to this file.
// If the user's SW console doesn't print this exact string, Chrome is running
// a cached old SW and the extension MUST be removed + reloaded fresh.
const YDK_SW_BUILD = 'sw-build-2026-04-26-combo-deckid-stamp';
console.log('YDK Extension: Service worker loaded —', YDK_SW_BUILD);

let activeExtractionTabId = null;
let extractionCancelled = false;

// ============================================================
// Message handler
// ============================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractReplay') {
    extractReplay(message.replayUrl);
    sendResponse({ success: true });
    return true;
  }
  if (message.action === 'cancelExtraction') {
    extractionCancelled = true;
    if (activeExtractionTabId) {
      try { chrome.tabs.remove(activeExtractionTabId); } catch (_) {}
      activeExtractionTabId = null;
    }
    chrome.storage.local.set({ extractionProgress: { status: 'cancelled' } });
    sendResponse({ success: true });
    return true;
  }
  if (message.action === 'openInDecoder') {
    // Fire-and-forget. The SW persists across popup close, so the async
    // tab-create + inject flow completes regardless of popup lifecycle.
    openInDecoder(message.combo);
    sendResponse({ ok: true });
    return true;
  }
  if (message.action === 'saveDeckToDecoder') {
    // Same pattern as openInDecoder — open a decoder tab (or focus an
    // existing one) and inject the deck into its localStorage.
    saveDeckToDecoder(message.deck);
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

// ============================================================
// Open a combo in the decoder — P0.4
// Runs in the service worker so it survives popup close.
// ============================================================
// The active app is the React build served at localhost:8000/react/ (same
// origin as this extension's localStorage injection). The legacy single-file
// decoder at /decoder/ydk_decoder.html still exists but is no longer where
// Abid works — point the hand-off at the React app. Requires the React build
// to be served at :8000 (npm run build:8000, then py -m http.server 8000).
const DECODER_URL = 'http://localhost:8000/react/';

async function openInDecoder(combo) {
  if (!combo) {
    console.warn('YDK Extension: openInDecoder called with no combo');
    return;
  }
  console.log('YDK Extension: Opening decoder for combo', combo.comboName, 'version', combo.version);

  let tab;
  try {
    tab = await chrome.tabs.create({ url: DECODER_URL, active: true });
  } catch (e) {
    console.error('YDK Extension: chrome.tabs.create failed', e);
    return;
  }

  try {
    await waitForDecoderTabLoad(tab.id, 15000);
  } catch (e) {
    console.warn('YDK Extension: Tab load wait timed out, trying inject anyway', e.message);
  }

  // Small extra delay so the decoder's inline <script> finishes executing
  // (status === 'complete' fires when parser is done, but sometimes scripts
  // have a microtask or two left).
  await sleep(200);

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectComboIntoDecoderPage,
      args: [combo],
    });
    console.log('YDK Extension: ✓ Injected combo into decoder tab', tab.id);
  } catch (injectErr) {
    console.warn('YDK Extension: Direct inject failed, falling back to URL-param navigation', injectErr);
    try {
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(combo))));
      await chrome.tabs.update(tab.id, { url: `${DECODER_URL}?combo=${encoded}` });
    } catch (navErr) {
      console.error('YDK Extension: URL-param fallback also failed', navErr);
    }
  }
}

// ============================================================
// Save a deck into the decoder's local deck library.
// Mirrors openInDecoder but targets localStorage.ydk_decks instead of
// ydk_saved_combos. Each deck object is upserted by deckId (or by
// content hash if no id was set), so re-saving the same deck doesn't
// create a duplicate.
// ============================================================
async function saveDeckToDecoder(deck) {
  if (!deck || !deck.ydk) {
    console.warn('YDK Extension: saveDeckToDecoder called with no deck');
    return;
  }
  console.log('YDK Extension: Saving deck to decoder:', deck.deckName, `${deck.counts && deck.counts.total} cards`);

  // Build the payload that will land in decoder localStorage. Keep it
  // minimal — the decoder is the source of truth for variation metadata,
  // notes, etc.; the extension just provides the raw .ydk + a name.
  const payload = {
    deckId: deck.deckId || ('deck_' + Date.now()),
    name: deck.deckName || 'Untitled deck',
    ydkContent: deck.ydk,
    counts: deck.counts || null,
    main: deck.main || [],
    extra: deck.extra || [],
    side: deck.side || [],
    source: 'extension',
    sourceUrl: deck.pageUrl || null,
    extractedAt: new Date().toISOString(),
  };

  let tab;
  try {
    tab = await chrome.tabs.create({ url: DECODER_URL, active: true });
  } catch (e) {
    console.error('YDK Extension: chrome.tabs.create failed', e);
    return;
  }

  try {
    await waitForDecoderTabLoad(tab.id, 15000);
  } catch (e) {
    console.warn('YDK Extension: Tab load wait timed out, trying inject anyway', e.message);
  }
  await sleep(200);

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectDeckIntoDecoderPage,
      args: [payload],
    });
    console.log('YDK Extension: ✓ Injected deck into decoder tab', tab.id);
  } catch (e) {
    console.error('YDK Extension: Deck inject failed', e);
  }
}

// Runs in the decoder page context — must be self-contained (no closures).
function injectDeckIntoDecoderPage(deck) {
  try {
    const KEY = 'ydk_decks';
    const raw = window.localStorage.getItem(KEY);
    let arr = [];
    try {
      const parsed = JSON.parse(raw || '[]');
      if (Array.isArray(parsed)) arr = parsed;
    } catch (_) { arr = []; }

    // Upsert by deckId. If the user re-extracts the same deck, replace
    // (preserving existing metadata like variation parent / notes).
    const idx = arr.findIndex(d => d && d.deckId === deck.deckId);
    if (idx >= 0) {
      const existing = arr[idx];
      arr[idx] = {
        ...existing,
        name: deck.name,
        ydkContent: deck.ydkContent,
        counts: deck.counts,
        main: deck.main,
        extra: deck.extra,
        side: deck.side,
        source: deck.source,
        sourceUrl: deck.sourceUrl,
        updatedAt: new Date().toISOString(),
      };
    } else {
      arr.push({
        ...deck,
        parentDeckId: null,
        isVariation: false,
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    window.localStorage.setItem(KEY, JSON.stringify(arr));

    // Notify the decoder page so it can re-render its deck library.
    const detail = { deckId: deck.deckId, name: deck.name };
    const fire = () => {
      try { window.dispatchEvent(new CustomEvent('ydk:deck-injected', { detail })); } catch (_) {}
    };
    fire();
    setTimeout(fire, 200);
    setTimeout(fire, 800);
    setTimeout(fire, 2000);
    return { ok: true, totalDecks: arr.length };
  } catch (e) {
    console.error('YDK Decoder deck inject failed:', e);
    return { ok: false, error: e.message };
  }
}

function waitForDecoderTabLoad(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Decoder tab load timeout'));
    }, timeoutMs);

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// This function is serialized and runs inside the decoder tab's page context.
// MUST be self-contained — no closures, no external references except web globals.
function injectComboIntoDecoderPage(combo) {
  try {
    const KEY = 'ydk_saved_combos';
    const ACTIVE_DECK_KEY = 'ydk_active_deck_id';
    const raw = window.localStorage.getItem(KEY);
    let arr = [];
    try {
      const parsed = JSON.parse(raw || '[]');
      if (Array.isArray(parsed)) arr = parsed;
    } catch (_) { arr = []; }
    const key = combo.replayId || combo.replayUrl || combo.comboName || '';
    const idx = arr.findIndex(c => (c.replayId || c.replayUrl || c.comboName || '') === key);
    // Stamp the active deckId on the combo if it doesn't already have one,
    // OR if updating preserves the existing one. This is what links combos
    // to decks for the Decks→Combos navigation in the UI.
    if (!combo.deckId) {
      try {
        const activeId = window.localStorage.getItem(ACTIVE_DECK_KEY);
        if (activeId) combo.deckId = activeId;
        else if (idx >= 0 && arr[idx].deckId) combo.deckId = arr[idx].deckId;
      } catch (_) {}
    }
    if (idx >= 0) arr[idx] = combo;
    else arr.push(combo);
    window.localStorage.setItem(KEY, JSON.stringify(arr));

    const detail = { comboKey: key, comboName: combo.comboName || '' };
    const fire = () => {
      try { window.dispatchEvent(new CustomEvent('ydk:combo-injected', { detail })); } catch (_) {}
    };
    fire();
    setTimeout(fire, 200);
    setTimeout(fire, 800);
    setTimeout(fire, 2000);
    return { ok: true, totalCombos: arr.length };
  } catch (e) {
    console.error('YDK Decoder inject failed:', e);
    return { ok: false, error: e.message };
  }
}

// ============================================================
// Main flow
// ============================================================
async function extractReplay(replayUrl) {
  extractionCancelled = false;
  activeExtractionTabId = null;

  try {
    // Phase 1: Open tab
    await setProgress({ status: 'opening', replayUrl });
    const tab = await chrome.tabs.create({ url: replayUrl, active: true });
    activeExtractionTabId = tab.id;

    if (extractionCancelled) return;

    // Phase 2: Wait for page load (DuelingBook is an SPA, be patient)
    await setProgress({ status: 'loading' });
    try {
      await waitForTabLoad(tab.id, 45000);
    } catch (e) {
      console.warn('YDK Extension: Load wait issue, continuing:', e.message);
      await sleep(5000);
    }

    if (extractionCancelled) return;

    // Phase 3: Inject the extraction script
    await setProgress({ status: 'injecting' });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/combo-import-helper.js']
    });

    if (extractionCancelled) return;

    // Phase 4: Start extraction
    await setProgress({ status: 'extracting' });
    await chrome.storage.local.remove('comboImportRawResult');

    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'extractComboFromReplay',
        replayUrl
      });
    } catch (e) {
      // Retry once if script wasn't ready
      console.warn('YDK Extension: Initial send failed, retrying:', e.message);
      await sleep(3000);
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'extractComboFromReplay',
          replayUrl
        });
      } catch (e2) {
        throw new Error('Could not communicate with replay page. Make sure the URL is a valid DuelingBook replay.');
      }
    }

    // Phase 5: Poll for result (extraction takes 30s - 3min)
    const rawResult = await pollForResult(300000);

    if (extractionCancelled) return;

    if (rawResult && rawResult.success) {
      // Phase 6: Build clean combo object
      const combo = buildComboFromResult(rawResult, replayUrl);
      await chrome.storage.local.set({ latestCombo: combo });
      await setProgress({ status: 'complete', replayUrl });
    } else {
      await setProgress({
        status: 'error',
        error: rawResult?.error || 'Extraction returned no data',
        replayUrl
      });
    }

  } catch (error) {
    console.error('YDK Extension: Extraction failed:', error);
    await setProgress({
      status: 'error',
      error: error.message,
      replayUrl
    });
  } finally {
    // Close the tab ~2s after completion so user sees it finished
    if (activeExtractionTabId && !extractionCancelled) {
      setTimeout(() => {
        try { chrome.tabs.remove(activeExtractionTabId); } catch (_) {}
        activeExtractionTabId = null;
      }, 2000);
    }
  }
}

// ============================================================
// Build clean combo object from raw log lines
// This is the money function — transforms raw DuelingBook log into
// a structured combo the YDK Decoder can render beautifully.
// ============================================================
function buildComboFromResult(rawResult, replayUrl) {
  const { logLines, openingHand, playerCards, replayId, isSolo } = rawResult;

  // Filter to red player's actions only (player who is combo-ing)
  const playerActions = (logLines || []).filter(l => l.player === 'red');

  // Convert log lines into structured steps
  const steps = [];
  let stepNum = 0;

  for (const line of playerActions) {
    const text = line.text || '';
    const cards = line.cards || [];
    const action = detectAction(text);

    // Skip pure draws (opening hand) and non-action lines
    if (!action) continue;
    if (action === 'draw' && stepNum < 10) continue; // opening hand draws

    stepNum++;
    steps.push({
      n: stepNum,
      timestamp: line.timestamp || null,
      action,
      cards: cards.length > 0 ? cards : null,
      detail: text,
    });
  }

  // Derive combo name from opening hand / first action
  const comboName = deriveComboName(openingHand, steps);

  // Extract endboard with GY + Banished piles
  const { field, graveyard, banished } = deriveEndboard(steps);

  return {
    version: 3, // v3 adds endboardGraveyard + endboardBanished pile tracking
    extractedAt: new Date().toISOString(),
    replayUrl,
    replayId: replayId || null,
    comboName,
    openingHand: openingHand || [],
    isSolo: !!isSolo,
    playerCards: playerCards || [],
    steps,
    endboard: field,
    endboardGraveyard: graveyard,
    endboardBanished: banished,
    rawLogLineCount: (logLines || []).length,
  };
}

function detectAction(text) {
  if (!text) return null;
  const cleaned = text.replace(/^\[\d+:\d+\]\s*/, '').trim();
  if (/^Normal Summoned/i.test(cleaned)) return 'Normal Summon';
  if (/^Link Summoned/i.test(cleaned)) return 'Link Summon';
  if (/^Synchro Summoned/i.test(cleaned)) return 'Synchro Summon';
  if (/^Xyz Summoned/i.test(cleaned)) return 'Xyz Summon';
  if (/^Fusion Summoned/i.test(cleaned)) return 'Fusion Summon';
  if (/^Pendulum Summoned/i.test(cleaned)) return 'Pendulum Summon';
  if (/^Special Summoned/i.test(cleaned)) return 'Special Summon';
  if (/^Tribute Summoned/i.test(cleaned)) return 'Tribute Summon';
  if (/^Flip Summoned/i.test(cleaned)) return 'Flip Summon';
  if (/^Activated/i.test(cleaned) || /^Declared effect/i.test(cleaned)) return 'Activate';
  if (/^Added .+ to .*hand/i.test(cleaned)) return 'Search';
  if (/^Set /.test(cleaned) && !/^Set up/i.test(cleaned)) return 'Set';
  // DuelingBook logs drag-to-zone as "Placed X from <source> to S-N" (vs the
  // formal "Set X in S-N" action). Manual placements at end-of-turn (e.g.,
  // setting Destruction as a Trap) only emit a Placed line. Treat as Set.
  if (/^Placed .+\s+to\s+(?:S-\d|(?:Left |Right )?Pendulum Zone|Field Spell Zone)/i.test(cleaned)) return 'Set';
  if (/^Sent .+ to .*GY/i.test(cleaned)) return 'Send to GY';
  if (/^Discarded/i.test(cleaned)) return 'Discard';
  if (/^Banished/i.test(cleaned)) return 'Banish';
  if (/^Tributed/i.test(cleaned)) return 'Tribute';
  if (/^Drew/i.test(cleaned)) return 'Draw';
  if (/^Destroyed/i.test(cleaned)) return 'Destroy';
  if (/^Detached/i.test(cleaned)) return 'Detach';
  // "Attached banished X (n/n) to Y in M-Z" — DuelingBook's explicit event for
  // an equip spell becoming Xyz material on a freshly-summoned Xyz monster.
  // Critical for ADRASTEIA/DOOMDURG-style flows where equip→material requires
  // the player to manually drag from banished pile onto the Xyz.
  if (/^Attached\b/i.test(cleaned)) return 'AttachMaterial';
  // "Moved X from M-1 to Left EMZ" — DB auto-moves an Xyz monster to its EMZ.
  // Tracked so the per-card zone follows the actual playmat position.
  if (/^Moved\b/i.test(cleaned)) return 'Move';
  if (/^Overlayed/i.test(cleaned)) return 'Overlay';
  if (/^Targeted/i.test(cleaned)) return 'Target';
  if (/^Attacked/i.test(cleaned)) return 'Attack';
  if (/^Revealed/i.test(cleaned)) return 'Reveal';
  if (/^Equipped/i.test(cleaned)) return 'Equip';
  if (/^Returned/i.test(cleaned)) return 'Return';
  return null;
}

function deriveComboName(openingHand, steps) {
  // Name the combo after the STARTER, not the first Normal Summon — many DoomZ
  // lines funnel into the same NS (Elara), which made every combo collide on
  // one name. The starter is the first card actually *played*; best of all is
  // the first opening-hand card that's played (the true "1-card starter").
  const PLAY = new Set(['Activate', 'Normal Summon', 'Special Summon']);
  const hand = new Set(openingHand || []);

  // 1) First opening-hand card that gets activated/summoned — the real opener.
  for (const s of steps) {
    if (PLAY.has(s.action) && s.cards) {
      const fromHand = s.cards.find(c => hand.has(c));
      if (fromHand) return fromHand;
    }
  }
  // 2) Otherwise the first real play of any card (started off a searched piece).
  for (const s of steps) {
    if (PLAY.has(s.action) && s.cards && s.cards.length > 0) return s.cards[0];
  }
  // 3) Legacy fallback: first Normal Summon.
  const firstNS = steps.find(s => s.action === 'Normal Summon' && s.cards);
  if (firstNS && firstNS.cards.length > 0) return firstNS.cards[0];
  // 4) Last resort: first card in opening hand.
  if (openingHand && openingHand.length > 0) return `Opening: ${openingHand[0]}`;
  return 'Unnamed combo';
}

// Field-state tracker — returns Array<{ card, materials?, isSet?, isField? }>.
// Models Xyz material stacking, alt-Xyz transfers (Summon "onto X"),
// detach, removal events, and Overlay pre-Xyz stacking.
function deriveEndboard(steps) {
  const field = []; // each entry: { card, materials: [], stacked: [] }
  // Field zones — monster, spell/trap, both EMZ slots, both Pendulum slots,
  // Field Spell zone. The Pendulum entries need explicit Left/Right variants
  // since DuelingBook always logs them with the prefix (no bare "Pendulum Zone").
  const FIELD_ZONE_RE = /from\s+(?:[MS]-\d|Left Extra Monster Zone|Right Extra Monster Zone|Field Spell Zone|Left Pendulum Zone|Right Pendulum Zone|Pendulum Zone)/;

  function findTop(name) {
    return field.findIndex(s => s.card === name);
  }
  function findStacked(name) {
    for (let i = 0; i < field.length; i++) {
      if ((field[i].stacked || []).some(s => s.card === name)) return i;
    }
    return -1;
  }
  function findTwoTop(nameA, nameB) {
    if (nameA !== nameB) return [findTop(nameA), findTop(nameB)];
    let first = -1, second = -1;
    for (let i = 0; i < field.length; i++) {
      if (field[i].card === nameA) {
        if (first < 0) first = i;
        else { second = i; break; }
      }
    }
    return [first, second];
  }

  // Pile tracking — cards that ended up in GY / banish / extra-deck after the combo.
  // Using ordered arrays (not sets) because duplicates matter for the player
  // (e.g., two DoomZ V Amalthes sent to GY).
  const graveyard = [];
  const banished = [];
  const pileRemove = (pile, name) => {
    const i = pile.indexOf(name);
    if (i >= 0) pile.splice(i, 1);
  };

  for (const step of steps) {
    if (!step || !step.cards || !step.cards.length) {
      // Allow Activate-without-cards through? No — most field events have cards.
      continue;
    }
    const action = step.action || '';
    const detail = step.detail || '';
    const primary = step.cards[0];

    if (action === 'Normal Summon' || action === 'Tribute Summon' || action === 'Flip Summon' ||
        action === 'Pendulum Summon' || action === 'Link Summon' || action === 'Synchro Summon' ||
        action === 'Fusion Summon' || action === 'Xyz Summon') {
      field.push({ card: primary, materials: [] });
    }
    else if (action === 'Special Summon') {
      // If summoned from GY, remove from GY pile (it's back on field)
      if (/from\s+GY\b/i.test(detail)) pileRemove(graveyard, primary);
      // "onto X" — Xyz/material-stacked summon. cards typically [Z, X].
      const isOnto = / onto /.test(detail);
      if (isOnto && step.cards.length >= 2) {
        const targetName = step.cards[1];
        const topIdx = findTop(targetName);
        if (topIdx >= 0) {
          // Z replaces X at top. Materials = [X, ...X's prior materials, ...stacked-under].
          const target = field[topIdx];
          const newMaterials = [
            { card: targetName, materials: [] },
            ...(target.materials || []),
            ...(target.stacked || []),
          ];
          field[topIdx] = { card: primary, materials: newMaterials };
        } else {
          // Maybe target was Overlay'd onto another card.
          const stackedIdx = findStacked(targetName);
          if (stackedIdx >= 0) {
            const owner = field[stackedIdx];
            const newMaterials = [];
            // Add the stacked target (and its materials) first
            for (const s of owner.stacked) {
              newMaterials.push({ card: s.card, materials: [] });
              for (const m of (s.materials || [])) newMaterials.push(m);
            }
            // Then add the owner (and its materials)
            newMaterials.push({ card: owner.card, materials: [] });
            for (const m of (owner.materials || [])) newMaterials.push(m);
            field[stackedIdx] = { card: primary, materials: newMaterials };
          } else {
            // Target unknown — push without materials
            field.push({ card: primary, materials: [] });
          }
        }
      } else {
        field.push({ card: primary, materials: [] });
      }
    }
    else if (action === 'Set') {
      // Idempotent — skip if the card was already placed (e.g., "Placed from
      // Deck to S-N" already ran, then "Set X in S-N" follows).
      if (findTop(primary) >= 0) continue;
      // Pull from GY / banished if the card is there. Critical for "Placed X
      // from GY to S-N" cases (e.g., Graflario placed back as a set trap)
      // so the card isn't double-counted between field and the source pile.
      const gyIdx = graveyard.indexOf(primary);
      if (gyIdx >= 0) graveyard.splice(gyIdx, 1);
      const banIdx = banished.indexOf(primary);
      if (banIdx >= 0) banished.splice(banIdx, 1);

      const isFieldSpell = /Field Spell/i.test(detail);
      const isPendulumZone = /Pendulum Zone/i.test(detail);
      // Pendulum scales sit face-up — don't render as set face-down.
      field.push({
        card: primary,
        materials: [],
        isSet: !isFieldSpell && !isPendulumZone,
        isField: isFieldSpell,
      });
    }
    else if (action === 'Overlay') {
      // cards = [moved, target]. Move 'moved' under 'target' as a stacked entry.
      if (step.cards.length >= 2) {
        const movedName = step.cards[0];
        const targetName = step.cards[1];
        const [movedIdx, targetIdx] = findTwoTop(movedName, targetName);
        if (movedIdx >= 0 && targetIdx >= 0 && movedIdx !== targetIdx) {
          const moved = field[movedIdx];
          // Splice the lower index first to keep the other valid
          const lower = Math.min(movedIdx, targetIdx);
          const higher = Math.max(movedIdx, targetIdx);
          const targetEntry = movedIdx === lower ? field[higher] : field[lower];
          const movedEntry = movedIdx === lower ? field[lower] : field[higher];
          // Rebuild array without the 'moved' entry
          const newField = field.filter((_, i) => i !== movedIdx);
          // Re-find target in newField
          const newTargetIdx = newField.indexOf(targetEntry);
          if (newTargetIdx >= 0) {
            const t = newField[newTargetIdx];
            t.stacked = t.stacked || [];
            t.stacked.push({ card: movedEntry.card, materials: movedEntry.materials || [] });
          }
          // Replace field contents
          field.length = 0;
          field.push(...newField);
        }
      }
    }
    else if (action === 'Send to GY' || action === 'Destroy' ||
             action === 'Tribute' || action === 'Discard') {
      // Remove from field if applicable
      if (FIELD_ZONE_RE.test(detail)) {
        const idx = findTop(primary);
        if (idx >= 0) field.splice(idx, 1);
      }
      // Add to GY pile — regardless of origin (Deck→GY, Field→GY, Hand→GY all go to GY)
      graveyard.push(primary);
    }
    else if (action === 'Banish') {
      if (FIELD_ZONE_RE.test(detail)) {
        const idx = findTop(primary);
        if (idx >= 0) field.splice(idx, 1);
      }
      // If card was in GY, move it from GY to Banish
      pileRemove(graveyard, primary);
      banished.push(primary);
    }
    else if (action === 'Return') {
      // Returns from field to hand/Extra Deck/deck
      if (FIELD_ZONE_RE.test(detail)) {
        const idx = findTop(primary);
        if (idx >= 0) field.splice(idx, 1);
      }
      // If returning from GY (e.g., salvage to hand) or Banish, remove from that pile
      if (/from\s+GY\b/i.test(detail)) pileRemove(graveyard, primary);
      if (/from\s+banish/i.test(detail)) pileRemove(banished, primary);
    }
    else if (action === 'Detach') {
      // cards = [material, parent]. Remove material from parent's materials.
      if (step.cards.length >= 2) {
        const matName = step.cards[0];
        const parentName = step.cards[1];
        const idx = findTop(parentName);
        if (idx >= 0) {
          const parent = field[idx];
          const matIdx = (parent.materials || []).findIndex(m => m.card === matName);
          if (matIdx >= 0) parent.materials.splice(matIdx, 1);
        }
      }
    }
    else if (action === 'AttachMaterial') {
      // cards = [material, owner]. The material moves from its current pile
      // (banished / GY / hand / field) into the owner's Xyz materials.
      if (step.cards.length >= 2) {
        const matName = step.cards[0];
        const ownerName = step.cards[1];
        // Pull from whatever pile the source detail mentions
        if (/banished/i.test(detail)) {
          const i = banished.indexOf(matName);
          if (i >= 0) banished.splice(i, 1);
        } else if (/from\s+GY/i.test(detail)) {
          const i = graveyard.indexOf(matName);
          if (i >= 0) graveyard.splice(i, 1);
        } else {
          // Fallback — try field
          const fIdx = findTop(matName);
          if (fIdx >= 0) field.splice(fIdx, 1);
        }
        // Attach to the owner monster (idempotent — skip if already there)
        const ownerIdx = findTop(ownerName);
        if (ownerIdx >= 0) {
          const owner = field[ownerIdx];
          owner.materials = owner.materials || [];
          const exists = owner.materials.some(m =>
            (typeof m === 'string' ? m : m && m.card) === matName
          );
          if (!exists) owner.materials.push({ card: matName, materials: [] });
        }
      }
    }
    else if (action === 'Activate') {
      // Spell/Trap/Field Spell activation that places it on the field for the first time.
      // Examples: "Activated DoomZ Raiders from hand (1/1) to S-3"
      //           "Activated Field Spell Null Power Patron Realm - Vidria from hand (1/2)"
      const placesOnField = /Activated\b.*from\s+hand.*\bto\s+(?:S-\d|Field Spell Zone|(?:Left|Right) Pendulum Zone)/i.test(detail) ||
                            /Activated\s+Field Spell\b/i.test(detail);
      // DuelingBook sometimes skips the explicit "Activated to S-N" step and the
      // first sign of a card is "Declared effect of X in S-N" / "in Pendulum Zone".
      // Treat that as the implicit placement so the field state stays correct.
      const declaredOnField = /Declared effect.*in\s+(?:S-\d|(?:Left|Right)\s+Pendulum Zone|Field Spell Zone)/i.test(detail);
      if ((placesOnField || declaredOnField) && findTop(primary) < 0) {
        const isFieldSpell = /Field Spell/i.test(detail);
        field.push({ card: primary, materials: [], isField: isFieldSpell });
      }
    }
  }

  // Flatten into output entries — materials + stacked merged into a single name list
  const flatField = field.map(slot => {
    const matNames = (slot.materials || []).map(m => m.card);
    const stackNames = [];
    for (const s of (slot.stacked || [])) {
      stackNames.push(s.card);
      for (const m of (s.materials || [])) stackNames.push(m.card);
    }
    const allMats = [...matNames, ...stackNames];
    const out = { card: slot.card };
    if (allMats.length) out.materials = allMats;
    if (slot.isSet) out.isSet = true;
    if (slot.isField) out.isField = true;
    return out;
  });

  return { field: flatField, graveyard, banished };
}

// ============================================================
// Utilities
// ============================================================
function setProgress(data) {
  return chrome.storage.local.set({
    extractionProgress: { ...data, updatedAt: new Date().toISOString() }
  });
}

function waitForTabLoad(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tab load timeout'));
    }, timeoutMs);

    const listener = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        // Give SPA extra time to initialize
        setTimeout(resolve, 3000);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function pollForResult(maxWaitMs) {
  const start = Date.now();
  const POLL_INTERVAL = 1500;
  while (Date.now() - start < maxWaitMs) {
    if (extractionCancelled) return null;
    const stored = await chrome.storage.local.get('comboImportRawResult');
    if (stored.comboImportRawResult) {
      await chrome.storage.local.remove('comboImportRawResult');
      return stored.comboImportRawResult;
    }
    await sleep(POLL_INTERVAL);
  }
  throw new Error('Extraction timed out after 5 minutes');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
