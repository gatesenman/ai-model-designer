import type { DiagramNode, ModelDoc } from '@shared/types'

const NODE_WIDTH = 230
const GAP_X = 70
const GAP_Y = 60
const HEADER_H = 40
const ROW_H = 22
const PADDING = 16

export type LayoutType = 'grid' | 'tree' | 'horizontal' | 'circular' | 'force' | 'vertical-tree'

export const LAYOUT_LABELS: Record<LayoutType, string> = {
  grid: '网格布局',
  tree: '树形布局',
  'vertical-tree': '纵向树形',
  horizontal: '水平布局',
  circular: '环形布局',
  force: '力导向布局'
}

/** 估算节点渲染高度（用于无重叠布局） */
function nodeHeight(node: DiagramNode): number {
  const rows = node.fields.length + (node.methods?.length ?? 0)
  return HEADER_H + rows * ROW_H + PADDING
}

/**
 * 统一入口：根据 layoutType 选择布局算法
 */
export function autoLayout(doc: ModelDoc, startX = 40, startY = 40): DiagramNode[] {
  return gridLayout(doc, startX, startY)
}

export function applyLayout(
  doc: ModelDoc,
  layoutType: LayoutType,
  startX = 40,
  startY = 40
): DiagramNode[] {
  switch (layoutType) {
    case 'grid':
      return gridLayout(doc, startX, startY)
    case 'tree':
      return treeLayout(doc, startX, startY)
    case 'vertical-tree':
      return verticalTreeLayout(doc, startX, startY)
    case 'horizontal':
      return horizontalLayout(doc, startX, startY)
    case 'circular':
      return circularLayout(doc, startX, startY)
    case 'force':
      return forceLayout(doc, startX, startY)
  }
}

/* ============================= 网格布局 ============================= */

function gridLayout(doc: ModelDoc, startX: number, startY: number): DiagramNode[] {
  const nodes = doc.nodes
  const n = nodes.length
  if (n === 0) return nodes.map((nd) => ({ ...nd }))
  const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(n))))
  const rows = Math.ceil(n / cols)

  const rowHeights: number[] = []
  for (let r = 0; r < rows; r++) {
    let maxH = 0
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c
      if (idx < n) maxH = Math.max(maxH, nodeHeight(nodes[idx]))
    }
    rowHeights.push(maxH)
  }
  const rowY: number[] = []
  let acc = startY
  for (let r = 0; r < rows; r++) {
    rowY.push(acc)
    acc += rowHeights[r] + GAP_Y
  }

  return nodes.map((nd, idx) => {
    const r = Math.floor(idx / cols)
    const c = idx % cols
    return {
      ...nd,
      position: { x: startX + c * (NODE_WIDTH + GAP_X), y: rowY[r] }
    }
  })
}

/* ============================= 树形布局（层次结构） ============================= */

function buildAdjacency(doc: ModelDoc): {
  children: Map<string, string[]>
  roots: string[]
} {
  const nodeIds = new Set(doc.nodes.map((n) => n.id))
  const children = new Map<string, string[]>()
  const hasParent = new Set<string>()

  for (const id of nodeIds) {
    children.set(id, [])
  }

  for (const e of doc.edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue
    const parent = e.source
    const child = e.target
    children.get(parent)!.push(child)
    hasParent.add(child)
  }

  const roots = doc.nodes.filter((n) => !hasParent.has(n.id)).map((n) => n.id)
  if (roots.length === 0 && doc.nodes.length > 0) {
    roots.push(doc.nodes[0].id)
  }

  return { children, roots }
}

