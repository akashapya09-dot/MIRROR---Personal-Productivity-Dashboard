import express from 'express';
import initSqlJs from 'sql.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const dbPath = path.join(dataDir, 'mirror.db');
fs.mkdirSync(dataDir, { recursive: true });

const SQL = await initSqlJs();
const db = fs.existsSync(dbPath)
  ? new SQL.Database(new Uint8Array(fs.readFileSync(dbPath)))
  : new SQL.Database();

db.run(`
  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    due_date TEXT NOT NULL DEFAULT '',
    missed INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    mood TEXT NOT NULL DEFAULT 'Calm',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Safe migrations for databases created by earlier MIRROR versions.
for (const [column, definition] of [['due_date', "TEXT NOT NULL DEFAULT ''"], ['missed', 'INTEGER NOT NULL DEFAULT 0']]) {
  try { db.run(`ALTER TABLE goals ADD COLUMN ${column} ${definition}`); } catch {}
}

function persistDb() {
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}
function one(sql, params = []) {
  return all(sql, params)[0] ?? null;
}
function run(sql, params = []) {
  db.run(sql, params);
  const id = db.exec('SELECT last_insert_rowid() AS id')[0]?.values[0][0] ?? null;
  persistDb();
  return id;
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'mirror-api' }));

app.get('/api/goals', (_req, res) => res.json(all('SELECT * FROM goals ORDER BY id DESC')));
app.post('/api/goals', (req, res) => {
  const title = String(req.body?.title ?? '').trim();
  const detail = String(req.body?.detail ?? '').trim();
  const dueDate = String(req.body?.due_date ?? '').trim();
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return res.status(400).json({ error: 'Choose a valid due date.' });
  if (!title) return res.status(400).json({ error: 'Goal title is required.' });
  if (title.length > 120 || detail.length > 300) return res.status(400).json({ error: 'Goal text is too long.' });
  const id = run('INSERT INTO goals (title, detail, due_date) VALUES (?, ?, ?)', [title, detail, dueDate]);
  res.status(201).json(one('SELECT * FROM goals WHERE id = ?', [id]));
});
app.patch('/api/goals/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!one('SELECT id FROM goals WHERE id = ?', [id])) return res.status(404).json({ error: 'Goal not found.' });
  if (typeof req.body?.completed === 'boolean') {
    run('UPDATE goals SET completed = ?, missed = 0 WHERE id = ?', [req.body.completed ? 1 : 0, id]);
  } else if (typeof req.body?.missed === 'boolean') {
    run('UPDATE goals SET missed = ?, completed = 0 WHERE id = ?', [req.body.missed ? 1 : 0, id]);
  } else if (typeof req.body?.due_date === 'string' && (!req.body.due_date || /^\d{4}-\d{2}-\d{2}$/.test(req.body.due_date))) {
    run('UPDATE goals SET due_date = ? WHERE id = ?', [req.body.due_date, id]);
  } else return res.status(400).json({ error: 'Provide completed, missed, or a valid due_date.' });
  res.json(one('SELECT * FROM goals WHERE id = ?', [id]));
});
app.delete('/api/goals/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!one('SELECT id FROM goals WHERE id = ?', [id])) return res.status(404).json({ error: 'Goal not found.' });
  run('DELETE FROM goals WHERE id = ?', [id]);
  res.status(204).end();
});

app.get('/api/journal', (_req, res) => res.json(all('SELECT * FROM journal_entries ORDER BY id DESC')));
app.post('/api/journal', (req, res) => {
  const content = String(req.body?.content ?? '').trim();
  const mood = String(req.body?.mood ?? 'Calm').trim().slice(0, 30) || 'Calm';
  if (!content) return res.status(400).json({ error: 'Write something before saving.' });
  if (content.length > 5000) return res.status(400).json({ error: 'Entry must be 5000 characters or fewer.' });
  const id = run('INSERT INTO journal_entries (content, mood) VALUES (?, ?)', [content, mood]);
  res.status(201).json(one('SELECT * FROM journal_entries WHERE id = ?', [id]));
});
app.delete('/api/journal/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!one('SELECT id FROM journal_entries WHERE id = ?', [id])) return res.status(404).json({ error: 'Journal entry not found.' });
  run('DELETE FROM journal_entries WHERE id = ?', [id]);
  res.status(204).end();
});

// API-only backend. Nginx on the frontend instance serves the built website.

const port = Number(process.env.PORT || 3001);
app.listen(port, '0.0.0.0', () => {
  console.log(`MIRROR server listening on http://localhost:${port}`);
});
