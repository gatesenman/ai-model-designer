import { useMemo, useState, useRef } from 'react'
import { Button, Input, Empty, Segmented, Tooltip } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  MinusOutlined,
  ApartmentOutlined
} from '@ant-design/icons'
import * as d3 from 'd3'
import { useModelStore } from '../../store/modelStore'
import { useCanvasHotkeys } from '../useCanvasHotkeys'
import { reparentNode, wouldCreateCycle } from '@shared/editOps'
import { getDiagramType } from '@shared/diagramCatalog'

const NODE_W = 156
const NODE_H = 48
const PAD = 60

type TreeLayout = 'tidy' | 'horizontal' | 'radial' | 'org'

const LAYOUT_LABEL: Record<TreeLayout, string> = {
  tidy: '纵向树',
  horizontal: '横向树',
  radial: '放射',
  org: '组织'
}

/** 每个图种的默认树布局 */
function defaultLayout(type?: string): TreeLayout {
  switch (type) {
    case 'mindmap':
      return 'radial'
    case 'fishbone':
      return 'horizontal'
    case 'org-chart':
      return 'org'
    default:
      return 'tidy'
  }
}

interface Placed {
  id: string
  x: number
  y: number
}

export default function TreeCanvas() {
  const doc = useModelStore((s) => s.doc)
  const addNode = useModelStore((s) => s.addNode)
  const updateNode = useModelStore((s) => s.updateNode)
  const addEdge = useModelStore((s) => s.addEdge)
  const setDoc = useModelStore((s) => s.setDoc)
  const selectNode = useModelStore((s) => s.selectNode)
  const selectedNodeId = useModelStore((s) => s.selectedNodeId)

  const [editing, setEditing] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const dragId = useRef<string | null>(null)
  useCanvasHotkeys()

  const diagramName = getDiagramType(doc.diagramType)?.name ?? '树形图'

  const layout: TreeLayout =
    (doc.meta?.treeLayout as TreeLayout) ?? defaultLayout(doc.diagramType)
  const collapsed = useMemo<Set<string>>(
    () => new Set(Array.isArray(doc.meta?.collapsed) ? (doc.meta?.collapsed as string[]) : []),
    [doc.meta]
  )

  const setLayout = (v: TreeLayout): void => {
    setDoc({ ...doc, meta: { ...(doc.meta ?? {}), treeLayout: v } })
  }
  const toggleCollapse = (id: string): void => {
    const next = new Set(collapsed)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setDoc({ ...doc, meta: { ...(doc.meta ?? {}), collapsed: Array.from(next) } })
  }

  const { childrenMap, roots, labelOf } = useMemo(() => {
    const cm: Record<string, string[]> = {}
    const hasParent = new Set<string>()
    const lm: Record<string, string> = {}
    doc.nodes.forEach((n) => (lm[n.id] = n.label))
    doc.edges.forEach((e) => {
      if (!cm[e.source]) cm[e.source] = []
      cm[e.source].push(e.target)
      hasParent.add(e.target)
    })
    const rs = doc.nodes.filter((n) => !hasParent.has(n.id)).map((n) => n.id)
    return { childrenMap: cm, roots: rs, labelOf: lm }
  }, [doc.edges, doc.nodes])

  const hasChildren = (id: string): boolean => (childrenMap[id] ?? []).length > 0

  // 用 d3-hierarchy 计算布局；多根时加一个虚拟根
  const { placed, links, bounds, isRoot } = useMemo(() => {
    const VROOT = '__vroot__'
    const rootSet = new Set(roots)
    const build = (id: string): d3.HierarchyNode<{ id: string }>['data'] & {
      id: string
      children?: unknown[]
    } => {
      const kids = collapsed.has(id) ? [] : childrenMap[id] ?? []
      return { id, children: kids.map((k) => build(k)) as unknown[] }
    }
    const rootData =
      roots.length === 1
        ? build(roots[0])
        : { id: VROOT, children: roots.map((r) => build(r)) }

    const root = d3.hierarchy(rootData as { id: string; children?: unknown[] }, (d) =>
      (d as { children?: { id: string }[] }).children as { id: string }[] | undefined
    )

    const pos: Record<string, Placed> = {}
    const linkList: { id: string; d: string }[] = []

    if (layout === 'radial') {
      const radius = Math.max(160, root.descendants().length * 26)
      d3
        .tree<{ id: string }>()
        .size([2 * Math.PI, radius])
        .separation((a, b) => (a.parent === b.parent ? 1 : 2) / Math.max(a.depth, 1))(root)
      const toXY = (ang: number, r: number): { x: number; y: number } => ({
        x: r * Math.cos(ang - Math.PI / 2),
        y: r * Math.sin(ang - Math.PI / 2)
      })
      root.each((n) => {
        const { x, y } = toXY((n as { x: number }).x, (n as { y: number }).y)
        pos[n.data.id] = { id: n.data.id, x, y }
      })
      const gen = d3
        .linkRadial<unknown, d3.HierarchyPointNode<{ id: string }>>()
        .angle((d) => (d as { x: number }).x)
        .radius((d) => (d as { y: number }).y)
      root.links().forEach((l) => {
        if (l.source.data.id === VROOT) return
        const d = gen({ source: l.source, target: l.target } as never) ?? ''
        linkList.push({ id: `${l.source.data.id}-${l.target.data.id}`, d })
      })
    } else {
      const horizontal = layout === 'horizontal'
      const nodeSize: [number, number] = horizontal
        ? [NODE_H + 26, NODE_W + 90]
        : [NODE_W + 30, NODE_H + 76]
      d3.tree<{ id: string }>().nodeSize(nodeSize)(root)
      root.each((n) => {
        const nx = (n as { x: number }).x
        const ny = (n as { y: number }).y
        pos[n.data.id] = horizontal ? { id: n.data.id, x: ny, y: nx } : { id: n.data.id, x: nx, y: ny }
      })
      const linkGen = horizontal
        ? d3.linkHorizontal<unknown, { x: number; y: number }>().x((d) => (d as Placed).x + NODE_W / 2).y((d) => (d as Placed).y + NODE_H / 2)
        : d3.linkVertical<unknown, { x: number; y: number }>().x((d) => (d as Placed).x + NODE_W / 2).y((d) => (d as Placed).y + NODE_H / 2)
      root.links().forEach((l) => {
        if (l.source.data.id === VROOT) return
        const s = pos[l.source.data.id]
        const t = pos[l.target.data.id]
        if (layout === 'org') {
          // 正交肘形连线
          const sx = s.x + NODE_W / 2
          const sy = s.y + NODE_H
          const tx = t.x + NODE_W / 2
          const ty = t.y
          const my = (sy + ty) / 2
          linkList.push({
            id: `${l.source.data.id}-${l.target.data.id}`,
            d: `M ${sx} ${sy} V ${my} H ${tx} V ${ty}`
          })
        } else {
          const d = linkGen({ source: s, target: t } as never) ?? ''
          linkList.push({ id: `${l.source.data.id}-${l.target.data.id}`, d })
        }
      })
    }

    // 归一化到正坐标 + padding
    const xs = Object.values(pos).map((p) => p.x)
    const ys = Object.values(pos).map((p) => p.y)
    const minX = xs.length ? Math.min(...xs) : 0
    const minY = ys.length ? Math.min(...ys) : 0
    const dx = PAD - minX
    const dy = PAD - minY
    Object.values(pos).forEach((p) => {
      p.x += dx
      p.y += dy
    })
    const shift = (d: string): string =>
      d.replace(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g, (_m, a, b) => `${Number(a) + dx},${Number(b) + dy}`)
    const shiftedLinks =
      layout === 'radial'
        ? linkList.map((l) => ({ id: l.id, d: shift(l.d) }))
        : linkList.map((l) => ({ id: l.id, d: shift(l.d) }))

    const w = Math.max(420, (xs.length ? Math.max(...xs) : 0) + dx + NODE_W + PAD)
    const h = Math.max(320, (ys.length ? Math.max(...ys) : 0) + dy + NODE_H + PAD)

    return {
      placed: pos,
      links: shiftedLinks,
      bounds: { w, h },
      isRoot: (id: string) => rootSet.has(id)
    }
  }, [childrenMap, roots, layout, collapsed])

  const addRoot = (): void => {
    addNode({
      label: doc.nodes.length === 0 ? '中心主题' : `节点 ${doc.nodes.length + 1}`,
      position: { x: 0, y: 0 }
    })
  }
  const addChild = (parentId: string): void => {
    if (collapsed.has(parentId)) toggleCollapse(parentId)
    const id = addNode({ label: '子节点', position: { x: 0, y: 0 } })
    addEdge(parentId, id, 'association')
  }
  const removeSubtree = (id: string): void => {
    const toRemove = new Set<string>()
    const walk = (nid: string): void => {
      if (toRemove.has(nid)) return
      toRemove.add(nid)
      ;(childrenMap[nid] ?? []).forEach(walk)
    }
    walk(id)
    setDoc({
      ...doc,
      nodes: doc.nodes.filter((n) => !toRemove.has(n.id)),
      edges: doc.edges.filter((e) => !toRemove.has(e.source) && !toRemove.has(e.target))
    })
  }

  return (
    <div className="tree-canvas">
      <div className="rc-toolbar">
        <span className="rc-toolbar__title">{diagramName}</span>
        <Button size="small" icon={<PlusOutlined />} onClick={addRoot}>
          {doc.nodes.length === 0 ? '中心主题' : '根节点'}
        </Button>
        <Segmented<TreeLayout>
          size="small"
          value={layout}
          onChange={(v) => setLayout(v)}
          options={(Object.keys(LAYOUT_LABEL) as TreeLayout[]).map((k) => ({
            value: k,
            label: LAYOUT_LABEL[k],
            icon: <ApartmentOutlined />
          }))}
        />
        <span className="rc-toolbar__hint">节点 {doc.nodes.length} · 拖到另一节点可换父</span>
      </div>

      <div className="tree-scroll">
        {doc.nodes.length === 0 ? (
          <div className="rc-empty">
            <Empty description="点击上方按钮添加中心主题，再在节点上「+」展开分支" />
          </div>
        ) : (
          <div className="tree-stage" style={{ width: bounds.w, height: bounds.h }}>
            <svg className="tree-svg" width={bounds.w} height={bounds.h}>
              {links.map((l) => (
                <path key={l.id} d={l.d} fill="none" stroke="#c7ccd6" strokeWidth={1.8} />
              ))}
            </svg>
            {doc.nodes.map((n) => {
              const p = placed[n.id]
              if (!p) return null
              const rootNode = isRoot(n.id)
              const kids = hasChildren(n.id)
              const isCollapsed = collapsed.has(n.id)
              const canDrop =
                dragId.current != null &&
                dragId.current !== n.id &&
                !wouldCreateCycle(doc.edges, dragId.current, n.id)
              return (
                <div
                  key={n.id}
                  className={`tree-node ${rootNode ? 'tree-node--root' : ''} ${selectedNodeId === n.id ? 'is-selected' : ''} ${dropTarget === n.id ? (canDrop ? 'is-drop' : 'is-drop-forbid') : ''}`}
                  style={{ left: p.x, top: p.y, width: NODE_W, minHeight: NODE_H }}
                  draggable
                  onClick={(e) => {
                    e.stopPropagation()
                    selectNode(n.id)
                  }}
                  onDragStart={(e) => {
                    dragId.current = n.id
                    e.dataTransfer.setData('text/plain', n.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => {
                    dragId.current = null
                    setDropTarget(null)
                  }}
                  onDragOver={(e) => {
                    if (!dragId.current || dragId.current === n.id) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = wouldCreateCycle(doc.edges, dragId.current, n.id)
                      ? 'none'
                      : 'move'
                    setDropTarget(n.id)
                  }}
                  onDragLeave={() => setDropTarget((h) => (h === n.id ? null : h))}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const src = dragId.current ?? e.dataTransfer.getData('text/plain')
                    setDropTarget(null)
                    dragId.current = null
                    if (src) setDoc(reparentNode(doc, src, n.id))
                  }}
                >
                  {editing === n.id ? (
                    <Input
                      size="small"
                      autoFocus
                      defaultValue={n.label}
                      onPressEnter={(e) => {
                        updateNode(n.id, { label: (e.target as HTMLInputElement).value })
                        setEditing(null)
                      }}
                      onBlur={(e) => {
                        updateNode(n.id, { label: e.target.value })
                        setEditing(null)
                      }}
                    />
                  ) : (
                    <span className="tree-node__label" onDoubleClick={() => setEditing(n.id)}>
                      {n.label || labelOf[n.id]}
                    </span>
                  )}
                  <div className="tree-node__ops">
                    {kids && (
                      <Tooltip title={isCollapsed ? '展开子树' : '折叠子树'}>
                        <button className="tree-node__op" onClick={(e) => { e.stopPropagation(); toggleCollapse(n.id) }}>
                          {isCollapsed ? <PlusOutlined /> : <MinusOutlined />}
                        </button>
                      </Tooltip>
                    )}
                    <Tooltip title="添加子节点">
                      <button className="tree-node__op" onClick={(e) => { e.stopPropagation(); addChild(n.id) }}>
                        <PlusOutlined />
                      </button>
                    </Tooltip>
                    <Tooltip title="删除（含子树）">
                      <button
                        className="tree-node__op tree-node__op--del"
                        onClick={(e) => { e.stopPropagation(); removeSubtree(n.id) }}
                      >
                        <DeleteOutlined />
                      </button>
                    </Tooltip>
                  </div>
                  {kids && isCollapsed && (
                    <span className="tree-node__badge">{(childrenMap[n.id] ?? []).length}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
