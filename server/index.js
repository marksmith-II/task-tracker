const express = require('express')
const path = require('path')
const fs = require('fs')

const { db, DB_PATH, safeParseTags, normalizeTags } = require('./db')

const app = express()
app.use(express.json({ limit: '1mb' }))

function nowIso() {
  return new Date().toISOString()
}

function toTaskSummary(row) {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? '',
    status: row.status,
    dueDate: row.dueDate ?? null,
    tags: safeParseTags(row.tags),
    createdAt: row.createdAt,
    subtaskTotal: Number(row.subtaskTotal ?? 0),
    subtaskCompleted: Number(row.subtaskCompleted ?? 0),
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// List tasks (summary rows) with aggregated subtask progress
app.get('/api/tasks', (req, res) => {
  const status = req.query.status ? String(req.query.status) : null
  const tag = req.query.tag ? String(req.query.tag) : null

  const where = []
  const params = {}
  if (status && ['TODO', 'IN_PROGRESS', 'DONE'].includes(status)) {
    where.push('t.status = @status')
    params.status = status
  }

  // Tag filter is done on the stored JSON string for simplicity.
  // This is good enough for a local tool; the client also filters.
  if (tag) {
    where.push("t.tags LIKE @tagLike")
    params.tagLike = `%\"${tag.replaceAll('"', '\\"')}\"%`
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const stmt = db.prepare(`
    SELECT
      t.*,
      COUNT(s.id) AS subtaskTotal,
      COALESCE(SUM(CASE WHEN s.is_completed = 1 THEN 1 ELSE 0 END), 0) AS subtaskCompleted
    FROM tasks t
    LEFT JOIN subtasks s ON s.task_id = t.id
    ${whereSql}
    GROUP BY t.id
    ORDER BY datetime(t.createdAt) DESC, t.id DESC
  `)

  const rows = stmt.all(params)
  res.json(rows.map(toTaskSummary))
})

// Get one task + its subtasks
app.get('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid task id' })

  const taskRow = db
    .prepare(
      `
      SELECT
        t.*,
        COUNT(s.id) AS subtaskTotal,
        COALESCE(SUM(CASE WHEN s.is_completed = 1 THEN 1 ELSE 0 END), 0) AS subtaskCompleted
      FROM tasks t
      LEFT JOIN subtasks s ON s.task_id = t.id
      WHERE t.id = ?
      GROUP BY t.id
    `
    )
    .get(id)

  if (!taskRow) return res.status(404).json({ error: 'Task not found' })

  const subtasks = db
    .prepare('SELECT id, task_id as taskId, content, is_completed as isCompleted FROM subtasks WHERE task_id = ? ORDER BY id ASC')
    .all(id)
    .map((s) => ({ ...s, isCompleted: Boolean(s.isCompleted) }))

  res.json({ ...toTaskSummary(taskRow), subtasks })
})

