import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

/** 超过该像素距离才进入拖动，避免普通点击/双击被当成拖拽。 */
export const MATRIX_DRAG_THRESHOLD = 6

/** 两次无拖动的 pointerup 间隔内视为双击改名。 */
export const MATRIX_DOUBLE_CLICK_MS = 500

export function isInteractiveMatrixTarget(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null
  if (!el) return false
  return !!el.closest('button, input, textarea, select, a, .ant-input, .mx-item__tag, .mx-item__del, .mx-item__edit')
}

export function exceededDragThreshold(dx: number, dy: number, threshold = MATRIX_DRAG_THRESHOLD): boolean {
  return Math.hypot(dx, dy) >= threshold
}

export interface MatrixCellHit {
  row: string
  col: string
  el: HTMLElement
}

/**
 * 用指针坐标命中矩阵格。从 elementFromPoint 的真实节点向上查找带 data-row/data-col 的 .mx-cell，
 * 这样落在「+ 添加」按钮或条目上也一样。可选 ignore 用于排除跟随光标的幽灵节点。
 */
export function findMatrixCellAt(
  clientX: number,
  clientY: number,
  options?: { root?: Element | null; ignore?: Element | null }
): MatrixCellHit | null {
  const ignore = options?.ignore instanceof HTMLElement ? options.ignore : null
  const prev = ignore?.style.pointerEvents
  if (ignore) ignore.style.pointerEvents = 'none'
  let node: Element | null = null
  try {
    node = document.elementFromPoint(clientX, clientY)
  } finally {
    if (ignore) ignore.style.pointerEvents = prev ?? ''
  }
  const cell = node?.closest?.('.mx-cell') as HTMLElement | null
  if (!cell) return null
  if (options?.root && !options.root.contains(cell)) return null
  const row = cell.getAttribute('data-row') ?? ''
  const col = cell.getAttribute('data-col') ?? ''
  if (!row || !col) return null
  return { row, col, el: cell }
}

export interface MatrixGhost {
  label: string
  x: number
  y: number
}

interface DragSession {
  pointerId: number
  itemId: string
  label: string
  startX: number
  startY: number
  dragging: boolean
  capturedEl: HTMLElement | null
}

interface HookArgs {
  canvasRef: RefObject<HTMLElement | null>
  onMoveItem: (id: string, row: string, col: string) => void
  onSelectItem: (id: string) => void
  onItemEdit?: (id: string) => void
  setDropHint: (hint: string | null) => void
}

