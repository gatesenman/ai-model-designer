import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { coerceProject } from '@renderer/project/projectFile'
import {
  getActivationMode,
  pruneSequenceActivations,
  resolveActivations
} from '@shared/sequenceActivations'
import { matrixCols, matrixRows } from '@shared/matrixAxis'
import { emptyDoc } from '@renderer/store/modelStore'
import type { ModelDoc, Project } from '@shared/types'

function stripActivationFields(doc: ModelDoc): ModelDoc {
  const meta = { ...(doc.meta ?? {}) }
  delete (meta as { activationMode?: unknown }).activationMode
  delete (meta as { activations?: unknown }).activations
  return { ...doc, meta }
}

describe('1.2.0 持久化兼容旧项目', () => {
  it('无 activationMode 的旧时序文档视为自动，prune 不改写', () => {
    const legacy = stripActivationFields(emptyDoc('uml', '时序', 'uml-sequence'))
    expect(legacy.meta && 'activationMode' in legacy.meta).toBe(false)
    expect(getActivationMode(legacy)).toBe('auto')
    expect(pruneSequenceActivations(legacy)).toBe(legacy)
    const resolved = resolveActivations(legacy)
    expect(resolved.mode).toBe('auto')
    expect(resolved.activations.length).toBeGreaterThan(0)
    expect(resolved.activations.every((a) => a.id.startsWith('auto-'))).toBe(true)
  })

  it('旧矩阵文档仍按 meta.rows/cols 与条目引用读取，不要求新字段', () => {
    const doc = emptyDoc('architecture', 'RACI', 'raci')
    expect(doc.meta && 'activationMode' in doc.meta).toBe(false)
    expect(matrixRows(doc).length).toBeGreaterThanOrEqual(1)
    expect(matrixCols(doc).length).toBeGreaterThanOrEqual(1)
    const pruned = pruneSequenceActivations(doc)
    expect(pruned).toBe(doc)
    expect(pruned.meta).toEqual(doc.meta)
  })

  it('只读打开既有 1.0/1.1 验收工程时，时序保持自动、矩阵行列仍在', () => {
    const paths = [
      '/workspace/qa-pointer-raci.amdproj',
      '/workspace/qa-final-raci.amdproj',
      '/workspace/qa-maturity-1.1.0.amdproj'
    ]
    const existing = paths.filter((p) => existsSync(p))
    expect(existing.length, '打包环境可能没有这些验收文件，但开发盘应仍保留').toBeGreaterThan(0)
    for (const p of existing) {
      const project = coerceProject(JSON.parse(readFileSync(p, 'utf8'))) as Project
      const sequences = project.models.filter((m) => m.diagramType === 'uml-sequence')
      const matrices = project.models.filter((m) => (m.meta?.rows || m.meta?.cols) && Array.isArray(m.meta?.rows))
      for (const doc of sequences) {
        expect(doc.meta?.activationMode ?? '<absent>').not.toBe('manual')
        expect(getActivationMode(doc)).toBe('auto')
        expect(pruneSequenceActivations(doc)).toBe(doc)
        expect(resolveActivations(doc).mode).toBe('auto')
      }
      for (const doc of matrices) {
        expect(matrixRows(doc).length).toBeGreaterThanOrEqual(1)
        expect(matrixCols(doc).length).toBeGreaterThanOrEqual(1)
        const item = doc.nodes.find((n) => n.props?.row || n.props?.col)
        if (item) {
          if (item.props?.row) expect(matrixRows(doc)).toContain(item.props.row)
          if (item.props?.col) expect(matrixCols(doc)).toContain(item.props.col)
        }
      }
    }
  })
})
