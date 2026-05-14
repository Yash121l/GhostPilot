import { ipcMain, dialog, app } from 'electron'
import { copyFileSync, mkdirSync, readFileSync } from 'fs'
import { join, extname } from 'path'
import { nanoid } from 'nanoid'
import { IPC_CHANNELS } from '../../shared/ipc-types'
import { ok, err, AppError, ErrorCode } from '../../shared/types/error'
import type { ImageAttachment } from '../../shared/types/post'
import { getServices } from '../services/index'
import { createLogger } from '../infrastructure/logger/logger'

const logger = createLogger('MediaHandlers')

const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])

function mimeForExt(ext: string): string {
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
  }
  return map[ext.toLowerCase()] ?? 'image/jpeg'
}

function ensureMediaDir(): string {
  const dir = join(app.getPath('userData'), 'media')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function registerMediaHandlers(): void {
  // Open native file picker, copy selected images to userData/media/, return attachments
  ipcMain.handle(IPC_CHANNELS.MEDIA_OPEN_DIALOG, async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Images',
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
        properties: ['openFile', 'multiSelections'],
      })

      if (result.canceled || !result.filePaths.length) {
        return ok([])
      }

      const mediaDir = ensureMediaDir()
      const attachments: ImageAttachment[] = []

      for (const srcPath of result.filePaths.slice(0, 4)) {
        const ext = extname(srcPath).toLowerCase()
        if (!ALLOWED_EXTS.has(ext)) continue

        const destName = `${nanoid()}${ext}`
        const localPath = join(mediaDir, destName)
        copyFileSync(srcPath, localPath)

        const mime = mimeForExt(ext)
        const dataUrl = `data:${mime};base64,${readFileSync(localPath).toString('base64')}`
        attachments.push({ localPath, mimeType: mime, dataUrl })
        logger.info({ msg: 'Image attached', localPath })
      }

      return ok(attachments)
    } catch (e) {
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })

  // Update a post's image list
  ipcMain.handle(IPC_CHANNELS.POST_SET_IMAGES, async (_event, { postId, images }: { postId: string; images: ImageAttachment[] }) => {
    try {
      return ok(await getServices().postService.setImages(postId, images))
    } catch (e) {
      return err(e instanceof AppError ? e : new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })

  // Generate an image via DALL-E 3 and save to userData/media/
  ipcMain.handle(IPC_CHANNELS.AI_IMAGE_GENERATE, async (_event, { prompt }: { prompt: string }) => {
    try {
      const attachment = await getServices().aiGateway.generateImage(prompt)
      return ok(attachment)
    } catch (e) {
      return err(e instanceof AppError ? e : new AppError({ code: ErrorCode.AI_CALL_FAILED, message: String(e) }))
    }
  })
}
