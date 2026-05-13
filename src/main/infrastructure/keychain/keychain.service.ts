/**
 * @module keychain.service
 * Secure credential storage using keytar (OS keychain) with
 * electron.safeStorage as fallback for environments where keytar is unavailable.
 *
 * RULES:
 *  - Tokens and API keys NEVER pass through the renderer or IPC payload.
 *  - Keys stored here are referenced in DB by a `keychainKey` string only.
 */

import keytar from 'keytar'
import { safeStorage } from 'electron'
import { join } from 'path'
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { createLogger } from '../logger/logger'
import { AppError, ErrorCode } from '../../../shared/types/error'

const logger = createLogger('KeychainService')

const SERVICE_NAME = 'ghostpilot'

/** Fallback encrypted store path (used if keytar fails). */
function getFallbackStorePath(): string {
  const dir = join(app.getPath('userData'), 'secure')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'store.enc')
}

function readFallbackStore(): Record<string, string> {
  const path = getFallbackStorePath()
  if (!existsSync(path)) return {}
  try {
    const encrypted = readFileSync(path)
    const decrypted = safeStorage.decryptString(encrypted)
    return JSON.parse(decrypted) as Record<string, string>
  } catch {
    return {}
  }
}

function writeFallbackStore(store: Record<string, string>): void {
  const path = getFallbackStorePath()
  const encrypted = safeStorage.encryptString(JSON.stringify(store))
  writeFileSync(path, encrypted)
}

/**
 * Secure keychain service.
 * Primary: OS keychain via keytar.
 * Fallback: electron.safeStorage encrypted file.
 */
export class KeychainService {
  /**
   * Store a secret in the OS keychain.
   * @param key - unique key (e.g. 'linkedin:access_token:userId')
   * @param secret - the secret value to store
   */
  async set(key: string, secret: string): Promise<void> {
    logger.info({ msg: 'Storing secret in keychain', keychainKey: key })
    try {
      await keytar.setPassword(SERVICE_NAME, key, secret)
    } catch (e) {
      logger.warn({ msg: 'keytar failed, using safeStorage fallback', error: String(e) })
      try {
        const store = readFallbackStore()
        store[key] = secret
        writeFallbackStore(store)
      } catch (fe) {
        throw new AppError({
          code: ErrorCode.KEYCHAIN_WRITE_FAILED,
          message: `Failed to store secret for key "${key}"`,
          context: { key },
          cause: fe as Error,
        })
      }
    }
  }

  /**
   * Retrieve a secret from the OS keychain.
   * Returns null if not found.
   */
  async get(key: string): Promise<string | null> {
    try {
      const val = await keytar.getPassword(SERVICE_NAME, key)
      if (val !== null) return val
    } catch (e) {
      logger.warn({ msg: 'keytar read failed, trying safeStorage fallback', error: String(e) })
    }

    try {
      const store = readFallbackStore()
      return store[key] ?? null
    } catch (fe) {
      throw new AppError({
        code: ErrorCode.KEYCHAIN_READ_FAILED,
        message: `Failed to read secret for key "${key}"`,
        context: { key },
        cause: fe as Error,
      })
    }
  }

  /**
   * Delete a secret from the keychain.
   */
  async delete(key: string): Promise<void> {
    logger.info({ msg: 'Deleting secret from keychain', keychainKey: key })
    try {
      await keytar.deletePassword(SERVICE_NAME, key)
    } catch {
      // best-effort
    }
    try {
      const store = readFallbackStore()
      delete store[key]
      writeFallbackStore(store)
    } catch {
      // best-effort
    }
  }
}
