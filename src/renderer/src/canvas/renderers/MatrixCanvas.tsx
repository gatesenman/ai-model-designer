import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Button, Input, Tooltip, type InputRef } from 'antd'
import { PlusOutlined, DeleteOutlined, HolderOutlined, EditOutlined, ArrowUpOutlined, ArrowDownOutlined, ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons'
import { useModelStore } from '../../store/modelStore'
import { useCanvasHotkeys } from '../useCanvasHotkeys'
import { useMatrixItemPointerDrag } from '../matrixPointerDrag'
import { moveMatrixItem } from '@shared/editOps'
import {
  canRemoveMatrixAxis,
  matrixAxisDeleteReason,
  moveMatrixCol,
  moveMatrixRow,
  removeMatrixCol,
  removeMatrixRow,
  renameMatrixCol,
  renameMatrixRow
} from '@shared/matrixAxis'
import { useMatrixAxisPointerDrag } from '../matrixAxisPointer'
import { getDiagramType } from '@shared/diagramCatalog'
import { getDiagramSchema } from '@shared/diagramSchema'
import type { DiagramNode, ModelDoc } from '@shared/types'

function tagPresetsFor(type?: string): string[] {
  if (type === 'raci') return ['', 'R', 'A', 'C', 'I']
  return ['', '高', '中', '低']
}
function tagColor(tag: string): string {
  switch (tag) {
    case 'R':
    case '高':
      return '#e11d48'
    case 'A':
    case '中':
      return '#16a34a'
    case 'C':
    case '低':
      return '#0891b2'
    case 'I':
      return '#7c3aed'
    default:
      return '#94a3b8'
  }
}

function ItemLabelEditor({
  value,
  onSubmit,
  onCancel
}: {
  value: string
  onSubmit: (next: string) => void
  onCancel: () => void
}): JSX.Element {
  const ref = useRef<InputRef>(null)
  const cancelled = useRef(false)
  const selectedOnce = useRef(false)
  const selectInitial = (el: HTMLInputElement): void => {
    if (selectedOnce.current) return
    selectedOnce.current = true
    const len = el.value.length
    el.setSelectionRange(0, len)
  }
  return (
    <Input
      ref={ref}
      size="small"
      autoFocus
      data-testid="mx-item-name-input"
      defaultValue={value}
      onFocus={(e) => selectInitial(e.currentTarget)}
      onPressEnter={(e) => {
        onSubmit((e.target as HTMLInputElement).value)
      }}
      onBlur={(e) => {
        if (!cancelled.current) onSubmit(e.target.value)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          cancelled.current = true
          onCancel()
        }
      }}
    />
  )
}

