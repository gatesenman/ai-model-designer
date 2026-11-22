import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GeneratePanel from '@renderer/panels/GeneratePanel'
import { useModelStore } from '@renderer/store/modelStore'
import { useSettingsStore } from '@renderer/store/settingsStore'
import * as aiClient from '@renderer/ai/aiClient'
vi.mock('@renderer/ai/aiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@renderer/ai/aiClient')>()
  return {
    ...actual,
    generateCodeArtifact: vi.fn((doc: Parameters<typeof actual.generateCodeArtifact>[0], target: Parameters<typeof actual.generateCodeArtifact>[1], opts: Parameters<typeof actual.generateCodeArtifact>[2]) =>
      actual.generateCodeArtifact(doc, target, opts)
    )
  }
})

describe('生成面板：空/失败禁用与切类型隔离', () => {
  beforeEach(() => {
    useModelStore.getState().newProject()
    vi.mocked(aiClient.generateCodeArtifact).mockClear()
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('尚未生成时不展示旧输出；复制/保存按钮不出现', () => {
    render(<GeneratePanel />)
    expect(screen.getByTestId('generate-output-empty').textContent).toMatch(/不会沿用上一份输出/)
    expect(screen.queryByTestId('generate-copy')).toBeNull()
    expect(screen.queryByTestId('generate-save')).toBeNull()
  })

  it('生成成功后标明来源；切换类别后旧结果不再作为当前结果展示', async () => {
    render(<GeneratePanel />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('generate-run'))
    })
    const source = screen.getByTestId('generate-output-source')
    expect(source.textContent).toMatch(/结果来源：/)
    expect(source.textContent).toMatch(/代码/)
    expect(source.textContent).not.toMatch(/生成失败/)
    expect(screen.getByTestId('generate-copy').hasAttribute('disabled')).toBe(false)
    expect(screen.getByTestId('generate-save').hasAttribute('disabled')).toBe(false)
    const sqlText = document.querySelector('.code-block')?.textContent ?? ''
    expect(sqlText.length).toBeGreaterThan(5)

    fireEvent.click(screen.getByText('数据'))
    expect(screen.getByTestId('generate-output-empty')).toBeTruthy()
    expect(screen.queryByTestId('generate-copy')).toBeNull()
    expect(document.querySelector('.code-block')?.textContent ?? '').not.toBe(sqlText)
  })

  it('生成失败时复制与保存按钮禁用，并标明失败', async () => {
    vi.mocked(aiClient.generateCodeArtifact).mockImplementationOnce(() => {
      throw new Error('模拟失败')
    })
    render(<GeneratePanel />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('generate-run'))
    })
    expect(screen.getByTestId('generate-output-source').textContent).toMatch(/生成失败/)
    expect(screen.getByTestId('generate-copy').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('generate-save').hasAttribute('disabled')).toBe(true)
    expect(screen.getByText(/生成失败：模拟失败/)).toBeTruthy()
  })

  it('生成中时复制与保存按钮禁用', async () => {
    let finish: (v: string) => void = () => undefined
    const pending = new Promise<string>((resolve) => {
      finish = resolve
    })
    vi.mocked(aiClient.generateCodeArtifact).mockImplementationOnce(() => pending as unknown as string)
    render(<GeneratePanel />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('generate-run'))
    })
    expect(screen.getByTestId('generate-copy').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('generate-save').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('generate-output-source').textContent).toMatch(/生成中/)
    await act(async () => {
      finish('CREATE TABLE t (id int);')
      await pending
    })
    expect(screen.getByTestId('generate-copy').hasAttribute('disabled')).toBe(false)
  })

  it('即使未配置 AI Key，本地代码生成仍可用，并说明无需 Key', () => {
    useSettingsStore.getState().setProvider({
      type: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.4,
      apiKey: ''
    })
    render(<GeneratePanel />)
    const run = screen.getByTestId('generate-run')
    expect(run.hasAttribute('disabled')).toBe(false)
    expect(screen.getByTestId('generate-local-hint').textContent).toMatch(/无需 AI Key/)
    expect(screen.getByTestId('generate-local-hint').textContent).toMatch(/AI 助手/)
  })
})
