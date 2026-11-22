import { describe, expect, it } from 'vitest'
import type { DiagramEdge, DiagramNode, ModelDoc } from '@shared/types'
import {
  moveMatrixItem,
  parentOf,
  reparentNode,
  treeLevel,
  wouldCreateCycle
} from '@shared/editOps'

function node(id: string, label = id, props?: DiagramNode['props']): DiagramNode {
  return { id, label, fields: [], position: { x: 0, y: 0 }, props }
}

function edge(id: string, source: string, target: string): DiagramEdge {
  return { id, source, target, relation: 'association' }
}

function doc(nodes: DiagramNode[], edges: DiagramEdge[]): ModelDoc {
  return {
    id: 'd1',
    name: 't',
    kind: 'architecture',
    nodes,
    edges
  }
}

describe('树换父与循环保护', () => {
  // A -> B -> C ，另有游离节点 D
  const base = doc(
    [node('A'), node('B'), node('C'), node('D')],
    [edge('e1', 'A', 'B'), edge('e2', 'B', 'C')]
  )

  it('识别现有父子与层级', () => {
    expect(parentOf(base.edges, 'C')).toBe('B')
    expect(parentOf(base.edges, 'A')).toBeNull()
    expect(treeLevel(base.edges, 'A')).toBe(0)
    expect(treeLevel(base.edges, 'C')).toBe(2)
  })

  it('把节点接到自己或子孙会成环，被拒绝', () => {
    expect(wouldCreateCycle(base.edges, 'A', 'A')).toBe(true)
    expect(wouldCreateCycle(base.edges, 'A', 'C')).toBe(true)
    expect(wouldCreateCycle(base.edges, 'B', 'C')).toBe(true)
    expect(wouldCreateCycle(base.edges, 'C', 'A')).toBe(false)
    expect(wouldCreateCycle(base.edges, 'D', 'A')).toBe(false)
    const rejected = reparentNode(base, 'A', 'C')
    expect(rejected.edges).toEqual(base.edges)
  })

  it('合法换父会替换入边', () => {
    const next = reparentNode(base, 'C', 'A')
    expect(parentOf(next.edges, 'C')).toBe('A')
    expect(next.edges.some((e) => e.source === 'B' && e.target === 'C')).toBe(false)
  })

  it('父设为 null 后成为根', () => {
    const next = reparentNode(base, 'B', null)
    expect(parentOf(next.edges, 'B')).toBeNull()
    expect(parentOf(next.edges, 'C')).toBe('B')
  })
})

describe('矩阵跨格移动', () => {
  it('更新条目的行列且不改动其他节点', () => {
    const d = doc(
      [node('i1', '条目1', { row: '行 1', col: '列 1' }), node('i2', '条目2', { row: '行 2', col: '列 2' })],
      []
    )
    const next = moveMatrixItem(d, 'i1', '行 2', '列 2')
    expect(next.nodes[0].props).toMatchObject({ row: '行 2', col: '列 2' })
    expect(next.nodes[1].props).toMatchObject({ row: '行 2', col: '列 2' })
    const same = moveMatrixItem(next, 'i1', '行 2', '列 2')
    expect(same).toBe(next)
  })
})
