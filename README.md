# Local Task Tracker

A **local-first** task tracker with:

- **UI**: React + Vite + Tailwind (`client/`)
- **API**: Node + Express (`server/`)
- **Database**: SQLite via `better-sqlite3` (`server/tasks.db`)

It’s designed for personal use on your machine (no auth, no cloud services).

## Requirements

- Node.js (includes npm)

## Install

From the repo root:

```bash
npm install
npm --prefix client install
npm --prefix server install
```

## Run locally (dev)

From the repo root:

```bash
npm run dev
```

- **Client**: `http://localhost:5173`
- **Server**: `http://localhost:3001`

### Common issues

- **Port 5173 already in use**
  - This app intentionally runs Vite with `--strictPort`, so it will **fail** rather than silently switching ports.
  - Stop the old Vite process (or reboot), then run `npm run dev` again.

- **“Failed to fetch”**
  - Make sure both server and client are running via `npm run dev`.

## Launch from Desktop (no IDE)

This repo includes a desktop launcher:

- **`TaskTracker-Start.cmd`**: double-click to start the app
- **`TaskTracker.ps1`**: script that launches `npm run dev` and opens the browser

### Create a Desktop shortcut

1. In File Explorer, open the repo folder.
2. Right-click `TaskTracker-Start.cmd` → **Send to → Desktop (create shortcut)**.
3. Double-click the Desktop shortcut anytime you want to start the app.

### If you move the repo

Update the path inside `TaskTracker.ps1`:

- `$repoRoot = "C:\\Users\\marks\\projects\\my-task-tracker"`

## Features

### Tasks

- Create / edit / delete tasks
- Fields: title, notes, status, due date
- Tags (multiple per task)
- Subtasks (checklist) with progress indicator
- Filter by status and tag
- Two views: **Cards** and **List**

### Notes

- Create / edit / delete notes
- Link notes to tasks (many-to-many)
- Create a **task from a note** (automatically linked)
- Create a **note from a task** (automatically linked)

### Reminders

- Create reminders linked to either a **task** or a **note**
- In-app toast notifications when reminders are due (polled from the server)
- Mark reminders “Done” and optionally show done reminders

### Links (previews + optional screenshots)

- Add URL attachments to **tasks** and **notes**
- Shows a rich preview (title/description/image/favicon) when available
- Optional screenshots (see below)

### Data & backup

- SQLite database file: `server/tasks.db`
- Export: click **Export Data** in the UI (downloads the current DB via `GET /api/backup`)

## Link screenshots (optional)

By default, link previews fetch metadata (title/description/image/favicon). **Screenshots are opt-in** because they require a local headless browser.

1. Install Playwright + Chromium:

```bash
cd server
npm i -D playwright
npx playwright install chromium
```

2. Start the server with screenshots enabled:

- **PowerShell**:

```powershell
$env:LINK_SCREENSHOTS="1"
npm --prefix server run dev
```

- Or set `LINK_SCREENSHOTS=1` in your environment before starting `npm run dev`.

