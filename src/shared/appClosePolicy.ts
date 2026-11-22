/** 窗口关闭 / 退出时的纯策略：主进程与单测共用，不依赖 Electron。 */

export const RENDERER_CLOSE_TIMEOUT_MS = 3000

export const NATIVE_CLOSE_BUTTONS = ['保存', '不保存', '取消'] as const
export const NATIVE_SAVE = 0
export const NATIVE_DISCARD = 1
export const NATIVE_CANCEL = 2

export interface CloseGuardState {
  dirty: boolean
  fileSaved: boolean
  filePath: string | null
  hasProject: boolean
}

/**
 * 是否需要未保存确认。
 * dirty 有明确布尔值时以它为准；renderer 未同步时，回退为「有项目且尚未写入文件」。
 */
export function needsUnsavedPrompt(state: CloseGuardState & { dirtyKnown?: boolean }): boolean {
  if (state.dirtyKnown === false) {
    return state.hasProject && !state.fileSaved
  }
  return state.dirty === true
}

export interface RendererAskEligibility {
  rendererReady: boolean
  rendererCrashed: boolean
  rendererDestroyed: boolean
  ackReceived: boolean
  timedOut: boolean
}

/** renderer 未就绪、已崩溃、已销毁或超时未应答时，改走主进程原生对话框，避免静默丢数据或卡死。 */
export function shouldUseNativeUnsavedDialog(e: RendererAskEligibility): boolean {
  if (e.rendererCrashed || e.rendererDestroyed) return true
  if (!e.rendererReady) return true
  if (e.timedOut && !e.ackReceived) return true
  return false
}

export function nativeUnsavedDialogOptions(filePath: string | null): {
  title: string
  message: string
  detail: string
  buttons: string[]
  defaultId: number
  cancelId: number
  noLink: true
  type: 'warning'
} {
  const base = filePath ? filePath.split(/[/\\]/).pop() || filePath : null
  const hint = base ? `「${base}」` : '项目文件'
  return {
    type: 'warning',
    noLink: true,
    title: '有未保存的更改',
    message: '有未保存的更改',
    detail: `当前项目有尚未写入${hint}的更改。若直接退出，这些更改不会出现在 .amdproj 中（本机草稿仍会保留以便下次恢复，但不能代替保存）。`,
    buttons: [...NATIVE_CLOSE_BUTTONS],
    defaultId: NATIVE_SAVE,
    cancelId: NATIVE_CANCEL
  }
}

export type NativeCloseChoice = 'save' | 'discard' | 'cancel'

export function nativeCloseChoice(responseIndex: number): NativeCloseChoice {
  if (responseIndex === NATIVE_SAVE) return 'save'
  if (responseIndex === NATIVE_DISCARD) return 'discard'
  return 'cancel'
}
