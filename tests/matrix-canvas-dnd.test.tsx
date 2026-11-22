import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MatrixCanvas from '@renderer/canvas/renderers/MatrixCanvas'
import { useModelStore } from '@renderer/store/modelStore'
import {
  clearClickSuppression,
  exceededDragThreshold,
  findMatrixCellAt,
  isInteractiveMatrixTarget,
  MATRIX_DRAG_THRESHOLD
} from '@renderer/canvas/matrixPointerDrag'

function setupRaci(): void {
  useModelStore.getState().newProject()
  const id = useModelStore.getState().addModel('architecture', 'RACI', 'raci')
  useModelStore.getState().switchModel(id)
}

function itemNode(): HTMLElement {
  const el =
    document.querySelector('.mx-item[data-item-id]') ??
    screen.getByText('条目 1').closest('.mx-item')
  if (!el) throw new Error('未找到条目')
  return el as HTMLElement
}

function nameInput(): HTMLInputElement | null {
  return itemNode().querySelector('input')
}

function cell(row: string, col: string): HTMLElement {
  const el = document.querySelector(`.mx-cell[data-row="${row}"][data-col="${col}"]`)
  if (!el) throw new Error(`未找到格子 ${row}/${col}`)
  return el as HTMLElement
}

function pointer(type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel', target: EventTarget, init: PointerEventInit): void {
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

describe('findMatrixCellAt / 阈值', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    clearClickSuppression()
    document.body.innerHTML = ''
  })

  it('从「+ 添加」按钮命中父格的 data-row/data-col', () => {
    document.body.innerHTML =
      '<div class="mx-canvas"><div class="mx-cell" data-row="任务 2" data-col="角色 B"><button class="mx-cell__add">添加</button></div></div>'
    const btn = document.querySelector('.mx-cell__add') as HTMLElement
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(btn)
    const hit = findMatrixCellAt(120, 80)
    expect(hit?.row).toBe('任务 2')
    expect(hit?.col).toBe('角色 B')
  })

  it('越出矩阵时返回 null', () => {
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.body)
    expect(findMatrixCellAt(0, 0)).toBeNull()
  })

  it('未超过阈值不进入拖动，超过则进入', () => {
    expect(exceededDragThreshold(3, 3)).toBe(false)
    expect(exceededDragThreshold(MATRIX_DRAG_THRESHOLD, 0)).toBe(true)
  })

  it('标记/删除/添加按钮视为交互控件', () => {
    document.body.innerHTML =
      '<div class="mx-item"><button class="mx-item__tag">·</button><button class="mx-cell__add">添加</button></div>'
    expect(isInteractiveMatrixTarget(document.querySelector('.mx-item__tag'))).toBe(true)
    expect(isInteractiveMatrixTarget(document.querySelector('.mx-cell__add'))).toBe(true)
    expect(isInteractiveMatrixTarget(document.querySelector('.mx-item'))).toBe(false)
  })
})

