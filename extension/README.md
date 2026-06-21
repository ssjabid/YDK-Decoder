# YDK Decoder — Replay Extractor Extension

Extract DoomZ combos from DuelingBook replays into the YDK Decoder learning tool.

## One-time setup

### 1. Install the extension in Chrome

1. Unzip this folder somewhere you'll keep it (e.g. `~/ydk-extension/`).
2. Open Chrome and go to `chrome://extensions/`
3. Turn on **Developer mode** (toggle, top-right)
4. Click **Load unpacked**
5. Select the `ydk-extension` folder you unzipped

You should see **YDK Decoder — Replay Extractor v1.0** appear in your extensions list.

### 2. Pin the extension

Click the puzzle-piece icon in Chrome's toolbar → pin **YDK Decoder**. The accent-colored icon stays visible so you can click it anytime.

### 3. Build + start the local server

"Open in YDK Decoder" now opens the **React app** at `localhost:8000/react/`
(not the legacy single-file decoder). Build it once, then serve the repo root:

```
cd app
npm run build:8000        # outputs the app to ../react/
cd ..
py -m http.server 8000    # (macOS/Linux: python3 -m http.server 8000)
```

Leave the server running. The extension hands combos to `localhost:8000/react/`,
which shares that origin — so extracted combos land directly in the app's
**Combos** tab. (The old `decoder/ydk_decoder.html` still exists but is no
longer the hand-off target.)

## How to use

1. Copy a DuelingBook replay URL (e.g. `https://www.duelingbook.com/replay?id=1345419-80595527`)
2. Click the **YDK Decoder** icon in Chrome's toolbar
3. Paste the URL → click **Extract Combo**
4. Wait (30 seconds – 3 minutes depending on replay length)
   - A new tab will open the replay and fast-forward through it automatically
   - You'll see progress updates in the popup
   - The tab closes on completion
5. Preview the extracted steps in the popup
6. Click **Open in YDK Decoder** → opens the combo in your learning tool
   - or **Copy JSON** if you want to paste it manually

## Troubleshooting

**"Failed to start extraction"**: Make sure the URL is a DuelingBook replay link.

**Takes forever / times out**: Some DuelingBook replays are 5+ minutes long. The extractor has a 5-minute max timeout. If it fails, try reloading the extension (chrome://extensions/ → refresh icon on the card).

**"Open in YDK Decoder" doesn't work**: Make sure `python3 -m http.server 8000` is running in the YDK Decoder folder. Use "Copy JSON" as a fallback — paste into the Decoder's import field.

**Extraction opens tab but never completes**: Some replays have issues with DuelingBook's Fast Forward. Manually click Fast Forward on the opened tab if needed.

## Privacy

- Does NOT send any data to external servers
- Only talks to DuelingBook.com (to read the replay you paste)
- All combo data stored locally in your browser
- No analytics, no tracking

## Credits

Core replay extraction logic adapted from the DuelMetrics extension by an earlier build. Rewritten minimal scaffolding around it.
