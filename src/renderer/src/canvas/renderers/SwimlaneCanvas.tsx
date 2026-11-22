import { useMemo, useRef, useState } from 'react'
import { Button, Dropdown, Input, Tooltip, Empty } from 'antd'
import type { MenuProps } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  ApartmentOutlined,
  NodeIndexOutlined,
  GroupOutlined
} from '@ant-design/icons'
import { useModelStore } from '../../store/modelStore'
import { useCanvasHotkeys } from '../useCanvasHotkeys'
import { getDiagramSchema } from '@shared/diagramSchema'
import { getDiagramType } from '@shared/diagramCatalog'
import type { DiagramNode } from '@shared/types'

const LANE_H = 150
const LANE_HEAD_W = 120
const POOL_HEAD_W = 30
const NODE_W = 120
const NODE_H = 56

function laneOf(n: DiagramNode): string {
  return (n.props?.lane as string) ?? ''
}

function shapeClass(shape?: string): string {
  switch (shape) {
    case 'diamond':
      return 'swl-node--diamond'
    case 'circle':
    case 'ellipse':
      return 'swl-node--circle'
    case 'hexagon':
      return 'swl-node--hexagon'
    case 'parallelogram':
      return 'swl-node--parallelogram'
    default:
      return 'swl-node--rounded'
  }
}

