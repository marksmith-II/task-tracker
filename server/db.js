const path = require('path')
const Database = require('better-sqlite3')

const DB_PATH = path.join(__dirname, 'tasks.db')

/**
 * One shared connection for the process (better-sqlite3 is synchronous).
 */
const db = new Database(DB_PATH)

db.pragma('foreign_keys = ON')
db.pragma('journal_mode = WAL')

db.exec(`
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  notes TEXT DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('TODO','IN_PROGRESS','DONE')) DEFAULT 'TODO',
  dueDate TEXT,
  tags TEXT DEFAULT '[]',
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subtasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0
);
`)

function safeParseTags(tagsText) {
  if (!tagsText) return []
  try {
    const parsed = JSON.parse(tagsText)
    if (Array.isArray(parsed)) return parsed.filter((t) => typeof t === 'string')
    return []
  } catch {
    return []
  }
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return []
  const cleaned = tags
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean)
    .slice(0, 30)
  return Array.from(new Set(cleaned))
}

module.exports = {
  db,
  DB_PATH,
  safeParseTags,
  normalizeTags,
}

