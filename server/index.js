const express = require('express')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const { db, DB_PATH, safeParseTags, normalizeTags } = require('./db')

const app = express()
app.use(express.json({ limit: '1mb' }))

const DATA_DIR = path.join(__dirname, 'data')
const SCREENSHOT_DIR = path.join(DATA_DIR, 'link-screenshots')
const SCREENSHOT_ROUTE = '/api/link-screenshots'

function nowIso() {
  return new Date().toISOString()
}

function safeBoolean(v) {
  return Boolean(Number(v))
}

function isValidHttpUrl(input) {
  try {
    const u = new URL(String(input))
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function toTaskSummary(row) {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? '',
    status: row.status,
    priority: row.priority ?? null,
    dueDate: row.dueDate ?? null,
    tags: safeParseTags(row.tags),
    createdAt: row.createdAt,
    subtaskTotal: Number(row.subtaskTotal ?? 0),
    subtaskCompleted: Number(row.subtaskCompleted ?? 0),
    sortOrder: Number(row.sortOrder ?? 0),
    archivedAt: row.archivedAt ?? null,
  }
}

function toNoteSummary(row) {
  const body = typeof row.body === 'string' ? row.body : ''
  const excerpt = body.trim().replace(/\s+/g, ' ').slice(0, 180)
  return {
    id: row.id,
    title: row.title,
    excerpt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    linkedTaskCount: Number(row.linkedTaskCount ?? 0),
    sortOrder: Number(row.sortOrder ?? 0),
  }
}

function toReminder(row) {
  return {
    id: row.id,
    targetType: row.targetType,
    targetId: Number(row.targetId),
    dueAt: row.dueAt,
    message: row.message ?? '',
    isDone: safeBoolean(row.isDone),
    firedAt: row.firedAt ?? null,
    createdAt: row.createdAt,
  }
}

function toLinkAttachment(row) {
  const filename = row.screenshotPath ? String(row.screenshotPath) : null
  const screenshotUrl = filename ? `${SCREENSHOT_ROUTE}/${encodeURIComponent(filename)}` : null
  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId: Number(row.ownerId),
    url: row.url,
    title: row.title ?? null,
    description: row.description ?? null,
    imageUrl: row.imageUrl ?? null,
    faviconUrl: row.faviconUrl ?? null,
    screenshotUrl,
    lastFetchedAt: row.lastFetchedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function fetchUrlText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'local-task-tracker/1.0 (+link-preview)',
      Accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) throw new Error(`Failed to fetch (${res.status})`)
  return await res.text()
}

async function getLinkPreview(url) {
  // Lazy-load cheerio so the server can start even if deps are not installed yet.
  let cheerio
  try {
    cheerio = require('cheerio')
  } catch {
    return { url, title: null, description: null, imageUrl: null, faviconUrl: null }
  }

  const html = await fetchUrlText(url)
  const $ = cheerio.load(html)

  const pick = (...values) => values.find((v) => typeof v === 'string' && v.trim())?.trim() ?? null

  const title = pick($('meta[property="og:title"]').attr('content'), $('title').text())
  const description = pick($('meta[property="og:description"]').attr('content'), $('meta[name="description"]').attr('content'))
  const imageUrl = pick($('meta[property="og:image"]').attr('content'), $('meta[name="twitter:image"]').attr('content'))
  const faviconHref = pick(
    $('link[rel="icon"]').attr('href'),
    $('link[rel="shortcut icon"]').attr('href'),
    $('link[rel="apple-touch-icon"]').attr('href')
  )

  let faviconUrl = null
  if (faviconHref) {
    try {
      faviconUrl = new URL(faviconHref, url).toString()
    } catch {
      faviconUrl = null
    }
  }

  let resolvedImageUrl = imageUrl
  if (imageUrl) {
    try {
      resolvedImageUrl = new URL(imageUrl, url).toString()
    } catch {
      resolvedImageUrl = imageUrl
    }
  }

  return { url, title, description, imageUrl: resolvedImageUrl, faviconUrl }
}

