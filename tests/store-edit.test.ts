import { describe, expect, it, beforeEach } from 'vitest'
import { useModelStore } from '@renderer/store/modelStore'
import { moveMatrixItem, reparentNode, wouldCreateCycle } from '@shared/editOps'

describe('核心编辑状态', () => {
  beforeEach(() => {
    useModelStore.getState().newProject()
  })

  it('选中节点与边会写入 store，互斥清除', () => {
    const id = useModelStore.getState().addModel('architecture', '时序', 'uml-sequence')
    useModelStore.getState().switchModel(id)
    const doc = useModelStore.getState().doc
    const nodeId = doc.nodes[0].id
    const edgeId = doc.edges[0].id

    useModelStore.getState().selectNode(nodeId)
    expect(useModelStore.getState().selectedNodeId).toBe(nodeId)
    expect(useModelStore.getState().selectedNodeIds).toEqual([nodeId])
    expect(useModelStore.getState().selectedEdgeId).toBeNull()

    useModelStore.getState().selectEdge(edgeId)
    expect(useModelStore.getState().selectedEdgeId).toBe(edgeId)
    expect(useModelStore.getState().selectedNodeId).toBeNull()
    expect(useModelStore.getState().selectedNodeIds).toEqual([])

    useModelStore.getState().clearSelection()
    expect(useModelStore.getState().selectedEdgeId).toBeNull()
    expect(useModelStore.getState().selectedNodeId).toBeNull()
  })

  it('撤销/重做能恢复节点标签', () => {
    const id = useModelStore.getState().addModel('architecture', '树', 'mindmap')
    useModelStore.getState().switchModel(id)
    const nodeId = useModelStore.getState().doc.nodes[0].id
    const original = useModelStore.getState().doc.nodes[0].label
    useModelStore.getState().updateNode(nodeId, { label: '改名后' })
    expect(useModelStore.getState().doc.nodes[0].label).toBe('改名后')
    expect(useModelStore.getState().canUndo()).toBe(true)
    useModelStore.getState().undo()
    expect(useModelStore.getState().doc.nodes[0].label).toBe(original)
    useModelStore.getState().redo()
    expect(useModelStore.getState().doc.nodes[0].label).toBe('改名后')
  })

  it('矩阵条目可通过 editOps 跨格移动并写回 store', () => {
    const id = useModelStore.getState().addModel('architecture', 'RACI', 'raci')
    useModelStore.getState().switchModel(id)
    const doc = useModelStore.getState().doc
    const item = doc.nodes[0]
    const rows = doc.meta?.rows as string[]
    const cols = doc.meta?.cols as string[]
    const targetRow = rows[rows.length - 1]
    const targetCol = cols[cols.length - 1]
    useModelStore.getState().setDoc(moveMatrixItem(doc, item.id, targetRow, targetCol))
    const moved = useModelStore.getState().doc.nodes.find((n) => n.id === item.id)
    expect(moved?.props?.row).toBe(targetRow)
    expect(moved?.props?.col).toBe(targetCol)
  })

  it('树换父带循环保护', () => {
    const id = useModelStore.getState().addModel('architecture', '组织', 'org-chart')
    useModelStore.getState().switchModel(id)
    const rootId = useModelStore.getState().doc.nodes[0].id
    const childId = useModelStore.getState().addNode({ label: '子节点', position: { x: 0, y: 0 } })
    useModelStore.getState().addEdge(rootId, childId, 'association')
    const doc = useModelStore.getState().doc
    expect(wouldCreateCycle(doc.edges, rootId, childId)).toBe(true)
    useModelStore.getState().setDoc(reparentNode(doc, rootId, childId))
    expect(useModelStore.getState().doc.edges).toEqual(doc.edges)
  })
})
