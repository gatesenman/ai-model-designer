// 共享类型定义：主进程、预加载、渲染进程通用

/** 模型类型：数据建模三层 + 软件架构模型 */
export type ModelKind =
  | 'conceptual' // 概念模型：实体 + 关系
  | 'logical' // 逻辑模型：实体 + 属性 + 主外键 + 关系
  | 'physical' // 物理模型：表 + 列 + 类型 + 索引 + 约束
  | 'uml' // UML 类图：类 + 属性 + 方法 + 关联
  | 'architecture' // 架构/组件图：组件 + 依赖

export const MODEL_KIND_LABELS: Record<ModelKind, string> = {
  conceptual: '概念模型',
  logical: '逻辑模型',
  physical: '物理模型',
  uml: 'UML 类图',
  architecture: '架构图'
}

/** 字段 / 列 / 属性 */
export interface Field {
  id: string
  name: string
  /** 数据类型，如 string/int/VARCHAR(255) 等；概念模型可留空 */
  type?: string
  /** 是否主键 */
  primaryKey?: boolean
  /** 是否外键 */
  foreignKey?: boolean
  /** 是否唯一 */
  unique?: boolean
  /** 是否非空 */
  notNull?: boolean
  /** 是否自增 */
  autoIncrement?: boolean
  /** 默认值 */
  defaultValue?: string
  /** 备注 */
  comment?: string
  /** UML 可见性 */
  visibility?: 'public' | 'private' | 'protected'
  /** 本体：是否为对象类型的标题属性（Title Property） */
  isTitle?: boolean
}

/** UML 方法 */
export interface Method {
  id: string
  name: string
  returnType?: string
  params?: string
  visibility?: 'public' | 'private' | 'protected'
  /** 静态方法 */
  static?: boolean
  /** 抽象方法 */
  abstract?: boolean
  comment?: string
}

/** 节点构造型：UML（class/interface/abstract/enum）与本体（object/link/action/value） */
export type NodeStereotype =
  | 'class'
  | 'interface'
  | 'abstract'
  | 'enum'
  | 'object'
  | 'link'
  | 'action'
  | 'value'

export const NODE_STEREOTYPE_LABELS: Record<NodeStereotype, string> = {
  class: '类 (class)',
  interface: '接口 (interface)',
  abstract: '抽象类 (abstract)',
  enum: '枚举 (enum)',
  object: '对象类型 (Object Type)',
  link: '链接类型 (Link Type)',
  action: '动作类型 (Action Type)',
  value: '值类型 (Value Type)'
}

/** 节点类型：实体/表/类/组件，统一结构按模型类型解释 */
export interface DiagramNode {
  id: string
  /** 节点标题：实体名/表名/类名/组件名 */
  label: string
  /** 字段/列/属性集合 */
  fields: Field[]
  /** UML 方法（仅 uml 用） */
  methods?: Method[]
  /** 节点备注 */
  comment?: string
  /** 节点类别（architecture 用：service/db/ui/external 等） */
  category?: string
  /** 构造型：UML 类图与本体语义建模用 */
  stereotype?: NodeStereotype
  /** Schema 节点种类 id（来自 diagramSchema，决定形状/调色板项） */
  nodeKind?: string
  /** Schema 驱动的扩展属性键值 */
  props?: Record<string, string | number | boolean>
  position: { x: number; y: number }
}

/** 关系类型 */
export type RelationKind =
  | 'oneToOne'
  | 'oneToMany'
  | 'manyToMany'
  | 'fk' // 外键引用
  | 'association' // 关联
  | 'inheritance' // 继承
  | 'composition' // 组合
  | 'aggregation' // 聚合
  | 'dependency' // 依赖

export const RELATION_LABELS: Record<RelationKind, string> = {
  oneToOne: '一对一',
  oneToMany: '一对多',
  manyToMany: '多对多',
  fk: '外键引用',
  association: '关联',
  inheritance: '继承',
  composition: '组合',
  aggregation: '聚合',
  dependency: '依赖'
}