async function captureScreenshot(url) {
  if (process.env.LINK_SCREENSHOTS !== '1') return null

  // Opt-in only: user can install playwright manually if they want screenshots.
  let playwright
  try {
    playwright = require('playwright')
  } catch {
    return null
  }

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

  const hash = crypto.createHash('sha1').update(`${url}|${Date.now()}`).digest('hex').slice(0, 16)
  const filename = `${hash}.png`
  const fullPath = path.join(SCREENSHOT_DIR, filename)

  const browser = await playwright.chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(500)
    await page.screenshot({ path: fullPath, fullPage: false })
  } finally {
    await browser.close()
  }

  return filename
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// Serve stored screenshots (if any)
app.use(SCREENSHOT_ROUTE, express.static(SCREENSHOT_DIR, { fallthrough: true, maxAge: 0 }))

// List tasks (summary rows) with aggregated subtask progress
app.get('/api/tasks', (req, res) => {
  const status = req.query.status ? String(req.query.status) : null
  const tag = req.query.tag ? String(req.query.tag) : null
  const includeArchived = String(req.query.includeArchived ?? '') === '1'

  const where = []
  const params = {}
  
  // By default, exclude archived tasks unless explicitly requested
  if (!includeArchived) {
    where.push('t.archivedAt IS NULL')
  }
  
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
    ORDER BY t.sortOrder ASC, datetime(t.createdAt) DESC, t.id DESC
  `)

  const rows = stmt.all(params)
  res.json(rows.map(toTaskSummary))
})

// List archived tasks with search
app.get('/api/tasks/archived', (req, res) => {
  const search = req.query.search ? String(req.query.search).trim() : ''
  
  const where = ['t.archivedAt IS NOT NULL']
  const params = {}
  
  if (search) {
    where.push('(t.title LIKE @searchLike OR t.notes LIKE @searchLike)')
    params.searchLike = `%${search}%`
  }

  const whereSql = `WHERE ${where.join(' AND ')}`

  const stmt = db.prepare(`
    SELECT
      t.*,
      COUNT(s.id) AS subtaskTotal,
      COALESCE(SUM(CASE WHEN s.is_completed = 1 THEN 1 ELSE 0 END), 0) AS subtaskCompleted
    FROM tasks t
    LEFT JOIN subtasks s ON s.task_id = t.id
    ${whereSql}
    GROUP BY t.id
    ORDER BY datetime(t.archivedAt) DESC, t.id DESC
  `)

  const rows = stmt.all(params)
  res.json(rows.map(toTaskSummary))
})

// Reorder tasks - update sortOrder for multiple tasks
app.put('/api/tasks/reorder', (req, res) => {
  const items = req.body?.items
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items array is required' })

  const tx = db.transaction(() => {
    for (const item of items) {
      const id = Number(item.id)
      const sortOrder = Number(item.sortOrder)
      if (!Number.isFinite(id) || !Number.isFinite(sortOrder)) continue
      db.prepare('UPDATE tasks SET sortOrder = ? WHERE id = ?').run(sortOrder, id)
    }
  })

  tx()
  res.json({ ok: true })
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

  const linkedNotes = db
    .prepare(
      `
      SELECT n.id, n.title, n.createdAt, n.updatedAt
      FROM notes n
      INNER JOIN note_task_links l ON l.note_id = n.id
      WHERE l.task_id = ?
      ORDER BY datetime(n.updatedAt) DESC, n.id DESC
    `
    )
    .all(id)

  const links = db
    .prepare('SELECT * FROM link_attachments WHERE ownerType = ? AND ownerId = ? ORDER BY datetime(updatedAt) DESC, id DESC')
    .all('TASK', id)
    .map(toLinkAttachment)

  res.json({ ...toTaskSummary(taskRow), subtasks, linkedNotes, links })
})

// Create task
app.post('/api/tasks', (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
  if (!title) return res.status(400).json({ error: 'Title is required' })

  const notes = typeof req.body?.notes === 'string' ? req.body.notes : ''
  const status = ['TODO', 'IN_PROGRESS', 'DONE'].includes(req.body?.status) ? req.body.status : 'TODO'
  const priority = ['HIGH', 'MEDIUM', 'LOW'].includes(req.body?.priority) ? req.body.priority : null
  const dueDate = typeof req.body?.dueDate === 'string' && req.body.dueDate.trim() ? req.body.dueDate.trim() : null
  const tags = normalizeTags(req.body?.tags)

  const createdAt = nowIso()

  const info = db
    .prepare('INSERT INTO tasks (title, notes, status, priority, dueDate, tags, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(title, notes, status, priority, dueDate, JSON.stringify(tags), createdAt)

  const task = {
    id: Number(info.lastInsertRowid),
    title,
    notes,
    status,
    priority,
    dueDate,
    tags,
    createdAt,
    subtaskTotal: 0,
    subtaskCompleted: 0,
    sortOrder: 0,
    archivedAt: null,
  }

  res.status(201).json(task)
})

// Create a note from a task and link them
app.post('/api/tasks/:id/create-note', (req, res) => {
  const taskId = Number(req.params.id)
  if (!Number.isFinite(taskId)) return res.status(400).json({ error: 'Invalid task id' })

  const task = db.prepare('SELECT id, title, notes FROM tasks WHERE id = ?').get(taskId)
  if (!task) return res.status(404).json({ error: 'Task not found' })

  const title =
    typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim() : `Notes for: ${task.title}`
  const body =
    typeof req.body?.body === 'string' && req.body.body.trim()
      ? req.body.body
      : task.notes
        ? `Linked to task: ${task.title}\n\n${task.notes}`
        : `Linked to task: ${task.title}\n`

  const ts = nowIso()
  const info = db.prepare('INSERT INTO notes (title, body, createdAt, updatedAt) VALUES (?, ?, ?, ?)').run(title, body, ts, ts)
  const noteId = Number(info.lastInsertRowid)

  db.prepare('INSERT OR IGNORE INTO note_task_links (note_id, task_id, createdAt) VALUES (?, ?, ?)').run(noteId, taskId, ts)

  const noteRow = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId)
  res.status(201).json(noteRow)
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
  const priority =
    req.body?.priority === null
      ? null
      : ['HIGH', 'MEDIUM', 'LOW'].includes(req.body?.priority)
        ? req.body.priority
        : existing.priority ?? null
  const dueDate =
    req.body?.dueDate === null
      ? null
      : typeof req.body?.dueDate === 'string' && req.body.dueDate.trim()
        ? req.body.dueDate.trim()
        : existing.dueDate ?? null
  const tags = req.body?.tags !== undefined ? normalizeTags(req.body.tags) : safeParseTags(existing.tags)

  db.prepare('UPDATE tasks SET title = ?, notes = ?, status = ?, priority = ?, dueDate = ?, tags = ? WHERE id = ?').run(
    title,
    notes,
    status,
    priority,
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

// Archive a task
app.post('/api/tasks/:id/archive', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid task id' })

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Task not found' })

  const ts = nowIso()
  db.prepare('UPDATE tasks SET archivedAt = ? WHERE id = ?').run(ts, id)

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

// Unarchive a task
app.post('/api/tasks/:id/unarchive', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid task id' })

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Task not found' })

  db.prepare('UPDATE tasks SET archivedAt = NULL WHERE id = ?').run(id)

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

// Link an existing note to a task
app.post('/api/tasks/:id/link-note', (req, res) => {
  const taskId = Number(req.params.id)
  const noteId = Number(req.body?.noteId)
  if (!Number.isFinite(taskId)) return res.status(400).json({ error: 'Invalid task id' })
  if (!Number.isFinite(noteId)) return res.status(400).json({ error: 'Invalid note id' })

  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId)
  if (!task) return res.status(404).json({ error: 'Task not found' })
  const note = db.prepare('SELECT id FROM notes WHERE id = ?').get(noteId)
  if (!note) return res.status(404).json({ error: 'Note not found' })

  db.prepare('INSERT OR IGNORE INTO note_task_links (note_id, task_id, createdAt) VALUES (?, ?, ?)').run(noteId, taskId, nowIso())
  res.status(204).send()
})

app.delete('/api/tasks/:id/link-note/:noteId', (req, res) => {
  const taskId = Number(req.params.id)
  const noteId = Number(req.params.noteId)
  if (!Number.isFinite(taskId)) return res.status(400).json({ error: 'Invalid task id' })
  if (!Number.isFinite(noteId)) return res.status(400).json({ error: 'Invalid note id' })
  db.prepare('DELETE FROM note_task_links WHERE note_id = ? AND task_id = ?').run(noteId, taskId)
  res.status(204).send()
})

// Add a link attachment to a task
app.post('/api/tasks/:id/links', async (req, res) => {
  const taskId = Number(req.params.id)
  if (!Number.isFinite(taskId)) return res.status(400).json({ error: 'Invalid task id' })

  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId)
  if (!task) return res.status(404).json({ error: 'Task not found' })

  const url = typeof req.body?.url === 'string' ? req.body.url.trim() : ''
  if (!url || !isValidHttpUrl(url)) return res.status(400).json({ error: 'Valid http(s) url is required' })

  try {
    const ts = nowIso()
    const preview = await getLinkPreview(url)
    const screenshotPath = await captureScreenshot(url)

    const info = db
      .prepare(
        `
        INSERT INTO link_attachments
          (ownerType, ownerId, url, title, description, imageUrl, faviconUrl, screenshotPath, lastFetchedAt, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        'TASK',
        taskId,
        url,
        preview.title,
        preview.description,
        preview.imageUrl,
        preview.faviconUrl,
        screenshotPath,
        ts,
        ts,
        ts
      )

    const row = db.prepare('SELECT * FROM link_attachments WHERE id = ?').get(Number(info.lastInsertRowid))
    res.status(201).json(toLinkAttachment(row))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create link attachment' })
  }
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

// ---- Notes ----
app.get('/api/notes', (_req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        n.*,
        (SELECT COUNT(*) FROM note_task_links l WHERE l.note_id = n.id) AS linkedTaskCount
      FROM notes n
      ORDER BY n.sortOrder ASC, datetime(n.updatedAt) DESC, n.id DESC
    `
    )
    .all()
  res.json(rows.map(toNoteSummary))
})

// Reorder notes - update sortOrder for multiple notes
app.put('/api/notes/reorder', (req, res) => {
  const items = req.body?.items
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items array is required' })

  const tx = db.transaction(() => {
    for (const item of items) {
      const id = Number(item.id)
      const sortOrder = Number(item.sortOrder)
      if (!Number.isFinite(id) || !Number.isFinite(sortOrder)) continue
      db.prepare('UPDATE notes SET sortOrder = ? WHERE id = ?').run(sortOrder, id)
    }
  })

  tx()
  res.json({ ok: true })
})

app.post('/api/notes', (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
  if (!title) return res.status(400).json({ error: 'Title is required' })
  const body = typeof req.body?.body === 'string' ? req.body.body : ''

  const ts = nowIso()
  const info = db.prepare('INSERT INTO notes (title, body, createdAt, updatedAt) VALUES (?, ?, ?, ?)').run(title, body, ts, ts)
  const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(Number(info.lastInsertRowid))
  res.status(201).json(row)
})

app.get('/api/notes/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid note id' })

  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id)
  if (!note) return res.status(404).json({ error: 'Note not found' })

  const linkedTasks = db
    .prepare(
      `
      SELECT
        t.*,
        COUNT(s.id) AS subtaskTotal,
        COALESCE(SUM(CASE WHEN s.is_completed = 1 THEN 1 ELSE 0 END), 0) AS subtaskCompleted
      FROM tasks t
      LEFT JOIN subtasks s ON s.task_id = t.id
      INNER JOIN note_task_links l ON l.task_id = t.id
      WHERE l.note_id = ?
      GROUP BY t.id
      ORDER BY datetime(t.createdAt) DESC, t.id DESC
    `
    )
    .all(id)
    .map(toTaskSummary)

  const links = db
    .prepare('SELECT * FROM link_attachments WHERE ownerType = ? AND ownerId = ? ORDER BY datetime(updatedAt) DESC, id DESC')
    .all('NOTE', id)
    .map(toLinkAttachment)

  res.json({ ...note, linkedTasks, links })
})

app.put('/api/notes/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid note id' })

  const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Note not found' })

  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : existing.title
  if (!title) return res.status(400).json({ error: 'Title is required' })
  const body = typeof req.body?.body === 'string' ? req.body.body : existing.body

  const ts = nowIso()
  db.prepare('UPDATE notes SET title = ?, body = ?, updatedAt = ? WHERE id = ?').run(title, body, ts, id)

  const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id)
  res.json(row)
})

app.delete('/api/notes/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid note id' })
  const info = db.prepare('DELETE FROM notes WHERE id = ?').run(id)
  if (info.changes === 0) return res.status(404).json({ error: 'Note not found' })
  res.status(204).send()
})

// Link an existing task to a note
app.post('/api/notes/:id/link-task', (req, res) => {
  const noteId = Number(req.params.id)
  const taskId = Number(req.body?.taskId)
  if (!Number.isFinite(noteId)) return res.status(400).json({ error: 'Invalid note id' })
  if (!Number.isFinite(taskId)) return res.status(400).json({ error: 'Invalid task id' })

  const note = db.prepare('SELECT id FROM notes WHERE id = ?').get(noteId)
  if (!note) return res.status(404).json({ error: 'Note not found' })
  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId)
  if (!task) return res.status(404).json({ error: 'Task not found' })

  db.prepare('INSERT OR IGNORE INTO note_task_links (note_id, task_id, createdAt) VALUES (?, ?, ?)').run(noteId, taskId, nowIso())
  res.status(204).send()
})

app.delete('/api/notes/:id/link-task/:taskId', (req, res) => {
  const noteId = Number(req.params.id)
  const taskId = Number(req.params.taskId)
  if (!Number.isFinite(noteId)) return res.status(400).json({ error: 'Invalid note id' })
  if (!Number.isFinite(taskId)) return res.status(400).json({ error: 'Invalid task id' })
  db.prepare('DELETE FROM note_task_links WHERE note_id = ? AND task_id = ?').run(noteId, taskId)
  res.status(204).send()
})

// Create task from note and link them
app.post('/api/notes/:id/create-task', (req, res) => {
  const noteId = Number(req.params.id)
  if (!Number.isFinite(noteId)) return res.status(400).json({ error: 'Invalid note id' })
  const note = db.prepare('SELECT id, title FROM notes WHERE id = ?').get(noteId)
  if (!note) return res.status(404).json({ error: 'Note not found' })

  const title = typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim() : note.title
  const notes = typeof req.body?.notes === 'string' ? req.body.notes : ''
  const status = ['TODO', 'IN_PROGRESS', 'DONE'].includes(req.body?.status) ? req.body.status : 'TODO'
  const priority = ['HIGH', 'MEDIUM', 'LOW'].includes(req.body?.priority) ? req.body.priority : null
  const dueDate = typeof req.body?.dueDate === 'string' && req.body.dueDate.trim() ? req.body.dueDate.trim() : null
  const tags = normalizeTags(req.body?.tags)

  const createdAt = nowIso()
  const info = db
    .prepare('INSERT INTO tasks (title, notes, status, priority, dueDate, tags, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(title, notes, status, priority, dueDate, JSON.stringify(tags), createdAt)
  const taskId = Number(info.lastInsertRowid)

  db.prepare('INSERT OR IGNORE INTO note_task_links (note_id, task_id, createdAt) VALUES (?, ?, ?)').run(noteId, taskId, createdAt)

  // Return created summary
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
    .get(taskId)

  res.status(201).json(toTaskSummary(taskRow))
})

// Add a link attachment to a note
app.post('/api/notes/:id/links', async (req, res) => {
  const noteId = Number(req.params.id)
  if (!Number.isFinite(noteId)) return res.status(400).json({ error: 'Invalid note id' })

  const note = db.prepare('SELECT id FROM notes WHERE id = ?').get(noteId)
  if (!note) return res.status(404).json({ error: 'Note not found' })

  const url = typeof req.body?.url === 'string' ? req.body.url.trim() : ''
  if (!url || !isValidHttpUrl(url)) return res.status(400).json({ error: 'Valid http(s) url is required' })

  try {
    const ts = nowIso()
    const preview = await getLinkPreview(url)
    const screenshotPath = await captureScreenshot(url)

    const info = db
      .prepare(
        `
        INSERT INTO link_attachments
          (ownerType, ownerId, url, title, description, imageUrl, faviconUrl, screenshotPath, lastFetchedAt, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        'NOTE',
        noteId,
        url,
        preview.title,
        preview.description,
        preview.imageUrl,
        preview.faviconUrl,
        screenshotPath,
        ts,
        ts,
        ts
      )

    const row = db.prepare('SELECT * FROM link_attachments WHERE id = ?').get(Number(info.lastInsertRowid))
    res.status(201).json(toLinkAttachment(row))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create link attachment' })
  }
})