function treeLayout(doc: ModelDoc, startX: number, startY: number): DiagramNode[] {
  const nodes = doc.nodes
  const n = nodes.length
  if (n === 0) return []

  const nodeMap = new Map(nodes.map((nd) => [nd.id, nd]))
  const { children, roots } = buildAdjacency(doc)
  const positions = new Map<string, { x: number; y: number }>()
  const visited = new Set<string>()

  const LEVEL_GAP_X = NODE_WIDTH + GAP_X + 40
  const SIBLING_GAP_Y = GAP_Y + 10

  let globalY = startY

  function layoutSubtree(nodeId: string, depth: number): void {
    if (visited.has(nodeId)) return
    visited.add(nodeId)

    const node = nodeMap.get(nodeId)
    if (!node) return

    const ch = (children.get(nodeId) ?? []).filter((c) => !visited.has(c))

    if (ch.length === 0) {
      positions.set(nodeId, { x: startX + depth * LEVEL_GAP_X, y: globalY })
      globalY += nodeHeight(node) + SIBLING_GAP_Y
      return
    }

    const childYStart = globalY
    for (const childId of ch) {
      layoutSubtree(childId, depth + 1)
    }
    const childYEnd = globalY - SIBLING_GAP_Y

    const midY = (childYStart + childYEnd) / 2 - nodeHeight(node) / 2
    positions.set(nodeId, { x: startX + depth * LEVEL_GAP_X, y: Math.max(midY, childYStart) })
  }

  for (const rootId of roots) {
    layoutSubtree(rootId, 0)
  }

  // Place any unvisited nodes
  for (const nd of nodes) {
    if (!visited.has(nd.id)) {
      positions.set(nd.id, { x: startX, y: globalY })
      globalY += nodeHeight(nd) + SIBLING_GAP_Y
    }
  }

  return nodes.map((nd) => ({
    ...nd,
    position: positions.get(nd.id) ?? nd.position
  }))
}

/* ============================= 纵向树形布局 ============================= */

function verticalTreeLayout(doc: ModelDoc, startX: number, startY: number): DiagramNode[] {
  const nodes = doc.nodes
  const n = nodes.length
  if (n === 0) return []

  const nodeMap = new Map(nodes.map((nd) => [nd.id, nd]))
  const { children, roots } = buildAdjacency(doc)
  const positions = new Map<string, { x: number; y: number }>()
  const visited = new Set<string>()

  const LEVEL_GAP_Y = 200
  const SIBLING_GAP_X = NODE_WIDTH + GAP_X

  let globalX = startX

  function layoutSubtree(nodeId: string, depth: number): void {
    if (visited.has(nodeId)) return
    visited.add(nodeId)

    const node = nodeMap.get(nodeId)
    if (!node) return

    const ch = (children.get(nodeId) ?? []).filter((c) => !visited.has(c))

    if (ch.length === 0) {
      positions.set(nodeId, { x: globalX, y: startY + depth * LEVEL_GAP_Y })
      globalX += SIBLING_GAP_X
      return
    }

    const childXStart = globalX
    for (const childId of ch) {
      layoutSubtree(childId, depth + 1)
    }
    const childXEnd = globalX - SIBLING_GAP_X

    const midX = (childXStart + childXEnd) / 2
    positions.set(nodeId, { x: midX, y: startY + depth * LEVEL_GAP_Y })
  }

  for (const rootId of roots) {
    layoutSubtree(rootId, 0)
  }

  for (const nd of nodes) {
    if (!visited.has(nd.id)) {
      positions.set(nd.id, { x: globalX, y: startY })
      globalX += SIBLING_GAP_X
    }
  }

  return nodes.map((nd) => ({
    ...nd,
    position: positions.get(nd.id) ?? nd.position
  }))
}

/* ============================= 水平布局 ============================= */

function horizontalLayout(doc: ModelDoc, startX: number, startY: number): DiagramNode[] {
  const nodes = doc.nodes
  if (nodes.length === 0) return []

  return nodes.map((nd, idx) => ({
    ...nd,
    position: { x: startX + idx * (NODE_WIDTH + GAP_X), y: startY }
  }))
}

/* ============================= 环形布局 ============================= */

