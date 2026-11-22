import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AIPanel from '@renderer/panels/AIPanel'
import { useModelStore } from '@renderer/store/modelStore'
import { useSettingsStore } from '@renderer/store/settingsStore'
import { generateModel } from '@renderer/ai/aiClient'
import type { ModelDoc } from '@shared/types'

vi.mock('@renderer/ai/aiClient', async () => {
  const actual = await vi.importActual<typeof import('@renderer/ai/aiClient')>('@renderer/ai/aiClient')
  return {
    ...actual,
    generateModel: vi.fn(),
    refineModel: vi.fn()
  }
})

function composer(): HTMLTextAreaElement {
  const el = document.querySelector('.ai-chat textarea') as HTMLTextAreaElement | null
  if (!el) throw new Error('未找到 AI 输入框')
  return el
}

function stubApi(): void {
  window.api = {
    cancelAi: vi.fn(async () => ({ ok: true })),
    ackClose: vi.fn(),
    rendererReady: vi.fn()
  } as unknown as Window['api']
}

describe('AI 面板：缺 Key 可见理由与取消不回填', () => {
  beforeEach(() => {
    stubApi()
    useModelStore.getState().newProject()
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        provider: { type: 'mock', model: '', temperature: 0.4 }
      }
    })
    vi.mocked(generateModel).mockReset()
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('缺少 API Key 时发送禁用，并显示可见说明', () => {
    useSettingsStore.getState().setProvider({
      type: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.4,
      apiKey: ''
    })
    render(<AIPanel />)
    fireEvent.change(composer(), { target: { value: '生成订单模型' } })
    const send = screen.getByTestId('ai-send')
    expect(send).toHaveProperty('disabled', true)
    expect(send.getAttribute('title') ?? '').toMatch(/API Key|密钥|不会假装/)
    expect(screen.getByTestId('ai-missing-key-reason').textContent).toMatch(/缺少 API Key/)
    expect(screen.getByTestId('ai-provider-status').textContent).toMatch(/未配置密钥/)
  })

  it('取消后，已发出的旧请求完成时不得把结果写回画布', async () => {
    const before = useModelStore.getState().doc
    let finish: (doc: ModelDoc) => void = () => undefined
    const pending = new Promise<ModelDoc>((resolve) => {
      finish = resolve
    })
    vi.mocked(generateModel).mockImplementationOnce(() => pending)

    render(<AIPanel />)
    const generateMode = screen.getAllByText('生成').find((n) => n.closest('.ant-segmented-item'))
    if (generateMode) fireEvent.click(generateMode)
    fireEvent.change(composer(), { target: { value: '生成订单模型' } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('ai-send'))
    })
    expect(screen.getByTestId('ai-cancel')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByTestId('ai-cancel'))
    })
    expect(window.api.cancelAi).toHaveBeenCalled()

    const late: ModelDoc = {
      ...before,
      id: before.id,
      name: '不该回填的模型',
      nodes: [{ ...before.nodes[0], id: 'late', label: '旧请求结果', fields: [], position: { x: 0, y: 0 } }],
      edges: []
    }
    await act(async () => {
      finish(late)
      await pending
    })
    await waitFor(() => {
      expect(screen.getByText('已取消。')).toBeTruthy()
    })
    expect(useModelStore.getState().doc.nodes.some((n) => n.label === '旧请求结果')).toBe(false)
    expect(useModelStore.getState().doc.name).not.toBe('不该回填的模型')
  })
})
