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

  let latestCombo = null;
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
    resultTitle.textContent = combo.comboName || 'Extracted combo';
    resultMeta.textContent =
      `${combo.steps.length} steps · ${combo.openingHand.length}-card hand · ${combo.rawLogLineCount} log lines`;

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
  // Open in YDK Decoder
  // ============================================================
  btnOpenDecoder.addEventListener('click', () => {
    if (!latestCombo) return;
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(latestCombo))));
    // Try localhost first, fall back to a prompt
    const url = `http://localhost:8000/ydk_decoder.html?combo=${encoded}`;
    chrome.tabs.create({ url });
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
});
