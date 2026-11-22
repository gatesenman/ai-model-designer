import type { ModelKind } from './types'

/**
 * 图表分组（参考 Enterprise Architect / ArchiMate / SysML / BPMN 的专业分组）
 */
export type DiagramGroupId =
  | 'data'
  | 'uml-structural'
  | 'uml-behavioral'
  | 'sysml'
  | 'bpmn'
  | 'archimate'
  | 'requirements'
  | 'flowchart'
  | 'network'
  | 'c4'
  | 'enterprise'
  | 'concept'
  | 'uiux'
  | 'database'
  | 'integration'
  | 'security'

export const DIAGRAM_GROUP_LABELS: Record<DiagramGroupId, string> = {
  data: '数据建模',
  'uml-structural': 'UML · 结构图',
  'uml-behavioral': 'UML · 行为图',
  sysml: 'SysML · 系统工程',
  bpmn: 'BPMN · 业务流程',
  archimate: 'ArchiMate · 企业架构',
  requirements: '需求工程',
  flowchart: '流程与活动',
  network: '网络与基础设施',
  c4: 'C4 · 软件架构',
  enterprise: '企业架构与战略',
  concept: '概念与知识',
  uiux: 'UI / UX 设计',
  database: '数据库与存储',
  integration: '集成与 API',
  security: '安全与运维'
}

/** 分组展示顺序 */
export const DIAGRAM_GROUP_ORDER: DiagramGroupId[] = [
  'data',
  'uml-structural',
  'uml-behavioral',
  'sysml',
  'bpmn',
  'archimate',
  'c4',
  'requirements',
  'flowchart',
  'network',
  'enterprise',
  'concept',
  'uiux',
  'database',
  'integration',
  'security'
]

export interface DiagramTypeDef {
  /** 唯一标识 */
  id: string
  /** 中文显示名 */
  name: string
  /** 英文/缩写副标题 */
  subtitle?: string
  /** 所属分组 */
  group: DiagramGroupId
  /** 底层渲染引擎（沿用现有 5 种画布之一） */
  engine: ModelKind
  /** 描述 */
  description: string
}

/** 简写构造器 */
function d(
  id: string,
  name: string,
  subtitle: string,
  group: DiagramGroupId,
  engine: ModelKind,
  description: string
): DiagramTypeDef {
  return { id, name, subtitle, group, engine, description }
}

/**
 * 图表类型目录（100+ 种，多数共用画布、按模板/分组区分）。
 * engine 决定底层设计器：
 *  - conceptual：实体 + 关系（概念层）
 *  - logical：实体 + 属性 + 主外键
 *  - physical：表 + 列 + 索引 + 约束
 *  - uml：类 + 属性 + 方法
 *  - architecture：节点盒 + 连线（通用框图）
 */
