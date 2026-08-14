const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, '..', 'schema.sql');

/**
 * Opens (or creates) a SQLite database at `dbPath`, applies the schema
 * (idempotent - uses CREATE TABLE IF NOT EXISTS), and returns the
 * configured better-sqlite3 instance.
 *
 * Pass ':memory:' for an in-memory database, e.g. in tests.
 */
function createDb(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);

  return db;
}

module.exports = { createDb };
