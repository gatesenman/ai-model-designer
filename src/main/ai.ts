import type { ChatMessage, ProviderConfig, AIResult, AiChatOptions } from '../shared/types'

/** 请求超时（毫秒）：本体等大模型生成可能较慢 */
const REQUEST_TIMEOUT_MS = 120_000
const DEFAULT_MAX_TOKENS = 8192

const inflight = new Map<string, AbortController>()

export function cancelAiRequest(requestId: string): boolean {
  const c = inflight.get(requestId)
  if (!c) return false
  c.abort()
  inflight.delete(requestId)
  return true
}

/** 带超时与可取消的 fetch */
async function fetchWithTimeout(url: string, init: RequestInit, requestId?: string): Promise<Response> {
  const controller = new AbortController()
  if (requestId) inflight.set(requestId, controller)
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      if (requestId && !inflight.has(requestId)) {
        throw new Error('已取消')
      }
      throw new Error(`请求超时（>${REQUEST_TIMEOUT_MS / 1000}s），请重试或检查网络/端点`)
    }
    throw err
  } finally {
    clearTimeout(timer)
    if (requestId) inflight.delete(requestId)
  }
}

/**
 * 主进程内统一的 AI 聊天调用，按 provider 分发。
 * 在主进程发起请求可避免渲染进程的 CORS 限制。
 */
export async function aiChat(
  config: ProviderConfig,
  messages: ChatMessage[],
  opts?: AiChatOptions
): Promise<AIResult> {
  try {
    switch (config.type) {
      case 'mock':
        return { ok: true, content: '' } // mock 由渲染进程本地处理
      case 'openai':
        return await openAICompatible(config, messages, {
          baseURL: config.baseURL || 'https://api.openai.com/v1',
          model: config.model || 'gpt-4o-mini'
        }, opts)
      case 'deepseek':
        return await openAICompatible(config, messages, {
          baseURL: config.baseURL || 'https://api.deepseek.com/v1',
          model: config.model || 'deepseek-chat'
        }, opts)
      case 'qwen':
        return await openAICompatible(config, messages, {
          baseURL: config.baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
          model: config.model || 'qwen-plus'
        }, opts)
      case 'ollama':
        return await openAICompatible(
          { ...config, apiKey: config.apiKey || 'ollama' },
          messages,
          {
            baseURL: config.baseURL || 'http://localhost:11434/v1',
            model: config.model || 'llama3.1'
          },
          opts
        )
      case 'azure':
        return await azureOpenAI(config, messages, opts)
      case 'anthropic':
        return await anthropic(config, messages, opts)
      default:
        return { ok: false, content: '', error: `未知供应商：${config.type}` }
    }
  } catch (err) {
    return { ok: false, content: '', error: (err as Error).message }
  }
}

interface OpenAITarget {
  baseURL: string
  model: string
}

/** OpenAI 兼容协议（OpenAI / DeepSeek / Qwen / Ollama 通用） */
async function openAICompatible(
  config: ProviderConfig,
  messages: ChatMessage[],
  target: OpenAITarget,
  opts?: AiChatOptions
): Promise<AIResult> {
  const url = `${target.baseURL.replace(/\/$/, '')}/chat/completions`
  const body: Record<string, unknown> = {
    model: target.model,
    messages,
    temperature: config.temperature ?? 0.4,
    max_tokens: opts?.maxTokens ?? DEFAULT_MAX_TOKENS
  }
  if (opts?.jsonMode) body.response_format = { type: 'json_object' }
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey || ''}`
    },
    body: JSON.stringify(body)
  }, opts?.requestId)
  if (!res.ok) {
    const text = await res.text()
    return { ok: false, content: '', error: `HTTP ${res.status}: ${text.slice(0, 500)}` }
  }
  const data: any = await res.json()
  const content: string = data?.choices?.[0]?.message?.content ?? ''
  return { ok: true, content }
}

/** Azure OpenAI */
async function azureOpenAI(
  config: ProviderConfig,
  messages: ChatMessage[],
  opts?: AiChatOptions
): Promise<AIResult> {
  if (!config.baseURL || !config.azureDeployment) {
    return { ok: false, content: '', error: '请配置 Azure 的 baseURL(资源端点) 与部署名' }
  }
  const apiVersion = config.azureApiVersion || '2024-02-15-preview'
  const url = `${config.baseURL.replace(/\/$/, '')}/openai/deployments/${config.azureDeployment}/chat/completions?api-version=${apiVersion}`
  const azureBody: Record<string, unknown> = {
    messages,
    temperature: config.temperature ?? 0.4,
    max_tokens: opts?.maxTokens ?? DEFAULT_MAX_TOKENS
  }
  if (opts?.jsonMode) azureBody.response_format = { type: 'json_object' }
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.apiKey || ''
    },
    body: JSON.stringify(azureBody)
  }, opts?.requestId)
  if (!res.ok) {
    const text = await res.text()
    return { ok: false, content: '', error: `HTTP ${res.status}: ${text.slice(0, 500)}` }
  }
  const data: any = await res.json()
  return { ok: true, content: data?.choices?.[0]?.message?.content ?? '' }
}

/** Anthropic Claude */
async function anthropic(
  config: ProviderConfig,
  messages: ChatMessage[],
  opts?: AiChatOptions
): Promise<AIResult> {
  const url = `${(config.baseURL || 'https://api.anthropic.com').replace(/\/$/, '')}/v1/messages`
  const system = messages.find((m) => m.role === 'system')?.content
  const rest = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }))
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey || '',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.model || 'claude-3-5-sonnet-20240620',
      max_tokens: opts?.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: config.temperature ?? 0.4,
      system,
      messages: rest
    })
  }, opts?.requestId)
  if (!res.ok) {
    const text = await res.text()
    return { ok: false, content: '', error: `HTTP ${res.status}: ${text.slice(0, 500)}` }
  }
  const data: any = await res.json()
  const content: string = Array.isArray(data?.content)
    ? data.content.map((c: any) => c?.text ?? '').join('')
    : ''
  return { ok: true, content }
}