/** 边 / 关系 */
export interface DiagramEdge {
  id: string
  source: string
  target: string
  relation: RelationKind
  /** 关系标签 */
  label?: string
  /** 源端字段（外键场景） */
  sourceField?: string
  /** 目标端字段（外键场景） */
  targetField?: string
  /** 本体链接：源端基数，如 1 / 0..1 / * / 1..* */
  sourceCardinality?: string
  /** 本体链接：目标端基数 */
  targetCardinality?: string
  /** Schema 连线种类 id */
  edgeKind?: string
}

/** 完整模型文档（一个图） */
export interface ModelDoc {
  id: string
  name: string
  kind: ModelKind
  /** 具体图表类型 id（来自 diagramCatalog，决定模板/分组展示）；缺省时按 kind 显示 */
  diagramType?: string
  description?: string
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  meta?: Record<string, unknown>
  /** 该图所用 Schema 版本（预留升级用） */
  schemaVersion?: number
  createdAt?: string
  updatedAt?: string
}

/** 项目版本快照：保存某一时刻整个项目的图表集合 */
export interface ProjectSnapshot {
  id: string
  /** 快照对应的版本号 */
  version: number
  /** 用户备注 */
  label?: string
  createdAt: string
  /** 统计信息（用于列表展示，避免每次反序列化全量） */
  stats: { models: number; nodes: number; edges: number }
  /** 快照内容 */
  models: ModelDoc[]
  activeModelId: string
}

/** 项目：包含多个模型 */
export interface Project {
  id: string
  name: string
  description?: string
  models: ModelDoc[]
  activeModelId: string
  version: number
  /** 版本快照历史 */
  snapshots?: ProjectSnapshot[]
  createdAt: string
  updatedAt: string
  /** 文件格式标识 */
  format?: 'amdproj'
}

/** AI 供应商类型 */
export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'azure'
  | 'deepseek'
  | 'qwen'
  | 'ollama'
  | 'mock'

export const PROVIDER_LABELS: Record<ProviderType, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  azure: 'Azure OpenAI',
  deepseek: 'DeepSeek',
  qwen: '通义千问 (Qwen)',
  ollama: 'Ollama (本地)',
  mock: '内置模拟 (无需 Key)'
}

/** AI 供应商配置 */
export interface ProviderConfig {
  type: ProviderType
  apiKey?: string
  /** 自定义 baseURL / endpoint */
  baseURL?: string
  model?: string
  /** Azure 专用：部署名 */
  azureDeployment?: string
  /** Azure 专用：api-version */
  azureApiVersion?: string
  temperature?: number
}

export type ThemeMode = 'light' | 'dark'
export type NamingConvention = 'snake_case' | 'camelCase' | 'PascalCase' | 'original'

/** 应用设置 */
export interface AppSettings {
  provider: ProviderConfig
  language: 'zh'
  theme: ThemeMode
  /** 自动保存间隔（秒），0 表示关闭 */
  autosaveInterval: number
  /** 默认新建模型类型 */
  defaultModelKind: ModelKind
  codegen: {
    sqlDialect: SqlDialect
    naming: NamingConvention
  }
}

/** 聊天消息 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** AI 调用可选项 */
export interface AiChatOptions {
  /** 要求模型严格返回 JSON 对象（OpenAI 兼容协议 response_format） */
  jsonMode?: boolean
  /** 最大输出 token */
  maxTokens?: number
  /** 用于取消进行中的请求 */
  requestId?: string
}

/** AI 调用结果 */
export interface AIResult {
  ok: boolean
  content: string
  error?: string
}

/** 产物大类 */
export type ArtifactCategory = 'code' | 'doc' | 'data'

/** SQL 方言 */
export type SqlDialect = 'mysql' | 'postgres' | 'sqlserver' | 'oracle' | 'sqlite'

