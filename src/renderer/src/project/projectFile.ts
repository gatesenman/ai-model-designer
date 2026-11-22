import { nanoid } from 'nanoid'
import type { ModelDoc, Project } from '@shared/types'
import { shouldPromptSaveDialog } from '@shared/projectSession'

/** 序列化项目为 .amdproj（JSON）并保存。非另存为且已有路径时直接覆盖，避免每次都弹窗。 */
export async function saveProjectFile(
  project: Project,
  opts?: { filePath?: string | null; saveAs?: boolean }
): Promise<{ ok: boolean; canceled?: boolean; filePath?: string }> {
  const data = JSON.stringify(project, null, 2)
  const encoding = 'utf8' as const
  if (!shouldPromptSaveDialog(opts?.filePath, opts?.saveAs === true) && opts?.filePath) {
    return window.api.saveFileTo({ filePath: opts.filePath, data, encoding })
  }
  return window.api.saveFile({
    defaultName: opts?.filePath
      ? opts.filePath.split(/[/\\]/).pop() || `${project.name || '未命名项目'}.amdproj`
      : `${project.name || '未命名项目'}.amdproj`,
    data,
    encoding,
    filters: [
      { name: 'AI 模型项目', extensions: ['amdproj'] },
      { name: 'JSON', extensions: ['json'] }
    ]
  })
}

/** 打开 .amdproj / .json，识别为项目或单个模型，统一返回 Project 与文件路径 */
export async function openProjectFile(): Promise<{ project: Project; filePath: string } | null> {
  const res = await window.api.openFile({
    filters: [
      { name: '项目/模型', extensions: ['amdproj', 'json'] },
      { name: '全部文件', extensions: ['*'] }
    ]
  })
  if (!res.ok || !res.content || !res.filePath) return null
  const parsed = JSON.parse(res.content) as unknown
  return { project: coerceProject(parsed), filePath: res.filePath }
}

/** 把任意解析结果统一成 Project（兼容旧版单模型 JSON） */
export function coerceProject(parsed: unknown): Project {
  const obj = parsed as Record<string, unknown>
  if (obj && Array.isArray(obj.models) && typeof obj.activeModelId === 'string') {
    return parsed as Project
  }
  const doc = parsed as ModelDoc
  const model: ModelDoc = {
    ...doc,
    id: doc.id ?? nanoid(),
    nodes: Array.isArray(doc.nodes) ? doc.nodes : [],
    edges: Array.isArray(doc.edges) ? doc.edges : []
  }
  return {
    id: nanoid(),
    name: doc.name ?? '导入的项目',
    description: doc.description ?? '',
    models: [model],
    activeModelId: model.id,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    format: 'amdproj'
  }
}
