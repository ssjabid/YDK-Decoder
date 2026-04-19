# Git Setup + Claude Code Migration (Windows PowerShell)

This guide gets the project onto GitHub and opens it in Claude Code.

---

## Part 1 — Prerequisites

### Check Git is installed
```powershell
git --version
```
If "command not found" → install from https://git-scm.com/download/win → accept defaults.

### Check you're logged into GitHub
```powershell
git config --global user.name
git config --global user.email
```
If either is blank:
```powershell
git config --global user.name "Abid"
git config --global user.email "your-github-email@example.com"
```

---

## Part 2 — Initialize the repo locally

Unzip the handoff bundle somewhere permanent. Example path used below:
```
H:\Abid - Documents\Documents\Abid - Projects\Abid - YDKDecoder\
```

### Open PowerShell in that folder
```powershell
cd "H:\Abid - Documents\Documents\Abid - Projects\Abid - YDKDecoder"
```

### Initialize the repo
```powershell
git init
git branch -M main
git add .
git status
```

The `git status` should show all the handoff files staged (green). If anything looks wrong, stop and check.

### First commit
```powershell
git commit -m "Initial import: YDK Decoder + Chrome Extension + handoff docs"
```

---

## Part 3 — Push to GitHub

### Create a new GitHub repo
1. Open https://github.com/new
2. Repository name: `ydk-decoder` (or whatever you prefer)
3. Description: "Personal Yu-Gi-Oh deck learning tool"
4. Visibility: **Private** (recommended — this is your personal tool)
5. DO NOT initialize with README, .gitignore, or license (we already have them)
6. Click "Create repository"

### Connect local to GitHub
GitHub will show you commands. Use the HTTPS version (easiest for Windows):

```powershell
# Replace YOUR_USERNAME with your GitHub username
git remote add origin https://github.com/YOUR_USERNAME/ydk-decoder.git
git push -u origin main
```

On first push, Windows will pop up a browser login for GitHub. Log in. It caches the credential.

### Verify
Refresh your GitHub repo page in the browser. You should see all the files.

---

## Part 4 — Open in Claude Code

### Install Claude Code
If you haven't already:
1. Install from https://claude.com/claude-code (or your company's distribution)
2. Log in with your Claude account

### Open the repo
From PowerShell, in your project folder:
```powershell
claude
```

(Alternatively, open Claude Code, and use "Open Folder" → select the `ydk-decoder` folder)

### Verify Claude Code can see the repo
Once open, type in Claude Code:
```
Run `ls` and tell me what you see at the top level.
```

You should see: `README.md`, `extension/`, `decoder/`, `docs/`, `sample-data/`, `.gitignore`.

---

## Part 5 — The starter prompt

Paste this into Claude Code as your FIRST message:

```
I'm migrating this project to you from Claude chat. Please:

1. Read docs/CLAUDE.md fully — that's your architectural briefing
2. Read docs/ROADMAP.md — that's the prioritized backlog
3. Read docs/BUGS.md — those are known issues
4. Read docs/DECK_CONTEXT.md — context on what this deck is

Then tell me:
- A 3-sentence summary of what the project is
- The top 3 items on the roadmap (just the titles)
- Which one you'd suggest starting with and why

Do NOT make any code changes yet. I want to confirm you understand the project before we start.

Environment: Windows, Chrome, Python installed, VS Code. I'm running `py -m http.server 8000` in the project root for the decoder.

Working replay URL for testing: https://www.duelingbook.com/replay?id=1345419-80595527
```

Claude Code will confirm understanding. Then you can say something like:

> Great. Let's start with P0.1 from ROADMAP.md — make the decoder auto-load combos from the URL param. Follow the acceptance criteria exactly.

---

## Part 6 — Workflow going forward

### Normal dev cycle
```powershell
# In your project folder
git pull         # get any changes (rare for solo project)
# ... make changes via Claude Code ...
git status       # see what changed
git add .
git commit -m "Describe what changed"
git push
```

### Claude Code will typically do these commits for you when you ask it to.

### Testing the extension after code changes
1. Go to `chrome://extensions/`
2. Click the refresh icon on the YDK Decoder extension card
3. Click the extension icon → test

### Testing the decoder after code changes
1. Save file
2. Refresh browser tab at `http://localhost:8000/decoder/ydk_decoder.html`
3. Hard refresh if CSS/JS cached: Ctrl+Shift+R

---

## Troubleshooting

### "Permission denied (publickey)" on git push
You're trying to use SSH without keys set up. Use HTTPS instead — the URL should be `https://github.com/...` not `git@github.com:...`.

### "remote: Repository not found"
Check the repo URL and that you're logged into the right GitHub account.

### Claude Code says "I can't find that file"
Make sure you opened the FOLDER (top level with `README.md`) not a subfolder.

### Merge conflicts
Unlikely for a solo project. If you see one:
```powershell
git status       # see which files conflict
# Open conflicted file — fix manually or ask Claude Code to resolve
git add .
git commit -m "Resolve merge conflict"
```

---

## One-page cheat sheet

```powershell
# Start server (run once at start of dev session)
cd "H:\Abid - Documents\Documents\Abid - Projects\Abid - YDKDecoder"
py -m http.server 8000

# In a second PowerShell window — open Claude Code
cd "H:\Abid - Documents\Documents\Abid - Projects\Abid - YDKDecoder"
claude

# Commit and push (after making changes)
git add .
git commit -m "What I did"
git push
```
