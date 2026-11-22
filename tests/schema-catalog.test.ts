import { describe, expect, it } from 'vitest'
import { DIAGRAM_CATALOG, getDiagramType } from '@shared/diagramCatalog'
import { RENDER_KIND_BY_TYPE, getRenderKind, type RenderKind } from '@shared/diagramRender'
import { getDiagramSchema, resolveTemplate } from '@shared/diagramSchema'

const KINDS: RenderKind[] = ['graph', 'sequence', 'swimlane', 'matrix', 'tree', 'timeline']

describe('104 图种目录与 Schema 一致性', () => {
  it('目录恰好 104 个且 id 唯一', () => {
    const ids = DIAGRAM_CATALOG.map((t) => t.id)
    expect(ids).toHaveLength(104)
    expect(new Set(ids).size).toBe(104)
  })

  it('每个目录图种都有显式 renderKind 映射', () => {
    const missing = DIAGRAM_CATALOG.filter((t) => !(t.id in RENDER_KIND_BY_TYPE)).map((t) => t.id)
    expect(missing).toEqual([])
  })

  it('映射表不含目录外的无效图种 id', () => {
    const catalog = new Set(DIAGRAM_CATALOG.map((t) => t.id))
    const extra = Object.keys(RENDER_KIND_BY_TYPE).filter((id) => !catalog.has(id))
    expect(extra).toEqual([])
  })

  it('getDiagramSchema.renderKind 与 getRenderKind 一致，且模板可用', () => {
    for (const t of DIAGRAM_CATALOG) {
      const schema = getDiagramSchema(t.id)
      expect(schema.typeId).toBe(t.id)
      expect(schema.engine).toBe(t.engine)
      expect(KINDS).toContain(schema.renderKind)
      expect(schema.renderKind).toBe(getRenderKind(t.id))
      expect(schema.nodeKinds.length).toBeGreaterThan(0)
      expect(schema.edgeKinds.length).toBeGreaterThan(0)
      expect(schema.genHint.length).toBeGreaterThan(0)

      const tmpl = resolveTemplate(t.id)
      expect(Array.isArray(tmpl.nodes)).toBe(true)
      expect(Array.isArray(tmpl.edges)).toBe(true)
      if (schema.renderKind === 'graph' || schema.renderKind === 'tree' || schema.renderKind === 'sequence') {
        expect(tmpl.nodes.length).toBeGreaterThan(0)
      }
      if (schema.renderKind === 'sequence') {
        expect(tmpl.nodes.length).toBeGreaterThanOrEqual(2)
        expect(tmpl.edges.length).toBeGreaterThan(0)
      }
      if (schema.renderKind === 'matrix') {
        const rows = tmpl.meta?.rows as string[]
        const cols = tmpl.meta?.cols as string[]
        expect(rows?.length).toBeGreaterThan(0)
        expect(cols?.length).toBeGreaterThan(0)
        expect(tmpl.nodes.length).toBeGreaterThan(0)
      }
      if (schema.renderKind === 'timeline') {
        expect((tmpl.meta?.tracks as string[])?.length).toBeGreaterThan(0)
        expect((tmpl.meta?.periods as string[])?.length).toBeGreaterThan(0)
        expect(tmpl.nodes.length).toBeGreaterThan(0)
      }
      if (schema.renderKind === 'swimlane') {
        expect((tmpl.meta?.lanes as string[])?.length).toBeGreaterThan(0)
        expect(tmpl.nodes.length).toBeGreaterThan(0)
      }
    }
  })

  it('getDiagramType 能解析全部目录 id，未知 id 走 graph 兜底', () => {
    for (const t of DIAGRAM_CATALOG) {
      expect(getDiagramType(t.id)?.name).toBe(t.name)
    }
    expect(getRenderKind(undefined)).toBe('graph')
    expect(getRenderKind('not-a-real-type')).toBe('graph')
  })
})
