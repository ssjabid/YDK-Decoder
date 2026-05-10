// YDK Decoder Extension — Popup Logic

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('replay-url');
  const btnExtract = document.getElementById('btn-extract');
  const statusEl = document.getElementById('status');
  const statusLabel = document.getElementById('status-label');
  const statusMsg = document.getElementById('status-msg');
  const progressFill = document.getElementById('progress-fill');
  const resultPanel = document.getElementById('result-panel');
  const resultTitle = document.getElementById('result-title');
  const resultMeta = document.getElementById('result-meta');
  const resultSteps = document.getElementById('result-steps');
  const btnOpenDecoder = document.getElementById('btn-open-decoder');
  const btnCopyJson = document.getElementById('btn-copy-json');
  const btnReset = document.getElementById('btn-reset');

  // Deck-extraction elements
  const btnExtractDeck = document.getElementById('btn-extract-deck');
  const btnScanAllDecks = document.getElementById('btn-scan-all-decks');
  const scanProgressEl = document.getElementById('scan-progress');
  const deckResultEl = document.getElementById('deck-result');
  const deckResultName = document.getElementById('deck-result-name');
  const deckResultCounts = document.getElementById('deck-result-counts');
  const btnCopyYdk = document.getElementById('btn-copy-ydk');
  const btnDownloadYdk = document.getElementById('btn-download-ydk');
  const btnSaveDeck = document.getElementById('btn-save-deck');

  // .ydk file dropzone
  const ydkDropzone = document.getElementById('ydk-dropzone');
  const ydkFileInput = document.getElementById('ydk-file-input');

  // Deck library
  const deckLibraryEl = document.getElementById('deck-library');

  let latestCombo = null;
  let latestDeck = null;
  let pollTimer = null;

  // ============================================================
  // Extract button
  // ============================================================
  btnExtract.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
      showStatus('Please paste a DuelingBook replay URL', 'error');
      return;
    }
    if (!url.includes('duelingbook.com/replay')) {
      showStatus('URL must be a DuelingBook replay link', 'error');
      return;
    }

    btnExtract.disabled = true;
    resultPanel.classList.add('hidden');
    showStatus('Starting extraction…', null);

    try {
      await chrome.runtime.sendMessage({
        action: 'extractReplay',
        replayUrl: url
      });
      // Start polling for progress
      startPolling();
    } catch (e) {
      showStatus('Failed to start extraction: ' + e.message, 'error');
      btnExtract.disabled = false;
    }
  });

  // ============================================================
  // Progress polling
  // ============================================================
  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(pollProgress, 1000);
    pollProgress();
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function pollProgress() {
    const { extractionProgress, latestCombo: combo } =
      await chrome.storage.local.get(['extractionProgress', 'latestCombo']);

    if (!extractionProgress) return;

    const status = extractionProgress.status;

    const labels = {
      opening: { label: 'Opening replay', pct: 15 },
      loading: { label: 'Loading page', pct: 30 },
      injecting: { label: 'Injecting extractor', pct: 45 },
      extracting: { label: 'Watching replay (this can take up to 3 min)', pct: 65 },
      parsing: { label: 'Parsing combo', pct: 90 },
      complete: { label: 'Complete', pct: 100 },
      error: { label: 'Error', pct: 0 },
      cancelled: { label: 'Cancelled', pct: 0 },
    };

    const info = labels[status] || { label: status, pct: 50 };

    if (status === 'complete' && combo) {
      stopPolling();
      latestCombo = combo;
      showStatus('✓ Extraction complete', 'success');
      progressFill.style.width = '100%';
      progressFill.classList.remove('animate');
      renderResult(combo);
      btnExtract.disabled = false;
      // Clear progress marker so we don't re-show
      chrome.storage.local.remove('extractionProgress');
    } else if (status === 'error') {
      stopPolling();
      showStatus('✗ ' + (extractionProgress.error || 'Unknown error'), 'error');
      progressFill.style.width = '0%';
      progressFill.classList.remove('animate');
      btnExtract.disabled = false;
      chrome.storage.local.remove('extractionProgress');
    } else if (status === 'cancelled') {
      stopPolling();
      showStatus('Cancelled', null);
      progressFill.style.width = '0%';
      progressFill.classList.remove('animate');
      btnExtract.disabled = false;
      chrome.storage.local.remove('extractionProgress');
    } else {
      showStatus(info.label + '…', null);
      progressFill.style.width = info.pct + '%';
      progressFill.classList.add('animate');
    }
  }

  // ============================================================
  // Result display
  // ============================================================
  function renderResult(combo) {
    resultPanel.classList.remove('hidden');

    // EMPTY EXTRACTION — the helper ran but scraped 0 lines from the log.
    // Don't let the user click "Open in Decoder" on garbage data.
    const empty = !combo.steps || combo.steps.length === 0 || combo.rawLogLineCount === 0;
    if (empty) {
      resultTitle.textContent = 'Extraction returned no data';
      resultMeta.innerHTML =
        `<span style="color: #e55b3c;">0 log lines captured.</span> The replay page didn't produce any log entries in time. Common causes:` +
        `<ul style="margin: 8px 0 0 16px; padding: 0; color: var(--text-dim); font-size: 11px; line-height: 1.6;">` +
        `<li>Replay URL was invalid or the page failed to load</li>` +
        `<li>DuelingBook's log panel didn't open (log button not found)</li>` +
        `<li>Fast-Forward wasn't clicked fast enough, replay auto-completed before logs streamed</li>` +
        `<li>Extension was reloaded mid-extraction</li>` +
        `</ul>` +
        `<div style="margin-top: 10px; color: var(--text-dim); font-size: 11px;"><strong>Fix:</strong> Try "Extract Another" with the same URL. The extractor is timing-sensitive on first-run.</div>`;
      resultSteps.innerHTML = '';
      btnOpenDecoder.disabled = true;
      btnOpenDecoder.title = 'Nothing to open — extraction was empty';
      btnCopyJson.disabled = false; // still allow copy for debugging
      return;
    }

    btnOpenDecoder.disabled = false;
    btnOpenDecoder.title = '';
    btnCopyJson.disabled = false;

    resultTitle.textContent = combo.comboName || 'Extracted combo';
    const versionBadge = combo.version >= 2 ? ' · <span style="color: #5fc49a;">v2</span>' : ' · <span style="color: #e5a93c;">v1 stale</span>';
    const soloBadge = combo.isSolo ? ' · <span style="color: #e55b3c;">solo</span>' : '';
    resultMeta.innerHTML =
      `${combo.steps.length} steps · ${combo.openingHand.length}-card hand · ${combo.rawLogLineCount} log lines${versionBadge}${soloBadge}`;

    // Show first 8 steps as preview
    resultSteps.innerHTML = '';
    const preview = combo.steps.slice(0, 8);
    for (const step of preview) {
      const row = document.createElement('div');
      row.className = 'result-step';
      const cards = step.cards ? step.cards.join(', ') : '';
      row.innerHTML = `
        <div class="result-step-n">${String(step.n).padStart(2, '0')}</div>
        <div>${step.action}${cards ? ': ' + escapeHtml(cards) : ''}</div>
      `;
      resultSteps.appendChild(row);
    }
    if (combo.steps.length > 8) {
      const more = document.createElement('div');
      more.style.color = 'var(--text-faint)';
      more.style.paddingLeft = '28px';
      more.style.marginTop = '4px';
      more.textContent = `+ ${combo.steps.length - 8} more steps…`;
      resultSteps.appendChild(more);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ============================================================
  // Open in YDK Decoder — P0.4
  // Delegate to the service worker: popup closes when user focuses the
  // new tab, so any async work started here would be terminated mid-flight.
  // The service worker persists, so it owns the open + inject flow.
  // ============================================================
  const DECODER_URL = 'http://localhost:8000/decoder/ydk_decoder.html';

  btnOpenDecoder.addEventListener('click', async () => {
    if (!latestCombo) return;
    btnOpenDecoder.disabled = true;
    try {
      // Fire-and-forget: SW takes over. Popup may close before this resolves.
      chrome.runtime.sendMessage({ action: 'openInDecoder', combo: latestCombo });
      // Give the message time to dispatch before the popup disappears
      await new Promise(r => setTimeout(r, 50));
    } catch (e) {
      console.warn('YDK Popup: openInDecoder message failed, using direct URL-param fallback.', e);
      // If messaging fails for some reason, open the URL-param URL ourselves.
      // Popup may die before this completes, but chrome.tabs.create is usually
      // fast enough to at least start the navigation.
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(latestCombo))));
      chrome.tabs.create({ url: `${DECODER_URL}?combo=${encoded}` });
    } finally {
      btnOpenDecoder.disabled = false;
    }
  });

  // ============================================================
  // Copy JSON fallback
  // ============================================================
  btnCopyJson.addEventListener('click', async () => {
    if (!latestCombo) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(latestCombo, null, 2));
      const originalText = btnCopyJson.textContent;
      btnCopyJson.textContent = '✓ Copied';
      btnCopyJson.classList.add('success');
      setTimeout(() => {
        btnCopyJson.textContent = originalText;
        btnCopyJson.classList.remove('success');
      }, 1500);
    } catch (e) {
      alert('Copy failed: ' + e.message);
    }
  });

  // ============================================================
  // .ydk file import — primary deck-import path. The user already
  // has the .ydk on disk (or downloads it from DB's Export Deck).
  // We just parse it and feed it through the same renderDeckResult /
  // saveDeckToDecoder flow as the DB scanner.
  // ============================================================
  function parseYdkText(txt, fallbackName) {
    const lines = String(txt || '').split(/\r?\n/);
    const out = { main: [], extra: [], side: [] };
    let cur = null;
    let nameFromComment = '';
    for (const ln of lines) {
      const t = ln.trim();
      if (!t) continue;
      if (/^#main\b/i.test(t)) { cur = 'main'; continue; }
      if (/^#extra\b/i.test(t)) { cur = 'extra'; continue; }
      if (/^!side\b/i.test(t)) { cur = 'side'; continue; }
      if (/^#created\s+by/i.test(t)) continue;
      // Plain # comment lines that aren't section markers may carry the deck name
      if (/^#/.test(t)) {
        const stripped = t.replace(/^#\s*/, '');
        if (stripped && !nameFromComment) nameFromComment = stripped;
        continue;
      }
      if (/^\d{6,8}$/.test(t) && cur) out[cur].push(t);
    }
    return {
      main: out.main,
      extra: out.extra,
      side: out.side,
      deckName: nameFromComment || fallbackName || 'Imported deck',
      counts: {
        main: out.main.length,
        extra: out.extra.length,
        side: out.side.length,
        total: out.main.length + out.extra.length + out.side.length,
      },
      ydk: txt,
      success: (out.main.length + out.extra.length + out.side.length) > 0,
    };
  }

  async function handleYdkFile(file) {
    if (!file) return;
    if (!/\.ydk$/i.test(file.name) && file.type && !/text\/plain/.test(file.type)) {
      showStatus('That doesn\'t look like a .ydk file', 'error');
      return;
    }
    showStatus(`Reading ${file.name}…`, null);
    let text;
    try {
      text = await file.text();
    } catch (e) {
      showStatus('Could not read file: ' + e.message, 'error');
      return;
    }
    const baseName = file.name.replace(/\.ydk$/i, '');
    const parsed = parseYdkText(text, baseName);
    if (!parsed.success) {
      showStatus('No card passcodes found in that .ydk file', 'error');
      return;
    }
    latestDeck = parsed;
    renderDeckResult(parsed);
    showStatus(`✓ Imported ${parsed.counts.total} cards from ${file.name}`, 'success');
    // Auto-stick to the local library so it survives popup close
    await addToLibrary(parsed);
    await renderDeckLibrary();
  }

  // File picker (click)
  ydkFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handleYdkFile(file);
    // Reset so re-picking the same file fires change again
    ydkFileInput.value = '';
  });

  // Drag & drop
  ['dragenter', 'dragover'].forEach(evt => {
    ydkDropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      ydkDropzone.classList.add('is-dragover');
    });
  });
  ['dragleave', 'drop'].forEach(evt => {
    ydkDropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      ydkDropzone.classList.remove('is-dragover');
    });
  });
  ydkDropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleYdkFile(file);
  });

  // ============================================================
  // sendToActiveTab — send a message to the active DuelingBook tab's
  // content script (deck-extractor). If the tab isn't DB or the script
  // isn't ready, returns null. Retries once with a 300ms delay.
  // ============================================================
  async function sendToActiveTab(msg) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) return { error: 'No active tab' };
    if (!(tabs[0].url || '').includes('duelingbook.com')) {
      return { error: 'Active tab is not DuelingBook. Open your deck on DB first.' };
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await chrome.tabs.sendMessage(tabs[0].id, msg);
        return r || { error: 'No response from page (content script may not be loaded yet — try refreshing the DB tab).' };
      } catch (e) {
        if (attempt === 0) await new Promise(r => setTimeout(r, 300));
        else return { error: 'Page not responding: ' + e.message + '. Refresh the DB tab and try again.' };
      }
    }
  }

  // ============================================================
  // Deck extraction — scan active deck on the open DB tab.
  // Uses chrome.tabs.sendMessage to talk to deck-extractor.js (which
  // is registered as a content_script in manifest.json and auto-loads
  // on every duelingbook.com page).
  // ============================================================
  btnExtractDeck.addEventListener('click', async () => {
    btnExtractDeck.disabled = true;
    btnExtractDeck.textContent = 'Scanning…';
    deckResultEl.classList.add('hidden');
    showStatus('Asking the DuelingBook tab for the active deck…', null);

    try {
      const r = await sendToActiveTab({ action: 'exportDeck' });
      if (!r || !r.success) {
        showStatus(r && r.error ? r.error : 'Scan failed — open the deck constructor on DB and try again.', 'error');
        return;
      }
      latestDeck = r;  // shape matches what renderDeckResult expects
      renderDeckResult(r);
      showStatus(`✓ Scanned ${r.counts.total} cards from "${r.deckName}"`, 'success');
      // Also auto-save into the local library so it sticks
      await addToLibrary(r);
      await renderDeckLibrary();
    } catch (e) {
      console.error('[YDK Popup] exportDeck error:', e);
      showStatus('Error: ' + e.message, 'error');
    } finally {
      btnExtractDeck.disabled = false;
      btnExtractDeck.textContent = 'Scan active deck';
    }
  });

  // ============================================================
  // Scan all decks — walks DB's deck dropdown, captures each, persists
  // them all in chrome.storage.local.savedDecks. Best-effort live
  // progress via deckScanProgress in chrome.storage.
  // ============================================================
  let scanProgressTimer = null;
  btnScanAllDecks.addEventListener('click', async () => {
    btnScanAllDecks.disabled = true;
    btnExtractDeck.disabled = true;
    btnScanAllDecks.textContent = 'Scanning all…';
    scanProgressEl.classList.remove('hidden');
    scanProgressEl.textContent = 'Walking deck dropdown…';

    // Live progress poll
    scanProgressTimer = setInterval(async () => {
      const { deckScanProgress } = await chrome.storage.local.get('deckScanProgress');
      if (deckScanProgress) {
        scanProgressEl.textContent = `Scanned ${deckScanProgress.scanned}/${deckScanProgress.total}: ${deckScanProgress.currentDeck}`;
      }
    }, 500);

    try {
      const r = await sendToActiveTab({ action: 'scanAllDecks' });
      clearInterval(scanProgressTimer);
      if (!r || !r.success) {
        showStatus(r && r.error ? r.error : 'Scan all failed.', 'error');
        scanProgressEl.textContent = '';
        return;
      }
      scanProgressEl.textContent = `Saved ${r.count} decks to local library.`;
      showStatus(`✓ Scanned ${r.count} deck${r.count === 1 ? '' : 's'} from DB`, 'success');
      await renderDeckLibrary();
    } catch (e) {
      clearInterval(scanProgressTimer);
      console.error('[YDK Popup] scanAllDecks error:', e);
      showStatus('Error: ' + e.message, 'error');
    } finally {
      btnScanAllDecks.disabled = false;
      btnExtractDeck.disabled = false;
      btnScanAllDecks.textContent = 'Scan all decks';
    }
  });

  // ============================================================
  // Local deck library — all decks stored in chrome.storage.local
  // .savedDecks. Survives popup close + browser restart. Each row
  // shows name, counts, and Push (sync to YDK Decoder) / Delete.
  // ============================================================
  async function addToLibrary(deck) {
    if (!deck || !deck.deckName) return;
    const { savedDecks = {} } = await chrome.storage.local.get('savedDecks');
    savedDecks[deck.deckName] = {
      deckName: deck.deckName,
      main: deck.main,
      extra: deck.extra,
      side: deck.side,
      counts: deck.counts,
      ydk: deck.ydk,
      pageUrl: deck.pageUrl,
      scannedAt: new Date().toISOString(),
    };
    await chrome.storage.local.set({ savedDecks });
  }

  async function renderDeckLibrary() {
    const { savedDecks = {} } = await chrome.storage.local.get('savedDecks');
    const names = Object.keys(savedDecks).sort();
    if (!names.length) {
      deckLibraryEl.innerHTML = '<div class="deck-library-empty">No decks saved yet — scan or import to populate.</div>';
      return;
    }
    deckLibraryEl.innerHTML = names.map(name => {
      const d = savedDecks[name] || {};
      const c = d.counts || {};
      const counts = `${c.main || 0}+${c.extra || 0}+${c.side || 0}`;
      return `
        <div class="deck-library-row" data-deck="${escapeHtml(name)}">
          <span class="deck-library-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
          <span class="deck-library-counts">${counts}</span>
          <span class="deck-library-actions">
            <button class="deck-library-action" data-action="push">Push</button>
            <button class="deck-library-action secondary danger" data-action="delete" title="Remove from local library">×</button>
          </span>
        </div>`;
    }).join('');
  }

  // Click delegation for library actions
  deckLibraryEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const row = btn.closest('.deck-library-row');
    const name = row && row.dataset.deck;
    if (!name) return;

    const { savedDecks = {} } = await chrome.storage.local.get('savedDecks');
    const deck = savedDecks[name];
    if (!deck) return;

    if (btn.dataset.action === 'push') {
      btn.disabled = true;
      btn.textContent = 'Sending…';
      try {
        chrome.runtime.sendMessage({ action: 'saveDeckToDecoder', deck });
        await new Promise(r => setTimeout(r, 60));
        btn.textContent = 'Sent';
        setTimeout(() => { btn.disabled = false; btn.textContent = 'Push'; }, 1200);
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Push';
        alert('Could not reach service worker: ' + err.message);
      }
    } else if (btn.dataset.action === 'delete') {
      delete savedDecks[name];
      await chrome.storage.local.set({ savedDecks });
      await renderDeckLibrary();
    }
  });

  function renderDeckResult(deck) {
    deckResultEl.classList.remove('hidden');
    deckResultName.textContent = deck.deckName || 'Untitled deck';
    deckResultCounts.innerHTML =
      `<span class="pill">main ${deck.counts.main}</span>` +
      `<span class="pill">extra ${deck.counts.extra}</span>` +
      `<span class="pill">side ${deck.counts.side}</span>` +
      `<span class="pill">total ${deck.counts.total}</span>`;
  }

  btnCopyYdk.addEventListener('click', async () => {
    if (!latestDeck) return;
    try {
      await navigator.clipboard.writeText(latestDeck.ydk);
      flashButton(btnCopyYdk, '✓ Copied');
    } catch (e) {
      alert('Copy failed: ' + e.message);
    }
  });

  btnDownloadYdk.addEventListener('click', () => {
    if (!latestDeck) return;
    const blob = new Blob([latestDeck.ydk], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const safeName = (latestDeck.deckName || 'deck').replace(/[^a-z0-9_\-]+/gi, '_').slice(0, 50);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName || 'deck'}.ydk`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flashButton(btnDownloadYdk, '✓ Saved');
  });

  btnSaveDeck.addEventListener('click', async () => {
    if (!latestDeck) return;
    btnSaveDeck.disabled = true;
    try {
      // Stick into the local library too so the user can re-push later
      await addToLibrary(latestDeck);
      await renderDeckLibrary();
      // Delegate to service worker — opens the decoder tab and pushes the
      // deck into its localStorage.ydk_decks. SW survives popup close.
      chrome.runtime.sendMessage({ action: 'saveDeckToDecoder', deck: latestDeck });
      // Give the message time to dispatch before the popup may close
      await new Promise(r => setTimeout(r, 50));
      flashButton(btnSaveDeck, '✓ Sent');
    } catch (e) {
      console.warn('[YDK Popup] saveDeckToDecoder send failed:', e);
      alert('Could not reach the service worker: ' + e.message);
    } finally {
      btnSaveDeck.disabled = false;
    }
  });

  function flashButton(btn, text) {
    const orig = btn.textContent;
    btn.textContent = text;
    btn.classList.add('success');
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove('success');
    }, 1500);
  }

  // ============================================================
  // Reset
  // ============================================================
  btnReset.addEventListener('click', () => {
    resultPanel.classList.add('hidden');
    statusEl.classList.add('hidden');
    urlInput.value = '';
    latestCombo = null;
    chrome.storage.local.remove('latestCombo');
    urlInput.focus();
  });

  // ============================================================
  // Helpers
  // ============================================================
  function showStatus(msg, variant) {
    statusEl.classList.remove('hidden', 'error', 'success');
    if (variant) statusEl.classList.add(variant);
    statusMsg.textContent = msg;
    statusLabel.textContent = variant === 'error' ? 'Error'
                            : variant === 'success' ? 'Done'
                            : 'Status';
  }

  // ============================================================
  // On-load: check if there's a recent combo to show
  // ============================================================
  chrome.storage.local.get(['latestCombo', 'extractionProgress'], ({ latestCombo: combo, extractionProgress }) => {
    if (extractionProgress && ['opening', 'loading', 'injecting', 'extracting', 'parsing'].includes(extractionProgress.status)) {
      // Extraction in progress, resume polling
      btnExtract.disabled = true;
      startPolling();
    } else if (combo) {
      // Show last extracted combo
      latestCombo = combo;
      renderResult(combo);
    }
  });

  // Render the deck library on every popup open. chrome.storage.local
  // is the source of truth — survives popup close, browser restart,
  // and even extension reload.
  renderDeckLibrary();
});
