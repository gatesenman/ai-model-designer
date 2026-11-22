import { describe, expect, it } from 'vitest'
import { describeProviderStatus, missingProviderKeyError, providerNeedsApiKey } from '@shared/providerStatus'
import { isOutputSavable, normalizeProjectSession, shouldPromptSaveDialog } from '@shared/projectSession'
import { searchProject } from '@shared/searchModel'
import { generateModel } from '@renderer/ai/aiClient'
import { emptyDoc, emptyProject, useModelStore } from '@renderer/store/modelStore'
import type { Project, ProviderConfig } from '@shared/types'

const mock: ProviderConfig = { type: 'mock', model: '', temperature: 0.4 }
const openaiNoKey: ProviderConfig = { type: 'openai', model: 'gpt-4o-mini', temperature: 0.4, apiKey: '' }
const openaiReady: ProviderConfig = { type: 'openai', model: 'gpt-4o-mini', temperature: 0.4, apiKey: 'sk-test' }
const ollama: ProviderConfig = { type: 'ollama', model: 'llama3', temperature: 0.4, baseUrl: 'http://127.0.0.1:11434' }

describe('供应商状态分辨', () => {
  it('mock 标记为离线模拟，不需要密钥', () => {
    const s = describeProviderStatus(mock)
    expect(s.mode).toBe('mock')
    expect(s.needsKey).toBe(false)
    expect(s.label).toContain('离线模拟')
  })

  it('缺少 API Key 的云端供应商为 missing-key，不会假装已连通', () => {
    expect(providerNeedsApiKey('openai')).toBe(true)
    const s = describeProviderStatus(openaiNoKey)
    expect(s.mode).toBe('missing-key')
    expect(s.hint).toMatch(/不会假装/)
    expect(missingProviderKeyError(openaiNoKey)).toMatch(/API Key/)
  })

  it('已填密钥或 Ollama 为 ready，提示仍不声称已验证', () => {
    expect(describeProviderStatus(openaiReady).mode).toBe('ready')
    expect(describeProviderStatus(openaiReady).hint).toMatch(/不会在无凭据时伪装/)
    expect(providerNeedsApiKey('ollama')).toBe(false)
    expect(describeProviderStatus(ollama).mode).toBe('ready')
  })
})

describe('项目会话与保存策略', () => {
  it('已有路径且非另存为时不弹对话框', () => {
    expect(shouldPromptSaveDialog('/tmp/a.amdproj', false)).toBe(false)
    expect(shouldPromptSaveDialog('/tmp/a.amdproj', true)).toBe(true)
    expect(shouldPromptSaveDialog(null, false)).toBe(true)
  })

  it('规范化新会话与旧版仅存 Project 的草稿', () => {
    const next = normalizeProjectSession({ project: { name: 'A', models: [] }, filePath: '/a.amdproj', fileSaved: true })
    expect(next.filePath).toBe('/a.amdproj')
    expect(next.fileSaved).toBe(true)
    const legacy = normalizeProjectSession({ name: '旧项目', models: [], activeModelId: 'x', format: 'amdproj' })
    expect((legacy.project as { name: string }).name).toBe('旧项目')
    expect(legacy.filePath).toBeNull()
    expect(legacy.fileSaved).toBe(false)
    expect(normalizeProjectSession(null).project).toBeNull()
  })

  it('空输出、生成中、失败文案不可保存或复制', () => {
    expect(isOutputSavable('')).toBe(false)
    expect(isOutputSavable('   ')).toBe(false)
    expect(isOutputSavable('生成中…')).toBe(false)
    expect(isOutputSavable('生成失败：timeout')).toBe(false)
    expect(isOutputSavable('CREATE TABLE t (id int);')).toBe(true)
  })
})

describe('项目内搜索', () => {
  it('按节点名、字段、方法检索并可区分大小写无关', () => {
    const project = emptyProject('检索项目') as Project
    const doc = emptyDoc('uml', '类图', 'uml-class')
    doc.nodes = [
      {
        id: 'n1',
        label: 'OrderService',
        position: { x: 0, y: 0 },
        fields: [{ id: 'f1', name: 'orderId', type: 'string' }],
        methods: [{ id: 'm1', name: 'placeOrder' }],
        comment: '下单服务'
      }
    ]
    project.models = [doc]
    expect(searchProject(project, '  ')).toEqual([])
    expect(searchProject(project, 'orderservice').map((h) => h.nodeId)).toEqual(['n1'])
    expect(searchProject(project, 'orderId')[0].field).toBe('orderId')
    expect(searchProject(project, 'placeOrder')[0].field).toBe('placeOrder()')
    expect(searchProject(project, '下单')[0].label).toBe('OrderService')
  })
})

describe('会话路径与未保存标记', () => {
  it('newProject 清空 filePath；loadProject 可写入路径且默认 dirty=false', () => {
    const store = useModelStore.getState()
    store.newProject()
    useModelStore.getState().setFilePath('/tmp/demo.amdproj')
    expect(useModelStore.getState().filePath).toBe('/tmp/demo.amdproj')
    useModelStore.getState().newProject()
    expect(useModelStore.getState().filePath).toBeNull()
    expect(useModelStore.getState().dirty).toBe(false)

    const snap = useModelStore.getState().project
    useModelStore.getState().loadProject(snap, { dirty: true, filePath: '/workspace/qa-pointer-raci.amdproj' })
    const after = useModelStore.getState()
    expect(after.filePath).toBe('/workspace/qa-pointer-raci.amdproj')
    expect(after.dirty).toBe(true)
    useModelStore.getState().loadProject(snap, { dirty: false, filePath: '/tmp/saved.amdproj' })
    expect(useModelStore.getState().dirty).toBe(false)
    expect(useModelStore.getState().filePath).toBe('/tmp/saved.amdproj')
  })
})

describe('缺少密钥时不调用供应商', () => {
  it('generateModel 在 missing-key 时直接抛错，不依赖 window.api', async () => {
    await expect(generateModel(openaiNoKey, '生成订单模型', 'logical')).rejects.toThrow(/API Key/)
  })

  it('mock 生成仍可离线给出非空模型', async () => {
    const doc = await generateModel(mock, '订单与库存', 'logical')
    expect(doc.nodes.length).toBeGreaterThan(0)
  })
})