export const SQL_DIALECT_LABELS: Record<SqlDialect, string> = {
  mysql: 'MySQL',
  postgres: 'PostgreSQL',
  sqlserver: 'SQL Server',
  oracle: 'Oracle',
  sqlite: 'SQLite'
}

/** 代码生成目标 */
export type CodeTarget =
  | 'sql'
  | 'java-pojo'
  | 'java-jpa'
  | 'python-dataclass'
  | 'python-sqlalchemy'
  | 'python-pydantic'
  | 'typescript-interface'
  | 'typescript-typeorm'
  | 'typescript-prisma'
  | 'go-struct'
  | 'csharp-class'
  | 'mongoose'

export const CODE_TARGET_LABELS: Record<CodeTarget, string> = {
  sql: 'SQL DDL',
  'java-pojo': 'Java POJO',
  'java-jpa': 'Java JPA 实体',
  'python-dataclass': 'Python dataclass',
  'python-sqlalchemy': 'Python SQLAlchemy',
  'python-pydantic': 'Python Pydantic',
  'typescript-interface': 'TypeScript Interface',
  'typescript-typeorm': 'TypeScript TypeORM',
  'typescript-prisma': 'Prisma Schema',
  'go-struct': 'Go Struct',
  'csharp-class': 'C# Class',
  mongoose: 'Mongoose Schema'
}

/** 文档生成目标 */
export type DocTarget = 'requirementDoc' | 'dataDictionary' | 'aiSpec' | 'aiPrompt'

export const DOC_TARGET_LABELS: Record<DocTarget, string> = {
  requirementDoc: '需求文档',
  dataDictionary: '数据字典',
  aiSpec: 'AI 规格说明',
  aiPrompt: 'AI 开发提示词'
}

/** 数据生成目标 */
export type DataTarget = 'json' | 'csv' | 'sqlInsert'

export const DATA_TARGET_LABELS: Record<DataTarget, string> = {
  json: 'JSON',
  csv: 'CSV',
  sqlInsert: 'SQL INSERT'
}

/** 导出格式 */
export type ExportFormat = 'json' | 'sql' | 'png' | 'svg' | 'markdown' | 'pdf'

/** 校验问题级别 */
export type IssueSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  id: string
  severity: IssueSeverity
  message: string
  nodeId?: string
  /** 规则编码 */
  rule: string
}

export interface CodeGenOptions {
  sqlDialect: SqlDialect
  naming: NamingConvention
}

/** IPC 通道名 */
export const IPC = {
  AI_CHAT: 'ai:chat',
  AI_CANCEL: 'ai:cancel',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  PROJECT_GET: 'project:get',
  PROJECT_SET: 'project:set',
  SAVE_FILE: 'file:save',
  SAVE_FILE_TO: 'file:saveTo',
  OPEN_FILE: 'file:open',
  SAVE_DIR_FILES: 'file:saveDirFiles',
  MENU_EVENT: 'menu:event',
  APP_CLOSE_REQUEST: 'app:close-request',
  APP_CONFIRM_CLOSE: 'app:confirm-close',
  APP_CANCEL_CLOSE: 'app:cancel-close',
  APP_CLOSE_ACK: 'app:close-ack',
  APP_RENDERER_READY: 'app:renderer-ready',
  APP_NATIVE_CLOSE: 'app:native-close'
} as const

export type MenuEvent =
  | 'new-project'
  | 'open-project'
  | 'save-project'
  | 'save-project-as'
  | 'new-model'
  | 'new-model-conceptual'
  | 'new-model-logical'
  | 'new-model-physical'
  | 'new-model-uml'
  | 'new-model-architecture'
  | 'export'
  | 'export-json'
  | 'export-sql'
  | 'export-markdown'
  | 'export-png'
  | 'export-svg'
  | 'export-pdf'
  | 'export-batch-model'
  | 'export-batch-project'
  | 'undo'
  | 'redo'
  | 'toggle-theme'
  | 'settings'
  | 'about'
  | 'close-project'
  | 'find'
  | 'help-shortcuts'
