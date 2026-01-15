# Local Task Tracker

Local-only task tracker with a **React (Vite) + Tailwind** UI and a **Node/Express + SQLite** backend.

## Dev

From the repo root:

```bash
npm run dev
```

- Client: `http://localhost:5173`
- Server: `http://localhost:3001`

## Features

- Task CRUD (title, notes, status, due date)
- Tags (multiple per task)
- Subtasks (checklist) with progress indicator
- Filtering by status + tag
- SQLite persistence (`server/tasks.db`)
- **Backup/Export**: click **Export Data** to download the current `tasks.db` via `GET /api/backup`

