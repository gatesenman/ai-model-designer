import { describe, expect, it } from 'vitest'
import {
  canRemoveMatrixAxis,
  matrixAxisDeleteReason,
  moveListItem,
  moveMatrixCol,
  moveMatrixRow,
  removeMatrixCol,
  removeMatrixRow,
  renameMatrixCol,
  renameMatrixRow
} from '@shared/matrixAxis'
import { emptyDoc, useModelStore } from '@renderer/store/modelStore'
import type { ModelDoc } from '@shared/types'

function raciDoc(): ModelDoc {
  const doc = emptyDoc('architecture', 'RACI', 'raci')
  doc.meta = { rows: ['任务 1', '任务 2'], cols: ['角色 A', '角色 B'] }
  doc.nodes = [
    {
      id: 'n1',
      label: '条目 1',
      fields: [],
      position: { x: 0, y: 0 },
      props: { row: '任务 1', col: '角色 A' }
    },
    {
      id: 'n2',
      label: '条目 2',
      fields: [],
      position: { x: 0, y: 0 },
      props: { row: '任务 2', col: '角色 B' }
    }
  ]
  return doc
}

describe('矩阵行列轴纯操作', () => {
  it('移动行列只改顺序，条目引用仍指向原名称', () => {
    const doc = raciDoc()
    const moved = moveMatrixRow(doc, 0, 1)
    expect(moved.meta?.rows).toEqual(['任务 2', '任务 1'])
    expect(moved.nodes.find((n) => n.id === 'n1')?.props?.row).toBe('任务 1')
    const cols = moveMatrixCol(doc, 0, 1)
    expect(cols.meta?.cols).toEqual(['角色 B', '角色 A'])
    expect(cols.nodes.find((n) => n.id === 'n1')?.props?.col).toBe('角色 A')
    expect(moveListItem(['a', 'b'], 0, 0)).toBeNull()
    expect(moveMatrixRow(doc, 0, 0)).toBe(doc)
  })

  it('重命名行列会同步条目引用', () => {
    const doc = raciDoc()
    const rowRenamed = renameMatrixRow(doc, 0, '需求 A')
    expect(rowRenamed.meta?.rows).toEqual(['需求 A', '任务 2'])
    expect(rowRenamed.nodes.find((n) => n.id === 'n1')?.props?.row).toBe('需求 A')
    expect(rowRenamed.nodes.find((n) => n.id === 'n2')?.props?.row).toBe('任务 2')
    const colRenamed = renameMatrixCol(doc, 1, '角色 Z')
    expect(colRenamed.nodes.find((n) => n.id === 'n2')?.props?.col).toBe('角色 Z')
  })

  it('最后一行/列不可删，删除时移除该轴上的条目', () => {
    expect(canRemoveMatrixAxis(1)).toBe(false)
    expect(matrixAxisDeleteReason('row', 1)).toMatch(/至少保留一行/)
    expect(matrixAxisDeleteReason('col', 1)).toMatch(/至少保留一列/)
    const doc = raciDoc()
    const oneRow = removeMatrixRow(
      { ...doc, meta: { ...doc.meta, rows: ['任务 1'] }, nodes: doc.nodes.filter((n) => n.props?.row === '任务 1') },
      0
    )
    expect(oneRow.ok).toBe(false)
    expect(oneRow.reason).toMatch(/至少保留一行/)
    const removed = removeMatrixRow(doc, 0)
    expect(removed.ok).toBe(true)
    expect(removed.doc.meta?.rows).toEqual(['任务 2'])
    expect(removed.doc.nodes.map((n) => n.id)).toEqual(['n2'])
    const removedCol = removeMatrixCol(doc, 1)
    expect(removedCol.doc.nodes.map((n) => n.id)).toEqual(['n1'])
  })

  it('移动行列写入 store 后可撤销重做', () => {
    const store = useModelStore.getState()
    store.newProject()
    const id = useModelStore.getState().addModel('architecture', 'RACI', 'raci')
    useModelStore.getState().switchModel(id)
    const before = [...((useModelStore.getState().doc.meta?.rows as string[]) ?? [])]
    expect(before.length).toBeGreaterThanOrEqual(2)
    useModelStore.getState().setDoc(moveMatrixRow(useModelStore.getState().doc, 0, 1))
    expect(useModelStore.getState().doc.meta?.rows).toEqual([before[1], before[0], ...before.slice(2)])
    useModelStore.getState().undo()
    expect(useModelStore.getState().doc.meta?.rows).toEqual(before)
    useModelStore.getState().redo()
    expect(useModelStore.getState().doc.meta?.rows).toEqual([before[1], before[0], ...before.slice(2)])
  })
})
