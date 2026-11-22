import { nanoid } from 'nanoid'
import type {
  AiChatOptions,
  ChatMessage,
  CodeTarget,
  DataTarget,
  DiagramEdge,
  DiagramNode,
  DocTarget,
  Field,
  Method,
  ModelDoc,
  ModelKind,
  NodeStereotype,
  ProviderConfig,
  RelationKind
} from '@shared/types'
import { DOC_TARGET_LABELS } from '@shared/types'
import {
  buildArtifactMessages,
  buildGenerateMessages,
  buildProjectDiagramMessages,
  buildProjectPlanMessages,
  buildRefineMessages
} from './prompts'
import { getDiagramType } from '@shared/diagramCatalog'
import { getDiagramSchema } from '@shared/diagramSchema'
import { mockGenerateModel, mockRefineModel } from './mockGenerator'
import { describeProviderStatus, missingProviderKeyError } from '@shared/providerStatus'
import {
  generateCode,
  generateData,
  generateDoc,
  type GenOptions
} from '../generate/generators'
import { autoLayout } from '../canvas/layout'

async function callProvider(
  config: ProviderConfig,
  messages: ChatMessage[],
  opts?: AiChatOptions
): Promise<string> {
  if (describeProviderStatus(config).mode === 'missing-key') {
    throw new Error(missingProviderKeyError(config))
  }
  const res = await window.api.aiChat(config, messages, opts)
  if (!res.ok) throw new Error(res.error || 'AI 调用失败')
  return res.content
}

const VALID_STEREOTYPES: NodeStereotype[] = [
  'class',
  'interface',
  'abstract',
  'enum',
  'object',
  'link',
  'action',
  'value'
]

/** 从 LLM 文本中尽力提取 JSON 对象 */
function extractJson(text: string): unknown {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) t = t.slice(start, end + 1)
  return JSON.parse(t)
}

const VALID_RELATIONS: RelationKind[] = [
  'oneToOne',
  'oneToMany',
  'manyToMany',
  'fk',
  'association',
  'inheritance',
  'composition',
  'aggregation',
  'dependency'
]

interface RawNode {
  label?: unknown
  name?: unknown
  comment?: unknown
  category?: unknown
  stereotype?: unknown
  fields?: unknown
  methods?: unknown
  position?: { x: number; y: number }
}
interface RawField {
  name?: unknown
  type?: unknown
  primaryKey?: unknown
  foreignKey?: unknown
  unique?: unknown
  notNull?: unknown
  autoIncrement?: unknown
  defaultValue?: unknown
  comment?: unknown
  visibility?: Field['visibility']
  isTitle?: unknown
}
interface RawMethod {
  name?: unknown
  returnType?: unknown
  params?: unknown
  visibility?: Method['visibility']
  static?: unknown
  abstract?: unknown
}
interface RawEdge {
  source?: unknown
  target?: unknown
  relation?: unknown
  label?: unknown
  sourceField?: unknown
  targetField?: unknown
  sourceCardinality?: unknown
  targetCardinality?: unknown
}
interface RawModel {
  name?: unknown
  description?: unknown
  nodes?: unknown
  edges?: unknown
}

function str(v: unknown): string {
  return v == null ? '' : String(v)
}

