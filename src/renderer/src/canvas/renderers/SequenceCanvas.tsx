import { useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Button, Input, Select, Tooltip, Empty, Dropdown } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  UserOutlined,
  GroupOutlined
} from '@ant-design/icons'
import { useModelStore } from '../../store/modelStore'
import { useCanvasHotkeys } from '../useCanvasHotkeys'
import { getDiagramType } from '@shared/diagramCatalog'
import type { DiagramEdge } from '@shared/types'
import {
  activationBand,
  addActivation,
  resolveActivations,
  restoreAutoActivations
} from '@shared/sequenceActivations'
import SequenceActivationList from '../SequenceActivationList'

const COL_W = 170
const MARGIN_X = 40
const HEAD_H = 54
const MSG_TOP = 130
const MSG_H = 56
const ACT_W = 12

type MsgKind = 'sync' | 'async' | 'reply'

const MSG_LABEL: Record<MsgKind, string> = {
  sync: '同步消息',
  async: '异步消息',
  reply: '返回消息'
}

type FragKind = 'alt' | 'opt' | 'loop' | 'par' | 'break'

const FRAG_LABEL: Record<FragKind, string> = {
  alt: 'alt 条件',
  opt: 'opt 可选',
  loop: 'loop 循环',
  par: 'par 并行',
  break: 'break 中断'
}

interface Fragment {
  id: string
  kind: FragKind
  label: string
  from: number
  to: number
}

function msgKindOf(e: DiagramEdge): MsgKind {
  const k = e.edgeKind as MsgKind
  return k === 'async' || k === 'reply' ? k : 'sync'
}

let fragSeq = 0
function newFragId(): string {
  fragSeq += 1
  return `frag-${Date.now()}-${fragSeq}`
}

