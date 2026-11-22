// 纯函数编辑操作：供范式渲染器、属性面板与测试共用。不依赖 React / Zustand。

import { nanoid } from 'nanoid'
import type { DiagramEdge, DiagramNode, ModelDoc, RelationKind } from './types'

/** 以边的 source → target 作为树的父子关系 */
export function childrenOf(edges: DiagramEdge[], parentId: string): string[] {
  return edges.filter((e) => e.source === parentId).map((e) => e.target)
}

/** 取节点的第一个入边来源作为父节点；根节点返回 null */
export function parentOf(edges: DiagramEdge[], nodeId: string): string | null {
  const e = edges.find((x) => x.target === nodeId)
  return e ? e.source : null
}

/** 从 ancestorId 出发，nodeId 是否落在其子树中（含自身） */
export function isInSubtree(edges: DiagramEdge[], ancestorId: string, nodeId: string): boolean {
  if (ancestorId === nodeId) return true
  const seen = new Set<string>()
  const stack = [ancestorId]
  while (stack.length) {
    const id = stack.pop() as string
    if (seen.has(id)) continue
    seen.add(id)
    for (const child of childrenOf(edges, id)) {
      if (child === nodeId) return true
      stack.push(child)
    }
  }
  return false
}

/**
 * 若把 nodeId 的父改为 newParentId，是否会成环。
 * newParentId 为 null 表示变为根，不成环。
 */
export function wouldCreateCycle(
  edges: DiagramEdge[],
  nodeId: string,
  newParentId: string | null
): boolean {
  if (!newParentId) return false
  if (newParentId === nodeId) return true
  // 新父若落在 nodeId 的子树中，则会把子树接到自己下面形成环
  return isInSubtree(edges, nodeId, newParentId)
}

/** 节点在树中的层级（根为 0） */
export function treeLevel(edges: DiagramEdge[], nodeId: string): number {
  const seen = new Set<string>()
  let level = 0
  let cur: string | null = nodeId
  while (cur) {
    if (seen.has(cur)) break
    seen.add(cur)
    const p = parentOf(edges, cur)
    if (!p) break
    level += 1
    cur = p
  }
  return level
}

/** 换父：删除指向 nodeId 的旧入边，按需添加新入边。成环时原样返回。 */
export function reparentNode(
  doc: ModelDoc,
  nodeId: string,
  newParentId: string | null,
  relation: RelationKind = 'association'
): ModelDoc {
  if (wouldCreateCycle(doc.edges, nodeId, newParentId)) return doc
  const current = parentOf(doc.edges, nodeId)
  if (current === newParentId) return doc
  const edges = doc.edges.filter((e) => e.target !== nodeId)
  if (newParentId) {
    edges.push({
      id: nanoid(),
      source: newParentId,
      target: nodeId,
      relation
    })
  }
  return { ...doc, edges }
}

/** 将矩阵条目移动到指定行/列 */
export function moveMatrixItem(doc: ModelDoc, itemId: string, row: string, col: string): ModelDoc {
  let changed = false
  const nodes = doc.nodes.map((n) => {
    if (n.id !== itemId) return n
    if ((n.props?.row as string) === row && (n.props?.col as string) === col) return n
    changed = true
    return { ...n, props: { ...(n.props ?? {}), row, col } }
  })
  return changed ? { ...doc, nodes } : doc
}

export function findNode(doc: ModelDoc, id: string): DiagramNode | undefined {
  return doc.nodes.find((n) => n.id === id)
}
