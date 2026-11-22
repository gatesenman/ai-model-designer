import { describe, expect, it } from 'vitest'
import { coerceProject } from '@renderer/project/projectFile'
import { emptyDoc, emptyProject, useModelStore } from '@renderer/store/modelStore'
import { toJSON, toMarkdown, toSQL } from '@renderer/export/exporters'
import type { Project } from '@shared/types'

describe('项目保存与重载', () => {
  it('完整项目 JSON 往返后结构保持', () => {
    const project = emptyProject('测试项目')
    const text = JSON.stringify(project, null, 2)
    const loaded = coerceProject(JSON.parse(text))
    expect(loaded.format).toBe('amdproj')
    expect(loaded.id).toBe(project.id)
    expect(loaded.name).toBe('测试项目')
    expect(loaded.models).toHaveLength(1)
    expect(loaded.activeModelId).toBe(project.activeModelId)
    expect(loaded.models[0].nodes.length).toBe(project.models[0].nodes.length)
    expect(loaded.models[0].diagramType).toBe('logical-erd')
  })

  it('兼容导入单模型 JSON 并包装为项目', () => {
    const doc = emptyDoc('uml', '类图 A', 'uml-class')
    const loaded = coerceProject(JSON.parse(JSON.stringify(doc)))
    expect(loaded.models).toHaveLength(1)
    expect(loaded.models[0].name).toBe('类图 A')
    expect(loaded.models[0].kind).toBe('uml')
    expect(loaded.activeModelId).toBe(loaded.models[0].id)
    expect(loaded.format).toBe('amdproj')
  })

  it('store 编辑后序列化再 loadProject 能恢复节点、边与 meta', () => {
    const store = useModelStore.getState()
    store.newProject()
    const seqId = useModelStore.getState().addModel('architecture', '时序样例', 'uml-sequence')
    const before = useModelStore.getState()
    const seq = before.project.models.find((m) => m.id === seqId)
    expect(seq?.nodes.length).toBeGreaterThanOrEqual(2)
    expect(seq?.edges.length).toBeGreaterThanOrEqual(1)

    const mxId = useModelStore.getState().addModel('architecture', '矩阵样例', 'raci')
    const mx = useModelStore.getState().project.models.find((m) => m.id === mxId)
    expect((mx?.meta?.rows as string[])?.length).toBeGreaterThan(0)

    const snapshot = JSON.parse(JSON.stringify(useModelStore.getState().project)) as Project
    useModelStore.getState().newProject()
    expect(useModelStore.getState().project.models.some((m) => m.id === seqId)).toBe(false)

    useModelStore.getState().loadProject(snapshot)
    const after = useModelStore.getState()
    expect(after.project.models).toHaveLength(snapshot.models.length)
    const reSeq = after.project.models.find((m) => m.id === seqId)
    expect(reSeq?.edges.map((e) => e.label)).toEqual(seq?.edges.map((e) => e.label))
    const reMx = after.project.models.find((m) => m.id === mxId)
    expect(reMx?.meta?.rows).toEqual(mx?.meta?.rows)
    expect(after.selectedNodeId).toBeNull()
    expect(after.dirty).toBe(false)
  })
})

describe('导出闭合（文本产物）', () => {
  it('JSON / Markdown / SQL 导出非空且可再解析 JSON', () => {
    const doc = emptyDoc('physical', '物理模型', 'physical-erd')
    const json = toJSON(doc)
    expect(json.ext).toBe('json')
    const parsed = JSON.parse(json.data)
    expect(parsed.id).toBe(doc.id)
    expect(parsed.nodes.length).toBe(doc.nodes.length)

    const md = toMarkdown(doc)
    expect(md.ext).toBe('md')
    expect(md.data.length).toBeGreaterThan(20)

    const sql = toSQL(doc)
    expect(sql.ext).toBe('sql')
    expect(sql.data.length).toBeGreaterThan(0)
  })
})