describe('RACI 矩阵跨格拖放（Pointer Events 路径）', () => {
  beforeEach(() => {
    setupRaci()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    clearClickSuppression()
  })

  it('从条目标签按下并移动超过阈值，在目标格「+ 添加」中央松开后行列写回 store 且保持选中', () => {
    render(<MatrixCanvas />)
    const source = itemNode()
    const label = source.querySelector('.mx-item__label') as HTMLElement
    const targetAdd = cell('任务 2', '角色 B').querySelector('.mx-cell__add') as HTMLElement
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(targetAdd)

    act(() => {
      pointer('pointerdown', label, { button: 0, buttons: 1, clientX: 40, clientY: 40 })
      pointer('pointermove', window, { buttons: 1, clientX: 40 + MATRIX_DRAG_THRESHOLD + 8, clientY: 40 + 20 })
      pointer('pointerup', window, { button: 0, buttons: 0, clientX: 240, clientY: 180 })
    })

    const moved = useModelStore.getState().doc.nodes.find((n) => n.label === '条目 1')
    expect(moved?.props?.row).toBe('任务 2')
    expect(moved?.props?.col).toBe('角色 B')
    expect(useModelStore.getState().selectedNodeId).toBe(moved?.id)
    expect(cell('任务 2', '角色 B').querySelector('.mx-item__label')?.textContent).toBe('条目 1')
    expect(document.querySelector('.mx-canvas')?.classList.contains('is-item-dragging')).toBe(false)
  })

  it('反向再拖回原格同样提交', () => {
    const itemId = useModelStore.getState().doc.nodes[0].id
    useModelStore.getState().setDoc(
      {
        ...useModelStore.getState().doc,
        nodes: useModelStore.getState().doc.nodes.map((n) =>
          n.id === itemId ? { ...n, props: { ...n.props, row: '任务 2', col: '角色 B' } } : n
        )
      }
    )
    render(<MatrixCanvas />)
    const source = itemNode()
    const originAdd = cell('任务 1', '角色 A').querySelector('.mx-cell__add') as HTMLElement
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(originAdd)

    act(() => {
      pointer('pointerdown', source, { button: 0, buttons: 1, clientX: 10, clientY: 10 })
      pointer('pointermove', window, { buttons: 1, clientX: 40, clientY: 50 })
      pointer('pointerup', window, { button: 0, clientX: 40, clientY: 50 })
    })

    const moved = useModelStore.getState().doc.nodes.find((n) => n.id === itemId)
    expect(moved?.props?.row).toBe('任务 1')
    expect(moved?.props?.col).toBe('角色 A')
  })

  it('未超过移动阈值时只选中、不改行列', () => {
    render(<MatrixCanvas />)
    const source = itemNode()
    const id = useModelStore.getState().doc.nodes[0].id
    const other = cell('任务 2', '角色 B')
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(other)

    act(() => {
      pointer('pointerdown', source, { button: 0, buttons: 1, clientX: 50, clientY: 50 })
      pointer('pointermove', window, { buttons: 1, clientX: 52, clientY: 51 })
      pointer('pointerup', window, { button: 0, clientX: 52, clientY: 51 })
    })

    const node = useModelStore.getState().doc.nodes[0]
    expect(node.props?.row).toBe('任务 1')
    expect(node.props?.col).toBe('角色 A')
    expect(useModelStore.getState().selectedNodeId).toBe(id)
  })

  it('拖出矩阵后松开则取消，条目留在原格', () => {
    render(<MatrixCanvas />)
    const source = itemNode()
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.body)

    act(() => {
      pointer('pointerdown', source, { button: 0, buttons: 1, clientX: 20, clientY: 20 })
      pointer('pointermove', window, { buttons: 1, clientX: 20, clientY: 80 })
      pointer('pointerup', window, { button: 0, clientX: 20, clientY: 80 })
    })

    const node = useModelStore.getState().doc.nodes[0]
    expect(node.props?.row).toBe('任务 1')
    expect(node.props?.col).toBe('角色 A')
    expect(document.querySelector('.mx-cell.is-drop')).toBeNull()
  })

  it('仅手动触发 HTML5 drop 不会移动条目', () => {
    render(<MatrixCanvas />)
    const target = cell('任务 2', '角色 B')
    const dt = {
      getData: () => useModelStore.getState().doc.nodes[0].id,
      types: ['text/plain'],
      dropEffect: 'move',
      setData(): void {},
      effectAllowed: 'move'
    }
    fireEvent.dragStart(itemNode(), { dataTransfer: dt })
    fireEvent.drop(target, { dataTransfer: dt })
    fireEvent.drop(target.querySelector('.mx-cell__add') as HTMLElement, { dataTransfer: dt })

    const node = useModelStore.getState().doc.nodes[0]
    expect(node.props?.row).toBe('任务 1')
    expect(node.props?.col).toBe('角色 A')
  })

  it('从标记按钮按下不会开始条目拖动（避免与切换标记冲突）', () => {
    render(<MatrixCanvas />)
    const tag = itemNode().querySelector('.mx-item__tag') as HTMLElement
    const targetAdd = cell('任务 2', '角色 C').querySelector('.mx-cell__add') as HTMLElement
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(targetAdd)

    act(() => {
      pointer('pointerdown', tag, { button: 0, buttons: 1, clientX: 10, clientY: 10 })
      pointer('pointermove', window, { buttons: 1, clientX: 80, clientY: 90 })
      pointer('pointerup', window, { button: 0, clientX: 80, clientY: 90 })
    })

    const node = useModelStore.getState().doc.nodes[0]
    expect(node.props?.row).toBe('任务 1')
    expect(node.props?.col).toBe('角色 A')
  })

  it('在「+ 添加」上松开后，残余 click 不会新增条目', () => {
    render(<MatrixCanvas />)
    const source = itemNode()
    const targetAdd = cell('任务 2', '角色 B').querySelector('.mx-cell__add') as HTMLElement
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(targetAdd)

    act(() => {
      pointer('pointerdown', source, { button: 0, buttons: 1, clientX: 10, clientY: 10 })
      pointer('pointermove', window, { buttons: 1, clientX: 40, clientY: 50 })
      pointer('pointerup', window, { button: 0, clientX: 200, clientY: 160 })
    })
    const countAfterMove = useModelStore.getState().doc.nodes.length
    fireEvent.click(targetAdd)
    expect(useModelStore.getState().doc.nodes.length).toBe(countAfterMove)
  })
})