export default function MatrixCanvas() {
  const doc = useModelStore((s) => s.doc)
  const addNode = useModelStore((s) => s.addNode)
  const updateNode = useModelStore((s) => s.updateNode)
  const removeNode = useModelStore((s) => s.removeNode)
  const setDoc = useModelStore((s) => s.setDoc)
  const selectNode = useModelStore((s) => s.selectNode)
  const selectedNodeId = useModelStore((s) => s.selectedNodeId)

  const [editing, setEditing] = useState<string | null>(null)
  useCanvasHotkeys()

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'F2') return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
        return
      }
      if (!selectedNodeId) return
      e.preventDefault()
      setEditing(selectedNodeId)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedNodeId])
  const [dropHint, setDropHint] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const diagramName = getDiagramType(doc.diagramType)?.name ?? '矩阵图'
  const seed = useMemo(() => getDiagramSchema(doc.diagramType).layout ?? {}, [doc.diagramType])
  const rows: string[] = (doc.meta?.rows as string[]) ?? seed.rows ?? ['行 1', '行 2']
  const cols: string[] = (doc.meta?.cols as string[]) ?? seed.cols ?? ['列 1', '列 2']
  const singleCol = cols.length === 1
  const presets = tagPresetsFor(doc.diagramType)

  const cellItems = useMemo(() => {
    const m: Record<string, DiagramNode[]> = {}
    doc.nodes.forEach((n) => {
      const key = `${(n.props?.row as string) ?? ''}||${(n.props?.col as string) ?? ''}`
      if (!m[key]) m[key] = []
      m[key].push(n)
    })
    return m
  }, [doc.nodes])

  const applyDoc = (next: ModelDoc): void => {
    if (next !== useModelStore.getState().doc) setDoc(next)
  }
  const addRow = (): void =>
    applyDoc({
      ...useModelStore.getState().doc,
      meta: { ...(useModelStore.getState().doc.meta ?? {}), rows: [...rows, `行 ${rows.length + 1}`], cols }
    })
  const addCol = (): void =>
    applyDoc({
      ...useModelStore.getState().doc,
      meta: { ...(useModelStore.getState().doc.meta ?? {}), rows, cols: [...cols, `列 ${cols.length + 1}`] }
    })
  const renameRow = (i: number, v: string): void => applyDoc(renameMatrixRow(useModelStore.getState().doc, i, v))
  const renameCol = (i: number, v: string): void => applyDoc(renameMatrixCol(useModelStore.getState().doc, i, v))
  const removeRow = (i: number): void => {
    const res = removeMatrixRow(useModelStore.getState().doc, i)
    if (res.ok) applyDoc(res.doc)
  }
  const removeCol = (i: number): void => {
    const res = removeMatrixCol(useModelStore.getState().doc, i)
    if (res.ok) applyDoc(res.doc)
  }
  const moveRow = (from: number, to: number): void => applyDoc(moveMatrixRow(useModelStore.getState().doc, from, to))
  const moveCol = (from: number, to: number): void => applyDoc(moveMatrixCol(useModelStore.getState().doc, from, to))
  const onAxisKey = (e: React.KeyboardEvent, axis: 'row' | 'col', index: number, count: number): void => {
    if (e.target !== e.currentTarget) return
    const back = axis === 'col' ? e.key === 'ArrowLeft' : e.key === 'ArrowUp'
    const fwd = axis === 'col' ? e.key === 'ArrowRight' : e.key === 'ArrowDown'
    if (back && index > 0) {
      e.preventDefault()
      ;(axis === 'col' ? moveCol : moveRow)(index, index - 1)
    } else if (fwd && index < count - 1) {
      e.preventDefault()
      ;(axis === 'col' ? moveCol : moveRow)(index, index + 1)
    }
  }
  const addItem = (row: string, col: string): void => {
    addNode({ label: '新条目', props: { row, col, tag: '' }, position: { x: 0, y: 0 } })
  }
  const cycleTag = (it: DiagramNode): void => {
    const cur = (it.props?.tag as string) ?? ''
    const idx = presets.indexOf(cur)
    const nextTag = presets[(idx + 1) % presets.length]
    updateNode(it.id, { props: { ...it.props, tag: nextTag } })
  }

  const gridTemplate = singleCol ? '160px 1fr' : `160px repeat(${cols.length}, minmax(150px, 1fr))`

  const moveItem = (id: string, row: string, col: string): void => {
    const current = useModelStore.getState().doc
    const next = moveMatrixItem(current, id, row, col)
    if (next !== current) setDoc(next)
  }

  const { itemDragging, sourceId, ghost, ghostRef, onItemPointerDown } = useMatrixItemPointerDrag({
    canvasRef,
    onMoveItem: moveItem,
    onSelectItem: selectNode,
    onItemEdit: (id) => setEditing(id),
    setDropHint
  })
  const { axisDragging, onAxisPointerDown } = useMatrixAxisPointerDrag({
    canvasRef,
    onMoveAxis: (axis, from, to) => (axis === 'col' ? moveCol(from, to) : moveRow(from, to)),
    setDropHint
  })

  return (
    <div ref={canvasRef} className={`mx-canvas${itemDragging ? ' is-item-dragging' : ''}${axisDragging ? ' is-axis-dragging' : ''}`}>
      <div className="rc-toolbar">
        <span className="rc-toolbar__title">{diagramName}</span>
        <Button size="small" icon={<PlusOutlined />} onClick={addRow}>
          行
        </Button>
        {!singleCol && (
          <Button size="small" icon={<PlusOutlined />} onClick={addCol}>
            列
          </Button>
        )}
        <span className="rc-toolbar__hint">
          {rows.length} 行 × {cols.length} 列 · {doc.nodes.length} 条目 · 拖动手柄或点箭头可调整行列顺序
        </span>
      </div>

      <div className="mx-scroll">
        <div className="mx-grid" style={{ gridTemplateColumns: gridTemplate }}>
          {/* 表头 */}
          <div className="mx-corner" />
          {cols.map((c, ci) => (
              <div
                key={`col-${ci}`}
                className={`mx-colhead ${dropHint === `c${ci}` ? 'is-drop' : ''}`}
                data-mx-axis="col"
                data-mx-index={ci}
                data-testid={`mx-colhead-${ci}`}
                tabIndex={0}
                onKeyDown={(e) => onAxisKey(e, 'col', ci, cols.length)}
              >
                <span
                  className="mx-drag"
                  data-testid={`mx-col-handle-${ci}`}
                  title="拖动以调整列顺序"
                  style={{ minWidth: 22, minHeight: 28 }}
                  onPointerDown={(e) => onAxisPointerDown(e, 'col', ci)}
                >
                  <HolderOutlined />
                </span>
                <Input size="small" variant="borderless" value={c} onChange={(e) => renameCol(ci, e.target.value)} />
                <span className="mx-axis-actions">
                  <Tooltip title={ci === 0 ? '已经是第一列' : '左移此列'}>
                    <Button
                      type="text"
                      size="small"
                      icon={<ArrowLeftOutlined />}
                      disabled={ci === 0}
                      data-testid={`mx-col-up-${ci}`}
                      onClick={() => moveCol(ci, ci - 1)}
                    />
                  </Tooltip>
                  <Tooltip title={ci === cols.length - 1 ? '已经是最后一列' : '右移此列'}>
                    <Button
                      type="text"
                      size="small"
                      icon={<ArrowRightOutlined />}
                      disabled={ci === cols.length - 1}
                      data-testid={`mx-col-down-${ci}`}
                      onClick={() => moveCol(ci, ci + 1)}
                    />
                  </Tooltip>
                  <Tooltip title={matrixAxisDeleteReason('col', cols.length) ?? '删除列（该列条目会一并删除）'}>
                    <span className="mx-axis-action-wrap" data-testid={`mx-col-del-wrap-${ci}`}>
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        disabled={!canRemoveMatrixAxis(cols.length)}
                        data-testid={`mx-col-del-${ci}`}
                        onClick={() => removeCol(ci)}
                      />
                    </span>
                  </Tooltip>
                </span>
              </div>
            ))}

          {rows.map((r, ri) => (
            <MatrixRow
              key={`row-${ri}`}
              index={ri}
              row={r}
              cols={cols}
              cellItems={cellItems}
              editing={editing}
              setEditing={setEditing}
              dropHint={dropHint}
              onRenameRow={(v) => renameRow(ri, v)}
              onRemoveRow={() => removeRow(ri)}
              canRemoveRow={canRemoveMatrixAxis(rows.length)}
              rowDeleteReason={matrixAxisDeleteReason('row', rows.length)}
              onMoveRow={(to) => moveRow(ri, to)}
              canMoveUp={ri > 0}
              canMoveDown={ri < rows.length - 1}
              onAxisPointerDown={onAxisPointerDown}
              onAxisKey={(e) => onAxisKey(e, 'row', ri, rows.length)}
              onAddItem={addItem}
              onUpdateItem={(id, v) => updateNode(id, { label: v })}
              onRemoveItem={removeNode}
              onCycleTag={cycleTag}
              selectedId={selectedNodeId}
              sourceId={sourceId}
              onSelectItem={selectNode}
              onItemPointerDown={onItemPointerDown}
            />
          ))}
        </div>
      </div>

      {ghost ? (
        <div
          ref={ghostRef}
          className="mx-item-ghost"
          style={{ left: ghost.x + 8, top: ghost.y + 8 }}
          aria-hidden
        >
          {ghost.label}
        </div>
      ) : null}
    </div>
  )
}

