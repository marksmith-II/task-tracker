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
  priority TEXT CHECK(priority IN ('HIGH','MEDIUM','LOW') OR priority IS NULL) DEFAULT NULL,
  dueDate TEXT,
  tags TEXT DEFAULT '[]',
  createdAt TEXT NOT NULL,
  sortOrder INTEGER DEFAULT 0,
  archivedAt TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS subtasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0
);

-- Notes (rich, linkable documents)
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  sortOrder INTEGER DEFAULT 0
);

-- Many-to-many links between notes and tasks
CREATE TABLE IF NOT EXISTS note_task_links (
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL,
  PRIMARY KEY (note_id, task_id)
);

-- Reminders linked to either a task or a note
CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  targetType TEXT NOT NULL CHECK(targetType IN ('TASK','NOTE')),
  targetId INTEGER NOT NULL,
  dueAt TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  isDone INTEGER NOT NULL DEFAULT 0,
  firedAt TEXT,
  createdAt TEXT NOT NULL
);

-- URL attachments with preview metadata (and optional screenshot)
CREATE TABLE IF NOT EXISTS link_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ownerType TEXT NOT NULL CHECK(ownerType IN ('TASK','NOTE')),
  ownerId INTEGER NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  imageUrl TEXT,
  faviconUrl TEXT,
  screenshotPath TEXT,
  lastFetchedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_note_task_links_task_id ON note_task_links(task_id);
CREATE INDEX IF NOT EXISTS idx_note_task_links_note_id ON note_task_links(note_id);
CREATE INDEX IF NOT EXISTS idx_reminders_dueAt ON reminders(dueAt);
CREATE INDEX IF NOT EXISTS idx_links_owner ON link_attachments(ownerType, ownerId);
`)

// Migrations for existing databases - add new columns if they don't exist
const taskColumns = db.prepare("PRAGMA table_info(tasks)").all().map(c => c.name)
if (!taskColumns.includes('sortOrder')) {
  db.exec('ALTER TABLE tasks ADD COLUMN sortOrder INTEGER DEFAULT 0')
}
if (!taskColumns.includes('archivedAt')) {
  db.exec('ALTER TABLE tasks ADD COLUMN archivedAt TEXT DEFAULT NULL')
}

const noteColumns = db.prepare("PRAGMA table_info(notes)").all().map(c => c.name)
if (!noteColumns.includes('sortOrder')) {
  db.exec('ALTER TABLE notes ADD COLUMN sortOrder INTEGER DEFAULT 0')
}

// Add priority column migration
if (!taskColumns.includes('priority')) {
  db.exec('ALTER TABLE tasks ADD COLUMN priority TEXT CHECK(priority IN (\'HIGH\',\'MEDIUM\',\'LOW\') OR priority IS NULL) DEFAULT NULL')
}

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