function clickSeq(target: EventTarget, x = 40, y = 40): void {
  pointer('pointerdown', target, { button: 0, buttons: 1, clientX: x, clientY: y })
  pointer('pointerup', window, { button: 0, buttons: 0, clientX: x, clientY: y })
  if (target instanceof Element) fireEvent.click(target)
}

describe('RACI 条目就地改名（pointer 序列 / 双击 / 显式入口）', () => {
  beforeEach(() => {
    setupRaci()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    clearClickSuppression()
  })

  it('真实 pointerdown/up/click 双击序列显示输入框，Escape 取消不写回，Enter 提交写回', async () => {
    render(<MatrixCanvas />)
    const label = itemNode().querySelector('.mx-item__label') as HTMLElement

    act(() => {
      clickSeq(label)
    })
    expect(useModelStore.getState().selectedNodeId).toBe(useModelStore.getState().doc.nodes[0].id)
    expect(nameInput()).toBeNull()

    act(() => {
      clickSeq(label)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    const input = nameInput()
    expect(input).toBeTruthy()

    fireEvent.change(input!, { target: { value: '不该保存' } })
    fireEvent.keyDown(input!, { key: 'Escape' })
    expect(nameInput()).toBeNull()
    expect(itemNode().querySelector('.mx-item__label')?.textContent).toBe('条目 1')
    expect(useModelStore.getState().doc.nodes[0].label).toBe('条目 1')

    const label2 = itemNode().querySelector('.mx-item__label') as HTMLElement
    act(() => {
      clickSeq(label2)
      clickSeq(label2)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    const input2 = nameInput()
    expect(input2).toBeTruthy()
    fireEvent.change(input2!, { target: { value: '条目改名' } })
    fireEvent.keyDown(input2!, { key: 'Enter' })
    expect(useModelStore.getState().doc.nodes[0].label).toBe('条目改名')
    expect(itemNode().querySelector('.mx-item__label')?.textContent).toBe('条目改名')
  })

  it('选中后的编辑按钮和 F2 都能进入编辑态', () => {
    render(<MatrixCanvas />)
    act(() => {
      clickSeq(itemNode().querySelector('.mx-item__label') as HTMLElement)
    })
    const editBtn = document.querySelector('[data-testid="mx-item-rename"]') as HTMLElement
    expect(editBtn).toBeTruthy()
    act(() => {
      fireEvent.click(editBtn)
    })
    expect(nameInput()).toBeTruthy()

    fireEvent.keyDown(nameInput()!, { key: 'Escape' })
    expect(nameInput()).toBeNull()

    act(() => {
      fireEvent.keyDown(window, { key: 'F2' })
    })
    expect(nameInput()).toBeTruthy()
  })

  it('改名入口不破坏已验证的跨格拖动', () => {
    render(<MatrixCanvas />)
    const source = itemNode()
    const targetAdd = cell('任务 2', '角色 B').querySelector('.mx-cell__add') as HTMLElement
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(targetAdd)

    act(() => {
      pointer('pointerdown', source.querySelector('.mx-item__label') as HTMLElement, {
        button: 0,
        buttons: 1,
        clientX: 10,
        clientY: 10
      })
      pointer('pointermove', window, { buttons: 1, clientX: 40, clientY: 50 })
      pointer('pointerup', window, { button: 0, clientX: 200, clientY: 160 })
    })

    const moved = useModelStore.getState().doc.nodes.find((n) => n.label === '条目 1')
    expect(moved?.props?.row).toBe('任务 2')
    expect(moved?.props?.col).toBe('角色 B')
    expect(itemNode().querySelector('input')).toBeNull()
  })

  it('进入编辑后延迟定时器不会再次全选并吞掉首字', async () => {
    render(<MatrixCanvas />)
    const label = itemNode().querySelector('.mx-item__label') as HTMLElement
    act(() => {
      clickSeq(label)
      clickSeq(label)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    const input = nameInput()
    expect(input).toBeTruthy()

    const typeChar = (el: HTMLInputElement, ch: string): void => {
      const start = el.selectionStart ?? el.value.length
      const end = el.selectionEnd ?? el.value.length
      const next = el.value.slice(0, start) + ch + el.value.slice(end)
      el.value = next
      const pos = start + ch.length
      el.setSelectionRange(pos, pos)
      fireEvent.input(el, { target: { value: next } })
      fireEvent.change(el, { target: { value: next } })
    }

    typeChar(input!, 'Q')
    // 若仍有二次延迟 select，会在此时把 Q 全选，后续键入会覆盖首字
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    for (const ch of 'A_MatrixRename') typeChar(input!, ch)
    fireEvent.keyDown(input!, { key: 'Enter' })
    expect(useModelStore.getState().doc.nodes[0].label).toBe('QA_MatrixRename')
  })
})
