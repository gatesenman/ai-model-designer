import type { Project } from './types'

export interface SearchHit {
  modelId: string
  modelName: string
  nodeId: string
  label: string
  field?: string
}

/** 在项目全部图表中按节点名称、字段/方法名检索（不区分大小写）。 */
export function searchProject(project: Project, rawQuery: string, limit = 80): SearchHit[] {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return []
  const hits: SearchHit[] = []
  for (const model of project.models) {
    for (const node of model.nodes) {
      const label = node.label || '(未命名)'
      if (label.toLowerCase().includes(q) || (node.comment ?? '').toLowerCase().includes(q)) {
        hits.push({ modelId: model.id, modelName: model.name, nodeId: node.id, label })
        if (hits.length >= limit) return hits
      }
      for (const field of node.fields ?? []) {
        const fname = field.name || ''
        if (fname.toLowerCase().includes(q) || (field.comment ?? '').toLowerCase().includes(q)) {
          hits.push({
            modelId: model.id,
            modelName: model.name,
            nodeId: node.id,
            label,
            field: fname || field.comment
          })
          if (hits.length >= limit) return hits
        }
      }
      for (const method of node.methods ?? []) {
        const mname = method.name || ''
        if (mname.toLowerCase().includes(q)) {
          hits.push({
            modelId: model.id,
            modelName: model.name,
            nodeId: node.id,
            label,
            field: `${mname}()`
          })
          if (hits.length >= limit) return hits
        }
      }
    }
  }
  return hits
}
