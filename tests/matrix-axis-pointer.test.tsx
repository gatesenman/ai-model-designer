import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MatrixCanvas from '@renderer/canvas/renderers/MatrixCanvas'
import { useModelStore } from '@renderer/store/modelStore'
import { findMatrixAxisAt } from '@renderer/canvas/matrixAxisPointer'
import '@renderer/styles.css'

function setupRaci(): void {
  useModelStore.getState().newProject()
  const id = useModelStore.getState().addModel('architecture', 'RACI', 'raci')
  useModelStore.getState().switchModel(id)
}

function pointer(type: 'pointerdown' | 'pointermove' | 'pointerup', target: EventTarget, init: PointerEventInit): void {
  fireEvent(
    target,
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      ...init
    })
  )
}

describe('矩阵表头 Pointer 排序与显式入口', () => {
  beforeEach(() => {
    setupRaci()
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('findMatrixAxisAt 能从手柄命中 data-mx-axis/index', () => {
    document.body.innerHTML =
      '<div class="mx-canvas"><div class="mx-rowhead" data-mx-axis="row" data-mx-index="1"><span class="mx-drag">::</span></div></div>'
    const handle = document.querySelector('.mx-drag') as HTMLElement
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(handle)
    const hit = findMatrixAxisAt(10, 10, 'row')
    expect(hit?.index).toBe(1)
    expect(hit?.axis).toBe('row')
  })

  it('显式下移/上移按钮调整行顺序，条目引用保持', () => {
    render(<MatrixCanvas />)
    const before = [...((useModelStore.getState().doc.meta?.rows as string[]) ?? [])]
    const firstItemRow = useModelStore.getState().doc.nodes[0].props?.row
    fireEvent.click(screen.getByTestId('mx-row-down-0'))
    const after = useModelStore.getState().doc.meta?.rows as string[]
    expect(after[0]).toBe(before[1])
    expect(after[1]).toBe(before[0])
    expect(useModelStore.getState().doc.nodes[0].props?.row).toBe(firstItemRow)
    fireEvent.click(screen.getByTestId('mx-row-up-1'))
    expect(useModelStore.getState().doc.meta?.rows).toEqual(before)
  })

  it('最后一行删除按钮禁用并给出原因，不能删光', () => {
    render(<MatrixCanvas />)
    const rows = (useModelStore.getState().doc.meta?.rows as string[]) ?? []
    for (let i = rows.length - 1; i >= 1; i--) {
      fireEvent.click(screen.getByTestId(`mx-row-del-${i}`))
    }
    expect((useModelStore.getState().doc.meta?.rows as string[]).length).toBe(1)
    expect(screen.getByTestId('mx-row-del-0')).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByTestId('mx-row-del-0'))
    expect((useModelStore.getState().doc.meta?.rows as string[]).length).toBe(1)
  })

  it('Pointer 跨行拖动手柄会提交排序；仅派发 HTML5 drop 不会改序', () => {
    render(<MatrixCanvas />)
    const before = [...((useModelStore.getState().doc.meta?.rows as string[]) ?? [])]
    const target = screen.getByTestId('mx-rowhead-1')
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(target)
    const handle = screen.getByTestId('mx-row-handle-0')
    act(() => {
      pointer('pointerdown', handle, { button: 0, buttons: 1, clientX: 10, clientY: 10 })
      pointer('pointermove', window, { buttons: 1, clientX: 10, clientY: 40 })
      pointer('pointerup', window, { button: 0, clientX: 10, clientY: 80 })
    })
    expect(useModelStore.getState().doc.meta?.rows).toEqual([before[1], before[0], ...before.slice(2)])

    const mid = [...((useModelStore.getState().doc.meta?.rows as string[]) ?? [])]
    act(() => {
      fireEvent.drop(screen.getByTestId('mx-rowhead-0'))
    })
    expect(useModelStore.getState().doc.meta?.rows).toEqual(mid)
  })

  it('拖动手柄有足够命中区域', () => {
    render(<MatrixCanvas />)
    const handle = screen.getByTestId('mx-col-handle-0')
    expect(handle.style.minWidth).toBe('22px')
    expect(handle.style.minHeight).toBe('28px')
  })

  it('最后一列删除禁用时，Tooltip 包裹层仍能显示原因', async () => {
    render(<MatrixCanvas />)
    const cols = (useModelStore.getState().doc.meta?.cols as string[]) ?? []
    for (let i = cols.length - 1; i >= 1; i--) {
      fireEvent.click(screen.getByTestId(`mx-col-del-${i}`))
    }
    expect((useModelStore.getState().doc.meta?.cols as string[]).length).toBe(1)
    expect(screen.getByTestId('mx-col-del-0')).toHaveProperty('disabled', true)
    fireEvent.mouseEnter(screen.getByTestId('mx-col-del-wrap-0'))
    fireEvent.mouseOver(screen.getByTestId('mx-col-del-wrap-0'))
    await waitFor(() => {
      const tips = Array.from(document.querySelectorAll('.ant-tooltip'))
      expect(tips.some((el) => (el.textContent || '').includes('至少保留一列'))).toBe(true)
    })
  })
})
