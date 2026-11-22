/** 矩阵行列轴操作：排序、重命名引用同步、删除安全规则。纯函数，供画布/属性/测试共用。 */

import type { ModelDoc } from './types'

export function matrixRows(doc: ModelDoc, fallback: string[] = ['行 1']): string[] {
  const rows = doc.meta?.rows
  return Array.isArray(rows) && rows.length > 0 ? (rows as string[]) : fallback
}

export function matrixCols(doc: ModelDoc, fallback: string[] = ['列 1']): string[] {
  const cols = doc.meta?.cols
  return Array.isArray(cols) && cols.length > 0 ? (cols as string[]) : fallback
}

export function canRemoveMatrixAxis(count: number): boolean {
  return count > 1
}

export function matrixAxisDeleteReason(axis: 'row' | 'col', count: number): string | null {
  if (count > 1) return null
  return axis === 'row' ? '项目至少保留一行，因此不能删除' : '项目至少保留一列，因此不能删除'
}

export function moveListItem<T>(list: T[], from: number, to: number): T[] | null {
  if (from < 0 || to < 0 || from >= list.length || to >= list.length || from === to) return null
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function moveMatrixRow(doc: ModelDoc, from: number, to: number): ModelDoc {
  const rows = matrixRows(doc)
  const cols = matrixCols(doc)
  const next = moveListItem(rows, from, to)
  if (!next) return doc
  return { ...doc, meta: { ...(doc.meta ?? {}), rows: next, cols } }
}

export function moveMatrixCol(doc: ModelDoc, from: number, to: number): ModelDoc {
  const rows = matrixRows(doc)
  const cols = matrixCols(doc)
  const next = moveListItem(cols, from, to)
  if (!next) return doc
  return { ...doc, meta: { ...(doc.meta ?? {}), rows, cols: next } }
}

export function renameMatrixRow(doc: ModelDoc, index: number, name: string): ModelDoc {
  const rows = matrixRows(doc)
  const cols = matrixCols(doc)
  if (index < 0 || index >= rows.length) return doc
  const old = rows[index]
  if (old === name) return doc
  const next = [...rows]
  next[index] = name
  return {
    ...doc,
    meta: { ...(doc.meta ?? {}), rows: next, cols },
    nodes: doc.nodes.map((n) =>
      (n.props?.row as string) === old ? { ...n, props: { ...n.props, row: name } } : n
    )
  }
}

export function renameMatrixCol(doc: ModelDoc, index: number, name: string): ModelDoc {
  const rows = matrixRows(doc)
  const cols = matrixCols(doc)
  if (index < 0 || index >= cols.length) return doc
  const old = cols[index]
  if (old === name) return doc
  const next = [...cols]
  next[index] = name
  return {
    ...doc,
    meta: { ...(doc.meta ?? {}), rows, cols: next },
    nodes: doc.nodes.map((n) =>
      (n.props?.col as string) === old ? { ...n, props: { ...n.props, col: name } } : n
    )
  }
}

export function removeMatrixRow(doc: ModelDoc, index: number): { doc: ModelDoc; ok: boolean; reason?: string } {
  const rows = matrixRows(doc)
  const cols = matrixCols(doc)
  const reason = matrixAxisDeleteReason('row', rows.length)
  if (reason || index < 0 || index >= rows.length) return { doc, ok: false, reason: reason ?? '行不存在' }
  const name = rows[index]
  return {
    ok: true,
    doc: {
      ...doc,
      meta: { ...(doc.meta ?? {}), rows: rows.filter((_, i) => i !== index), cols },
      nodes: doc.nodes.filter((n) => (n.props?.row as string) !== name)
    }
  }
}

export function removeMatrixCol(doc: ModelDoc, index: number): { doc: ModelDoc; ok: boolean; reason?: string } {
  const rows = matrixRows(doc)
  const cols = matrixCols(doc)
  const reason = matrixAxisDeleteReason('col', cols.length)
  if (reason || index < 0 || index >= cols.length) return { doc, ok: false, reason: reason ?? '列不存在' }
  const name = cols[index]
  return {
    ok: true,
    doc: {
      ...doc,
      meta: { ...(doc.meta ?? {}), rows, cols: cols.filter((_, i) => i !== index) },
      nodes: doc.nodes.filter((n) => (n.props?.col as string) !== name)
    }
  }
}
