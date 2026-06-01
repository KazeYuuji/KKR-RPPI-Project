import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";

let client: ReturnType<typeof createClient> | null = null;

export function getDb() {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

export async function initSchema() {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sponsors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      website TEXT DEFAULT '',
      description TEXT DEFAULT '',
      logo_url TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  await db.execute(`
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
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS registrants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      school TEXT DEFAULT '',
      email TEXT DEFAULT '',
      whatsapp TEXT DEFAULT '',
      participant_type TEXT DEFAULT 'Student',
      ticket TEXT DEFAULT '',
      checked_in INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      remaining INTEGER DEFAULT 0
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const existingTickets = await db.execute("SELECT id FROM tickets LIMIT 1");
  if (existingTickets.rows.length === 0) {
    await db.execute("INSERT INTO tickets (id, name, remaining) VALUES ('early', 'Early Bird', 120)");
    await db.execute("INSERT INTO tickets (id, name, remaining) VALUES ('general', 'General Admission', 240)");
    await db.execute("INSERT INTO tickets (id, name, remaining) VALUES ('alumni', 'Alumni', 80)");
  }

  await runMigrations(db);

  const adminCount = await db.execute("SELECT COUNT(*) as c FROM admins");
  const count = adminCount.rows[0] as unknown as Record<string, any>;
  if (!(count?.c || 0)) {
    const hash = bcrypt.hashSync("admin123", 10);
    await db.execute("INSERT INTO admins (username, email, password) VALUES (?, ?, ?)", ["admin", "admin@kkrrppi.com", hash]);
  }
}

async function runMigrations(db: ReturnType<typeof createClient>) {
  const migrations = [
    { table: "sponsors", column: "logo_url", def: "TEXT DEFAULT ''" },
    { table: "registrants", column: "email", def: "TEXT DEFAULT ''" },
    { table: "registrants", column: "whatsapp", def: "TEXT DEFAULT ''" },
    { table: "registrants", column: "participant_type", def: "TEXT DEFAULT 'Student'" },
  ];
  for (const { table, column, def } of migrations) {
    try {
      await db.execute(`SELECT ${column} FROM ${table} LIMIT 1`);
    } catch {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
    }
  }
  // Drop expiry_date from tickets if present
  try {
    await db.execute("SELECT expiry_date FROM tickets LIMIT 1");
    const data = await db.execute("SELECT id, name, remaining FROM tickets");
    const oldTickets = data.rows.map((r: any) => ({ id: r.id, name: r.name, remaining: r.remaining }));
    await db.execute("DROP TABLE IF EXISTS tickets_new");
    await db.execute("CREATE TABLE tickets_new (id TEXT PRIMARY KEY, name TEXT NOT NULL, remaining INTEGER DEFAULT 0)");
    for (const t of oldTickets) {
      await db.execute("INSERT INTO tickets_new (id, name, remaining) VALUES (?, ?, ?)", [t.id, t.name, t.remaining]);
    }
    await db.execute("DROP TABLE tickets");
    await db.execute("ALTER TABLE tickets_new RENAME TO tickets");
  } catch {
    // no expiry_date column
  }
  // Drop price column if present
  try {
    await db.execute("SELECT price FROM tickets LIMIT 1");
    const data = await db.execute("SELECT id, name, remaining FROM tickets");
    const oldTickets = data.rows.map((r: any) => ({ id: r.id, name: r.name, remaining: r.remaining }));
    await db.execute("DROP TABLE IF EXISTS tickets_new");
    await db.execute("CREATE TABLE tickets_new (id TEXT PRIMARY KEY, name TEXT NOT NULL, remaining INTEGER DEFAULT 0)");
    for (const t of oldTickets) {
      await db.execute("INSERT INTO tickets_new (id, name, remaining) VALUES (?, ?, ?)", [t.id, t.name, t.remaining]);
    }
    await db.execute("DROP TABLE tickets");
    await db.execute("ALTER TABLE tickets_new RENAME TO tickets");
  } catch {
    // no price column
  }
  // Drop status column from registrants
  try {
    await db.execute("SELECT status FROM registrants LIMIT 1");
    const data = await db.execute("SELECT id, name, school, email, whatsapp, participant_type, ticket, checked_in, created_at FROM registrants");
    const oldRows = data.rows.map((r: any) => ({ id: r.id, name: r.name, school: r.school, email: r.email, whatsapp: r.whatsapp, participant_type: r.participant_type, ticket: r.ticket, checked_in: r.checked_in, created_at: r.created_at }));
    await db.execute("DROP TABLE IF EXISTS registrants_new");
    await db.execute("CREATE TABLE registrants_new (id TEXT PRIMARY KEY, name TEXT NOT NULL, school TEXT DEFAULT '', email TEXT DEFAULT '', whatsapp TEXT DEFAULT '', participant_type TEXT DEFAULT 'Student', ticket TEXT DEFAULT '', checked_in INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))");
    for (const r of oldRows) {
      await db.execute("INSERT INTO registrants_new (id, name, school, email, whatsapp, participant_type, ticket, checked_in, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [r.id, r.name, r.school, r.email, r.whatsapp, r.participant_type, r.ticket, r.checked_in, r.created_at]);
    }
    await db.execute("DROP TABLE registrants");
    await db.execute("ALTER TABLE registrants_new RENAME TO registrants");
  } catch {
    // no status column
  }
  // Drop tier column from sponsors if present
  try {
    await db.execute("SELECT tier FROM sponsors LIMIT 1");
    const data = await db.execute("SELECT id, name, website, description, logo_url, is_active, created_at, updated_at FROM sponsors");
    const oldRows = data.rows.map((r: any) => ({ id: r.id, name: r.name, website: r.website, description: r.description, logo_url: r.logo_url, is_active: r.is_active, created_at: r.created_at, updated_at: r.updated_at }));
    await db.execute("DROP TABLE IF EXISTS sponsors_new");
    await db.execute("CREATE TABLE sponsors_new (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, website TEXT DEFAULT '', description TEXT DEFAULT '', logo_url TEXT DEFAULT '', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))");
    for (const r of oldRows) {
      await db.execute("INSERT INTO sponsors_new (id, name, website, description, logo_url, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [r.id, r.name, r.website, r.description, r.logo_url, r.is_active, r.created_at, r.updated_at]);
    }
    await db.execute("DROP TABLE sponsors");
    await db.execute("ALTER TABLE sponsors_new RENAME TO sponsors");
  } catch {
    // no tier column
  }
}

export async function getRow(sql: string, params?: any[]) {
  const result = await getDb().execute({ sql, args: params || [] });
  return (result.rows[0] as Record<string, any>) || null;
}

export async function getAll(sql: string, params?: any[]) {
  const result = await getDb().execute({ sql, args: params || [] });
  return result.rows as Record<string, any>[];
}
