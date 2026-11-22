import { ipcMain, dialog, BrowserWindow } from 'electron'
import { writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { IPC } from '../shared/types'
import type {
  AppSettings,
  ChatMessage,
  ProviderConfig,
  AiChatOptions
} from '../shared/types'
import { aiChat, cancelAiRequest } from './ai'
import { getSettings, setSettings } from './settings'
import { getSession, setSession, type PersistedSession } from './project'
import { confirmCloseFromRenderer, registerCloseGuardIpc, updateCloseStateFromSession } from './closeGuard'

interface SaveFilePayload {
  defaultName: string
  data: string
  encoding: 'utf8' | 'base64'
  filters: { name: string; extensions: string[] }[]
}

interface SaveToPathPayload {
  filePath: string
  data: string
  encoding: 'utf8' | 'base64'
}

interface OpenFilePayload {
  filters?: { name: string; extensions: string[] }[]
}

interface SaveDirFilesPayload {
  folderName: string
  files: { filename: string; content: string }[]
}

export function registerIpcHandlers(): void {
  registerCloseGuardIpc()
  ipcMain.handle(
    IPC.AI_CHAT,
    async (_e, config: ProviderConfig, messages: ChatMessage[], opts?: AiChatOptions) => {
      return aiChat(config, messages, opts)
    }
  )
  ipcMain.handle(IPC.AI_CANCEL, async (_e, requestId: string) => {
    return { ok: cancelAiRequest(requestId) }
  })

  ipcMain.handle(IPC.SETTINGS_GET, async () => getSettings())
  ipcMain.handle(IPC.SETTINGS_SET, async (_e, settings: AppSettings) => setSettings(settings))

  ipcMain.handle(IPC.PROJECT_GET, async () => getSession())
  ipcMain.handle(IPC.PROJECT_SET, async (_e, session: PersistedSession) => {
    setSession(session)
    updateCloseStateFromSession(session)
    return { ok: true }
  })

  ipcMain.handle(IPC.SAVE_FILE, async (e, payload: SaveFilePayload) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      defaultPath: payload.defaultName,
      filters: payload.filters
    })
    if (canceled || !filePath) return { ok: false, canceled: true }
    const buffer =
      payload.encoding === 'base64'
        ? Buffer.from(payload.data, 'base64')
        : Buffer.from(payload.data, 'utf8')
    await writeFile(filePath, buffer)
    return { ok: true, filePath }
  })

  ipcMain.handle(IPC.SAVE_FILE_TO, async (_e, payload: SaveToPathPayload) => {
    const buffer =
      payload.encoding === 'base64'
        ? Buffer.from(payload.data, 'base64')
        : Buffer.from(payload.data, 'utf8')
    await writeFile(payload.filePath, buffer)
    return { ok: true, filePath: payload.filePath }
  })

  ipcMain.handle(IPC.OPEN_FILE, async (e, payload?: OpenFilePayload) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      filters: payload?.filters ?? [
        { name: '项目/模型', extensions: ['amdproj', 'json'] }
      ]
    })
    if (canceled || filePaths.length === 0) return { ok: false, canceled: true }
    const fs = await import('fs/promises')
    const content = await fs.readFile(filePaths[0], 'utf8')
    return { ok: true, content, filePath: filePaths[0] }
  })

  ipcMain.handle(IPC.SAVE_DIR_FILES, async (e, payload: SaveDirFilesPayload) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || filePaths.length === 0) return { ok: false, canceled: true }
    const root = join(filePaths[0], payload.folderName)
    let count = 0
    for (const f of payload.files) {
      const target = join(root, f.filename)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, Buffer.from(f.content, 'utf8'))
      count++
    }
    return { ok: true, dir: root, count }
  })

  ipcMain.handle(IPC.APP_CONFIRM_CLOSE, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    return confirmCloseFromRenderer(win)
  })
}