function circularLayout(doc: ModelDoc, startX: number, startY: number): DiagramNode[] {
  const nodes = doc.nodes
  const n = nodes.length
  if (n === 0) return []
  if (n === 1) return [{ ...nodes[0], position: { x: startX + 300, y: startY + 300 } }]

  const radius = Math.max(200, n * 55)
  const cx = startX + radius + NODE_WIDTH / 2
  const cy = startY + radius + 100

  return nodes.map((nd, idx) => {
    const angle = (2 * Math.PI * idx) / n - Math.PI / 2
    return {
      ...nd,
      position: {
        x: cx + radius * Math.cos(angle) - NODE_WIDTH / 2,
        y: cy + radius * Math.sin(angle) - nodeHeight(nd) / 2
      }
    }
  })
}

/* ============================= 力导向布局 ============================= */

function forceLayout(doc: ModelDoc, startX: number, startY: number): DiagramNode[] {
  const nodes = doc.nodes
  const n = nodes.length
  if (n === 0) return []
  if (n === 1) return [{ ...nodes[0], position: { x: startX + 300, y: startY + 200 } }]

  const edgeSet = doc.edges.map((e) => ({
    sourceIdx: nodes.findIndex((nd) => nd.id === e.source),
    targetIdx: nodes.findIndex((nd) => nd.id === e.target)
  })).filter((e) => e.sourceIdx >= 0 && e.targetIdx >= 0)

  // Initialize positions in a circle to avoid overlap at start
  const initRadius = Math.max(150, n * 40)
  const cx = 400
  const cy = 400
  const pos: { x: number; y: number }[] = nodes.map((_, idx) => {
    const angle = (2 * Math.PI * idx) / n
    return { x: cx + initRadius * Math.cos(angle), y: cy + initRadius * Math.sin(angle) }
  })

  const REPULSION = 80000
  const SPRING_K = 0.008
  const IDEAL_LEN = NODE_WIDTH + GAP_X + 40
  const DAMPING = 0.85
  const ITERATIONS = 150

  const vel: { x: number; y: number }[] = nodes.map(() => ({ x: 0, y: 0 }))

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const forces: { x: number; y: number }[] = nodes.map(() => ({ x: 0, y: 0 }))
    const temp = 1 - iter / ITERATIONS

    // Repulsion between all pairs
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i].x - pos[j].x
        let dy = pos[i].y - pos[j].y
        let dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 1) {
          dx = Math.random() - 0.5
          dy = Math.random() - 0.5
          dist = 1
        }
        const force = REPULSION / (dist * dist)
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        forces[i].x += fx
        forces[i].y += fy
        forces[j].x -= fx
        forces[j].y -= fy
      }
    }

    // Spring attraction along edges
    for (const edge of edgeSet) {
      const { sourceIdx: i, targetIdx: j } = edge
      const dx = pos[j].x - pos[i].x
      const dy = pos[j].y - pos[i].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 1) continue
      const displacement = dist - IDEAL_LEN
      const force = SPRING_K * displacement
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      forces[i].x += fx
      forces[i].y += fy
      forces[j].x -= fx
      forces[j].y -= fy
    }

    // Center gravity
    for (let i = 0; i < n; i++) {
      forces[i].x += (cx - pos[i].x) * 0.001
      forces[i].y += (cy - pos[i].y) * 0.001
    }

    // Apply forces
    for (let i = 0; i < n; i++) {
      vel[i].x = (vel[i].x + forces[i].x) * DAMPING * temp
      vel[i].y = (vel[i].y + forces[i].y) * DAMPING * temp
      const maxV = 50
      vel[i].x = Math.max(-maxV, Math.min(maxV, vel[i].x))
      vel[i].y = Math.max(-maxV, Math.min(maxV, vel[i].y))
      pos[i].x += vel[i].x
      pos[i].y += vel[i].y
    }
  }

  // Normalize: shift so min is at startX, startY
  let minX = Infinity
  let minY = Infinity
  for (const p of pos) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
  }

  return nodes.map((nd, idx) => ({
    ...nd,
    position: {
      x: startX + pos[idx].x - minX,
      y: startY + pos[idx].y - minY
    }
  }))
}
