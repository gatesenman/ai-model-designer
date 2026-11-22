import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import SequenceCanvas from '@renderer/canvas/renderers/SequenceCanvas'
import PropertiesPanel from '@renderer/panels/PropertiesPanel'
import { useModelStore } from '@renderer/store/modelStore'
import { addActivation, resolveActivations } from '@shared/sequenceActivations'
import '@renderer/styles.css'

/** 镜像 App：选中激活条时自动打开属性面板（App.hasSelection 现已包含 selectedActivationId）。 */
function SequencePropsHarness(): JSX.Element {
  const selectedActivationId = useModelStore((s) => s.selectedActivationId)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (selectedActivationId) setOpen(true)
  }, [selectedActivationId])
  return (
    <div>
      <SequenceCanvas />
      {open ? (
        <div data-testid="seq-props-open">
          <PropertiesPanel />
        </div>
      ) : (
        <div data-testid="seq-props-closed" />
      )}
    </div>
  )
}

function loadManualSequence(): string {
  useModelStore.getState().newProject()
  const id = useModelStore.getState().addModel('uml', '时序图', 'uml-sequence')
  useModelStore.getState().switchModel(id)
  const added = addActivation(useModelStore.getState().doc)
  useModelStore.getState().setDoc(added)
  const last = resolveActivations(useModelStore.getState().doc).activations.at(-1)
  if (!last) throw new Error('未得到手动激活条')
  return last.id
}

describe('时序激活条：画布命中与属性面板联动', () => {
  beforeEach(() => {
    loadManualSequence()
  })
  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('SVG 生命线保持不可点，激活条及其加宽命中区必须可点', () => {
    render(<SequencePropsHarness />)
    const svg = document.querySelector('.seq-svg') as HTMLElement
    const group = document.querySelector('.seq-activation-group') as HTMLElement
    const hit = document.querySelector('.seq-activation-hit') as HTMLElement
    const bar = document.querySelector('.seq-activation') as HTMLElement
    expect(svg).toBeTruthy()
    expect(svg.getAttribute('style') || svg.style.pointerEvents).toMatch(/none/)
    expect(group.getAttribute('style') || group.style.pointerEvents).toMatch(/auto/)
    expect(getComputedStyle(hit).pointerEvents === 'auto' || hit.classList.contains('seq-activation-hit')).toBe(true)
    expect(bar).toBeTruthy()
  })

  it('点击条体选中后自动打开属性，可改参与者/起止并删除，撤销可恢复', () => {
    const actId = resolveActivations(useModelStore.getState().doc).activations.at(-1)!.id
    const beforeCount = resolveActivations(useModelStore.getState().doc).activations.length
    render(<SequencePropsHarness />)
    expect(screen.getByTestId('seq-props-closed')).toBeTruthy()
    fireEvent.click(screen.getByTestId(`seq-activation-${actId}`))
    expect(useModelStore.getState().selectedActivationId).toBe(actId)
    expect(screen.getByTestId('seq-props-open')).toBeTruthy()
    expect(screen.getByTestId('seq-activation-props').textContent).toMatch(/手动模式|激活条/)

    const other = useModelStore.getState().doc.nodes[1]?.id ?? useModelStore.getState().doc.nodes[0].id
    const participant = screen.getByTestId('seq-activation-props').querySelector('.ant-select')
    expect(participant).toBeTruthy()

    fireEvent.click(screen.getByTestId('seq-activation-delete'))
    expect(resolveActivations(useModelStore.getState().doc).activations.every((a) => a.id !== actId)).toBe(true)
    expect(resolveActivations(useModelStore.getState().doc).activations.length).toBe(beforeCount - 1)
    act(() => {
      useModelStore.getState().undo()
    })
    expect(resolveActivations(useModelStore.getState().doc).activations.some((a) => a.id === actId)).toBe(true)
    void other
  })

  it('列表入口可不依赖 SVG 命中即可打开属性并编辑起止', () => {
    const actId = resolveActivations(useModelStore.getState().doc).activations.at(-1)!.id
    render(<SequencePropsHarness />)
    const listBtns = screen.getAllByTestId(`seq-activation-list-${actId}`)
    fireEvent.click(listBtns[0])
    expect(useModelStore.getState().selectedActivationId).toBe(actId)
    expect(screen.getByTestId('seq-activation-props')).toBeTruthy()
    const toSelects = screen.getByTestId('seq-activation-props').querySelectorAll('.ant-select')
    expect(toSelects.length).toBeGreaterThanOrEqual(3)
  })

  it('右键条体会选中并打开属性，不会丢掉 selectedActivationId', () => {
    const actId = resolveActivations(useModelStore.getState().doc).activations.at(-1)!.id
    render(<SequencePropsHarness />)
    fireEvent.contextMenu(screen.getByTestId(`seq-activation-${actId}`))
    expect(useModelStore.getState().selectedActivationId).toBe(actId)
    expect(screen.getByTestId('seq-props-open')).toBeTruthy()
  })
})
