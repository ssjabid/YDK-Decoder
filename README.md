# YDK Decoder

Personal learning tool for memorizing Yu-Gi-Oh decks (currently tuned for **DoomZ / Power Patron**).

Three pieces:
1. **YDK Decoder** (`decoder/ydk_decoder.html`) — HTML/JS tool. Drop a `.ydk` file → strips every card to role tags and essential function. Shows combo lines.
2. **Chrome Extension** (`extension/`) — extracts DuelingBook replays into clean JSON, hands off to the decoder.
3. **Sample data** (`sample-data/`) — two real extracted combo JSONs as reference.

## Quick start (Windows PowerShell)

```powershell
# 1. Start local server for the decoder
cd "H:\Abid - Documents\Documents\Abid - Projects\Abid - YDKDecoder"
py -m http.server 8000

# 2. Open http://localhost:8000/decoder/ydk_decoder.html in browser
# 3. Drop abid_doomz_1.ydk onto the upload zone
```

## Chrome Extension install

1. Open `chrome://extensions/`
2. Enable Developer mode (top-right)
3. Click "Load unpacked" → select the `extension/` folder
4. Pin it in the toolbar

**Usage:** Click the extension icon → paste DuelingBook replay URL → Extract → Copy JSON or Open in Decoder.

## Where to start if you're Claude Code

**Read in order:**
1. `docs/CLAUDE.md` — architecture, decisions, current state
2. `docs/ROADMAP.md` — prioritized backlog
3. `docs/BUGS.md` — known issues

Then pick the top item in ROADMAP.md and go.

## Project status

- ✅ YDK parser + card display working
- ✅ Chrome extension extracts DuelingBook replays (proven on 2 real combos)
- ✅ Handoff via URL param (`?combo=<base64>`) structured but not yet rendered
- 🚧 Combo rendering from extracted data — next up
- 🚧 Endboard tracking (extractor over-includes Xyz materials)
- 🚧 Card image loading (works on localhost, broken on file://)