// Generic delete link attachment
app.delete('/api/links/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid link id' })
  const info = db.prepare('DELETE FROM link_attachments WHERE id = ?').run(id)
  if (info.changes === 0) return res.status(404).json({ error: 'Link not found' })
  res.status(204).send()
})

// One-off link preview helper (does not store)
app.get('/api/link-preview', async (req, res) => {
  const url = req.query.url ? String(req.query.url).trim() : ''
  if (!url || !isValidHttpUrl(url)) return res.status(400).json({ error: 'Valid http(s) url is required' })
  try {
    const preview = await getLinkPreview(url)
    const screenshotPath = await captureScreenshot(url)
    const screenshotUrl = screenshotPath ? `${SCREENSHOT_ROUTE}/${encodeURIComponent(screenshotPath)}` : null
    res.json({ ...preview, screenshotUrl })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch link preview' })
  }
})

// ---- Reminders ----
app.get('/api/reminders', (req, res) => {
  const includeDone = String(req.query.includeDone ?? '') === '1'
  const rows = db
    .prepare(includeDone ? 'SELECT * FROM reminders ORDER BY datetime(dueAt) ASC, id ASC' : 'SELECT * FROM reminders WHERE isDone = 0 ORDER BY datetime(dueAt) ASC, id ASC')
    .all()
  res.json(rows.map(toReminder))
})

