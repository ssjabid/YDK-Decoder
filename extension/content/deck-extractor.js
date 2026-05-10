// YDK Decoder — Deck Extractor (content script)
//
// Ported from the proven DuelMetrics v4.0 deck-extractor. Runs as a
// content script (registered in manifest.json under content_scripts) so
// it auto-loads on every duelingbook.com page at document_idle. The
// popup talks to it via chrome.tabs.sendMessage, NOT chrome.scripting
// .executeScript — that's the key difference that makes this work.
//
// What it does:
//   - On any DB page, after a 2s settle, scans the active deck constructor
//     for main / side / extra cards and caches the result.
//   - Listens for two messages from the popup:
//       { action: 'exportDeck' }     → returns the active deck
//       { action: 'scanAllDecks' }   → walks every entry in the deck
//                                      dropdown, scans each, writes the
//                                      lot to chrome.storage.local.savedDecks
//   - For both flows, also writes the latest single deck to
//     chrome.storage.local.latestScannedDeck, plus a .ydk-formatted string
//     so other code can use it directly.
//
// DB DOM shape (the breakthrough):
//   Main:  #deck_constructor div.deck_cards .cardfront
//   Side:  #deck_constructor div.side_cards .cardfront
//   Extra: #deck_constructor div.extra_cards .cardfront
//   Each .cardfront has div.cardfront_content with:
//     span.name_txt     — card name
//     span.passcode_txt — 6-8 digit passcode (what we need for .ydk)
//   Deck name: select#decklist_cb (selectedOption text)

// ====== Extension-context guard ======
// If the extension was reloaded mid-page-life, chrome.runtime.id becomes
// undefined and any chrome.* call throws. Guard everything.
(function checkExtensionContext() {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    if (typeof chrome !== 'undefined') {
      if (!chrome.storage) chrome.storage = { local: { get: () => {}, set: () => {}, remove: () => {} } };
      if (!chrome.runtime) chrome.runtime = { id: null, onMessage: { addListener: () => {} }, sendMessage: () => {} };
    }
    console.log('[YDK Deck] Extension context patched (invalidated)');
  }
})();

function isExtensionValid() {
  try { return !!(chrome && chrome.runtime && chrome.runtime.id); }
  catch (e) { return false; }
}

function safeAddMessageListener(handler) {
  if (!isExtensionValid()) return;
  try { chrome.runtime.onMessage.addListener(handler); }
  catch (e) { console.warn('[YDK Deck] Cannot add message listener', e.message); }
}