// Create task
app.post('/api/tasks', (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
  if (!title) return res.status(400).json({ error: 'Title is required' })

  const notes = typeof req.body?.notes === 'string' ? req.body.notes : ''
  const status = ['TODO', 'IN_PROGRESS', 'DONE'].includes(req.body?.status) ? req.body.status : 'TODO'
  const dueDate = typeof req.body?.dueDate === 'string' && req.body.dueDate.trim() ? req.body.dueDate.trim() : null
  const tags = normalizeTags(req.body?.tags)

  const createdAt = nowIso()

  const info = db
    .prepare('INSERT INTO tasks (title, notes, status, dueDate, tags, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
    .run(title, notes, status, dueDate, JSON.stringify(tags), createdAt)

  const task = {
    id: Number(info.lastInsertRowid),
    title,
    notes,
    status,
    dueDate,
    tags,
    createdAt,
    subtaskTotal: 0,
    subtaskCompleted: 0,
  }

  res.status(201).json(task)
})

// Update task
app.put('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid task id' })

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Task not found' })

  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : existing.title
  if (!title) return res.status(400).json({ error: 'Title is required' })

  const notes = typeof req.body?.notes === 'string' ? req.body.notes : existing.notes
  const status = ['TODO', 'IN_PROGRESS', 'DONE'].includes(req.body?.status) ? req.body.status : existing.status
  const dueDate =
    req.body?.dueDate === null
      ? null
      : typeof req.body?.dueDate === 'string' && req.body.dueDate.trim()
        ? req.body.dueDate.trim()
        : existing.dueDate ?? null
  const tags = req.body?.tags !== undefined ? normalizeTags(req.body.tags) : safeParseTags(existing.tags)

  db.prepare('UPDATE tasks SET title = ?, notes = ?, status = ?, dueDate = ?, tags = ? WHERE id = ?').run(
    title,
    notes,
    status,
    dueDate,
    JSON.stringify(tags),
    id
  )

  // Return updated summary
  const taskRow = db
    .prepare(
      `
      SELECT
        t.*,
        COUNT(s.id) AS subtaskTotal,
        COALESCE(SUM(CASE WHEN s.is_completed = 1 THEN 1 ELSE 0 END), 0) AS subtaskCompleted
      FROM tasks t
      LEFT JOIN subtasks s ON s.task_id = t.id
      WHERE t.id = ?
      GROUP BY t.id
    `
    )
    .get(id)

  res.json(toTaskSummary(taskRow))
})

// Delete task (subtasks cascade)
app.delete('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid task id' })

  const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  if (info.changes === 0) return res.status(404).json({ error: 'Task not found' })
  res.status(204).send()
})

// Add subtask
app.post('/api/tasks/:id/subtasks', (req, res) => {
  const taskId = Number(req.params.id)
  if (!Number.isFinite(taskId)) return res.status(400).json({ error: 'Invalid task id' })

  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId)
  if (!task) return res.status(404).json({ error: 'Task not found' })

  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : ''
  if (!content) return res.status(400).json({ error: 'Content is required' })

  const info = db.prepare('INSERT INTO subtasks (task_id, content, is_completed) VALUES (?, ?, 0)').run(taskId, content)
  res.status(201).json({ id: Number(info.lastInsertRowid), taskId, content, isCompleted: false })
})

// Update subtask (content and/or isCompleted)
app.put('/api/subtasks/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid subtask id' })

  const existing = db.prepare('SELECT id, task_id as taskId, content, is_completed as isCompleted FROM subtasks WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Subtask not found' })

  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : existing.content
  if (!content) return res.status(400).json({ error: 'Content is required' })

  const isCompleted =
    typeof req.body?.isCompleted === 'boolean'
      ? req.body.isCompleted
      : typeof req.body?.is_completed === 'boolean'
        ? req.body.is_completed
        : Boolean(existing.isCompleted)

  db.prepare('UPDATE subtasks SET content = ?, is_completed = ? WHERE id = ?').run(content, isCompleted ? 1 : 0, id)
  res.json({ id, taskId: existing.taskId, content, isCompleted })
})

// Delete subtask
app.delete('/api/subtasks/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid subtask id' })

  const info = db.prepare('DELETE FROM subtasks WHERE id = ?').run(id)
  if (info.changes === 0) return res.status(404).json({ error: 'Subtask not found' })
  res.status(204).send()
})

// Download the current tasks.db
app.get('/api/backup', (_req, res) => {
  // Ensure DB file exists on disk. better-sqlite3 creates it, but guard anyway.
  if (!fs.existsSync(DB_PATH)) return res.status(404).json({ error: 'Database file not found' })
  res.setHeader('Cache-Control', 'no-store')
  res.download(DB_PATH, 'tasks.db')
})

// Serve a helpful message for the root (optional)
app.get('/', (_req, res) => {
  res.type('text').send('Local Task Tracker API running. Use /api/tasks')
})

const PORT = Number(process.env.PORT) || 3001
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`)
})