export function useMatrixItemPointerDrag({ canvasRef, onMoveItem, onSelectItem, onItemEdit, setDropHint }: HookArgs): {
  itemDragging: boolean
  sourceId: string | null
  ghost: MatrixGhost | null
  ghostRef: (el: HTMLElement | null) => void
  onItemPointerDown: (e: ReactPointerEvent<HTMLElement>, item: { id: string; label: string }) => void
} {
  const sessionRef = useRef<DragSession | null>(null)
  const ghostElRef = useRef<HTMLElement | null>(null)
  const lastHintRef = useRef<string | null>(null)
  const [itemDragging, setItemDragging] = useState(false)
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [ghost, setGhost] = useState<MatrixGhost | null>(null)
  const moveItemRef = useRef(onMoveItem)
  const selectItemRef = useRef(onSelectItem)
  const editItemRef = useRef(onItemEdit)
  const setHintRef = useRef(setDropHint)
  const lastTapRef = useRef<{ id: string; time: number } | null>(null)
  moveItemRef.current = onMoveItem
  selectItemRef.current = onSelectItem
  editItemRef.current = onItemEdit
  setHintRef.current = setDropHint

  const detachRef = useRef<(() => void) | null>(null)

  const finish = useCallback((clientX: number, clientY: number, cancelled: boolean): void => {
    const session = sessionRef.current
    sessionRef.current = null
    detachRef.current?.()
    detachRef.current = null
    if (session?.capturedEl) {
      try {
        if (session.capturedEl.hasPointerCapture?.(session.pointerId)) {
          session.capturedEl.releasePointerCapture(session.pointerId)
        }
      } catch {
        /* jsdom / 已释放 */
      }
    }
    if (session?.dragging && !cancelled) {
      const hit = findMatrixCellAt(clientX, clientY, {
        root: canvasRef.current,
        ignore: ghostElRef.current
      })
      if (hit) moveItemRef.current(session.itemId, hit.row, hit.col)
    }
    lastHintRef.current = null
    setItemDragging(false)
    setSourceId(null)
    setGhost(null)
    setHintRef.current(null)
  }, [canvasRef])

  const onPointerMove = useCallback(
    (e: PointerEvent): void => {
      const session = sessionRef.current
      if (!session || e.pointerId !== session.pointerId) return
      const dx = e.clientX - session.startX
      const dy = e.clientY - session.startY
      if (!session.dragging) {
        if (!exceededDragThreshold(dx, dy)) return
        session.dragging = true
        lastTapRef.current = null
        document.getSelection()?.removeAllRanges()
        try {
          session.capturedEl?.setPointerCapture(session.pointerId)
        } catch {
          /* jsdom 或该元素已卸下，window 监听仍能继续 */
        }
        setItemDragging(true)
        setSourceId(session.itemId)
        setGhost({ label: session.label, x: e.clientX, y: e.clientY })
      } else {
        e.preventDefault()
        const node = ghostElRef.current
        if (node) {
          node.style.left = `${e.clientX + 8}px`
          node.style.top = `${e.clientY + 8}px`
        }
      }
      const hit = findMatrixCellAt(e.clientX, e.clientY, {
        root: canvasRef.current,
        ignore: ghostElRef.current
      })
      const hint = hit ? `cell:${hit.row}||${hit.col}` : null
      if (lastHintRef.current !== hint) {
        lastHintRef.current = hint
        setHintRef.current(hint)
      }
    },
    [canvasRef]
  )

  const onPointerUp = useCallback(
    (e: PointerEvent): void => {
      const session = sessionRef.current
      if (!session || e.pointerId !== session.pointerId) return
      if (session.dragging) {
        e.preventDefault()
        suppressNextClick()
        lastTapRef.current = null
        finish(e.clientX, e.clientY, false)
        return
      }
      const now = Date.now()
      const prev = lastTapRef.current
      const isDouble = !!prev && prev.id === session.itemId && now - prev.time <= MATRIX_DOUBLE_CLICK_MS
      lastTapRef.current = isDouble ? null : { id: session.itemId, time: now }
      const editId = isDouble ? session.itemId : null
      finish(e.clientX, e.clientY, false)
      // 等 click/dblclick 完成后再挂载输入框，避免第二下 pointerup 后的事件立刻抢走焦点。
      if (editId) window.setTimeout(() => editItemRef.current?.(editId), 0)
    },
    [finish]
  )

  const onPointerCancel = useCallback(
    (e: PointerEvent): void => {
      const session = sessionRef.current
      if (!session || e.pointerId !== session.pointerId) return
      finish(e.clientX, e.clientY, true)
    },
    [finish]
  )

  const attach = useCallback((): void => {
    detachRef.current?.()
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    detachRef.current = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [onPointerMove, onPointerUp, onPointerCancel])

  useEffect(() => {
    return () => {
      detachRef.current?.()
      detachRef.current = null
      sessionRef.current = null
    }
  }, [])

  const onItemPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>, item: { id: string; label: string }): void => {
      if (e.button !== 0) return
      if (isInteractiveMatrixTarget(e.target)) return
      if (e.pointerType === 'mouse' && e.buttons !== 1) return
      e.stopPropagation()
      // 不要在 pointerdown 时 setPointerCapture：捕获会把兼容鼠标事件（含 dblclick）
      // 派到条目容器而不是标签，导致双击改名丢失。真正越过拖动阈值后再捕获。
      selectItemRef.current(item.id)
      const el = e.currentTarget
      sessionRef.current = {
        pointerId: e.pointerId,
        itemId: item.id,
        label: item.label,
        startX: e.clientX,
        startY: e.clientY,
        dragging: false,
        capturedEl: el
      }
      attach()
    },
    [attach]
  )

  const ghostRef = useCallback((el: HTMLElement | null): void => {
    ghostElRef.current = el
  }, [])

  return { itemDragging, sourceId, ghost, ghostRef, onItemPointerDown }
}

let clickGuard: { block: (ev: Event) => void; timer: number } | null = null

/** 拖动结束后只抑制落在「+ 添加」上的残余 click，避免误新增；不拦截改名/删除等按钮。 */
export function suppressNextClick(ms = 250): void {
  clearClickSuppression()
  const block = (ev: Event): void => {
    const t = ev.target as HTMLElement | null
    if (!t?.closest?.('.mx-cell__add')) return
    ev.preventDefault()
    ev.stopPropagation()
    if ('stopImmediatePropagation' in ev) ev.stopImmediatePropagation()
  }
  const opts: AddEventListenerOptions = { capture: true }
  document.addEventListener('click', block, opts)
  const timer = window.setTimeout(() => {
    document.removeEventListener('click', block, opts)
    if (clickGuard?.block === block) clickGuard = null
  }, ms)
  clickGuard = { block, timer }
}

export function clearClickSuppression(): void {
  if (!clickGuard) return
  document.removeEventListener('click', clickGuard.block, { capture: true })
  window.clearTimeout(clickGuard.timer)
  clickGuard = null
}
