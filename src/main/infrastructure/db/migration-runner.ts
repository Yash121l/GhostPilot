/**
 * @module migration-runner
 * Runs pending SQL migrations at app startup using better-sqlite3 directly.
 * Migrations are ordered by filename prefix (0001_, 0002_, ...).
 * Failures abort startup with a clear error dialog.
 *
 * Path resolution:
 *  - Dev:  src/main/infrastructure/db/migrations/ (via electron-vite extraResources)
 *  - Prod: resources/migrations/ (copied by electron-builder)
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { getRawDb } from './connection'
import { createLogger } from '../logger/logger'

const logger = createLogger('MigrationRunner')

/**
 * Resolve migrations directory, handling dev vs production environments.
 */
function getMigrationsDir(): string {
  // In packaged production build, migrations are in resources/
  if (app.isPackaged) {
    return join(process.resourcesPath, 'migrations')
  }
  // In development, read directly from src
  const devPath = join(process.cwd(), 'src/main/infrastructure/db/migrations')
  if (existsSync(devPath)) return devPath
  // Fallback to relative from compiled output
  return join(__dirname, '../../../infrastructure/db/migrations')
}

/** Tracks which migrations have been applied. */
function ensureMigrationsTable(db: ReturnType<typeof getRawDb>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `)
}

function getAppliedMigrations(db: ReturnType<typeof getRawDb>): Set<string> {
  const rows = db.prepare('SELECT filename FROM _migrations').all() as { filename: string }[]
  return new Set(rows.map((r) => r.filename))
}

/**
 * Run all pending `.sql` migration files in ascending order.
 * Called once at startup before any service initialises.
 *
 * @throws Error if any migration fails — caller should show an error dialog and quit.
 */
export function runMigrations(): void {
  const db = getRawDb()
  const migrationsDir = getMigrationsDir()
  ensureMigrationsTable(db)

  const applied = getAppliedMigrations(db)

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  let count = 0
  for (const file of files) {
    if (applied.has(file)) continue

    const sql = readFileSync(join(migrationsDir, file), 'utf-8')
    logger.info({ msg: `Applying migration: ${file}` })

    db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)').run(
        file,
        Date.now(),
      )
    })()

    logger.info({ msg: `Migration applied: ${file}` })
    count++
  }

  if (count === 0) {
    logger.info({ msg: 'All migrations already applied — DB schema up to date' })
  } else {
    logger.info({ msg: `Applied ${count} migration(s) successfully` })
  }
}
