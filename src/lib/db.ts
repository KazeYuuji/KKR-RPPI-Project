import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "data", "natal.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sponsors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      website TEXT DEFAULT '',
      tier TEXT DEFAULT 'bronze',
      description TEXT DEFAULT '',
      logo_url TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS speakers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      title TEXT DEFAULT '',
      organization TEXT DEFAULT '',
      description TEXT DEFAULT '',
      photo_url TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS registrants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      school TEXT DEFAULT '',
      email TEXT DEFAULT '',
      whatsapp TEXT DEFAULT '',
      participant_type TEXT DEFAULT 'Student',
      ticket TEXT DEFAULT '',
      status TEXT DEFAULT 'Pending',
      checked_in INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      remaining INTEGER DEFAULT 0,
      expiry_date TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO tickets (id, name, remaining, expiry_date) VALUES
      ('early', 'Early Bird', 120, '2025-12-29'),
      ('general', 'General Admission', 240, '2026-01-10'),
      ('alumni', 'Alumni', 80, '2026-01-10');
  `);

  // Migrations
  for (const { table, column, def } of [
    { table: "tickets", column: "expiry_date", def: "TEXT DEFAULT ''" },
    { table: "sponsors", column: "logo_url", def: "TEXT DEFAULT ''" },
    { table: "registrants", column: "email", def: "TEXT DEFAULT ''" },
    { table: "registrants", column: "whatsapp", def: "TEXT DEFAULT ''" },
    { table: "registrants", column: "participant_type", def: "TEXT DEFAULT 'Student'" },
  ]) {
    try {
      db.prepare(`SELECT ${column} FROM ${table} LIMIT 1`).get();
    } catch {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
    }
  }
  // Migration: drop price column from tickets if present
  try {
    db.prepare("SELECT price FROM tickets LIMIT 1").get();
    const migrate = db.transaction(() => {
      db.exec("DROP TABLE IF EXISTS tickets_new");
      db.exec("CREATE TABLE tickets_new (id TEXT PRIMARY KEY, name TEXT NOT NULL, remaining INTEGER DEFAULT 0, expiry_date TEXT DEFAULT '')");
      db.exec("INSERT INTO tickets_new (id, name, remaining, expiry_date) SELECT id, name, remaining, COALESCE(expiry_date, '') FROM tickets");
      db.exec("DROP TABLE tickets");
      db.exec("ALTER TABLE tickets_new RENAME TO tickets");
    });
    migrate();
  } catch {
    // price column doesn't exist, nothing to migrate
  }

  const adminCount = db.prepare("SELECT COUNT(*) as c FROM admins").get() as { c: number };
  if (!adminCount.c) {
    const hash = bcrypt.hashSync("admin123", 10);
    db.prepare("INSERT INTO admins (username, email, password) VALUES (?, ?, ?)").run(
      "admin", "admin@kkrrppi.com", hash
    );
  }
}