interface RowProps {
  index: number
  row: string
  cols: string[]
  cellItems: Record<string, DiagramNode[]>
  editing: string | null
  setEditing: (id: string | null) => void
  dropHint: string | null
  onRenameRow: (v: string) => void
  onRemoveRow: () => void
  canRemoveRow: boolean
  rowDeleteReason: string | null
  onMoveRow: (to: number) => void
  canMoveUp: boolean
  canMoveDown: boolean
  onAxisPointerDown: (e: ReactPointerEvent<HTMLElement>, axis: 'row' | 'col', index: number) => void
  onAxisKey: (e: React.KeyboardEvent) => void
  onAddItem: (row: string, col: string) => void
  onUpdateItem: (id: string, v: string) => void
  onRemoveItem: (id: string) => void
  onCycleTag: (it: DiagramNode) => void
  selectedId: string | null
  sourceId: string | null
  onSelectItem: (id: string) => void
  onItemPointerDown: (e: ReactPointerEvent<HTMLElement>, item: { id: string; label: string }) => void
}

function MatrixRow({
  index,
  row,
  cols,
  cellItems,
  editing,
  setEditing,
  dropHint,
  onRenameRow,
  onRemoveRow,
  canRemoveRow,
  rowDeleteReason,
  onMoveRow,
  canMoveUp,
  canMoveDown,
  onAxisPointerDown,
  onAxisKey,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onCycleTag,
  selectedId,
  sourceId,
  onSelectItem,
  onItemPointerDown
}: RowProps) {
  return (
    <>
      <div
        className={`mx-rowhead ${dropHint === `r${index}` ? 'is-drop' : ''}`}
        data-mx-axis="row"
        data-mx-index={index}
        data-testid={`mx-rowhead-${index}`}
        tabIndex={0}
        onKeyDown={onAxisKey}
      >
        <span
          className="mx-drag"
          data-testid={`mx-row-handle-${index}`}
          style={{ minWidth: 22, minHeight: 28 }}
          title="拖动以调整行顺序"
          onPointerDown={(e) => onAxisPointerDown(e, 'row', index)}
        >
          <HolderOutlined />
        </span>
        <Input size="small" variant="borderless" value={row} onChange={(e) => onRenameRow(e.target.value)} />
        <span className="mx-axis-actions">
          <Tooltip title={canMoveUp ? '上移此行' : '已经是第一行'}>
            <Button
              type="text"
              size="small"
              icon={<ArrowUpOutlined />}
              disabled={!canMoveUp}
              data-testid={`mx-row-up-${index}`}
              onClick={() => onMoveRow(index - 1)}
            />
          </Tooltip>
          <Tooltip title={canMoveDown ? '下移此行' : '已经是最后一行'}>
            <Button
              type="text"
              size="small"
              icon={<ArrowDownOutlined />}
              disabled={!canMoveDown}
              data-testid={`mx-row-down-${index}`}
              onClick={() => onMoveRow(index + 1)}
            />
          </Tooltip>
          <Tooltip title={rowDeleteReason ?? '删除行（该行条目会一并删除）'}>
            <span className="mx-axis-action-wrap" data-testid={`mx-row-del-wrap-${index}`}>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={!canRemoveRow}
                data-testid={`mx-row-del-${index}`}
                onClick={onRemoveRow}
              />
            </span>
          </Tooltip>
        </span>
      </div>
      {cols.map((c, ci) => {
        const items = cellItems[`${row}||${c}`] ?? []
        const hintKey = `cell:${row}||${c}`
        return (
          <div
            key={`cell-${ci}`}
            className={`mx-cell ${dropHint === hintKey ? 'is-drop' : ''}`}
            data-row={row}
            data-col={c}
          >
            {items.map((it) => {
              const tag = (it.props?.tag as string) ?? ''
              return (
                <div
                  key={it.id}
                  className={`mx-item${selectedId === it.id ? ' is-selected' : ''}${sourceId === it.id ? ' is-dragging-source' : ''}`}
                  data-item-id={it.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectItem(it.id)
                  }}
                  onDoubleClick={(e) => {
                    if ((e.target as HTMLElement).closest('button, input')) return
                    e.stopPropagation()
                    setEditing(it.id)
                  }}
                  onPointerDown={(e) => onItemPointerDown(e, { id: it.id, label: it.label })}
                >
                  <Tooltip title="点击切换标记">
                    <button
                      className="mx-item__tag"
                      style={{ background: tag ? tagColor(tag) : 'transparent', borderColor: tagColor(tag) }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onCycleTag(it)
                      }}
                    >
                      {tag || '·'}
                    </button>
                  </Tooltip>
                  {editing === it.id ? (
                    <ItemLabelEditor
                      value={it.label}
                      onSubmit={(next) => {
                        onUpdateItem(it.id, next)
                        setEditing(null)
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <>
                      <span
                        className="mx-item__label"
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          setEditing(it.id)
                        }}
                      >
                        {it.label}
                      </span>
                      {selectedId === it.id ? (
                        <button
                          type="button"
                          className="mx-item__edit"
                          data-testid="mx-item-rename"
                          title="重命名（F2）"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditing(it.id)
                          }}
                        >
                          <EditOutlined />
                        </button>
                      ) : null}
                      <button
                        className="mx-item__del"
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveItem(it.id)
                        }}
                        title="删除"
                      >
                        <DeleteOutlined />
                      </button>
                    </>
                  )}
                </div>
              )
            })}
            <button className="mx-cell__add" onClick={() => onAddItem(row, c)}>
              <PlusOutlined /> 添加
            </button>
          </div>
        )
      })}
    </>
  )
}