app.post('/api/reminders', (req, res) => {
  const targetType = req.body?.targetType === 'TASK' || req.body?.targetType === 'NOTE' ? req.body.targetType : null
  const targetId = Number(req.body?.targetId)
  const dueAt = typeof req.body?.dueAt === 'string' ? req.body.dueAt.trim() : ''
  const message = typeof req.body?.message === 'string' ? req.body.message : ''
  if (!targetType) return res.status(400).json({ error: 'targetType must be TASK or NOTE' })
  if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'targetId is required' })
  if (!dueAt) return res.status(400).json({ error: 'dueAt is required' })
  if (!Number.isFinite(Date.parse(dueAt))) return res.status(400).json({ error: 'dueAt must be an ISO date string' })

  // Best-effort existence check
  if (targetType === 'TASK') {
    const t = db.prepare('SELECT id FROM tasks WHERE id = ?').get(targetId)
    if (!t) return res.status(404).json({ error: 'Task not found' })
  } else {
    const n = db.prepare('SELECT id FROM notes WHERE id = ?').get(targetId)
    if (!n) return res.status(404).json({ error: 'Note not found' })
  }

  const ts = nowIso()
  const info = db
    .prepare('INSERT INTO reminders (targetType, targetId, dueAt, message, isDone, firedAt, createdAt) VALUES (?, ?, ?, ?, 0, NULL, ?)')
    .run(targetType, targetId, dueAt, message, ts)
  const row = db.prepare('SELECT * FROM reminders WHERE id = ?').get(Number(info.lastInsertRowid))
  res.status(201).json(toReminder(row))
})