export default function SequenceCanvas() {
  const doc = useModelStore((s) => s.doc)
  const addNode = useModelStore((s) => s.addNode)
  const updateNode = useModelStore((s) => s.updateNode)
  const removeNode = useModelStore((s) => s.removeNode)
  const setNodes = useModelStore((s) => s.setNodes)
  const setDoc = useModelStore((s) => s.setDoc)
  const addEdge = useModelStore((s) => s.addEdge)
  const updateEdge = useModelStore((s) => s.updateEdge)
  const removeEdge = useModelStore((s) => s.removeEdge)
  const selectNode = useModelStore((s) => s.selectNode)
  const selectEdge = useModelStore((s) => s.selectEdge)
  const clearSelection = useModelStore((s) => s.clearSelection)
  const selectedNodeId = useModelStore((s) => s.selectedNodeId)
  const selectedEdgeId = useModelStore((s) => s.selectedEdgeId)
  const selectedActivationId = useModelStore((s) => s.selectedActivationId)
  const selectActivation = useModelStore((s) => s.selectActivation)

  const [editing, setEditing] = useState<string | null>(null)
  useCanvasHotkeys()

  const participants = doc.nodes
  const messages = doc.edges
  const diagramName = getDiagramType(doc.diagramType)?.name ?? '时序图'

  const fragments = useMemo<Fragment[]>(
    () => (Array.isArray(doc.meta?.fragments) ? (doc.meta?.fragments as Fragment[]) : []),
    [doc.meta]
  )

  const setFragments = (next: Fragment[]): void => {
    setDoc({ ...doc, meta: { ...(doc.meta ?? {}), fragments: next } })
  }

  const indexOf = useMemo(() => {
    const m: Record<string, number> = {}
    participants.forEach((p, i) => (m[p.id] = i))
    return m
  }, [participants])

  const laneX = (id: string): number => MARGIN_X + (indexOf[id] ?? 0) * COL_W + COL_W / 2
  const width = Math.max(participants.length * COL_W + MARGIN_X * 2, 480)
  const height = Math.max(MSG_TOP + messages.length * MSG_H + 80, 360)

  const addParticipant = (): void => {
    const n = participants.length
    addNode({
      label: `参与者${n + 1}`,
      category: 'actor',
      position: { x: MARGIN_X + n * COL_W, y: 0 }
    })
  }

  const moveParticipant = (id: string, dir: -1 | 1): void => {
    const i = indexOf[id]
    const j = i + dir
    if (j < 0 || j >= participants.length) return
    const next = [...participants]
    ;[next[i], next[j]] = [next[j], next[i]]
    setNodes(next.map((p, idx) => ({ ...p, position: { x: MARGIN_X + idx * COL_W, y: 0 } })))
  }

  const addMessage = (): void => {
    if (participants.length < 1) return
    const a = participants[0].id
    const b = participants[Math.min(1, participants.length - 1)].id
    addEdge(a, b, 'association')
  }

  const moveMessage = (id: string, dir: -1 | 1): void => {
    const i = messages.findIndex((m) => m.id === id)
    const j = i + dir
    if (j < 0 || j >= messages.length) return
    const next = [...messages]
    ;[next[i], next[j]] = [next[j], next[i]]
    setDoc({ ...doc, edges: next })
  }

  const addFragment = (kind: FragKind): void => {
    if (messages.length === 0) return
    setFragments([
      ...fragments,
      { id: newFragId(), kind, label: kind === 'loop' ? '条件成立' : '条件', from: 0, to: messages.length - 1 }
    ])
  }

  const updateFragment = (id: string, patch: Partial<Fragment>): void => {
    setFragments(fragments.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  const removeFragment = (id: string): void => {
    setFragments(fragments.filter((f) => f.id !== id))
  }

  const resolved = useMemo(() => resolveActivations(doc), [doc])
  const activationMode = resolved.mode
  const activations = useMemo(
    () =>
      resolved.activations.map((a) => {
        const band = activationBand(a.from, a.to, MSG_TOP, MSG_H)
        return {
          ...a,
          x: laneX(a.participantId) - ACT_W / 2,
          y: band.y,
          h: band.h
        }
      }),
    [resolved, indexOf]
  )

  const addManualActivation = (): void => {
    if (participants.length === 0) return
    const current = useModelStore.getState().doc
    const sourceId = selectedNodeId ?? selectedActivationId
    const participantId =
      (sourceId && current.nodes.some((n) => n.id === sourceId) ? sourceId : null) ??
      (resolved.activations.find((a) => a.id === selectedActivationId)?.participantId) ??
      current.nodes[0]?.id
    setDoc(addActivation(current, { participantId }))
  }

  return (
    <div className="seq-canvas">
      <div className="rc-toolbar">
        <span className="rc-toolbar__title">{diagramName}</span>
        <Button size="small" icon={<PlusOutlined />} onClick={addParticipant}>
          参与者
        </Button>
        <Button
          size="small"
          icon={<PlusOutlined />}
          onClick={addMessage}
          disabled={participants.length === 0}
        >
          消息
        </Button>
        <Dropdown
          disabled={messages.length === 0}
          menu={{
            items: (Object.keys(FRAG_LABEL) as FragKind[]).map((k) => ({
              key: k,
              label: FRAG_LABEL[k],
              onClick: () => addFragment(k)
            }))
          }}
        >
          <Button size="small" icon={<GroupOutlined />} disabled={messages.length === 0}>
            组合片段
          </Button>
        </Dropdown>
        <Button
          size="small"
          icon={<PlusOutlined />}
          onClick={addManualActivation}
          disabled={participants.length === 0}
          data-testid="seq-add-activation"
        >
          激活条
        </Button>
        {activationMode === 'manual' && (
          <Button
            size="small"
            onClick={() => setDoc(restoreAutoActivations(useModelStore.getState().doc))}
            data-testid="seq-restore-auto"
          >
            恢复自动激活条
          </Button>
        )}
        <span className="rc-toolbar__hint">
          参与者 {participants.length} · 消息 {messages.length} · 片段 {fragments.length}
          <span className="seq-toolbar-mode">
            {activationMode === 'manual' ? '激活条：手动（可独立编辑）' : '激活条：自动（随消息生成，添加或编辑后转为手动）'}
          </span>
        </span>
      </div>
      <SequenceActivationList />

      <div className="seq-scroll">
        {participants.length === 0 ? (
          <div className="rc-empty">
            <Empty description="暂无参与者，点击上方「+ 参与者」开始绘制时序图" />
          </div>
        ) : (
          <div
            className="seq-stage"
            style={{ width, height }}
            onClick={(e) => {
              if (e.target === e.currentTarget) clearSelection()
            }}
            onContextMenu={(e) => {
              if (e.target === e.currentTarget) {
                e.preventDefault()
                clearSelection()
              }
            }}
          >
            {/* 组合片段边框（在生命线之下） */}
            {fragments.map((f, fi) => {
              const from = Math.max(0, Math.min(f.from, messages.length - 1))
              const to = Math.max(from, Math.min(f.to, messages.length - 1))
              const involved = messages.slice(from, to + 1)
              const xs = involved.flatMap((m) => [laneX(m.source), laneX(m.target)])
              const minX = (xs.length ? Math.min(...xs) : MARGIN_X) - 34
              const maxX = (xs.length ? Math.max(...xs) : width) + 34
              const top = MSG_TOP + from * MSG_H - 40
              const bottom = MSG_TOP + to * MSG_H + 24
              return (
                <div
                  key={f.id}
                  className="seq-frag"
                  style={{
                    left: Math.max(8, minX),
                    top,
                    width: Math.min(width - 16, maxX) - Math.max(8, minX),
                    height: bottom - top,
                    zIndex: 1 + fi
                  }}
                >
                  <div className="seq-frag__tab">
                    <Select
                      size="small"
                      variant="borderless"
                      value={f.kind}
                      popupMatchSelectWidth={false}
                      onChange={(v) => updateFragment(f.id, { kind: v })}
                      options={(Object.keys(FRAG_LABEL) as FragKind[]).map((k) => ({
                        value: k,
                        label: k
                      }))}
                    />
                  </div>
                  <div className="seq-frag__guard">
                    [
                    <Input
                      size="small"
                      variant="borderless"
                      value={f.label}
                      onChange={(e) => updateFragment(f.id, { label: e.target.value })}
                    />
                    ]
                  </div>
                  <div className="seq-frag__ops">
                    <Tooltip title="缩小范围（下边界上移）">
                      <Button
                        type="text"
                        size="small"
                        icon={<ArrowUpOutlined />}
                        onClick={() => updateFragment(f.id, { to: Math.max(from, to - 1) })}
                      />
                    </Tooltip>
                    <Tooltip title="扩大范围（下边界下移）">
                      <Button
                        type="text"
                        size="small"
                        icon={<ArrowDownOutlined />}
                        onClick={() =>
                          updateFragment(f.id, { to: Math.min(messages.length - 1, to + 1) })
                        }
                      />
                    </Tooltip>
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeFragment(f.id)}
                    />
                  </div>
                </div>
              )
            })}

            {/* 生命线 + 激活条 + 消息 */}
            <svg className="seq-svg" width={width} height={height} style={{ pointerEvents: 'none' }}>
              {participants.map((p) => (
                <line
                  key={`ll-${p.id}`}
                  x1={laneX(p.id)}
                  y1={HEAD_H}
                  x2={laneX(p.id)}
                  y2={height - 20}
                  stroke="#c7ccd6"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                />
              ))}
              {activations.map((a) => {
                const selectBar = (e: ReactMouseEvent): void => {
                  e.stopPropagation()
                  e.preventDefault()
                  selectActivation(a.id)
                }
                return (
                  <g
                    key={`act-${a.id}`}
                    data-testid={`seq-activation-${a.id}`}
                    className={`seq-activation-group${selectedActivationId === a.id ? ' is-selected' : ''}`}
                    style={{ pointerEvents: 'auto' }}
                    onClick={selectBar}
                    onDoubleClick={selectBar}
                    onPointerDown={(e) => e.stopPropagation()}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      selectActivation(a.id)
                    }}
                  >
                    <rect
                      className="seq-activation-hit"
                      x={a.x - 8}
                      y={a.y - 4}
                      width={ACT_W + 16}
                      height={a.h + 8}
                    />
                    <rect
                      x={a.x}
                      y={a.y}
                      width={ACT_W}
                      height={a.h}
                      rx={2}
                      className={`seq-activation${selectedActivationId === a.id ? ' is-selected' : ''}`}
                    />
                  </g>
                )
              })}
              {messages.map((m, i) => {
                const x1 = laneX(m.source)
                const x2 = laneX(m.target)
                const y = MSG_TOP + i * MSG_H
                const kind = msgKindOf(m)
                const self = m.source === m.target
                const dash = kind === 'async' || kind === 'reply' ? '6 4' : undefined
                const color = kind === 'reply' ? '#8a93a6' : '#4f6ef7'
                const marker = kind === 'reply' ? 'url(#seq-arrow-open)' : 'url(#seq-arrow)'
                if (self) {
                  const x = x1
                  return (
                    <g key={`msg-${m.id}`}>
                      <path
                        d={`M ${x} ${y} h 46 v 22 h -46`}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.6}
                        strokeDasharray={dash}
                        markerEnd={marker}
                      />
                    </g>
                  )
                }
                const dir = x2 >= x1 ? 1 : -1
                const off = dir * (ACT_W / 2)
                return (
                  <g key={`msg-${m.id}`}>
                    <line
                      x1={x1 + (kind === 'reply' ? 0 : off)}
                      y1={y}
                      x2={x2 - dir * 7 - off}
                      y2={y}
                      stroke={color}
                      strokeWidth={1.6}
                      strokeDasharray={dash}
                      markerEnd={marker}
                    />
                  </g>
                )
              })}
              <defs>
                <marker
                  id="seq-arrow"
                  markerWidth="10"
                  markerHeight="10"
                  refX="8"
                  refY="3"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L8,3 L0,6 z" fill="#4f6ef7" />
                </marker>
                <marker
                  id="seq-arrow-open"
                  markerWidth="12"
                  markerHeight="12"
                  refX="8"
                  refY="4"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L8,4 L0,8" fill="none" stroke="#8a93a6" strokeWidth="1.4" />
                </marker>
              </defs>
            </svg>

            {/* 参与者头 */}
            {participants.map((p) => (
              <div
                key={p.id}
                className={`seq-head ${selectedNodeId === p.id ? 'is-selected' : ''}`}
                style={{ left: laneX(p.id) - COL_W / 2 + 15, width: COL_W - 30 }}
                onClick={(e) => {
                  e.stopPropagation()
                  selectNode(p.id)
                }}
              >
                <span className="seq-head__icon">
                  <UserOutlined />
                </span>
                {editing === p.id ? (
                  <Input
                    size="small"
                    autoFocus
                    defaultValue={p.label}
                    onPressEnter={(e) => {
                      updateNode(p.id, { label: (e.target as HTMLInputElement).value })
                      setEditing(null)
                    }}
                    onBlur={(e) => {
                      updateNode(p.id, { label: e.target.value })
                      setEditing(null)
                    }}
                  />
                ) : (
                  <span
                    className="seq-head__label"
                    onDoubleClick={() => setEditing(p.id)}
                    title="双击重命名"
                  >
                    {p.label}
                  </span>
                )}
                <span className="seq-head__ops">
                  <Tooltip title="左移">
                    <Button
                      type="text"
                      size="small"
                      icon={<ArrowUpOutlined rotate={-90} />}
                      onClick={() => moveParticipant(p.id, -1)}
                    />
                  </Tooltip>
                  <Tooltip title="右移">
                    <Button
                      type="text"
                      size="small"
                      icon={<ArrowDownOutlined rotate={-90} />}
                      onClick={() => moveParticipant(p.id, 1)}
                    />
                  </Tooltip>
                  <Tooltip title="删除">
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeNode(p.id)}
                    />
                  </Tooltip>
                </span>
              </div>
            ))}

            {/* 消息标签与编辑控件 */}
            {messages.map((m, i) => {
              const y = MSG_TOP + i * MSG_H
              const x1 = laneX(m.source)
              const x2 = laneX(m.target)
              const midX = m.source === m.target ? x1 + 50 : (x1 + x2) / 2
              return (
                <div
                  key={`lbl-${m.id}`}
                  className={`seq-msg-label ${selectedEdgeId === m.id ? 'is-selected' : ''}`}
                  style={{ top: y - 30, left: midX - 90 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    selectEdge(m.id)
                  }}
                >
                  <Input
                    size="small"
                    className="seq-msg-input"
                    value={m.label ?? ''}
                    placeholder="消息内容"
                    onChange={(e) => updateEdge(m.id, { label: e.target.value })}
                  />
                  <div className="seq-msg-ctrl">
                    <Select
                      size="small"
                      value={m.source}
                      popupMatchSelectWidth={false}
                      onChange={(v) => updateEdge(m.id, { source: v })}
                      options={participants.map((p) => ({ value: p.id, label: p.label }))}
                    />
                    <span className="seq-msg-arrow">→</span>
                    <Select
                      size="small"
                      value={m.target}
                      popupMatchSelectWidth={false}
                      onChange={(v) => updateEdge(m.id, { target: v })}
                      options={participants.map((p) => ({ value: p.id, label: p.label }))}
                    />
                    <Select
                      size="small"
                      value={msgKindOf(m)}
                      popupMatchSelectWidth={false}
                      onChange={(v) => updateEdge(m.id, { edgeKind: v })}
                      options={(['sync', 'async', 'reply'] as MsgKind[]).map((k) => ({
                        value: k,
                        label: MSG_LABEL[k]
                      }))}
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<ArrowUpOutlined />}
                      onClick={() => moveMessage(m.id, -1)}
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<ArrowDownOutlined />}
                      onClick={() => moveMessage(m.id, 1)}
                    />
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeEdge(m.id)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
