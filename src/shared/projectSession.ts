/** 保存策略：已有路径且非「另存为」时直接覆盖，否则弹出另存对话框。 */
export function shouldPromptSaveDialog(filePath: string | null | undefined, saveAs: boolean): boolean {
  return saveAs || !filePath
}

export interface ProjectSession {
  project: unknown
  filePath: string | null
  fileSaved: boolean
  dirty?: boolean
}

export function normalizeProjectSession(raw: unknown): {
  project: unknown
  filePath: string | null
  fileSaved: boolean
  dirty?: boolean
} {
  if (!raw || typeof raw !== 'object') {
    return { project: null, filePath: null, fileSaved: false }
  }
  const obj = raw as Record<string, unknown>
  if (obj.project && typeof obj.project === 'object') {
    return {
      project: obj.project,
      filePath: typeof obj.filePath === 'string' ? obj.filePath : null,
      fileSaved: obj.fileSaved === true,
      dirty: typeof obj.dirty === 'boolean' ? obj.dirty : undefined
    }
  }
  // 兼容旧版只存了 Project 本体
  if (Array.isArray(obj.models)) {
    return { project: obj, filePath: null, fileSaved: false }
  }
  return { project: null, filePath: null, fileSaved: false }
}

export function isOutputSavable(output: string): boolean {
  const t = output.trim()
  if (!t) return false
  if (t === '生成中…' || t === '生成中...') return false
  if (t.startsWith('生成失败')) return false
  return true
}