app.put('/api/reminders/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid reminder id' })
  const existing = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Reminder not found' })

  const dueAt = typeof req.body?.dueAt === 'string' ? req.body.dueAt.trim() : existing.dueAt
  if (!Number.isFinite(Date.parse(dueAt))) return res.status(400).json({ error: 'dueAt must be an ISO date string' })
  const message = typeof req.body?.message === 'string' ? req.body.message : existing.message
  const isDone = typeof req.body?.isDone === 'boolean' ? (req.body.isDone ? 1 : 0) : existing.isDone

  // If a reminder is moved to the future, allow it to fire again by clearing firedAt.
  const firedAt = isDone ? existing.firedAt : null
  db.prepare('UPDATE reminders SET dueAt = ?, message = ?, isDone = ?, firedAt = ? WHERE id = ?').run(dueAt, message, isDone, firedAt, id)

  const row = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id)
  res.json(toReminder(row))
})

app.delete('/api/reminders/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid reminder id' })
  const info = db.prepare('DELETE FROM reminders WHERE id = ?').run(id)
  if (info.changes === 0) return res.status(404).json({ error: 'Reminder not found' })
  res.status(204).send()
})

// Returns reminders that are due and not yet "fired". This endpoint marks them as fired.
app.get('/api/reminders/due', (req, res) => {
  const now = nowIso()
  const take = Math.max(1, Math.min(50, Number(req.query.take ?? 20)))

  const tx = db.transaction(() => {
    const due = db
      .prepare(
        `
        SELECT * FROM reminders
        WHERE isDone = 0 AND firedAt IS NULL AND datetime(dueAt) <= datetime(?)
        ORDER BY datetime(dueAt) ASC, id ASC
        LIMIT ?
      `
      )
      .all(now, take)

    if (due.length) {
      const ids = due.map((r) => Number(r.id))
      const placeholders = ids.map(() => '?').join(',')
      db.prepare(`UPDATE reminders SET firedAt = ? WHERE id IN (${placeholders})`).run(now, ...ids)
    }

    return due
  })

  const rows = tx()
  res.json(rows.map(toReminder))
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

