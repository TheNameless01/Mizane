import DatabaseConstructor, { Database } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Augment NodeJS global to hold singleton database instance across hot-reloads
declare global {
  // eslint-disable-next-line no-var
  var __mizan_db__: Database | undefined;
}

export function initDatabase(dbPath?: string): Database {
  const targetPath = dbPath || process.env.DATABASE_PATH || './data/mizan.db';

  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseConstructor(targetPath);

  // Set SQLite PRAGMAs for concurrency and integrity
  db.pragma('foreign_keys = ON');
  if (targetPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');

  // Load and apply base schema
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  }

  // Ensure default business settings row exists
  const hasSettings = db.prepare('SELECT id FROM business_settings WHERE id = 1').get();
  if (!hasSettings) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO business_settings (id, name, address, phone, nif, nis, rc, ai, default_currency, updated_at)
      VALUES (1, 'Établissement Commercial Mizan', 'Zone d''Activité, Alger, Algérie', '023 00 00 00 / 0550 00 00 00', '000016000000000', '00000000000000', '16/00-0000000B20', '16000000000', 'DZD', ?)
    `).run(now);
  }

  return db;
}

export function getDb(): Database {
  if (process.env.NODE_ENV === 'production') {
    if (!global.__mizan_db__) {
      global.__mizan_db__ = initDatabase();
    }
    return global.__mizan_db__;
  }

  // In development, preserve DB connection across tsx reloads
  if (!global.__mizan_db__) {
    global.__mizan_db__ = initDatabase();
  }
  return global.__mizan_db__;
}

export function createTestDb(): Database {
  return initDatabase(':memory:');
}