/** 把 AI 返回的原始 JSON 规范化为 ModelDoc */
function normalizeModel(
  rawInput: unknown,
  kind: ModelKind,
  fallbackName: string,
  diagramType?: string
): ModelDoc {
  const raw = (rawInput ?? {}) as RawModel
  const rawNodes: RawNode[] = Array.isArray(raw.nodes) ? (raw.nodes as RawNode[]) : []
  const labelToId = new Map<string, string>()
  const nodes: DiagramNode[] = rawNodes.map((rn, idx) => {
    const id = nanoid()
    const label = str(rn.label ?? rn.name) || `节点${idx + 1}`
    labelToId.set(label, id)
    const fields: Field[] = Array.isArray(rn.fields)
      ? (rn.fields as RawField[]).map((rf) => ({
          id: nanoid(),
          name: str(rf.name) || 'field',
          type: rf.type != null ? str(rf.type) : undefined,
          primaryKey: !!rf.primaryKey,
          foreignKey: !!rf.foreignKey,
          unique: !!rf.unique,
          notNull: !!rf.notNull,
          autoIncrement: !!rf.autoIncrement,
          defaultValue: rf.defaultValue != null ? str(rf.defaultValue) : undefined,
          comment: rf.comment != null ? str(rf.comment) : undefined,
          visibility: rf.visibility,
          isTitle: !!rf.isTitle
        }))
      : []
    const methods: Method[] | undefined = Array.isArray(rn.methods)
      ? (rn.methods as RawMethod[]).map((rm) => ({
          id: nanoid(),
          name: str(rm.name) || 'method',
          returnType: rm.returnType != null ? str(rm.returnType) : 'void',
          params: rm.params != null ? str(rm.params) : '',
          visibility: rm.visibility ?? 'public',
          static: !!rm.static,
          abstract: !!rm.abstract
        }))
      : undefined
    const stereotype = VALID_STEREOTYPES.includes(rn.stereotype as NodeStereotype)
      ? (rn.stereotype as NodeStereotype)
      : undefined
    return {
      id,
      label,
      fields,
      methods,
      comment: rn.comment != null ? str(rn.comment) : undefined,
      category: rn.category != null ? str(rn.category) : undefined,
      stereotype,
      position: rn.position ?? { x: 0, y: 0 }
    }
  })

  const rawEdges: RawEdge[] = Array.isArray(raw.edges) ? (raw.edges as RawEdge[]) : []
  const edges: DiagramEdge[] = rawEdges
    .map((re): DiagramEdge | null => {
      const source = labelToId.get(str(re.source)) ?? str(re.source)
      const target = labelToId.get(str(re.target)) ?? str(re.target)
      const valid = nodes.some((n) => n.id === source) && nodes.some((n) => n.id === target)
      if (!valid) return null
      const relation: RelationKind = VALID_RELATIONS.includes(re.relation as RelationKind)
        ? (re.relation as RelationKind)
        : 'association'
      return {
        id: nanoid(),
        source,
        target,
        relation,
        label: re.label != null ? str(re.label) : undefined,
        sourceField: re.sourceField != null ? str(re.sourceField) : undefined,
        targetField: re.targetField != null ? str(re.targetField) : undefined,
        sourceCardinality: re.sourceCardinality != null ? str(re.sourceCardinality) : undefined,
        targetCardinality: re.targetCardinality != null ? str(re.targetCardinality) : undefined
      }
    })
    .filter((e): e is DiagramEdge => e !== null)

  const doc: ModelDoc = {
    id: nanoid(),
    name: str(raw.name) || fallbackName,
    kind,
    diagramType,
    schemaVersion: 1,
    description: raw.description != null ? str(raw.description) : '',
    nodes,
    edges,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  doc.nodes = autoLayout(doc)
  return doc
}

/** 生成全新模型 */
export async function generateModel(
  config: ProviderConfig,
  prompt: string,
  kind: ModelKind,
  diagramType?: string,
  requestOpts?: Pick<AiChatOptions, 'requestId'>
): Promise<ModelDoc> {
  const def = getDiagramType(diagramType)
  if (config.type === 'mock') {
    const doc = mockGenerateModel(prompt, kind)
    doc.diagramType = diagramType
    doc.schemaVersion = 1
    if (def) doc.name = def.name
    doc.nodes = autoLayout(doc)
    return doc
  }
  const hint = def
    ? { name: def.name, genHint: getDiagramSchema(diagramType).genHint }
    : undefined
  const messages = buildGenerateMessages(prompt, kind, hint)
  const content = await callProvider(config, messages, { jsonMode: true, requestId: requestOpts?.requestId })
  const raw = extractJson(content)
  return normalizeModel(raw, kind, def?.name || prompt.slice(0, 20) || '新模型', diagramType)
}

/**
 * 项目驱动：一次性生成多张相互关联的图。
 * 先产出共享领域术语表，再按每个图种逐张生成，保证实体词汇一致。
 * onProgress(done, total, name) 用于 UI 进度反馈。
 */
export async function generateProjectDiagrams(
  config: ProviderConfig,
  prompt: string,
  typeIds: string[],
  onProgress?: (done: number, total: number, name: string) => void
): Promise<ModelDoc[]> {
  const defs = typeIds
    .map((id) => getDiagramType(id))
    .filter((d): d is NonNullable<typeof d> => !!d)
  if (defs.length === 0) return []

  if (config.type === 'mock') {
    const docs: ModelDoc[] = []
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i]
      const doc = mockGenerateModel(prompt, def.engine)
      doc.diagramType = def.id
      doc.schemaVersion = 1
      doc.name = def.name
      doc.nodes = autoLayout(doc)
      docs.push(doc)
      onProgress?.(i + 1, defs.length, def.name)
    }
    return docs
  }

  // 第一步：共享术语表
  let glossary = ''
  try {
    const planMessages = buildProjectPlanMessages(
      prompt,
      defs.map((d) => ({ name: d.name, genHint: getDiagramSchema(d.id).genHint }))
    )
    glossary = await callProvider(config, planMessages, { jsonMode: true })
  } catch {
    glossary = ''
  }

  // 第二步：逐张生成
  const docs: ModelDoc[] = []
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i]
    const hint = { name: def.name, genHint: getDiagramSchema(def.id).genHint }
    const messages = glossary
      ? buildProjectDiagramMessages(prompt, def.engine, hint, glossary)
      : buildGenerateMessages(prompt, def.engine, hint)
    try {
      const content = await callProvider(config, messages, { jsonMode: true })
      const raw = extractJson(content)
      docs.push(normalizeModel(raw, def.engine, def.name, def.id))
    } catch {
      // 单张失败不阻断其余：插入空白占位图
      docs.push(
        normalizeModel({ name: def.name, nodes: [], edges: [] }, def.engine, def.name, def.id)
      )
    }
    onProgress?.(i + 1, defs.length, def.name)
  }
  return docs
}

