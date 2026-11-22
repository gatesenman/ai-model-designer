import { nanoid } from 'nanoid'
import type { ModelDoc, ValidationIssue } from '@shared/types'

interface Rule {
  rule: string
  check: (doc: ModelDoc) => ValidationIssue[]
}

function issue(
  severity: ValidationIssue['severity'],
  rule: string,
  message: string,
  nodeId?: string
): ValidationIssue {
  return { id: nanoid(), severity, rule, message, nodeId }
}

/** 物理/逻辑模型实体应有主键 */
const missingPrimaryKey: Rule = {
  rule: 'missing-pk',
  check: (doc) => {
    if (doc.kind === 'architecture' || doc.kind === 'uml' || doc.kind === 'conceptual') return []
    const issues: ValidationIssue[] = []
    for (const n of doc.nodes) {
      if (n.fields.length === 0) continue
      if (!n.fields.some((f) => f.primaryKey)) {
        issues.push(issue('error', 'missing-pk', `实体「${n.label}」缺少主键`, n.id))
      }
    }
    return issues
  }
}

/** 孤立节点（无任何关系） */
const orphanNode: Rule = {
  rule: 'orphan-node',
  check: (doc) => {
    if (doc.nodes.length <= 1) return []
    const connected = new Set<string>()
    doc.edges.forEach((e) => {
      connected.add(e.source)
      connected.add(e.target)
    })
    return doc.nodes
      .filter((n) => !connected.has(n.id))
      .map((n) => issue('warning', 'orphan-node', `节点「${n.label}」没有任何关系连接`, n.id))
  }
}

/** 物理模型字段应指定类型 */
const missingType: Rule = {
  rule: 'missing-type',
  check: (doc) => {
    if (doc.kind !== 'physical') return []
    const issues: ValidationIssue[] = []
    for (const n of doc.nodes) {
      for (const f of n.fields) {
        if (!f.type || !f.type.trim()) {
          issues.push(issue('warning', 'missing-type', `「${n.label}.${f.name}」未指定数据类型`, n.id))
        }
      }
    }
    return issues
  }
}

/** 命名规范：实体名建议以字母开头，字段名非空 */
const namingConvention: Rule = {
  rule: 'naming',
  check: (doc) => {
    const issues: ValidationIssue[] = []
    for (const n of doc.nodes) {
      if (!n.label.trim()) {
        issues.push(issue('error', 'naming', '存在未命名的实体', n.id))
      }
      const seen = new Set<string>()
      for (const f of n.fields) {
        if (!f.name.trim()) {
          issues.push(issue('warning', 'naming', `「${n.label}」存在未命名字段`, n.id))
        }
        const key = f.name.toLowerCase()
        if (seen.has(key)) {
          issues.push(issue('error', 'naming', `「${n.label}」字段重名：${f.name}`, n.id))
        }
        seen.add(key)
      }
    }
    return issues
  }
}

/** 实体重名 */
const duplicateEntity: Rule = {
  rule: 'duplicate-entity',
  check: (doc) => {
    const issues: ValidationIssue[] = []
    const seen = new Map<string, number>()
    for (const n of doc.nodes) {
      const key = n.label.trim().toLowerCase()
      if (!key) continue
      seen.set(key, (seen.get(key) ?? 0) + 1)
    }
    for (const n of doc.nodes) {
      const key = n.label.trim().toLowerCase()
      if (key && (seen.get(key) ?? 0) > 1) {
        issues.push(issue('error', 'duplicate-entity', `实体名重复：「${n.label}」`, n.id))
      }
    }
    // 去重：每个名字只报一次
    const reported = new Set<string>()
    return issues.filter((i) => {
      if (reported.has(i.message)) return false
      reported.add(i.message)
      return true
    })
  }
}

/** 外键字段应有对应关系 */
const foreignKeyWithoutRelation: Rule = {
  rule: 'fk-no-relation',
  check: (doc) => {
    if (doc.kind === 'conceptual' || doc.kind === 'architecture') return []
    const issues: ValidationIssue[] = []
    const related = new Set<string>()
    doc.edges.forEach((e) => {
      related.add(e.source)
      related.add(e.target)
    })
    for (const n of doc.nodes) {
      const hasFk = n.fields.some((f) => f.foreignKey)
      if (hasFk && !related.has(n.id)) {
        issues.push(
          issue('warning', 'fk-no-relation', `「${n.label}」含外键字段但未建立关系连线`, n.id)
        )
      }
    }
    return issues
  }
}

/** 边引用了不存在的节点 */
const danglingEdge: Rule = {
  rule: 'dangling-edge',
  check: (doc) => {
    const ids = new Set(doc.nodes.map((n) => n.id))
    return doc.edges
      .filter((e) => !ids.has(e.source) || !ids.has(e.target))
      .map((e) => issue('error', 'dangling-edge', `存在指向不存在节点的关系（${e.id.slice(0, 6)}）`))
  }
}

/** 空模型提示 */
const emptyModel: Rule = {
  rule: 'empty-model',
  check: (doc) =>
    doc.nodes.length === 0 ? [issue('info', 'empty-model', '当前模型为空，请先生成或添加实体')] : []
}

const RULES: Rule[] = [
  missingPrimaryKey,
  orphanNode,
  missingType,
  namingConvention,
  duplicateEntity,
  foreignKeyWithoutRelation,
  danglingEdge,
  emptyModel
]

export function validateModel(doc: ModelDoc): ValidationIssue[] {
  const all: ValidationIssue[] = []
  for (const r of RULES) {
    try {
      all.push(...r.check(doc))
    } catch {
      // 单条规则异常不影响其它规则
    }
  }
  const order = { error: 0, warning: 1, info: 2 }
  return all.sort((a, b) => order[a.severity] - order[b.severity])
}

export function summarize(issues: ValidationIssue[]): {
  errors: number
  warnings: number
  infos: number
} {
  return {
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    infos: issues.filter((i) => i.severity === 'info').length
  }
}
