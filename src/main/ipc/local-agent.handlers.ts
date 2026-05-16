import { ipcMain } from 'electron'
import { IPC_CHANNELS, type LocalAgentGenerateRequest } from '../../shared/ipc-types'
import { ok, err, AppError, ErrorCode } from '../../shared/types/error'
import { getServices } from '../services/index'

export function registerLocalAgentHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.LOCAL_AGENT_STATUS, async () => {
    try {
      return ok(await getServices().localAgentService.status())
    } catch (e) {
      return err(new AppError({ code: ErrorCode.UNKNOWN, message: String(e) }))
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.LOCAL_AGENT_GENERATE,
    async (_event, input: LocalAgentGenerateRequest) => {
      try {
        return ok(await getServices().localAgentService.generate(input))
      } catch (e) {
        return err(new AppError({ code: ErrorCode.AI_CALL_FAILED, message: String(e) }))
      }
    }
  )
}
