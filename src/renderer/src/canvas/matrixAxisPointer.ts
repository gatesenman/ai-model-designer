import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { exceededDragThreshold, isInteractiveMatrixTarget, MATRIX_DRAG_THRESHOLD } from './matrixPointerDrag'

export type MatrixAxis = 'row' | 'col'

export interface MatrixAxisHit {
  axis: MatrixAxis
  index: number
  el: HTMLElement
}

export function findMatrixAxisAt(
  clientX: number,
  clientY: number,
  axis: MatrixAxis,
  options?: { root?: Element | null; ignore?: Element | null }
): MatrixAxisHit | null {
  const ignore = options?.ignore instanceof HTMLElement ? options.ignore : null
  const prev = ignore?.style.pointerEvents
  if (ignore) ignore.style.pointerEvents = 'none'
  let node: Element | null = null
  try {
    node = document.elementFromPoint(clientX, clientY)
  } finally {
    if (ignore) ignore.style.pointerEvents = prev ?? ''
  }
  const el = node?.closest?.(`[data-mx-axis="${axis}"]`) as HTMLElement | null
  if (!el) return null
  if (options?.root && !options.root.contains(el)) return null
  const raw = el.getAttribute('data-mx-index')
  if (raw == null || raw === '') return null
  const index = Number(raw)
  if (!Number.isFinite(index)) return null
  return { axis, index, el }
}

interface Session {
  pointerId: number
  axis: MatrixAxis
  from: number
  startX: number
  startY: number
  dragging: boolean
  capturedEl: HTMLElement | null
}

interface HookArgs {
  canvasRef: RefObject<HTMLElement | null>
  onMoveAxis: (axis: MatrixAxis, from: number, to: number) => void
  setDropHint: (hint: string | null) => void
}

export function useMatrixAxisPointerDrag({ canvasRef, onMoveAxis, setDropHint }: HookArgs): {
  axisDragging: boolean
  onAxisPointerDown: (e: ReactPointerEvent<HTMLElement>, axis: MatrixAxis, index: number) => void
} {
  const sessionRef = useRef<Session | null>(null)
  const [axisDragging, setAxisDragging] = useState(false)

  const finish = useCallback(
    (clientX: number, clientY: number, cancelled: boolean): void => {
      const session = sessionRef.current
      sessionRef.current = null
      setAxisDragging(false)
      setDropHint(null)
      if (session?.capturedEl) {
        try {
          session.capturedEl.releasePointerCapture(session.pointerId)
        } catch {
          /* already released */
        }
      }
      if (!session?.dragging || cancelled) return
      const hit = findMatrixAxisAt(clientX, clientY, session.axis, { root: canvasRef.current })
      if (hit) onMoveAxis(session.axis, session.from, hit.index)
    },
    [canvasRef, onMoveAxis, setDropHint]
  )

  useEffect(() => {
    const onMove = (e: PointerEvent): void => {
      const session = sessionRef.current
      if (!session || e.pointerId !== session.pointerId) return
      if (!session.dragging) {
        if (!exceededDragThreshold(e.clientX - session.startX, e.clientY - session.startY)) return
        session.dragging = true
        setAxisDragging(true)
        const el = session.capturedEl
        if (el) {
          try {
            el.setPointerCapture(session.pointerId)
          } catch {
            /* ignore */
          }
        }
      }
      const hit = findMatrixAxisAt(e.clientX, e.clientY, session.axis, { root: canvasRef.current })
      if (hit) setDropHint(session.axis === 'col' ? `c${hit.index}` : `r${hit.index}`)
      else setDropHint(null)
    }
    const onUp = (e: PointerEvent): void => {
      const session = sessionRef.current
      if (!session || e.pointerId !== session.pointerId) return
      finish(e.clientX, e.clientY, false)
    }
    const onCancel = (e: PointerEvent): void => {
      const session = sessionRef.current
      if (!session || e.pointerId !== session.pointerId) return
      finish(e.clientX, e.clientY, true)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [canvasRef, finish])

  const onAxisPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>, axis: MatrixAxis, index: number): void => {
    if (e.button !== 0) return
    if (isInteractiveMatrixTarget(e.target)) return
    e.preventDefault()
    e.stopPropagation()
    sessionRef.current = {
      pointerId: e.pointerId,
      axis,
      from: index,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
      capturedEl: e.currentTarget
    }
  }, [])

  return { axisDragging, onAxisPointerDown }
}

export { MATRIX_DRAG_THRESHOLD }