/** 局部微调 */
export async function refineModel(
  config: ProviderConfig,
  doc: ModelDoc,
  instruction: string,
  scopeIds?: string[],
  requestOpts?: Pick<AiChatOptions, 'requestId'>
): Promise<ModelDoc> {
  if (config.type === 'mock') {
    return mockRefineModel(doc, instruction, scopeIds)
  }
  const scopeLabels = scopeIds
    ?.map((id) => doc.nodes.find((n) => n.id === id)?.label)
    .filter((x): x is string => !!x)
  const messages = buildRefineMessages(doc, instruction, scopeLabels)
  const content = await callProvider(config, messages, { jsonMode: true, requestId: requestOpts?.requestId })
  const raw = extractJson(content)
  const normalized = normalizeModel(raw, doc.kind, doc.name)
  normalized.id = doc.id
  return normalized
}

/** 代码产物（确定性，本地生成，支持多语言/方言/ORM） */
export function generateCodeArtifact(
  doc: ModelDoc,
  target: CodeTarget,
  opts: GenOptions
): string {
  return generateCode(doc, target, opts)
}

/** 数据产物（确定性，本地生成） */
export function generateDataArtifact(
  doc: ModelDoc,
  target: DataTarget,
  opts: GenOptions
): string {
  return generateData(doc, target, opts)
}

/** 文档产物：requirementDoc/aiPrompt 可走真实 AI（失败回退本地）；dataDictionary/aiSpec 始终本地确定性生成 */
export async function generateDocArtifact(
  config: ProviderConfig,
  doc: ModelDoc,
  target: DocTarget
): Promise<string> {
  const local = generateDoc(doc, target)
  const status = describeProviderStatus(config)
  // 缺 Key 或离线模拟一律走本地，不把本地文档生成误做成「必须先有 Key」
  if (status.mode === 'mock' || status.mode === 'missing-key') return local
  if (target === 'dataDictionary' || target === 'aiSpec') return local
  try {
    const role =
      target === 'aiPrompt'
        ? '你是技术负责人，擅长把模型转化为给 AI 编程助手的高质量开发提示词。'
        : '你是产品/需求分析师，擅长把模型转化为规范的 Markdown 需求文档。'
    const task =
      target === 'aiPrompt'
        ? '请根据模型编写结构化的「AI 开发提示词」，含技术栈建议、数据结构、关键模块、接口与实现步骤。只输出 Markdown。'
        : '请根据模型编写一份 Markdown 需求文档，含背景、功能需求、数据模型说明、实体字段表、关系说明、非功能性需求。只输出 Markdown。'
    const messages = buildArtifactMessages(doc, role, task)
    return await callProvider(config, messages)
  } catch (err) {
    return `> ⚠️ AI 调用失败，已回退本地生成器（${DOC_TARGET_LABELS[target]}）：${
      (err as Error).message
    }\n\n${local}`
  }
}
