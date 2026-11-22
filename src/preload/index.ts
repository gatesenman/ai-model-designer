import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'
import type {
  AppSettings,
  ChatMessage,
  ProviderConfig,
  AIResult,
  Project,
  MenuEvent,
  AiChatOptions
} from '../shared/types'

export interface PersistedSession {
  project: Project | null
  filePath: string | null
  fileSaved: boolean
  dirty?: boolean
}

export interface SaveFileArgs {
  defaultName: string
  data: string
  encoding: 'utf8' | 'base64'
  filters: { name: string; extensions: string[] }[]
}

export interface OpenFileArgs {
  filters?: { name: string; extensions: string[] }[]
}

export interface SaveDirFilesArgs {
  folderName: string
  files: { filename: string; content: string }[]
}

const api = {
  aiChat: (
    config: ProviderConfig,
    messages: ChatMessage[],
    opts?: AiChatOptions
  ): Promise<AIResult> => ipcRenderer.invoke(IPC.AI_CHAT, config, messages, opts),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_GET),
  setSettings: (settings: AppSettings): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET, settings),
  getSession: (): Promise<PersistedSession> => ipcRenderer.invoke(IPC.PROJECT_GET),
  setSession: (session: PersistedSession): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC.PROJECT_SET, session),
  saveFile: (
    args: SaveFileArgs
  ): Promise<{ ok: boolean; canceled?: boolean; filePath?: string }> =>
    ipcRenderer.invoke(IPC.SAVE_FILE, args),
  saveFileTo: (
    args: { filePath: string; data: string; encoding: 'utf8' | 'base64' }
  ): Promise<{ ok: boolean; filePath?: string }> => ipcRenderer.invoke(IPC.SAVE_FILE_TO, args),
  cancelAi: (requestId: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC.AI_CANCEL, requestId),
  confirmClose: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.APP_CONFIRM_CLOSE),
  cancelClose: (): void => ipcRenderer.send(IPC.APP_CANCEL_CLOSE),
  ackClose: (): void => ipcRenderer.send(IPC.APP_CLOSE_ACK),
  rendererReady: (): void => ipcRenderer.send(IPC.APP_RENDERER_READY),
  requestNativeClose: (): void => ipcRenderer.send(IPC.APP_NATIVE_CLOSE),
  onCloseRequest: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on(IPC.APP_CLOSE_REQUEST, listener)
    return () => ipcRenderer.removeListener(IPC.APP_CLOSE_REQUEST, listener)
  },
  openFile: (
    args?: OpenFileArgs
  ): Promise<{ ok: boolean; canceled?: boolean; content?: string; filePath?: string }> =>
    ipcRenderer.invoke(IPC.OPEN_FILE, args),
  saveDirFiles: (
    args: SaveDirFilesArgs
  ): Promise<{ ok: boolean; canceled?: boolean; dir?: string; count?: number }> =>
    ipcRenderer.invoke(IPC.SAVE_DIR_FILES, args),
  onMenuEvent: (cb: (event: MenuEvent) => void): (() => void) => {
    const listener = (_e: unknown, event: MenuEvent): void => cb(event)
    ipcRenderer.on(IPC.MENU_EVENT, listener)
    return () => ipcRenderer.removeListener(IPC.MENU_EVENT, listener)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
