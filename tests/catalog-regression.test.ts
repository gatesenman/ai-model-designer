import { describe, expect, it } from 'vitest'
import { DIAGRAM_CATALOG } from '@shared/diagramCatalog'
import { getDiagramSchema, resolveTemplate } from '@shared/diagramSchema'
import { getRenderKind } from '@shared/diagramRender'
import { emptyDoc } from '@renderer/store/modelStore'
import { validateModel } from '@renderer/validation/validationEngine'
import { toJSON, toMarkdown, toSQL } from '@renderer/export/exporters'

describe('104 图种程序化一致性（非人工全测）', () => {
  it('每个图种的模板、校验与文本导出都不抛错', () => {
    const failures: string[] = []
    for (const t of DIAGRAM_CATALOG) {
      try {
        const schema = getDiagramSchema(t.id)
        expect(schema.renderKind).toBe(getRenderKind(t.id))
        const tmpl = resolveTemplate(t.id)
        const doc = emptyDoc(t.engine, t.name, t.id)
        expect(doc.diagramType).toBe(t.id)
        expect(Array.isArray(tmpl.nodes)).toBe(true)
        const issues = validateModel(doc)
        expect(Array.isArray(issues)).toBe(true)
        const json = toJSON(doc)
        expect(json.data.length).toBeGreaterThan(0)
        const parsed = JSON.parse(json.data)
        expect(parsed.diagramType ?? doc.diagramType).toBeTruthy()
        const md = toMarkdown(doc)
        expect(md.data.length).toBeGreaterThan(0)
        const sql = toSQL(doc)
        expect(typeof sql.data).toBe('string')
      } catch (err) {
        failures.push(`${t.id}: ${(err as Error).message}`)
      }
    }
    expect(DIAGRAM_CATALOG).toHaveLength(104)
    expect(failures, failures.join('\n')).toEqual([])
  })
})
