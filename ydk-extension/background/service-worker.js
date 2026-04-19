// YDK Decoder Extension — Minimal Service Worker
// Orchestrates replay extraction: open tab → inject script → poll for result → clean up
// Based on proven logic from DuelMetrics v4.0 (stripped to essentials)

console.log('YDK Extension: Service worker loaded');

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
  return false;
});

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
  const { logLines, openingHand, playerCards, replayId } = rawResult;

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

  // Extract endboard from final state (cards summoned/set that aren't destroyed)
  const endboard = deriveEndboard(steps);

  return {
    version: 1,
    extractedAt: new Date().toISOString(),
    replayUrl,
    replayId: replayId || null,
    comboName,
    openingHand: openingHand || [],
    playerCards: playerCards || [],
    steps,
    endboard,
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
  if (/^Sent .+ to .*GY/i.test(cleaned)) return 'Send to GY';
  if (/^Discarded/i.test(cleaned)) return 'Discard';
  if (/^Banished/i.test(cleaned)) return 'Banish';
  if (/^Tributed/i.test(cleaned)) return 'Tribute';
  if (/^Drew/i.test(cleaned)) return 'Draw';
  if (/^Destroyed/i.test(cleaned)) return 'Destroy';
  if (/^Detached/i.test(cleaned)) return 'Detach';
  if (/^Overlayed/i.test(cleaned)) return 'Overlay';
  if (/^Targeted/i.test(cleaned)) return 'Target';
  if (/^Attacked/i.test(cleaned)) return 'Attack';
  if (/^Revealed/i.test(cleaned)) return 'Reveal';
  if (/^Equipped/i.test(cleaned)) return 'Equip';
  if (/^Returned/i.test(cleaned)) return 'Return';
  return null;
}

function deriveComboName(openingHand, steps) {
  // Best heuristic: first Normal Summon = combo starter
  const firstNS = steps.find(s => s.action === 'Normal Summon' && s.cards);
  if (firstNS && firstNS.cards.length > 0) {
    return firstNS.cards[0];
  }
  // Fallback: first card in opening hand
  if (openingHand && openingHand.length > 0) {
    return `Opening: ${openingHand[0]}`;
  }
  return 'Unnamed combo';
}

function deriveEndboard(steps) {
  // Naive heuristic: cards that were summoned/set and not destroyed later
  const onField = new Set();
  for (const step of steps) {
    if (!step.cards) continue;
    if (step.action && step.action.includes('Summon')) {
      step.cards.forEach(c => onField.add(c));
    }
    if (step.action === 'Set') {
      step.cards.forEach(c => onField.add(c + ' (set)'));
    }
    if (step.action === 'Destroy' || step.action === 'Send to GY' || step.action === 'Tribute') {
      step.cards.forEach(c => {
        onField.delete(c);
        onField.delete(c + ' (set)');
      });
    }
  }
  return Array.from(onField);
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
