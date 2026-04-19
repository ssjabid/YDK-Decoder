// Extension context guard — MUST BE FIRST LINE
(function checkExtensionContext() {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    if (typeof chrome !== 'undefined') {
      if (!chrome.storage) chrome.storage = { local: { get: ()=>{}, set: ()=>{}, remove: ()=>{} } };
      if (!chrome.runtime) chrome.runtime = { id: null, onMessage: { addListener: ()=>{} }, sendMessage: ()=>{} };
    }
  }
})();

// DuelMetrics: Combo Import Helper
// Injected on replay pages for the "Import from Replay" feature.
// Unlike replay-extractor.js (which is designed for batch extraction with sendResponse),
// this script streams progress to chrome.storage.local so the popup can show real-time updates.
//
// Solo mode replays DON'T have "Left duel". We detect end by:
// 1. Fast Forward finishes (no more lines being added)
// 2. The last red player action was a while ago (idle detection)
// 3. The replay controls show it's complete

console.log('DuelMetrics: Combo Import Helper loaded');

let ffSpeedInterval = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractComboFromReplay') {
    // Start extraction — write result to storage when done
    // Do NOT rely on sendResponse — the channel may die for long replays
    runComboExtraction(message.replayUrl)
      .then(async (result) => {
        console.log('DuelMetrics: Combo extraction complete, writing to storage');
        try {
          await chrome.storage.local.set({ comboImportRawResult: result });
          await updateProgress({
            status: 'extraction_done',
            stepsExtracted: result.logLineCount || 0,
            success: result.success
          });
        } catch (e) {
          console.error('DuelMetrics: Failed to write result to storage', e);
        }
        // Also try sendResponse as backup (will fail if channel is closed — that's fine)
        try { sendResponse(result); } catch (e) {}
      })
      .catch(async (error) => {
        console.error('DuelMetrics: Combo extraction failed:', error);
        try {
          await chrome.storage.local.set({
            comboImportRawResult: { success: false, error: error.message }
          });
          await updateProgress({ status: 'error', error: error.message });
        } catch (e) {}
        try { sendResponse({ success: false, error: error.message }); } catch (e) {}
      });
    return true;
  }
  return false;
});