export const DIAGRAM_CATALOG: DiagramTypeDef[] = [
  // ===== 数据建模 =====
  d('conceptual-erd', '概念数据模型', 'Conceptual ERD', 'data', 'conceptual', '业务领域实体与关系，不含技术细节'),
  d('logical-erd', '逻辑数据模型', 'Logical ERD', 'data', 'logical', '实体、属性、主外键、关系'),
  d('physical-erd', '物理数据模型', 'Physical ERD', 'data', 'physical', '表、列、数据类型、索引、约束'),
  d('dimensional', '维度模型（星型）', 'Star Schema', 'data', 'physical', '事实表 + 维度表，数据仓库星型建模'),
  d('snowflake', '雪花模型', 'Snowflake Schema', 'data', 'physical', '规范化的维度建模'),
  d('data-vault', 'Data Vault', 'Data Vault', 'data', 'physical', 'Hub / Link / Satellite 数据仓库建模'),
  d('data-flow', '数据流图', 'DFD', 'data', 'architecture', '过程、数据存储与数据流'),
  d('data-lineage', '数据血缘图', 'Data Lineage', 'data', 'architecture', '数据从来源到去向的流转链路'),
  d('nosql-document', '文档数据模型', 'Document Model', 'data', 'logical', 'NoSQL 文档 / 集合结构'),
  d('graph-data', '图数据模型', 'Graph Model', 'data', 'conceptual', '节点 + 边的图数据库建模'),
  d('ontology', '本体语义模型', 'Ontology', 'data', 'conceptual', '对象/链接/动作类型（Palantir 风格本体）'),

  // ===== UML 结构图 =====
  d('uml-class', '类图', 'Class Diagram', 'uml-structural', 'uml', '类、属性、方法、关联与继承'),
  d('uml-object', '对象图', 'Object Diagram', 'uml-structural', 'uml', '类的实例及其链接快照'),
  d('uml-component', '组件图', 'Component Diagram', 'uml-structural', 'architecture', '组件、接口与依赖'),
  d('uml-composite', '复合结构图', 'Composite Structure', 'uml-structural', 'uml', '类的内部结构与端口'),
  d('uml-deployment', '部署图', 'Deployment Diagram', 'uml-structural', 'architecture', '节点、构件与部署关系'),
  d('uml-package', '包图', 'Package Diagram', 'uml-structural', 'architecture', '包及其依赖与导入关系'),
  d('uml-profile', '配置文件图', 'Profile Diagram', 'uml-structural', 'uml', '构造型与标记值扩展'),

  // ===== UML 行为图 =====
  d('uml-usecase', '用例图', 'Use Case Diagram', 'uml-behavioral', 'architecture', '参与者、用例与系统边界'),
  d('uml-activity', '活动图', 'Activity Diagram', 'uml-behavioral', 'architecture', '动作、控制流与并发'),
  d('uml-state', '状态机图', 'State Machine', 'uml-behavioral', 'architecture', '状态、转换与事件'),
  d('uml-sequence', '时序图', 'Sequence Diagram', 'uml-behavioral', 'architecture', '对象间按时间顺序的消息交互'),
  d('uml-communication', '通信图', 'Communication Diagram', 'uml-behavioral', 'architecture', '对象间消息与链接'),
  d('uml-timing', '时间图', 'Timing Diagram', 'uml-behavioral', 'architecture', '状态随时间变化的时序'),
  d('uml-interaction', '交互概览图', 'Interaction Overview', 'uml-behavioral', 'architecture', '活动图与交互片段的组合'),

  // ===== SysML =====
  d('sysml-bdd', '块定义图', 'BDD', 'sysml', 'uml', '系统块、值类型与组成'),
  d('sysml-ibd', '内部块图', 'IBD', 'sysml', 'architecture', '块内部部件与端口连接'),
  d('sysml-parametric', '参数图', 'Parametric', 'sysml', 'architecture', '约束与参数绑定'),
  d('sysml-requirement', '需求图', 'Requirement', 'sysml', 'architecture', '需求及其派生/满足/验证关系'),
  d('sysml-activity', '活动图', 'Activity', 'sysml', 'architecture', '系统行为流'),
  d('sysml-sequence', '时序图', 'Sequence', 'sysml', 'architecture', '系统交互时序'),
  d('sysml-state', '状态机图', 'State Machine', 'sysml', 'architecture', '系统状态与转换'),
  d('sysml-usecase', '用例图', 'Use Case', 'sysml', 'architecture', '系统用例与参与者'),
  d('sysml-package', '包图', 'Package', 'sysml', 'architecture', '模型组织结构'),

  // ===== BPMN =====
  d('bpmn-process', '业务流程图', 'Process', 'bpmn', 'architecture', '任务、网关、事件与顺序流'),
  d('bpmn-collaboration', '协作图', 'Collaboration', 'bpmn', 'architecture', '多泳道池间的消息协作'),
  d('bpmn-choreography', '编排图', 'Choreography', 'bpmn', 'architecture', '参与者间的消息编排'),
  d('bpmn-conversation', '会话图', 'Conversation', 'bpmn', 'architecture', '参与者间的会话总览'),

  // ===== ArchiMate =====
  d('archimate-business', '业务层视图', 'Business Layer', 'archimate', 'architecture', '业务角色、流程、服务与对象'),
  d('archimate-application', '应用层视图', 'Application Layer', 'archimate', 'architecture', '应用组件、服务与接口'),
  d('archimate-technology', '技术层视图', 'Technology Layer', 'archimate', 'architecture', '节点、设备、系统软件与网络'),
  d('archimate-motivation', '动机视图', 'Motivation', 'archimate', 'architecture', '干系人、驱动、目标与需求'),
  d('archimate-strategy', '战略视图', 'Strategy', 'archimate', 'architecture', '资源、能力与价值流'),
  d('archimate-migration', '实施与迁移视图', 'Implementation & Migration', 'archimate', 'architecture', '工作包、交付物与里程碑'),
  d('archimate-layered', '分层全景视图', 'Layered View', 'archimate', 'architecture', '业务/应用/技术多层关联'),

  // ===== C4 =====
  d('c4-context', '系统上下文图', 'C4 Context', 'c4', 'architecture', '系统与用户、外部系统的关系'),
  d('c4-container', '容器图', 'C4 Container', 'c4', 'architecture', '应用、数据存储等容器及交互'),
  d('c4-component', '组件图', 'C4 Component', 'c4', 'architecture', '容器内部组件及其职责'),
  d('c4-code', '代码图', 'C4 Code', 'c4', 'uml', '组件内部类级实现（UML 类图）'),
  d('c4-dynamic', '动态图', 'C4 Dynamic', 'c4', 'architecture', '运行时协作与调用顺序'),
  d('c4-deployment', '部署图', 'C4 Deployment', 'c4', 'architecture', '容器到基础设施的映射'),
  d('c4-landscape', '系统全景图', 'C4 Landscape', 'c4', 'architecture', '企业内多系统全景'),

  // ===== 需求工程 =====
  d('req-diagram', '需求图', 'Requirement Diagram', 'requirements', 'architecture', '需求层级与追溯关系'),
  d('req-matrix', '需求追溯矩阵', 'Traceability Matrix', 'requirements', 'logical', '需求与实现/测试的映射'),
  d('feature-model', '特性模型', 'Feature Model', 'requirements', 'architecture', '产品特性及其变体与约束'),
  d('user-story-map', '用户故事地图', 'Story Map', 'requirements', 'architecture', '用户活动、步骤与发布切片'),

  // ===== 流程与活动 =====
  d('flowchart', '流程图', 'Flowchart', 'flowchart', 'architecture', '通用流程：开始/判断/处理/结束'),
  d('swimlane', '泳道图', 'Swimlane', 'flowchart', 'architecture', '按角色划分泳道的流程'),
  d('cross-functional', '跨职能流程图', 'Cross-Functional', 'flowchart', 'architecture', '跨部门协作流程'),
  d('value-stream', '价值流图', 'Value Stream Map', 'flowchart', 'architecture', '端到端价值流与等待时间'),
  d('epc', '事件驱动流程链', 'EPC', 'flowchart', 'architecture', '事件 + 功能 + 连接器'),
  d('decision-tree', '决策树', 'Decision Tree', 'flowchart', 'architecture', '基于条件的分支决策'),
  d('process-map', '流程地图', 'Process Map', 'flowchart', 'architecture', '高层端到端流程概览'),

  // ===== 网络与基础设施 =====
  d('network-topology', '网络拓扑图', 'Network Topology', 'network', 'architecture', '设备、链路与子网'),
  d('infra-deployment', '基础设施部署图', 'Infra Deployment', 'network', 'architecture', '服务器、容器与服务部署'),
  d('cloud-architecture', '云架构图', 'Cloud Architecture', 'network', 'architecture', '云服务与资源拓扑'),
  d('rack-diagram', '机架图', 'Rack Diagram', 'network', 'architecture', '机柜内设备布局'),
  d('data-center', '数据中心图', 'Data Center', 'network', 'architecture', '机房、机架与网络'),
  d('system-context', '系统上下文图', 'System Context', 'network', 'architecture', '系统与外部环境边界'),

  // ===== 企业架构与战略 =====
  d('togaf-adm', 'TOGAF ADM', 'TOGAF ADM', 'enterprise', 'architecture', '架构开发方法各阶段'),
  d('zachman', 'Zachman 框架', 'Zachman', 'enterprise', 'logical', '企业架构分类矩阵'),
  d('capability-map', '能力地图', 'Capability Map', 'enterprise', 'architecture', '业务能力分层视图'),
  d('bmc', '商业模式画布', 'Business Model Canvas', 'enterprise', 'architecture', '九宫格商业模式'),
  d('value-chain', '价值链', 'Value Chain', 'enterprise', 'architecture', '主要活动与支持活动'),
  d('roadmap', '路线图', 'Roadmap', 'enterprise', 'architecture', '时间维度的规划与里程碑'),
  d('org-chart', '组织结构图', 'Org Chart', 'enterprise', 'architecture', '部门与汇报关系'),
  d('raci', 'RACI 职责矩阵', 'RACI Matrix', 'enterprise', 'logical', '任务与角色的职责分配'),

  // ===== 概念与知识 =====
  d('mindmap', '思维导图', 'Mind Map', 'concept', 'architecture', '中心主题发散的树状结构'),
  d('concept-map', '概念图', 'Concept Map', 'concept', 'conceptual', '概念及其命名关系'),
  d('taxonomy', '分类法', 'Taxonomy', 'concept', 'architecture', '层级分类体系'),
  d('knowledge-graph', '知识图谱', 'Knowledge Graph', 'concept', 'conceptual', '实体与关系的语义网络'),
  d('fishbone', '鱼骨图', 'Fishbone', 'concept', 'architecture', '因果分析（石川图）'),
  d('affinity', '亲和图', 'Affinity Diagram', 'concept', 'architecture', '想法分组与归类'),

  // ===== UI / UX =====
  d('wireframe', '线框图', 'Wireframe', 'uiux', 'architecture', '界面布局与元素草图'),
  d('sitemap', '站点地图', 'Sitemap', 'uiux', 'architecture', '页面层级结构'),
  d('user-flow', '用户流程图', 'User Flow', 'uiux', 'architecture', '用户操作路径'),
  d('screen-flow', '界面流转图', 'Screen Flow', 'uiux', 'architecture', '页面之间的跳转关系'),
  d('journey-map', '用户旅程地图', 'Journey Map', 'uiux', 'architecture', '触点、情绪与机会点'),
  d('service-blueprint', '服务蓝图', 'Service Blueprint', 'uiux', 'architecture', '前后台与支撑流程'),

  // ===== 数据库与存储 =====
  d('db-schema', '数据库 Schema 图', 'DB Schema', 'database', 'physical', '库、表、视图结构'),
  d('table-relationship', '表关系图', 'Table Relationship', 'database', 'physical', '表间外键引用关系'),
  d('index-design', '索引设计图', 'Index Design', 'database', 'physical', '索引与查询优化设计'),
  d('partition-design', '分区设计图', 'Partition Design', 'database', 'physical', '分区/分片策略'),
  d('replication', '复制拓扑图', 'Replication', 'database', 'architecture', '主从/集群复制关系'),

  // ===== 集成与 API =====
  d('api-map', 'API 地图', 'API Map', 'integration', 'architecture', 'API 端点与依赖总览'),
  d('api-sequence', 'API 时序图', 'API Sequence', 'integration', 'architecture', '服务间 API 调用时序'),
  d('event-storming', '事件风暴', 'Event Storming', 'integration', 'architecture', '领域事件、命令与聚合'),
  d('message-flow', '消息流图', 'Message Flow', 'integration', 'architecture', '消息队列与主题流转'),
  d('integration-map', '集成架构图', 'Integration Map', 'integration', 'architecture', '系统间集成与中间件'),
  d('microservice', '微服务架构图', 'Microservices', 'integration', 'architecture', '服务、网关与服务发现'),

  // ===== 安全与运维 =====
  d('threat-model', '威胁建模图', 'Threat Model', 'security', 'architecture', '资产、威胁与信任边界（STRIDE）'),
  d('security-architecture', '安全架构图', 'Security Architecture', 'security', 'architecture', '安全分区、控制与边界'),
  d('cicd-pipeline', 'CI/CD 流水线图', 'CI/CD Pipeline', 'security', 'architecture', '构建、测试、部署阶段'),
  d('monitoring', '监控架构图', 'Monitoring', 'security', 'architecture', '指标、日志与告警链路')
]

const CATALOG_BY_ID: Record<string, DiagramTypeDef> = Object.fromEntries(
  DIAGRAM_CATALOG.map((t) => [t.id, t])
)

export function getDiagramType(id?: string): DiagramTypeDef | undefined {
  if (!id) return undefined
  return CATALOG_BY_ID[id]
}

/** 取图表显示名：优先用目录名，回退到引擎类型 */
export function diagramTypeName(typeId: string | undefined, fallback: string): string {
  const def = getDiagramType(typeId)
  return def ? def.name : fallback
}
