/**
 * @module connection
 * better-sqlite3 singleton with WAL mode enabled.
 * Import `getDb()` — never construct Database directly elsewhere.
 */

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { join } from 'path'
import { app } from 'electron'
import * as schema from './schema'
import { DB_FILE_NAME } from '../../../shared/constants'

let _db: ReturnType<typeof drizzle> | null = null
let _sqlite: Database.Database | null = null

/**
 * Initialise the SQLite connection (idempotent).
 * Must be called once at app startup before any service uses `getDb()`.
 */
export function initDb(): ReturnType<typeof drizzle> {
  if (_db) return _db

  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, DB_FILE_NAME)

  _sqlite = new Database(dbPath)

  // Enable WAL mode for better concurrency + crash safety.
  _sqlite.pragma('journal_mode = WAL')
  _sqlite.pragma('foreign_keys = ON')
  _sqlite.pragma('synchronous = NORMAL')

  _db = drizzle(_sqlite, { schema })
  return _db
}

/**
 * Get the Drizzle ORM instance.
 * @throws if `initDb()` has not been called yet.
 */
export function getDb(): ReturnType<typeof drizzle> {
  if (!_db) throw new Error('DB not initialised — call initDb() first')
  return _db
}

/**
 * Get the raw better-sqlite3 Database instance.
 * Use only for migrations and FTS5 operations that Drizzle can't express.
 */
export function getRawDb(): Database.Database {
  if (!_sqlite) throw new Error('DB not initialised — call initDb() first')
  return _sqlite
}

/**
 * Close the database connection cleanly (called on app quit).
 */
export function closeDb(): void {
  _sqlite?.close()
  _sqlite = null
  _db = null
}
