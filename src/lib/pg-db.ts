import pg from "pg";

const PG_HOST = process.env.PGHOST || "postgresql";
const PG_PORT = parseInt(process.env.PGPORT || "5432", 10);
const PG_USER = process.env.PGUSER || "kediritechnopark";
const PG_PASSWORD = process.env.PGPASSWORD || "";
const PG_DATABASE = process.env.PGDATABASE || "kkr_rppi";

let pool: pg.Pool | null = null;
let poolError: Error | null = null;

async function getPool(): Promise<pg.Pool> {
  if (poolError) throw poolError;
  if (!pool) {
    if (!PG_PASSWORD) {
      poolError = new Error("PGPASSWORD environment variable is required");
      throw poolError;
    }
    pool = new pg.Pool({
      host: PG_HOST,
      port: PG_PORT,
      user: PG_USER,
      password: PG_PASSWORD,
      database: PG_DATABASE,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export async function query<T = Record<string, any>>(sql: string, params?: any[]): Promise<T[]> {
  const client = await (await getPool()).connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = Record<string, any>>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function execute(sql: string, params?: any[]): Promise<number> {
  const client = await (await getPool()).connect();
  try {
    const result = await client.query(sql, params);
    return result.rowCount ?? 0;
  } finally {
    client.release();
  }
}

export async function pgGet<T = Record<string, any>>(table: string, id: string): Promise<T | null> {
  const rows = await query<T>(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function pgList<T = Record<string, any>>(table: string, orderBy = "created_at DESC"): Promise<T[]> {
  return query<T>(`SELECT * FROM ${table} ORDER BY ${orderBy}`);
}

export async function pgSet<T extends Record<string, any>>(table: string, data: T): Promise<void> {
  const keys = Object.keys(data);
  const values = keys.map(k => data[k]);
  const setClause = keys.map(k => `${k} = EXCLUDED.${k}`).join(", ");
  await execute(
    `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")})
     ON CONFLICT (id) DO UPDATE SET ${setClause}`,
    values
  );
}

export async function pgDelete(table: string, id: string): Promise<number> {
  return execute(`DELETE FROM ${table} WHERE id = $1`, [id]);
}

export async function pgGetSettings(): Promise<Record<string, string>> {
  const rows = await query<{ key: string; value: string }>("SELECT key, value FROM settings");
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

export async function pgSetSetting(key: string, value: string): Promise<void> {
  await execute("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2", [key, value]);
}

export async function pgGetRegistrantByTicket(ticketId: string): Promise<number> {
  const row = await queryOne<{ count: string }>("SELECT COUNT(*) as count FROM registrants WHERE ticket = $1", [ticketId]);
  return parseInt(row?.count || "0", 10);
}

export async function initSchema(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS speakers (id TEXT PRIMARY KEY, name TEXT NOT NULL, title TEXT DEFAULT '', organization TEXT DEFAULT '', description TEXT DEFAULT '', photo_url TEXT DEFAULT '', tags TEXT DEFAULT '', story TEXT DEFAULT '', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT '', updated_at TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS sponsors (id TEXT PRIMARY KEY, name TEXT NOT NULL, website TEXT DEFAULT '', description TEXT DEFAULT '', logo_url TEXT DEFAULT '', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT '', updated_at TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, name TEXT NOT NULL, remaining INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS registrants (id TEXT PRIMARY KEY, name TEXT NOT NULL, school TEXT DEFAULT '', email TEXT DEFAULT '', whatsapp TEXT DEFAULT '', participant_type TEXT DEFAULT '', ticket TEXT, checked_in INTEGER DEFAULT 0, created_at TEXT DEFAULT '', updated_at TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT DEFAULT '', password TEXT NOT NULL, created_at TEXT DEFAULT '', updated_at TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS altar_servers (id TEXT PRIMARY KEY, name TEXT NOT NULL, title TEXT DEFAULT '', organization TEXT DEFAULT '', description TEXT DEFAULT '', photo_url TEXT DEFAULT '', tags TEXT DEFAULT '', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT '', updated_at TEXT DEFAULT '');
  `);
}
