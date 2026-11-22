import Store from 'electron-store'
import type { Project } from '../shared/types'
import { normalizeProjectSession } from '../shared/projectSession'

export interface PersistedSession {
  project: Project | null
  filePath: string | null
  fileSaved: boolean
  dirty?: boolean
}

/** 持久化最近的项目（用于自动暂存与下次启动恢复，不等于已保存到 .amdproj） */
const store = new Store<{ session: unknown }>({
  name: 'ai-model-designer-project',
  defaults: { session: { project: null, filePath: null, fileSaved: false } }
})

export function getSession(): PersistedSession {
  const raw = store.get('session') ?? store.get('project' as 'session')
  const n = normalizeProjectSession(raw)
  return {
    project: (n.project as Project | null) ?? null,
    filePath: n.filePath,
    fileSaved: n.fileSaved,
    dirty: n.dirty
  }
}

export function setSession(session: PersistedSession): void {
  store.set('session', session)
}

/** 兼容旧调用：仅取项目 */
export function getProject(): Project | null {
  return getSession().project
}

export function setProject(project: Project): void {
  const prev = getSession()
  setSession({ ...prev, project, fileSaved: false })
}