async function updateProgress(data) {
  try {
    await chrome.storage.local.set({
      comboImportProgress: {
        ...data,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (e) {
    console.warn('DuelMetrics: Progress update failed', e);
  }
}

async function runComboExtraction(replayUrl) {
  console.log('DuelMetrics: Starting combo extraction from replay');

  // Step 1: Find and click #log_btn (with retries)
  await updateProgress({ status: 'clicking_log', stepsExtracted: 0 });

  let logBtn = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    logBtn = document.querySelector('#log_btn');
    if (logBtn) break;
    console.log(`DuelMetrics: Waiting for #log_btn (attempt ${attempt + 1}/10)...`);
    await sleep(2000);
  }

  if (!logBtn) {
    return { success: false, error: 'Could not find Log button (#log_btn) on the replay page. The page may not have loaded correctly.' };
  }

  logBtn.click();
  console.log('DuelMetrics: Clicked #log_btn');
  await sleep(2000);

  // Step 2: Find the log container (with retries)
  let logContainer = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    logContainer = document.querySelector('#duel_log div.log_txt');
    if (logContainer) break;
    console.log(`DuelMetrics: Waiting for log container (attempt ${attempt + 1}/8)...`);
    await sleep(1500);
  }

  if (!logContainer) {
    return { success: false, error: 'Could not find log container. Log panel may not have opened.' };
  }

  console.log('DuelMetrics: Log container found');

  // Step 3: Click Fast Forward (with retries)
  await updateProgress({ status: 'clicking_ff', stepsExtracted: 0 });

  let ffClicked = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    const ffButton = findFastForwardButton();
    if (ffButton) {
      ffButton.click();
      ffClicked = true;
      console.log('DuelMetrics: Clicked Fast Forward');
      break;
    }
    // Try Play button as fallback
    const playBtn = document.querySelector('#play_btn') ||
                    document.querySelector('input[value="Play"]');
    if (playBtn) {
      playBtn.click();
      ffClicked = true;
      console.log('DuelMetrics: Clicked Play (Fast Forward not found)');
      break;
    }
    console.log(`DuelMetrics: Waiting for FF/Play button (attempt ${attempt + 1}/5)...`);
    await sleep(2000);
  }

  if (!ffClicked) {
    return { success: false, error: 'Could not find Fast Forward or Play button.' };
  }

  // SPEED HACK: Click FF repeatedly to keep replay moving at max speed
  // Duelingbook sometimes pauses between actions — re-clicking FF resumes it
  ffSpeedInterval = setInterval(() => {
    try { const ff = findFastForwardButton(); if (ff) ff.click(); } catch (e) {}
  }, 500);

  // Step 4: Watch the replay play out with real-time progress updates
  await updateProgress({ status: 'watching', stepsExtracted: 0, liveSteps: [] });

  const extractionResult = await watchReplayWithProgress(logContainer);

  // Step 5: Parse final result
  await updateProgress({ status: 'parsing', stepsExtracted: extractionResult.lineCount });

  return extractionResult;
}

/**
 * Watch the replay as it plays, streaming progress updates.
 * Handles BOTH solo mode replays (no "Left duel") and regular replays.
 */
async function watchReplayWithProgress(logContainer) {
  return new Promise((resolve) => {
    let lastLineCount = 0;
    let stableCount = 0; // how many consecutive polls with no new lines
    let resolved = false;
    let allLines = [];
    let liveSteps = [];
    const MAX_WAIT = 300000; // 5 minutes max
    const STABLE_THRESHOLD = 6; // 6 consecutive polls (12 seconds) with no new lines = done
    const POLL_INTERVAL = 2000;

    function finish(reason) {
      if (resolved) return;
      resolved = true;
      clearInterval(pollTimer);
      clearTimeout(maxTimer);
      if (ffSpeedInterval) { clearInterval(ffSpeedInterval); ffSpeedInterval = null; }
      console.log(`DuelMetrics: Replay extraction finished (${reason}), ${allLines.length} lines`);

      // Do final extraction
      const result = buildFinalResult(logContainer, reason);
      resolve(result);
    }

    function checkForNewLines() {
      if (resolved) return;

      const fontElements = logContainer.querySelectorAll('font');
      const topLevelFonts = Array.from(fontElements).filter(f =>
        !f.classList.contains('card_hover') && f.parentElement?.tagName !== 'FONT'
      );

      const currentCount = topLevelFonts.length;

      if (currentCount > lastLineCount) {
        // New lines appeared — reset stable counter
        stableCount = 0;

        // Process new lines
        const newFonts = topLevelFonts.slice(lastLineCount);
        lastLineCount = currentCount;

        for (const font of newFonts) {
          const text = (font.textContent || '').replace(/\n/g, ' ').trim();
          const color = font.getAttribute('color') || '';
          const player = color === '#FF0000' ? 'red'
                       : color === '#0000FF' ? 'blue'
                       : 'system';

          const cardHovers = font.querySelectorAll('font.card_hover');
          const cardNames = Array.from(cardHovers)
            .map(ch => ch.textContent?.trim())
            .filter(Boolean);

          allLines.push({ text, color, player, cardNames });

          // Build live step for this line (red player actions only)
          if (player === 'red') {
            const cleanText = text.replace(/^\[[\d:]+\]\s*/, '');
            const action = quickDetectAction(cleanText);
            if (action && cardNames.length > 0) {
              liveSteps.push({
                step: liveSteps.length + 1,
                action,
                card: cardNames[0] || '',
                detail: cleanText
              });
            }
          }

          // Check for definitive end signals
          if (text.includes('Left duel')) {
            // Give a moment for any final lines
            setTimeout(() => finish('left_duel'), 3000);
            return;
          }
        }

        // Update progress with live steps (throttled — every 2 seconds via poll)
        updateProgress({
          status: 'watching',
          stepsExtracted: allLines.length,
          liveSteps: liveSteps.slice(-20) // last 20 steps
        }).catch(() => {}); // ignore storage errors during streaming

      } else {
        // No new lines this poll
        stableCount++;

        if (stableCount >= STABLE_THRESHOLD) {
          // 12+ seconds with no new lines — replay is done
          finish('stable_idle');
        }
      }
    }

    const pollTimer = setInterval(checkForNewLines, POLL_INTERVAL);
    const maxTimer = setTimeout(() => finish('max_timeout'), MAX_WAIT);

    // Also do an immediate check
    checkForNewLines();
  });
}

/**
 * Build the final extraction result after replay finishes.
 * Re-reads the log container for complete data.
 */
function buildFinalResult(logContainer, completionReason) {
  // Re-extract all lines from the complete log
  const allFonts = logContainer.querySelectorAll('font');
  const topLevelFonts = Array.from(allFonts).filter(f =>
    !f.classList.contains('card_hover') && f.parentElement?.tagName !== 'FONT'
  );

  const logLines = topLevelFonts.map(font => {
    const text = (font.textContent || '').replace(/\n/g, ' ').trim();
    const color = font.getAttribute('color') || '';
    const player = color === '#FF0000' ? 'red'
                 : color === '#0000FF' ? 'blue'
                 : 'system';
    const cardHovers = font.querySelectorAll('font.card_hover');
    const cardNames = Array.from(cardHovers)
      .map(ch => ch.textContent?.trim())
      .filter(Boolean);
    const tsMatch = text.match(/^\[(\d+:\d+)\]/);
    const timestamp = tsMatch ? tsMatch[1] : null;

    return { text, color, player, cardNames, timestamp };
  });

  const rawLog = logContainer.innerText || '';

  // Extract card names
  const redCards = new Set();
  const blueCards = new Set();
  for (const line of logLines) {
    if (line.player === 'system') continue;
    const target = line.player === 'red' ? redCards : blueCards;
    for (const card of (line.cardNames || [])) target.add(card);
  }

  // Solo mode detection
  const isSolo = logLines.some(l => l.text.includes('entered Solo Mode'));

  // Structured log lines for export
  const structuredLogLines = logLines.map(line => ({
    player: line.player,
    text: line.text.replace(/^\[[\d:]+\]\s*/, ''),
    timestamp: line.timestamp || null,
    cards: line.cardNames.length > 0 ? line.cardNames : undefined
  }));

  // Opening hand (first 5-6 Drew lines for red player)
  const openingHand = [];
  for (const line of logLines) {
    if (openingHand.length >= 6) break;
    if (line.player !== 'red') continue;
    const t = line.text.replace(/^\[[\d:]+\]\s*/, '');
    if (t.includes('Drew ') && line.cardNames.length > 0) {
      openingHand.push(line.cardNames[0]);
    }
    // Stop at first non-draw action
    if (t.includes('Summoned') || t.includes('Activated') || t.includes('Entered Main')) {
      break;
    }
  }

  // Get replay ID from URL
  const replayId = new URLSearchParams(window.location.search).get('id');

  return {
    success: true,
    replayId,
    replayUrl: window.location.href,
    fullLog: rawLog,
    logLineCount: logLines.length,
    logLines: structuredLogLines,
    playerCards: Array.from(redCards).sort(),
    opponentCards: Array.from(blueCards).sort(),
    isSolo,
    completionReason,
    extractedAt: new Date().toISOString(),
    // Include raw opening hand for the combo
    openingHand,
    // Include games split (needed by service worker for buildComboFromReplayResult)
    games: [{
      gameNumber: 1,
      playerOpeningHand: openingHand,
      result: isSolo ? 'practice' : 'unknown',
      isSolo
    }]
  };
}

/**
 * Quick action detection for live step display.
 */
function quickDetectAction(text) {
  if (text.includes('Normal Summoned')) return 'Normal Summon';
  if (text.includes('Link Summoned')) return 'Link Summon';
  if (text.includes('Synchro Summoned')) return 'Synchro Summon';
  if (text.includes('Xyz Summoned')) return 'Xyz Summon';
  if (text.includes('Fusion Summoned')) return 'Fusion Summon';
  if (text.includes('Special Summoned')) return 'Special Summon';
  if (text.includes('Activated ') || text.includes('Declared effect')) return 'Activate';
  if (text.includes('Added') && text.includes('hand')) return 'Search';
  if (text.includes('Set ') && !text.includes('Set up')) return 'Set';
  if (text.includes('Sent ') && text.includes('GY')) return 'Send to GY';
  if (text.includes('Banished ')) return 'Banish';
  if (text.includes('Tributed ')) return 'Tribute';
  if (text.includes('Drew ')) return 'Draw';
  if (text.includes('Destroyed ')) return 'Destroy';
  if (text.includes('Detached ')) return 'Detach';
  return null;
}

/**
 * Find the Fast Forward button (same logic as replay-extractor.js).
 */
function findFastForwardButton() {
  const selectors = [
    'input[value="Fast Forward"]',
    '#fast_forward_btn',
    'input[value="fast forward"]',
    'button[title="Fast Forward"]'
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  const inputs = document.querySelectorAll('input[type="button"], input[type="submit"], button');
  for (const input of inputs) {
    const text = (input.value || input.textContent || '').toLowerCase();
    if (text.includes('fast') && text.includes('forward')) return input;
  }
  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
