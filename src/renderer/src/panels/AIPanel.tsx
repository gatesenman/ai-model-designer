import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input, Segmented, Select, Tag, Tooltip, message } from 'antd'
import {
  SendOutlined,
  ThunderboltOutlined,
  EditOutlined,
  ClearOutlined,
  AimOutlined,
  RobotOutlined,
  UserOutlined
} from '@ant-design/icons'
import { useModelStore } from '../store/modelStore'
import { useSettingsStore } from '../store/settingsStore'
import { generateModel, refineModel } from '../ai/aiClient'
import { MODEL_KIND_LABELS } from '@shared/types'
import { describeProviderStatus, missingProviderKeyError } from '@shared/providerStatus'
import { shouldApplyAiResult } from '@shared/aiRequestGuard'
import { getDiagramType, DIAGRAM_GROUP_LABELS } from '@shared/diagramCatalog'

const { TextArea } = Input

type ChatRole = 'user' | 'assistant'
type ChatMode = 'auto' | 'generate' | 'refine'

interface ChatTurn {
  id: string
  role: ChatRole
  content: string
  time: string
  pending?: boolean
  error?: boolean
}

function nowTime(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

let seq = 0
const newId = (): string => `m${Date.now()}_${seq++}`

const EXAMPLES = [
  '一个类似 Palantir 的本体语义建模系统，包含对象类型、属性、链接类型、动作类型、函数、值类型、数据集与物化映射',
  '一个电商系统，包含用户、商品、订单、支付、物流',
  '在线教育平台：课程、章节、教师、学生、订单、评价'
]

export default function AIPanel() {
  const doc = useModelStore((s) => s.doc)
  const setDoc = useModelStore((s) => s.setDoc)
  const selectedNodeIds = useModelStore((s) => s.selectedNodeIds)

  const provider = useSettingsStore((s) => s.settings.provider)

  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<ChatMode>('auto')
  const [refineScope, setRefineScope] = useState<'all' | 'selected'>('all')
  const requestIdRef = useRef<string | null>(null)
  const cancelledRef = useRef(false)
  const lastPayloadRef = useRef<string | null>(null)
  const providerStatus = describeProviderStatus(provider)

  // 选中多个元素时自动切到「仅作用于选中」，取消选择后回到「整个模型」
  useEffect(() => {
    setRefineScope(selectedNodeIds.length > 0 ? 'selected' : 'all')
  }, [selectedNodeIds.length])

  const listRef = useRef<HTMLDivElement>(null)

  const isOntology = doc.kind === 'conceptual'
  const nodeWord = isOntology ? '对象类型' : '实体'
  const edgeWord = isOntology ? '链接' : '关系'

  const diagramDef = getDiagramType(doc.diagramType)
  const diagramName = diagramDef?.name ?? MODEL_KIND_LABELS[doc.kind]
  const groupLabel = diagramDef ? DIAGRAM_GROUP_LABELS[diagramDef.group] : undefined

  // 有效动作：auto 时按画布是否为空决定生成/微调
  const effectiveAction: 'generate' | 'refine' = useMemo(() => {
    if (mode === 'generate') return 'generate'
    if (mode === 'refine') return 'refine'
    return doc.nodes.length === 0 ? 'generate' : 'refine'
  }, [mode, doc.nodes.length])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const patchMessage = (id: string, patch: Partial<ChatTurn>): void => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  const handleSend = async (): Promise<void> => {
    const text = input.trim()
    if (!text) return
    if (busy) return

    const action = effectiveAction
    if (action === 'refine' && doc.nodes.length === 0) {
      message.warning('当前画布为空，请先生成模型')
      return
    }
    if (providerStatus.mode === 'missing-key') {
      message.warning(missingProviderKeyError(provider))
      return
    }

    lastPayloadRef.current = text
    const requestId = newId()
    requestIdRef.current = requestId
    cancelledRef.current = false

    const userMsg: ChatTurn = { id: newId(), role: 'user', content: text, time: nowTime() }
    const assistantId = newId()
    const pendingText =
      action === 'generate'
        ? `正在用「${providerStatus.label}」生成「${diagramName}」…`
        : `正在用「${providerStatus.label}」微调当前模型…`
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: pendingText, time: nowTime(), pending: true }
    ])
    setInput('')
    setBusy(true)

    try {
      if (action === 'generate') {
        const result = await generateModel(provider, text, doc.kind, doc.diagramType, { requestId })
        if (!shouldApplyAiResult(requestIdRef.current, requestId)) {
          patchMessage(assistantId, { pending: false, error: true, content: '已取消。' })
          return
        }
        setDoc(result)
        patchMessage(assistantId, {
          pending: false,
          content:
            `已生成「${diagramName}」：${result.nodes.length} 个${nodeWord}、` +
            `${result.edges.length} 条${edgeWord}，已渲染到画布。\n` +
            '你可以直接在画布拖拽/编辑，或继续告诉我要修改的地方（例如"给订单加状态字段"）。'
        })
      } else {
        const scopeIds =
          refineScope === 'selected' && selectedNodeIds.length > 0 ? selectedNodeIds : undefined
        const result = await refineModel(provider, doc, text, scopeIds, { requestId })
        if (!shouldApplyAiResult(requestIdRef.current, requestId)) {
          patchMessage(assistantId, { pending: false, error: true, content: '已取消。' })
          return
        }
        setDoc(result)
        const scopeText =
          scopeIds && scopeIds.length > 0
            ? `（仅作用于选中的 ${scopeIds.length} 个元素）`
            : '（作用于整个模型）'
        patchMessage(assistantId, {
          pending: false,
          content:
            `已完成微调${scopeText}：当前 ${result.nodes.length} 个${nodeWord}、` +
            `${result.edges.length} 条${edgeWord}。`
        })
      }
    } catch (err) {
      if (!shouldApplyAiResult(requestIdRef.current, requestId) || cancelledRef.current) {
        patchMessage(assistantId, { pending: false, error: true, content: '已取消。' })
        return
      }
      patchMessage(assistantId, {
        pending: false,
        error: true,
        content: `${effectiveAction === 'generate' ? '生成' : '微调'}失败：${(err as Error).message}`
      })
    } finally {
      if (requestIdRef.current === requestId) {
        requestIdRef.current = null
        setBusy(false)
      }
    }
  }

  const handleCancel = (): void => {
    cancelledRef.current = true
    const id = requestIdRef.current
    requestIdRef.current = null
    if (id) void window.api?.cancelAi?.(id)
    setBusy(false)
  }

  const handleRetry = (): void => {
    if (lastPayloadRef.current) {
      setInput(lastPayloadRef.current)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const placeholder =
    effectiveAction === 'generate'
      ? '描述你的业务需求，回车生成模型；Shift+Enter 换行'
      : '输入微调指令，例如：新增一个优惠券对象；给所有对象加审计字段；回车发送'

  return (
    <div className="ai-chat">
      <div className="ai-chat__header">
        <div className="ai-chat__header-title">
          <RobotOutlined />
          <span>AI 助手</span>
        </div>
        <div className="ai-chat__header-right">
          <Tooltip title={groupLabel ? `${diagramName} · ${groupLabel}` : diagramName}>
            <Tag color="geekblue" className="ai-chat__diagram-tag">
              {diagramName}
            </Tag>
          </Tooltip>
          <Tooltip title="新对话（清空记录，不影响画布模型）">
            <Button
              size="small"
              type="text"
              icon={<ClearOutlined />}
              onClick={() => setMessages([])}
              disabled={busy || messages.length === 0}
            />
          </Tooltip>
        </div>
      </div>
      {providerStatus.mode === 'missing-key' ? (
        <div className="ai-missing-key-banner" role="status" data-testid="ai-missing-key-reason">
          这是左侧「AI 助手」对话面板：在线发送需要 API Key。{providerStatus.hint}
          缺少 API Key 时发送按钮已禁用。顶部工具栏「生成」（代码/文档/数据）是本地模板功能，无需 Key，请不要与本面板混淆。
        </div>
      ) : providerStatus.mode === 'mock' ? (
        <div className="ai-chat__composer-tip" style={{ padding: '6px 12px 0' }} role="status">
          当前为离线模拟，不会调用外部模型。顶部「生成」导出代码/文档同样是本地功能，无需 Key。
        </div>
      ) : null}

      <div className="ai-chat__messages" ref={listRef}>
        {messages.length === 0 ? (
          <div className="ai-chat__empty">
            <div className="ai-chat__empty-icon">
              <ThunderboltOutlined />
            </div>
            <div className="ai-chat__empty-title">用对话生成与微调「{diagramName}」</div>
            <div className="ai-chat__empty-sub">描述业务需求，AI 帮你生成模型；也可选中元素做局部微调</div>
            <div className="ai-chat__suggestions">
              {EXAMPLES.map((ex) => (
                <button key={ex} className="ai-chat__suggestion" onClick={() => setInput(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`ai-msg ${m.role}${m.error ? ' error' : ''}`}>
              <div className="ai-msg__avatar">
                {m.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
              </div>
              <div className="ai-msg__col">
                <div className="ai-msg__meta">
                  <span className="ai-msg__name">{m.role === 'user' ? '我' : 'AI 助手'}</span>
                  <span className="ai-msg__time">{m.time}</span>
                </div>
                <div className="ai-msg__bubble">
                  {m.pending ? (
                    <span className="ai-msg__thinking">
                      <span className="ai-typing" /> {m.content}
                    </span>
                  ) : (
                    <>
                      {m.content}
                      {m.error && lastPayloadRef.current && !busy ? (
                        <div>
                          <Button size="small" type="link" onClick={handleRetry} style={{ padding: 0 }}>
                            重试（填回指令）
                          </Button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="ai-chat__composer">
        <div className="ai-chat__composer-tools">
          <Segmented
            size="small"
            value={mode}
            onChange={(v) => setMode(v as ChatMode)}
            options={[
              { label: '自动', value: 'auto' },
              { label: '生成', value: 'generate', icon: <ThunderboltOutlined /> },
              { label: '微调', value: 'refine', icon: <EditOutlined /> }
            ]}
          />
          {effectiveAction === 'refine' && (
            <Select
              size="small"
              className="ai-chat__scope"
              value={refineScope}
              onChange={setRefineScope}
              suffixIcon={<AimOutlined />}
              popupMatchSelectWidth={false}
              options={[
                { value: 'all', label: '整个模型' },
                {
                  value: 'selected',
                  label:
                    selectedNodeIds.length > 0
                      ? `选中的 ${selectedNodeIds.length} 个元素`
                      : '仅选中元素（未选中）',
                  disabled: selectedNodeIds.length === 0
                }
              ]}
            />
          )}
        </div>
        <div className="ai-chat__composer-box">
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoSize={{ minRows: 2, maxRows: 6 }}
            disabled={busy}
            variant="borderless"
          />
          <div className="ai-chat__composer-bar">
            <span className="ai-chat__composer-hint">
              <Tag
                color={effectiveAction === 'generate' ? 'green' : 'gold'}
                bordered={false}
                style={{ margin: 0 }}
              >
                {effectiveAction === 'generate' ? '生成' : '微调'}
              </Tag>
              <span
                className="ai-chat__provider"
                title={providerStatus.hint}
                data-testid="ai-provider-status"
              >
                {providerStatus.label}
              </span>
            </span>
            {busy ? (
              <Button data-testid="ai-cancel" onClick={handleCancel}>取消</Button>
            ) : (
              <Button
                type="primary"
                shape="circle"
                icon={<SendOutlined />}
                disabled={!input.trim() || providerStatus.mode === 'missing-key'}
                title={providerStatus.mode === 'missing-key' ? providerStatus.hint : undefined}
                data-testid="ai-send"
                onClick={handleSend}
              />
            )}
          </div>
        </div>
        <div className="ai-chat__composer-tip">
          Enter 发送 · Shift+Enter 换行
          {providerStatus.mode === 'mock' ? ' · 当前为离线模拟，不会调用外部模型' : ''}
          {providerStatus.mode === 'missing-key' ? ' · 缺少 API Key，请先到设置中配置' : ''}
          {lastPayloadRef.current && !busy ? (
            <>
              {' · '}
              <button type="button" className="ai-chat__retry" onClick={handleRetry}>
                填入上一次指令以便重试
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