export default function SwimlaneCanvas() {
  const doc = useModelStore((s) => s.doc)
  const schema = useMemo(() => getDiagramSchema(doc.diagramType), [doc.diagramType])
  const addNode = useModelStore((s) => s.addNode)
  const updateNode = useModelStore((s) => s.updateNode)
  const removeNode = useModelStore((s) => s.removeNode)
  const moveNode = useModelStore((s) => s.moveNode)
  const addEdge = useModelStore((s) => s.addEdge)
  const setDoc = useModelStore((s) => s.setDoc)
  const selectNode = useModelStore((s) => s.selectNode)
  const selectEdge = useModelStore((s) => s.selectEdge)
  const selectedNodeId = useModelStore((s) => s.selectedNodeId)
  const selectedEdgeId = useModelStore((s) => s.selectedEdgeId)

  const [editing, setEditing] = useState<string | null>(null)
  useCanvasHotkeys()
  const [editingPool, setEditingPool] = useState<string | null>(null)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null)

  const lanes: string[] = useMemo(() => {
    const fromMeta = (doc.meta?.lanes as string[]) ?? []
    if (fromMeta.length) return fromMeta
    const used = new Set<string>()
    doc.nodes.forEach((n) => {
      const l = laneOf(n)
      if (l) used.add(l)
    })
    if (used.size) return Array.from(used)
    return schema.layout?.lanes ?? ['泳道 1', '泳道 2', '泳道 3']
  }, [doc.meta, doc.nodes, schema])

  // BPMN 池 → 泳道 归属映射（poolMap[lane] = 池名）
  const poolMap = (doc.meta?.poolMap as Record<string, string>) ?? {}
  const poolSegs = useMemo(() => {
    const segs: { pool: string; start: number; count: number }[] = []
    lanes.forEach((ln, i) => {
      const p = poolMap[ln]
      if (!p) return
      const last = segs[segs.length - 1]
      if (last && last.pool === p && last.start + last.count === i) last.count++
      else segs.push({ pool: p, start: i, count: 1 })
    })
    return segs
  }, [lanes, doc.meta])
  const hasPools = poolSegs.length > 0
  const poolOffset = hasPools ? POOL_HEAD_W : 0
  const poolNames = Array.from(new Set(Object.values(poolMap)))

  const diagramName = getDiagramType(doc.diagramType)?.name ?? '泳道图'
  const width = 1200
  const height = lanes.length * LANE_H
  const laneX0 = poolOffset + LANE_HEAD_W

  const setLanes = (next: string[]): void => {
    setDoc({ ...doc, meta: { ...(doc.meta ?? {}), lanes: next } })
  }
  const addLane = (): void => setLanes([...lanes, `泳道 ${lanes.length + 1}`])
  const renameLane = (i: number, name: string): void => {
    const old = lanes[i]
    const next = [...lanes]
    next[i] = name
    const nextPool = { ...poolMap }
    if (nextPool[old] != null) {
      nextPool[name] = nextPool[old]
      delete nextPool[old]
    }
    setDoc({
      ...doc,
      meta: { ...(doc.meta ?? {}), lanes: next, poolMap: nextPool },
      nodes: doc.nodes.map((n) => (laneOf(n) === old ? { ...n, props: { ...n.props, lane: name } } : n))
    })
  }
  const removeLane = (i: number): void => {
    if (lanes.length <= 1) return
    const name = lanes[i]
    const nextPool = { ...poolMap }
    delete nextPool[name]
    setDoc({
      ...doc,
      meta: { ...(doc.meta ?? {}), lanes: lanes.filter((_, idx) => idx !== i), poolMap: nextPool },
      nodes: doc.nodes.filter((n) => laneOf(n) !== name)
    })
  }

  const setLanePool = (lane: string, pool: string | null): void => {
    const next = { ...poolMap }
    if (pool) next[lane] = pool
    else delete next[lane]
    setDoc({ ...doc, meta: { ...(doc.meta ?? {}), poolMap: next } })
  }
  const renamePool = (oldName: string, newName: string): void => {
    const next: Record<string, string> = {}
    Object.entries(poolMap).forEach(([k, v]) => {
      next[k] = v === oldName ? newName : v
    })
    setDoc({ ...doc, meta: { ...(doc.meta ?? {}), poolMap: next } })
  }

  const addNodeToLane = (lane: string, kindId: string): void => {
    const kind = schema.nodeKinds.find((k) => k.id === kindId) ?? schema.nodeKinds[0]
    const count = doc.nodes.filter((n) => laneOf(n) === lane).length
    addNode({
      label: kind.label,
      category: kind.category ?? kind.id,
      nodeKind: kind.id,
      props: { lane },
      position: { x: 60 + count * (NODE_W + 40), y: 0 }
    })
  }

  const laneMenu = (lane: string): MenuProps['items'] =>
    schema.nodeKinds.map((k) => ({ key: k.id, label: k.label, onClick: () => addNodeToLane(lane, k.id) }))

  const poolMenu = (lane: string): MenuProps['items'] => [
    ...poolNames.map((p) => ({ key: p, label: `加入「${p}」`, onClick: () => setLanePool(lane, p) })),
    { key: '__new__', label: '新建泳池', onClick: () => setLanePool(lane, `泳池 ${poolNames.length + 1}`) },
    ...(poolMap[lane]
      ? [{ key: '__out__', label: '移出泳池', danger: true, onClick: () => setLanePool(lane, null) }]
      : [])
  ]

  const onNodeClick = (id: string): void => {
    if (!connectFrom) {
      selectNode(id)
      return
    }
    if (connectFrom === '__await__') {
      setConnectFrom(id)
      selectNode(id)
    } else if (connectFrom === id) {
      setConnectFrom(null)
    } else {
      addEdge(connectFrom, id, 'dependency')
      setConnectFrom(null)
    }
  }

  const onPointerDown = (e: React.PointerEvent, n: DiagramNode): void => {
    if (!connectFrom) selectNode(n.id)
    if (connectFrom) return
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    const laneIdx = Math.max(0, lanes.indexOf(laneOf(n)))
    const curY = laneIdx * LANE_H + (LANE_H - NODE_H) / 2
    drag.current = {
      id: n.id,
      dx: e.clientX - (rect.left + laneX0 + n.position.x),
      dy: e.clientY - (rect.top + curY)
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent): void => {
    const d = drag.current
    const rect = stageRef.current?.getBoundingClientRect()
    if (!d || !rect) return
    const x = Math.max(10, e.clientX - rect.left - laneX0 - d.dx)
    moveNode(d.id, x, 0)
  }
  const onPointerUp = (e: React.PointerEvent): void => {
    const d = drag.current
    const rect = stageRef.current?.getBoundingClientRect()
    if (d && rect) {
      const y = e.clientY - rect.top
      const laneIdx = Math.min(lanes.length - 1, Math.max(0, Math.floor(y / LANE_H)))
      const lane = lanes[laneIdx]
      const node = doc.nodes.find((n) => n.id === d.id)
      if (node && laneOf(node) !== lane) updateNode(d.id, { props: { ...node.props, lane } })
    }
    drag.current = null
  }

  const nodeCenter = (n: DiagramNode): { x: number; y: number } => {
    const laneIdx = Math.max(0, lanes.indexOf(laneOf(n)))
    return {
      x: laneX0 + n.position.x + NODE_W / 2,
      y: laneIdx * LANE_H + LANE_H / 2
    }
  }

  // 跨泳道正交路由：从节点侧边引出 → 中段竖直 → 进入目标侧边
  const edgeRoute = (s: DiagramNode, t: DiagramNode): string => {
    const cs = nodeCenter(s)
    const ct = nodeCenter(t)
    const toRight = ct.x >= cs.x
    const ax = cs.x + (toRight ? NODE_W / 2 : -NODE_W / 2)
    const bx = ct.x + (toRight ? -NODE_W / 2 : NODE_W / 2)
    const midX = (ax + bx) / 2
    return `M ${ax} ${cs.y} H ${midX} V ${ct.y} H ${bx}`
  }

  return (
    <div className="swl-canvas">
      <div className="rc-toolbar">
        <span className="rc-toolbar__title">{diagramName}</span>
        <Button size="small" icon={<PlusOutlined />} onClick={addLane}>
          泳道
        </Button>
        <Tooltip title="点一个节点开始连线，再点另一个节点完成（跨泳道自动正交路由）">
          <Button
            size="small"
            type={connectFrom ? 'primary' : 'default'}
            icon={<NodeIndexOutlined />}
            onClick={() => setConnectFrom(connectFrom ? null : '__await__')}
          >
            {connectFrom ? '选择起点/终点…' : '连线'}
          </Button>
        </Tooltip>
        <span className="rc-toolbar__hint">
          {hasPools ? `${poolNames.length} 池 · ` : ''}泳道 {lanes.length} · 节点 {doc.nodes.length}
        </span>
      </div>

      <div className="swl-scroll">
        {doc.nodes.length === 0 && lanes.length === 1 ? (
          <div className="rc-empty">
            <Empty description="添加泳道，泳道「+」加入任务/网关/事件；「池」按钮把泳道编入 BPMN 泳池" />
          </div>
        ) : null}
        <div
          className="swl-stage"
          ref={stageRef}
          style={{ width: poolOffset + width, height }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* 连线（跨泳道正交路由） */}
          <svg className="swl-svg" width={poolOffset + width} height={height}>
            {doc.edges.map((ed) => {
              const s = doc.nodes.find((n) => n.id === ed.source)
              const t = doc.nodes.find((n) => n.id === ed.target)
              if (!s || !t) return null
              return (
                <g
                  key={ed.id}
                  className={`swl-edge ${selectedEdgeId === ed.id ? 'is-selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    selectEdge(ed.id)
                  }}
                >
                  <path
                    d={edgeRoute(s, t)}
                    fill="none"
                    stroke={selectedEdgeId === ed.id ? '#4f6ef7' : '#7a869a'}
                    strokeWidth={selectedEdgeId === ed.id ? 2.2 : 1.6}
                    markerEnd="url(#swl-arrow)"
                  />
                </g>
              )
            })}
            <defs>
              <marker id="swl-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L8,3 L0,6 z" fill="#7a869a" />
              </marker>
            </defs>
          </svg>

          {/* 泳池竖条（BPMN pool 套 lane） */}
          {poolSegs.map((seg, si) => (
            <div
              key={`pool-${si}`}
              className="swl-pool"
              style={{ top: seg.start * LANE_H, height: seg.count * LANE_H, width: POOL_HEAD_W }}
            >
              {editingPool === seg.pool ? (
                <Input
                  size="small"
                  autoFocus
                  variant="borderless"
                  defaultValue={seg.pool}
                  onPressEnter={(e) => {
                    renamePool(seg.pool, (e.target as HTMLInputElement).value)
                    setEditingPool(null)
                  }}
                  onBlur={(e) => {
                    renamePool(seg.pool, e.target.value)
                    setEditingPool(null)
                  }}
                />
              ) : (
                <span className="swl-pool__label" onDoubleClick={() => setEditingPool(seg.pool)}>
                  {seg.pool}
                </span>
              )}
            </div>
          ))}

          {/* 泳道行 */}
          {lanes.map((lane, i) => (
            <div
              key={lane + i}
              className="swl-lane"
              style={{ top: i * LANE_H, left: poolOffset, height: LANE_H, width }}
            >
              <div className="swl-lane__head">
                <Input
                  size="small"
                  variant="borderless"
                  value={lane}
                  onChange={(e) => renameLane(i, e.target.value)}
                />
                <div className="swl-lane__ops">
                  <Dropdown menu={{ items: laneMenu(lane) }} trigger={['click']}>
                    <Tooltip title="添加元素">
                      <Button type="text" size="small" icon={<PlusOutlined />} />
                    </Tooltip>
                  </Dropdown>
                  <Dropdown menu={{ items: poolMenu(lane) }} trigger={['click']}>
                    <Tooltip title="编入/移出 BPMN 泳池">
                      <Button
                        type="text"
                        size="small"
                        icon={<GroupOutlined />}
                        className={poolMap[lane] ? 'swl-inpool' : ''}
                      />
                    </Tooltip>
                  </Dropdown>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    disabled={lanes.length <= 1}
                    onClick={() => removeLane(i)}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* 节点 */}
          {doc.nodes.map((n) => {
            const laneIdx = Math.max(0, lanes.indexOf(laneOf(n)))
            const kind = schema.nodeKinds.find((k) => k.id === n.nodeKind)
            const top = laneIdx * LANE_H + (LANE_H - NODE_H) / 2
            const left = laneX0 + n.position.x
            const isConnect = connectFrom === n.id
            return (
              <div
                key={n.id}
                className={`swl-node ${shapeClass(kind?.shape)} ${isConnect ? 'is-connect' : ''} ${selectedNodeId === n.id ? 'is-selected' : ''}`}
                style={{ top, left, width: NODE_W, height: NODE_H }}
                onPointerDown={(e) => onPointerDown(e, n)}
                onClick={(e) => {
                  e.stopPropagation()
                  onNodeClick(n.id)
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
                  <span className="swl-node__label" onDoubleClick={() => setEditing(n.id)}>
                    {n.label}
                  </span>
                )}
                <button
                  className="swl-node__del"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeNode(n.id)
                  }}
                  title="删除"
                >
                  <DeleteOutlined />
                </button>
              </div>
            )
          })}
        </div>
      </div>
      {connectFrom === '__await__' && (
        <div className="rc-tip-bar">
          <ApartmentOutlined /> 连线模式：先点击起点节点，再点击终点节点
        </div>
      )}
    </div>
  )
}