// Skip on replay pages — that's combo-import-helper's territory.
if (window.location.href.includes('/replay?id=') || window.location.href.includes('/replay?id%3D')) {
  console.log('[YDK Deck] On replay page, skipping');
} else {

const YDK_DECK_BUILD = 'deck-extractor-2026-04-26-v6-content-script';
console.log('[YDK Deck] Loaded —', YDK_DECK_BUILD);

// Module-level cache so message handlers don't have to re-scan
let cachedDeck = null;

// Auto-scan after page settles. The deck constructor needs a moment to
// populate its DOM after route changes.
setTimeout(() => {
  if (!isExtensionValid()) return;
  const deck = extractDeckList();
  if (deck) {
    cachedDeck = deck;
    persistLatestDeck(deck);
    console.log(`[YDK Deck] auto-scan found ${deck.cardCount} cards (deckName="${deck.deckName}")`);
  } else {
    console.log('[YDK Deck] auto-scan: no deck constructor on this page yet');
  }
}, 2000);

// ─────────────────────────────────────────────────────────────────
// Message handlers — popup invokes these via chrome.tabs.sendMessage.
// ─────────────────────────────────────────────────────────────────
safeAddMessageListener((message, sender, sendResponse) => {
  if (message && message.action === 'exportDeck') {
    try {
      const fresh = extractDeckList();
      if (fresh) cachedDeck = fresh;
      const deck = cachedDeck;
      if (!deck) {
        sendResponse({ success: false, error: 'No deck found. Open the Deck Constructor on DB first.' });
        return true;
      }
      const payload = toExtractedPayload(deck);
      persistLatestDeck(deck);
      console.log(`[YDK Deck] exportDeck → ${payload.counts.total} cards`);
      sendResponse({ success: true, ...payload });
    } catch (err) {
      console.error('[YDK Deck] exportDeck error', err);
      sendResponse({ success: false, error: err.message });
    }
    return true; // keep channel open for sendResponse
  }

  if (message && message.action === 'scanAllDecks') {
    const deckSelectEl = document.querySelector('select#decklist_cb');
    if (!deckSelectEl) {
      sendResponse({ success: false, error: 'Deck Constructor not open. Open it first.' });
      return true;
    }
    const options = Array.from(deckSelectEl.options);
    const originalIndex = deckSelectEl.selectedIndex;
    const results = {};

    (async () => {
      for (let i = 0; i < options.length; i++) {
        const rawText = options[i].text || '';
        const deckName = rawText.replace(/\s*\(default\)\s*$/i, '').trim() || `Deck ${i + 1}`;

        deckSelectEl.selectedIndex = i;
        deckSelectEl.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(r => setTimeout(r, 1200));  // wait for cards to load

        const deck = extractDeckList();
        if (deck && deck.cardCount > 0) {
          results[deckName] = {
            ...deck,
            ydk: buildYdkFromDeck(deck),
            scannedAt: new Date().toISOString(),
          };
          // Progress for the popup to read live
          try {
            chrome.storage.local.set({
              deckScanProgress: { scanned: Object.keys(results).length, total: options.length, currentDeck: deckName },
            });
          } catch (_) {}
        }
      }

      // Restore the user's original selection
      deckSelectEl.selectedIndex = originalIndex;
      deckSelectEl.dispatchEvent(new Event('change', { bubbles: true }));

      // Persist and respond
      try {
        chrome.storage.local.set({
          savedDecks: results,
          deckScanProgress: null,
          savedDecksAt: new Date().toISOString(),
        });
      } catch (_) {}
      console.log(`[YDK Deck] scanAllDecks → ${Object.keys(results).length} decks saved`);
      sendResponse({ success: true, count: Object.keys(results).length, decks: results });
    })();

    return true;  // async sendResponse
  }

  return false;  // not for us
});

// ─────────────────────────────────────────────────────────────────
// Extraction — DOM walk using DB's actual structure
// ─────────────────────────────────────────────────────────────────
function extractCardsFromContainer(containerSelector) {
  const cards = [];
  const cardfronts = document.querySelectorAll(`${containerSelector} .cardfront`);
  for (const cardDiv of cardfronts) {
    const content = cardDiv.querySelector('div.cardfront_content') || cardDiv;
    const nameEl = content.querySelector('span.name_txt');
    const name = nameEl && nameEl.innerText && nameEl.innerText.trim();
    if (!name) continue;
    const passEl = content.querySelector('span.passcode_txt');
    const passcode = passEl && passEl.innerText && passEl.innerText.trim();
    cards.push({
      name,
      id: passcode || '',
      type: (content.querySelector('span.type_txt') || {}).innerText?.trim() || '',
    });
  }
  return cards;
}

function deduplicateCards(cards) {
  const counts = {};
  for (const card of cards) {
    const key = card.id || card.name;
    if (!key) continue;
    if (counts[key]) counts[key].quantity++;
    else counts[key] = { ...card, quantity: 1 };
  }
  return Object.values(counts);
}

function extractDeckList() {
  // Bail out if the deck constructor isn't visible at all
  const dc = document.querySelector('#deck_constructor');
  if (!dc) {
    if (!document.querySelector('div.deck_cards')) return null;
  }

  // Deck name from the dropdown
  let deckName = 'Unnamed Deck';
  const deckSelect = document.querySelector('select#decklist_cb');
  if (deckSelect && deckSelect.selectedIndex >= 0) {
    const t = (deckSelect.options[deckSelect.selectedIndex] || {}).text;
    if (t) deckName = t.replace(/\s*\(default\)\s*$/i, '').trim();
  }

  // Try the canonical selectors first, then fall back without #deck_constructor
  let mainRaw  = extractCardsFromContainer('#deck_constructor div.deck_cards');
  if (!mainRaw.length)  mainRaw  = extractCardsFromContainer('div.deck_cards');
  let sideRaw  = extractCardsFromContainer('#deck_constructor div.side_cards');
  if (!sideRaw.length)  sideRaw  = extractCardsFromContainer('div.side_cards');
  let extraRaw = extractCardsFromContainer('#deck_constructor div.extra_cards');
  if (!extraRaw.length) extraRaw = extractCardsFromContainer('div.extra_cards');

  // _bg containers as a secondary fallback
  if (!mainRaw.length)  mainRaw  = extractCardsFromContainer('#deck_constructor div.deck_bg');
  if (!sideRaw.length)  sideRaw  = extractCardsFromContainer('#deck_constructor div.side_bg');
  if (!extraRaw.length) extraRaw = extractCardsFromContainer('#deck_constructor div.extra_bg');

  if (!mainRaw.length && !sideRaw.length && !extraRaw.length) return null;

  return {
    deckName,
    cardCount: mainRaw.length + sideRaw.length + extraRaw.length,
    main: deduplicateCards(mainRaw),
    side: deduplicateCards(sideRaw),
    extra: deduplicateCards(extraRaw),
    main_raw_count: mainRaw.length,
    side_raw_count: sideRaw.length,
    extra_raw_count: extraRaw.length,
  };
}

// ─────────────────────────────────────────────────────────────────
// Format conversion — DuelMetrics shape → our app's expected shape
// ─────────────────────────────────────────────────────────────────

// Expand a deduped section back into a flat passcode list, repeated
// per-copy. (.ydk format wants every individual card on its own line.)
function expandSectionToPasscodes(deduped) {
  const out = [];
  for (const card of deduped || []) {
    const id = card.id || '';
    if (!/^\d{6,8}$/.test(id)) continue;  // skip placeholder/missing
    const qty = Math.max(1, parseInt(card.quantity, 10) || 1);
    for (let i = 0; i < qty; i++) out.push(id);
  }
  return out;
}

function buildYdkFromDeck(deck) {
  const main = expandSectionToPasscodes(deck.main);
  const extra = expandSectionToPasscodes(deck.extra);
  const side = expandSectionToPasscodes(deck.side);
  const lines = [
    '#created by YDK Decoder Extension',
    `#${deck.deckName || 'deck'}`,
    '#main',
    ...main,
    '#extra',
    ...extra,
    '!side',
    ...side,
  ];
  return lines.join('\n') + '\n';
}

// Convert the rich DuelMetrics shape into what the rest of our extension
// expects — keeps the popup's renderDeckResult / saveDeckToDecoder flow
// unchanged regardless of where the deck came from.
function toExtractedPayload(deck) {
  const main  = expandSectionToPasscodes(deck.main);
  const extra = expandSectionToPasscodes(deck.extra);
  const side  = expandSectionToPasscodes(deck.side);
  return {
    deckName: deck.deckName || 'Unnamed Deck',
    counts: {
      main: main.length,
      extra: extra.length,
      side: side.length,
      total: main.length + extra.length + side.length,
    },
    main, extra, side,
    ydk: buildYdkFromDeck(deck),
    pageUrl: window.location.href,
    build: YDK_DECK_BUILD,
    // Keep the rich shape too in case downstream wants it (names, types)
    deckRich: deck,
  };
}

function persistLatestDeck(deck) {
  if (!isExtensionValid()) return;
  try {
    chrome.storage.local.set({
      latestScannedDeck: {
        ...toExtractedPayload(deck),
        scannedAt: new Date().toISOString(),
      },
    });
  } catch (_) {}
}

} // end "not on replay page" guard
