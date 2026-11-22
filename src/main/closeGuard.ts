import { BrowserWindow, app, dialog, ipcMain } from 'electron'
import { writeFile } from 'fs/promises'
import { IPC } from '../shared/types'
import type { Project } from '../shared/types'
import { getSession, setSession } from './project'
import {
  NATIVE_CANCEL,
  NATIVE_DISCARD,
  NATIVE_SAVE,
  RENDERER_CLOSE_TIMEOUT_MS,
  nativeUnsavedDialogOptions,
  needsUnsavedPrompt,
  shouldUseNativeUnsavedDialog,
  type CloseGuardState
} from '../shared/appClosePolicy'

interface WindowFlag {
  __allowClose?: boolean
}

let rendererReady = false
let dirtyKnown = false
let closeState: CloseGuardState = {
  dirty: false,
  fileSaved: true,
  filePath: null,
  hasProject: false
}
let closeInProgress = false
let ackReceived = false
let allowQuit = false
let rendererTimeout: ReturnType<typeof setTimeout> | null = null

function flagWin(win: BrowserWindow): BrowserWindow & WindowFlag {
  return win as BrowserWindow & WindowFlag
}

function mergeState(): CloseGuardState {
  const session = getSession()
  return {
    dirty: closeState.dirty || session.dirty === true,
    fileSaved: session.fileSaved,
    filePath: closeState.filePath ?? session.filePath,
    hasProject: closeState.hasProject || !!session.project
  }
}

export function updateCloseStateFromSession(session: {
  project: Project | null
  filePath: string | null
  fileSaved: boolean
  dirty?: boolean
}): void {
  dirtyKnown = typeof session.dirty === 'boolean'
  closeState = {
    dirty: session.dirty === true || (session.dirty !== false && !session.fileSaved && !!session.project),
    fileSaved: session.fileSaved,
    filePath: session.filePath,
    hasProject: !!session.project
  }
}

function clearRendererTimer(): void {
  if (rendererTimeout) {
    clearTimeout(rendererTimeout)
    rendererTimeout = null
  }
}

export function abortClose(): void {
  closeInProgress = false
  ackReceived = false
  allowQuit = false
  clearRendererTimer()
  console.log('[close-guard] close cancelled, window remains')
}

export function markAllowQuit(): void {
  allowQuit = true
  closeInProgress = false
  clearRendererTimer()
}

async function finishClose(win: BrowserWindow | null): Promise<void> {
  markAllowQuit()
  if (win && !win.isDestroyed()) {
    flagWin(win).__allowClose = true
    win.destroy()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
}

async function saveSessionToFile(win: BrowserWindow | null): Promise<boolean> {
  const session = getSession()
  if (!session.project) return false
  let filePath = session.filePath
  if (!filePath) {
    const res = await dialog.showSaveDialog(win && !win.isDestroyed() ? win : undefined!, {
      defaultPath: `${session.project.name || '未命名项目'}.amdproj`,
      filters: [{ name: 'AI Model Designer 项目', extensions: ['amdproj'] }]
    })
    if (res.canceled || !res.filePath) return false
    filePath = res.filePath
  }
  await writeFile(filePath, JSON.stringify(session.project, null, 2), 'utf8')
  setSession({ ...session, filePath, fileSaved: true, dirty: false })
  updateCloseStateFromSession({ ...session, filePath, fileSaved: true, dirty: false })
  return true
}

async function runNativeUnsavedDialog(win: BrowserWindow): Promise<void> {
  const state = mergeState()
  const opts = nativeUnsavedDialogOptions(state.filePath)
  console.log('[close-guard] native unsaved dialog', {
    dirty: state.dirty,
    fileSaved: state.fileSaved,
    rendererReady
  })
  const { response } = await dialog.showMessageBox(win.isDestroyed() ? undefined! : win, opts)
  if (response === NATIVE_CANCEL) {
    abortClose()
    return
  }
  if (response === NATIVE_SAVE) {
    const ok = await saveSessionToFile(win)
    if (!ok) {
      abortClose()
      return
    }
  }
  if (response === NATIVE_DISCARD) {
    // 草稿仍留在 electron-store，下次可恢复；不把 fileSaved 标真
    console.log('[close-guard] discard to file, draft kept in session')
  }
  await finishClose(win)
}

function rendererEligibility(win: BrowserWindow): {
  rendererReady: boolean
  rendererCrashed: boolean
  rendererDestroyed: boolean
} {
  const destroyed = win.isDestroyed() || win.webContents.isDestroyed()
  const crashed = !destroyed && win.webContents.isCrashed()
  return { rendererReady, rendererCrashed: crashed, rendererDestroyed: destroyed }
}

export function beginClose(win: BrowserWindow, reason: 'window-close' | 'quit'): void {
  if (allowQuit || flagWin(win).__allowClose) return
  if (closeInProgress) return
  closeInProgress = true
  ackReceived = false

  const state = mergeState()
  const mustPrompt = needsUnsavedPrompt({ ...state, dirtyKnown })
  console.log('[close-guard] beginClose', { reason, mustPrompt, rendererReady, state })

  if (!mustPrompt) {
    void finishClose(win)
    return
  }

  const elig = rendererEligibility(win)
  if (
    shouldUseNativeUnsavedDialog({
      ...elig,
      ackReceived: false,
      timedOut: false
    })
  ) {
    void runNativeUnsavedDialog(win)
    return
  }

  console.log('[close-guard] asking renderer, timeout', RENDERER_CLOSE_TIMEOUT_MS, 'ms')
  win.webContents.send(IPC.APP_CLOSE_REQUEST)
  clearRendererTimer()
  rendererTimeout = setTimeout(() => {
    if (!closeInProgress || allowQuit || ackReceived) return
    console.log('[close-guard] renderer did not ack, falling back to native dialog')
    void runNativeUnsavedDialog(win)
  }, RENDERER_CLOSE_TIMEOUT_MS)
}

export function attachWindowCloseGuard(win: BrowserWindow): void {
  win.on('close', (e) => {
    if (allowQuit || flagWin(win).__allowClose) return
    e.preventDefault()
    beginClose(win, 'window-close')
  })
}

export function attachAppQuitGuard(): void {
  app.on('before-quit', (e) => {
    if (allowQuit) return
    e.preventDefault()
    const win = BrowserWindow.getAllWindows()[0]
    if (!win || win.isDestroyed()) {
      allowQuit = true
      app.quit()
      return
    }
    beginClose(win, 'quit')
  })
}

export function registerCloseGuardIpc(): void {
  ipcMain.on(IPC.APP_RENDERER_READY, () => {
    rendererReady = true
    console.log('[close-guard] renderer ready')
  })
  ipcMain.on(IPC.APP_CLOSE_ACK, () => {
    ackReceived = true
    clearRendererTimer()
    console.log('[close-guard] renderer acked close request')
  })
  ipcMain.on(IPC.APP_CANCEL_CLOSE, () => {
    abortClose()
  })
  ipcMain.on(IPC.APP_NATIVE_CLOSE, () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win || win.isDestroyed()) return
    console.log('[close-guard] renderer requested native close dialog')
    closeInProgress = true
    void runNativeUnsavedDialog(win)
  })
}

export async function confirmCloseFromRenderer(win: BrowserWindow | null): Promise<{ ok: boolean }> {
  await finishClose(win)
  return { ok: true }
}
