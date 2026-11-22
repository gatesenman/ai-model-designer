import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input, Tooltip } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  ApiOutlined,
  VerticalRightOutlined
} from '@ant-design/icons'
import { useModelStore } from '../../store/modelStore'
import { useCanvasHotkeys } from '../useCanvasHotkeys'
import { getDiagramType } from '@shared/diagramCatalog'
import { getDiagramSchema } from '@shared/diagramSchema'
import type { DiagramNode } from '@shared/types'

const COLORS = ['#4f6ef7', '#16a34a', '#f59e0b', '#e11d48', '#7c3aed', '#0891b2']
const TRACK_W = 172
const HEADER_H = 40
const TRACK_H = 32
const ROW_H = 44
const ADD_H = 28
const PERIOD_W = 150

type DragMode = 'move' | 'resize-l' | 'resize-r'
interface Drag {
  id: string
  mode: DragMode
  startX: number
  origStart: number
  origEnd: number
  curStart: number
  curEnd: number
}

export default function TimelineCanvas() {
  const doc = useModelStore((s) => s.doc)
  const addNode = useModelStore((s) => s.addNode)
  const updateNode = useModelStore((s) => s.updateNode)
  const removeNode = useModelStore((s) => s.removeNode)
  const addEdge = useModelStore((s) => s.addEdge)
  const setDoc = useModelStore((s) => s.setDoc)
  const selectNode = useModelStore((s) => s.selectNode)
  const selectEdge = useModelStore((s) => s.selectEdge)
  const selectedNodeId = useModelStore((s) => s.selectedNodeId)
  const selectedEdgeId = useModelStore((s) => s.selectedEdgeId)

  const [editing, setEditing] = useState<string | null>(null)
  useCanvasHotkeys()
  const [linkMode, setLinkMode] = useState(false)
  const [linkFrom, setLinkFrom] = useState<string | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  dragRef.current = drag
  const stageRef = useRef<HTMLDivElement>(null)
  const todayDragRef = useRef(false)

  const diagramName = getDiagramType(doc.diagramType)?.name ?? '时间轴'
  const seed = useMemo(() => getDiagramSchema(doc.diagramType).layout ?? {}, [doc.diagramType])
  const tracks: string[] = (doc.meta?.tracks as string[]) ?? seed.tracks ?? ['轨道 1', '轨道 2']
  const periods: string[] =
    (doc.meta?.periods as string[]) ?? seed.periods ?? ['阶段 1', '阶段 2', '阶段 3']
  const today = doc.meta?.today as number | undefined

  const itemsByTrack = useMemo(() => {
    const m: Record<string, DiagramNode[]> = {}
    doc.nodes.forEach((n) => {
      const key = (n.props?.track as string) ?? ''
      if (!m[key]) m[key] = []
      m[key].push(n)
    })
    return m
  }, [doc.nodes])

  // 计算每个条目所在行的 y，供 svg 依赖连线使用
  const { rowY, addRowY, totalHeight } = useMemo(() => {
    const ry: Record<string, number> = {}
    const ay: Record<string, number> = {}
    let y = HEADER_H
    tracks.forEach((tr) => {
      y += TRACK_H
      ;(itemsByTrack[tr] ?? []).forEach((it) => {
        ry[it.id] = y
        y += ROW_H
      })
      ay[tr] = y
      y += ADD_H
    })
    return { rowY: ry, addRowY: ay, totalHeight: Math.max(y + 10, 260) }
  }, [tracks, itemsByTrack])

  const gridW = periods.length * PERIOD_W
  const stageW = TRACK_W + gridW

  const patchMeta = (patch: Record<string, unknown>): void =>
    setDoc({ ...doc, meta: { ...(doc.meta ?? {}), tracks, periods, ...patch } })
  const addTrack = (): void => patchMeta({ tracks: [...tracks, `轨道 ${tracks.length + 1}`] })
  const addPeriod = (): void => patchMeta({ periods: [...periods, `阶段 ${periods.length + 1}`] })
  const renameTrack = (i: number, v: string): void => {
    const old = tracks[i]
    const next = [...tracks]
    next[i] = v
    setDoc({
      ...doc,
      meta: { ...(doc.meta ?? {}), tracks: next, periods },
      nodes: doc.nodes.map((n) =>
        (n.props?.track as string) === old ? { ...n, props: { ...n.props, track: v } } : n
      )
    })
  }
  const renamePeriod = (i: number, v: string): void => {
    const next = [...periods]
    next[i] = v
    patchMeta({ periods: next })
  }
  const removeTrack = (i: number): void => {
    if (tracks.length <= 1) return
    const name = tracks[i]
    setDoc({
      ...doc,
      meta: { ...(doc.meta ?? {}), tracks: tracks.filter((_, idx) => idx !== i), periods },
      nodes: doc.nodes.filter((n) => (n.props?.track as string) !== name)
    })
  }
  const removePeriod = (i: number): void => {
    if (periods.length <= 1) return
    patchMeta({ periods: periods.filter((_, idx) => idx !== i) })
  }
  const addItem = (track: string): void => {
    addNode({ label: '里程碑', props: { track, start: 0, end: 0 }, position: { x: 0, y: 0 } })
  }
  const toggleToday = (): void => {
    if (today == null) patchMeta({ today: periods.length / 2 })
    else patchMeta({ today: undefined })
  }

  const barClick = (id: string): void => {
    if (!linkMode) {
      selectNode(id)
      return
    }
    if (linkFrom == null) {
      setLinkFrom(id)
      selectNode(id)
    } else if (linkFrom !== id) {
      addEdge(linkFrom, id, 'dependency')
      setLinkFrom(null)
    }
  }

  // 拖拽移动/伸缩
  const beginDrag = (e: React.MouseEvent, it: DiagramNode, mode: DragMode): void => {
    if (linkMode || editing === it.id) return
    e.preventDefault()
    const s = Number(it.props?.start ?? 0)
    const en = Math.max(Number(it.props?.end ?? 0), s)
    setDrag({ id: it.id, mode, startX: e.clientX, origStart: s, origEnd: en, curStart: s, curEnd: en })
  }

  useEffect(() => {
    if (!drag) return
    const maxIdx = periods.length - 1
    const onMove = (e: MouseEvent): void => {
      const d = dragRef.current
      if (!d) return
      const delta = Math.round((e.clientX - d.startX) / PERIOD_W)
      let cs = d.origStart
      let ce = d.origEnd
      const len = d.origEnd - d.origStart
      if (d.mode === 'move') {
        cs = Math.max(0, Math.min(maxIdx - len, d.origStart + delta))
        ce = cs + len
      } else if (d.mode === 'resize-l') {
        cs = Math.max(0, Math.min(d.origEnd, d.origStart + delta))
      } else {
        ce = Math.min(maxIdx, Math.max(d.origStart, d.origEnd + delta))
      }
      if (cs !== d.curStart || ce !== d.curEnd) setDrag({ ...d, curStart: cs, curEnd: ce })
    }
    const onUp = (): void => {
      const d = dragRef.current
      if (d && (d.curStart !== d.origStart || d.curEnd !== d.origEnd)) {
        const n = doc.nodes.find((x) => x.id === d.id)
        if (n) updateNode(d.id, { props: { ...n.props, start: d.curStart, end: d.curEnd } })
      }
      setDrag(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag, periods.length, doc.nodes, updateNode])

  // today 线拖拽
  const beginTodayDrag = (e: React.MouseEvent): void => {
    e.preventDefault()
    todayDragRef.current = true
    const rect = stageRef.current?.getBoundingClientRect()
    const left = (rect?.left ?? 0) + TRACK_W
    const onMove = (ev: MouseEvent): void => {
      if (!todayDragRef.current) return
      const val = Math.max(0, Math.min(periods.length, (ev.clientX - left) / PERIOD_W))
      patchMeta({ today: Math.round(val * 4) / 4 })
    }
    const onUp = (): void => {
      todayDragRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const barGeom = (it: DiagramNode): { start: number; end: number } => {
    if (drag && drag.id === it.id) return { start: drag.curStart, end: drag.curEnd }
    const s = Math.min(Number(it.props?.start ?? 0), periods.length - 1)
    const en = Math.min(Math.max(Number(it.props?.end ?? 0), s), periods.length - 1)
    return { start: s, end: en }
  }

  // 依赖连线路径（doc.edges）
  const depPaths = useMemo(() => {
    return doc.edges
      .map((e) => {
        const src = doc.nodes.find((n) => n.id === e.source)
        const tgt = doc.nodes.find((n) => n.id === e.target)
        if (!src || !tgt || rowY[src.id] == null || rowY[tgt.id] == null) return null
        const sg = barGeom(src)
        const tg = barGeom(tgt)
        const x1 = TRACK_W + (sg.end + 1) * PERIOD_W - 4
        const y1 = rowY[src.id] + ROW_H / 2
        const x2 = TRACK_W + tg.start * PERIOD_W + 4
        const y2 = rowY[tgt.id] + ROW_H / 2
        const mx = Math.max(x1 + 18, x2 - 18)
        return { id: e.id, d: `M ${x1} ${y1} H ${mx} V ${y2} H ${x2}` }
      })
      .filter(Boolean) as { id: string; d: string }[]
  }, [doc.edges, doc.nodes, rowY, drag, periods.length])

  return (
    <div className="tl-canvas">
      <div className="rc-toolbar">
        <span className="rc-toolbar__title">{diagramName}</span>
        <Button size="small" icon={<PlusOutlined />} onClick={addTrack}>
          轨道
        </Button>
        <Button size="small" icon={<PlusOutlined />} onClick={addPeriod}>
          阶段
        </Button>
        <Button
          size="small"
          type={linkMode ? 'primary' : 'default'}
          icon={<ApiOutlined />}
          onClick={() => {
            setLinkMode(!linkMode)
            setLinkFrom(null)
          }}
        >
          依赖连线
        </Button>
        <Button
          size="small"
          type={today != null ? 'primary' : 'default'}
          icon={<VerticalRightOutlined />}
          onClick={toggleToday}
        >
          今天线
        </Button>
        <span className="rc-toolbar__hint">
          {tracks.length} 轨道 × {periods.length} 阶段 · {doc.nodes.length} 项
        </span>
      </div>

      <div className="tl-scroll">
        <div className="tlg-stage" ref={stageRef} style={{ width: stageW, height: totalHeight }}>
          {/* 竖向网格线 */}
          {periods.map((_, pi) => (
            <div
              key={`grid-${pi}`}
              className="tlg-gridline"
              style={{ left: TRACK_W + pi * PERIOD_W, height: totalHeight }}
            />
          ))}

          {/* 顶部阶段表头 */}
          <div className="tlg-corner" style={{ width: TRACK_W, height: HEADER_H }} />
          {periods.map((p, pi) => (
            <div
              key={`ph-${pi}`}
              className="tlg-period"
              style={{ left: TRACK_W + pi * PERIOD_W, width: PERIOD_W, height: HEADER_H }}
            >
              <Input
                size="small"
                variant="borderless"
                value={p}
                onChange={(e) => renamePeriod(pi, e.target.value)}
              />
              <Tooltip title="删除阶段">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={periods.length <= 1}
                  onClick={() => removePeriod(pi)}
                />
              </Tooltip>
            </div>
          ))}

          {/* 轨道band + 条目行 + 添加行 */}
          {tracks.map((tr, ti) => {
            const bandY = (() => {
              // 计算该轨道 band 顶部：累加前面轨道高度
              let y = HEADER_H
              for (let k = 0; k < ti; k++) {
                y += TRACK_H + (itemsByTrack[tracks[k]] ?? []).length * ROW_H + ADD_H
              }
              return y
            })()
            const items = itemsByTrack[tr] ?? []
            return (
              <div key={`tr-${ti}`}>
                <div className="tlg-band" style={{ top: bandY, width: stageW, height: TRACK_H }}>
                  <div className="tlg-band__head" style={{ width: TRACK_W }}>
                    <Input
                      size="small"
                      variant="borderless"
                      value={tr}
                      onChange={(e) => renameTrack(ti, e.target.value)}
                    />
                    <div className="tlg-band__ops">
                      <Tooltip title="添加里程碑/条目">
                        <Button
                          type="text"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => addItem(tr)}
                        />
                      </Tooltip>
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        disabled={tracks.length <= 1}
                        onClick={() => removeTrack(ti)}
                      />
                    </div>
                  </div>
                </div>

                {items.map((it, idx) => {
                  const { start, end } = barGeom(it)
                  const color = COLORS[idx % COLORS.length]
                  const y = rowY[it.id]
                  const left = TRACK_W + start * PERIOD_W + 4
                  const width = (end - start + 1) * PERIOD_W - 8
                  const isLinkSrc = linkFrom === it.id
                  return (
                    <div
                      key={it.id}
                      className={`tlg-bar ${isLinkSrc ? 'is-linksrc' : ''} ${linkMode ? 'is-linkmode' : ''} ${selectedNodeId === it.id ? 'is-selected' : ''}`}
                      style={{ top: y + 6, left, width, height: ROW_H - 12, background: color }}
                      onMouseDown={(e) => beginDrag(e, it, 'move')}
                      onClick={(e) => {
                        e.stopPropagation()
                        barClick(it.id)
                      }}
                    >
                      <span
                        className="tlg-bar__handle tlg-bar__handle--l"
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          beginDrag(e, it, 'resize-l')
                        }}
                      />
                      {editing === it.id ? (
                        <Input
                          size="small"
                          autoFocus
                          variant="borderless"
                          defaultValue={it.label}
                          onPressEnter={(e) => {
                            updateNode(it.id, { label: (e.target as HTMLInputElement).value })
                            setEditing(null)
                          }}
                          onBlur={(e) => {
                            updateNode(it.id, { label: e.target.value })
                            setEditing(null)
                          }}
                        />
                      ) : (
                        <span
                          className="tlg-bar__label"
                          onDoubleClick={() => setEditing(it.id)}
                          title="双击重命名，拖动移动，两端拖动伸缩"
                        >
                          {it.label}
                        </span>
                      )}
                      <button
                        className="tlg-bar__del"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeNode(it.id)
                        }}
                        title="删除"
                      >
                        <DeleteOutlined />
                      </button>
                      <span
                        className="tlg-bar__handle tlg-bar__handle--r"
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          beginDrag(e, it, 'resize-r')
                        }}
                      />
                    </div>
                  )
                })}

                <div
                  className="tlg-addrow"
                  style={{ top: addRowY[tr], left: TRACK_W + 6, width: gridW - 12 }}
                  onClick={() => addItem(tr)}
                >
                  <PlusOutlined /> 添加条目
                </div>
              </div>
            )
          })}

          {/* 依赖连线 + today 线 */}
          <svg className="tlg-svg" width={stageW} height={totalHeight}>
            {depPaths.map((p) => (
              <path
                key={p.id}
                d={p.d}
                fill="none"
                stroke={selectedEdgeId === p.id ? '#4f6ef7' : '#e11d48'}
                strokeWidth={selectedEdgeId === p.id ? 2.4 : 1.6}
                markerEnd="url(#tl-dep)"
                className={`tlg-dep ${selectedEdgeId === p.id ? 'is-selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  selectEdge(p.id)
                }}
              />
            ))}
            {today != null && (
              <line
                x1={TRACK_W + today * PERIOD_W}
                y1={HEADER_H}
                x2={TRACK_W + today * PERIOD_W}
                y2={totalHeight}
                stroke="#16a34a"
                strokeWidth={2}
                strokeDasharray="5 4"
              />
            )}
            <defs>
              <marker
                id="tl-dep"
                markerWidth="9"
                markerHeight="9"
                refX="7"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L7,3 L0,6 z" fill="#e11d48" />
              </marker>
            </defs>
          </svg>
          {today != null && (
            <div
              className="tlg-today-handle"
              style={{ left: TRACK_W + today * PERIOD_W - 7 }}
              onMouseDown={beginTodayDrag}
              title="拖动调整今天线"
            >
              今天
            </div>
          )}
        </div>
      </div>

      {linkMode && (
        <div className="rc-tip-bar">
          <ApiOutlined /> {linkFrom ? '再点击目标条目建立依赖' : '点击起始条目，再点击目标条目'}
        </div>
      )}
    </div>
  )
}
