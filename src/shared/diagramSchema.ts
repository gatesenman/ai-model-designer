// 中间 Schema（元模型）：每种图表类型的节点种类、连线种类、属性与 AI 语义描述。
// 这是"图种差异化"的地基：调色板、属性编辑器、AI 生成提示、模板都从这里解析。

import { nanoid } from 'nanoid'
import type { DiagramEdge, DiagramNode, ModelDoc, ModelKind, NodeStereotype, RelationKind } from './types'
import type { DiagramGroupId } from './diagramCatalog'
import { getDiagramType } from './diagramCatalog'
import { getRenderKind, type RenderKind } from './diagramRender'

/** 节点形状（architecture 引擎按形状渲染；带字段的卡片用 card） */
export type NodeShape =
  | 'card' // 实体/类卡片（带字段表）
  | 'rect'
  | 'rounded'
  | 'ellipse'
  | 'circle'
  | 'diamond'
  | 'parallelogram'
  | 'cylinder'
  | 'hexagon'
  | 'actor'
  | 'note'

/** 属性定义（驱动属性面板动态表单） */
export interface PropDef {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'enum'
  options?: { value: string; label: string }[]
  default?: string | number | boolean
}

/** 节点种类（图种调色板的一项） */
export interface NodeKindDef {
  id: string
  label: string
  shape: NodeShape
  /** 头部/边框配色（覆盖默认） */
  color?: string
  /** 是否允许编辑字段（实体/类才需要） */
  allowsFields?: boolean
  /** 是否允许编辑方法（UML 类） */
  allowsMethods?: boolean
  /** 新建该种类节点时的默认构造型 */
  defaultStereotype?: NodeStereotype
  /** 新建该种类节点时写入 node.category */
  category?: string
  /** 该种类特有属性 */
  props?: PropDef[]
}

/** 连线种类 */
export interface EdgeKindDef {
  id: string
  label: string
  relation: RelationKind
  directed?: boolean
}

/** 结构化范式（matrix/timeline/swimlane）的初始布局种子 */
export interface LayoutSeed {
  /** matrix：行标题 */
  rows?: string[]
  /** matrix：列标题 */
  cols?: string[]
  /** swimlane：泳道名 */
  lanes?: string[]
  /** timeline：轨道名 */
  tracks?: string[]
  /** timeline：阶段/时段名 */
  periods?: string[]
}

/** 单个图种的解析后 Schema */
export interface DiagramSchema {
  typeId: string
  engine: ModelKind
  /** 视觉语言/交互范式（决定用哪套渲染器） */
  renderKind: RenderKind
  nodeKinds: NodeKindDef[]
  edgeKinds: EdgeKindDef[]
  /** 节点通用扩展属性 */
  nodeProps?: PropDef[]
  /** 图级属性 */
  diagramProps?: PropDef[]
  /** 结构化范式的初始布局种子（matrix/timeline/swimlane） */
  layout?: LayoutSeed
  /** 给 AI 的该图语义说明（拼进生成/微调提示词） */
  genHint: string
}

/* --------------------------- 构造工具 --------------------------- */

function nk(
  id: string,
  label: string,
  shape: NodeShape,
  opts: Partial<NodeKindDef> = {}
): NodeKindDef {
  return { id, label, shape, ...opts }
}

function ek(id: string, label: string, relation: RelationKind, directed = true): EdgeKindDef {
  return { id, label, relation, directed }
}

/* --------------------------- 公共连线集合 --------------------------- */

const DATA_EDGES: EdgeKindDef[] = [
  ek('oneToOne', '一对一', 'oneToOne'),
  ek('oneToMany', '一对多', 'oneToMany'),
  ek('manyToMany', '多对多', 'manyToMany'),
  ek('fk', '外键引用', 'fk')
]

const UML_EDGES: EdgeKindDef[] = [
  ek('association', '关联', 'association'),
  ek('inheritance', '继承/泛化', 'inheritance'),
  ek('composition', '组合', 'composition'),
  ek('aggregation', '聚合', 'aggregation'),
  ek('dependency', '依赖', 'dependency')
]

const FLOW_EDGES: EdgeKindDef[] = [
  ek('dependency', '流向/顺序', 'dependency'),
  ek('association', '关联', 'association')
]

const ARCH_EDGES: EdgeKindDef[] = [
  ek('dependency', '依赖/调用', 'dependency'),
  ek('association', '关联', 'association'),
  ek('composition', '包含', 'composition')
]

/* --------------------------- 公共节点集合 --------------------------- */

const ENTITY_KIND = (label = '实体'): NodeKindDef =>
  nk('entity', label, 'card', { allowsFields: true })

const UML_NODE_KINDS: NodeKindDef[] = [
  nk('class', '类', 'card', { allowsFields: true, allowsMethods: true, defaultStereotype: 'class' }),
  nk('interface', '接口', 'card', {
    allowsFields: true,
    allowsMethods: true,
    defaultStereotype: 'interface'
  }),
  nk('abstract', '抽象类', 'card', {
    allowsFields: true,
    allowsMethods: true,
    defaultStereotype: 'abstract'
  }),
  nk('enum', '枚举', 'card', { allowsFields: true, defaultStereotype: 'enum' })
]

const GENERIC_BOX_KINDS: NodeKindDef[] = [
  nk('component', '组件/节点', 'rounded'),
  nk('group', '分组/边界', 'rect'),
  nk('note', '注释', 'note')
]

/* --------------------------- 分组基线 Schema --------------------------- */

interface GroupBase {
  nodeKinds: NodeKindDef[]
  edgeKinds: EdgeKindDef[]
  nodeProps?: PropDef[]
  diagramProps?: PropDef[]
  layout?: LayoutSeed
  genHint: string
}

/** 流程类图（BPMN/流程图）的图级属性 */
const PROCESS_META: PropDef[] = [
  { key: 'owner', label: '流程负责人', type: 'string' },
  { key: 'version', label: '流程版本', type: 'string' },
  {
    key: 'status',
    label: '状态',
    type: 'enum',
    options: [
      { value: 'draft', label: '草稿' },
      { value: 'review', label: '评审中' },
      { value: 'released', label: '已发布' }
    ],
    default: 'draft'
  }
]

const GROUP_BASE: Record<DiagramGroupId, GroupBase> = {
  data: {
    nodeKinds: [ENTITY_KIND('实体/表')],
    edgeKinds: DATA_EDGES,
    genHint: '数据建模：实体/表为节点，字段含主外键，关系用一对一/一对多/多对多/外键。'
  },
  'uml-structural': {
    nodeKinds: UML_NODE_KINDS,
    edgeKinds: UML_EDGES,
    genHint: 'UML 结构图：类/接口/抽象类/枚举为节点，含属性与方法，关系含继承/组合/聚合/关联/依赖。'
  },
  'uml-behavioral': {
    nodeKinds: [
      nk('action', '动作/活动', 'rounded'),
      nk('decision', '判断', 'diamond'),
      nk('start', '开始', 'circle', { color: '#16a34a' }),
      nk('end', '结束', 'circle', { color: '#dc2626' }),
      nk('object', '对象/状态', 'rect')
    ],
    edgeKinds: FLOW_EDGES,
    genHint: 'UML 行为图：以动作/状态/判断为节点，控制流为有向边。'
  },
  sysml: {
    nodeKinds: [
      nk('block', '块 (Block)', 'card', { allowsFields: true, category: 'block' }),
      nk('valueType', '值类型', 'rect', { category: 'value' }),
      nk('constraint', '约束块', 'hexagon', { category: 'constraint' }),
      nk('requirement', '需求', 'rect', { category: 'requirement' })
    ],
    edgeKinds: [
      ek('composition', '组成', 'composition'),
      ek('association', '关联', 'association'),
      ek('dependency', '依赖/满足', 'dependency')
    ],
    genHint: 'SysML 系统工程：块/值类型/约束/需求为节点，使用组成/关联/依赖关系。'
  },
  bpmn: {
    nodeKinds: [
      nk('task', '任务', 'rounded', { color: '#2563eb' }),
      nk('event', '事件', 'circle', { color: '#16a34a' }),
      nk('gateway', '网关', 'diamond', { color: '#d97706' }),
      nk('pool', '池/泳道', 'rect' ),
      nk('dataObject', '数据对象', 'note')
    ],
    edgeKinds: [
      ek('dependency', '顺序流', 'dependency'),
      ek('association', '消息流', 'association')
    ],
    diagramProps: PROCESS_META,
    genHint: 'BPMN 业务流程：任务/事件/网关/泳道为节点，顺序流与消息流为有向边。'
  },
  archimate: {
    nodeKinds: [
      nk('businessRole', '业务角色', 'rounded', { category: 'business', color: '#eab308' }),
      nk('appComponent', '应用组件', 'rect', { category: 'application', color: '#0ea5e9' }),
      nk('techNode', '技术节点', 'rect', { category: 'technology', color: '#22c55e' }),
      nk('service', '服务', 'rounded', { category: 'service' }),
      nk('grouping', '分组容器', 'rect', { category: 'grouping', color: '#64748b' })
    ],
    edgeKinds: ARCH_EDGES,
    genHint: 'ArchiMate 企业架构：按业务/应用/技术分层，组件与服务节点，关系含服务/实现/依赖。'
  },
  requirements: {
    nodeKinds: [
      nk('requirement', '需求', 'rect', { category: 'requirement' }),
      nk('feature', '特性', 'rounded', { category: 'feature' }),
      nk('actor', '角色', 'actor', { category: 'actor' })
    ],
    edgeKinds: [
      ek('composition', '包含/细化', 'composition'),
      ek('dependency', '追溯/派生', 'dependency')
    ],
    genHint: '需求工程：需求/特性/角色为节点，使用包含、细化、追溯关系。'
  },
  flowchart: {
    nodeKinds: [
      nk('start', '开始/结束', 'ellipse', { color: '#16a34a' }),
      nk('process', '处理', 'rect', { color: '#2563eb' }),
      nk('decision', '判断', 'diamond', { color: '#d97706' }),
      nk('io', '输入/输出', 'parallelogram'),
      nk('subprocess', '子流程', 'rounded')
    ],
    edgeKinds: FLOW_EDGES,
    diagramProps: PROCESS_META,
    genHint: '流程图：开始/处理/判断/输入输出为节点，按流向连接，判断分支标注是/否。'
  },
  network: {
    nodeKinds: [
      nk('server', '服务器', 'rect', { category: 'server' }),
      nk('router', '路由/交换', 'hexagon', { category: 'network' }),
      nk('storage', '存储', 'cylinder', { category: 'storage' }),
      nk('client', '客户端', 'rounded', { category: 'client' }),
      nk('cloud', '云服务', 'rounded', { category: 'cloud' })
    ],
    edgeKinds: [
      ek('association', '链路', 'association', false),
      ek('dependency', '依赖', 'dependency')
    ],
    genHint: '网络与基础设施：服务器/路由/存储/客户端/云为节点，链路为连接边。'
  },
  c4: {
    nodeKinds: [
      nk('person', '用户/角色', 'actor', { category: 'person' }),
      nk('system', '软件系统', 'rect', { category: 'system', color: '#2563eb' }),
      nk('container', '容器', 'rounded', { category: 'container' }),
      nk('component', '组件', 'rounded', { category: 'component' }),
      nk('externalSystem', '外部系统', 'rect', { category: 'external', color: '#6b7280' }),
      nk('db', '数据存储', 'cylinder', { category: 'db' })
    ],
    edgeKinds: [ek('dependency', '使用/调用', 'dependency')],
    genHint: 'C4 软件架构：用户/系统/容器/组件/数据存储为节点，使用"调用/使用"有向关系并标注用途。'
  },
  enterprise: {
    nodeKinds: [
      nk('capability', '能力/职能', 'rounded'),
      nk('unit', '组织单元', 'rect'),
      nk('milestone', '里程碑/阶段', 'rounded')
    ],
    edgeKinds: ARCH_EDGES,
    genHint: '企业架构与战略：能力/组织单元/里程碑为节点，使用分解与依赖关系。'
  },
  concept: {
    nodeKinds: [
      nk('central', '中心主题', 'ellipse', { color: '#7c3aed' }),
      nk('topic', '主题/分支', 'rounded'),
      nk('concept', '概念', 'rect')
    ],
    edgeKinds: [
      ek('composition', '包含/分支', 'composition'),
      ek('association', '关联', 'association')
    ],
    genHint: '概念与知识：中心主题向外发散分支节点，使用包含与关联关系。'
  },
  uiux: {
    nodeKinds: [
      nk('screen', '页面/屏幕', 'rect', { category: 'screen' }),
      nk('component', 'UI 组件', 'rounded', { category: 'component' }),
      nk('decision', '分支', 'diamond'),
      nk('actor', '用户', 'actor')
    ],
    edgeKinds: FLOW_EDGES,
    genHint: 'UI/UX：页面/组件/用户为节点，使用跳转/流向关系。'
  },
  database: {
    nodeKinds: [
      nk('table', '表', 'card', { allowsFields: true, category: 'table' }),
      nk('view', '视图', 'card', { allowsFields: true, category: 'view' }),
      nk('index', '索引', 'rect', { category: 'index' })
    ],
    edgeKinds: DATA_EDGES,
    genHint: '数据库与存储：表/视图/索引为节点，外键引用为关系，列含类型与约束。'
  },
  integration: {
    nodeKinds: [
      nk('service', '服务', 'rounded', { category: 'service', color: '#2563eb' }),
      nk('gateway', '网关', 'hexagon', { category: 'gateway' }),
      nk('queue', '消息队列/主题', 'cylinder', { category: 'queue' }),
      nk('api', 'API/端点', 'rect', { category: 'api' }),
      nk('external', '外部系统', 'rect', { category: 'external', color: '#6b7280' })
    ],
    edgeKinds: [
      ek('dependency', '调用/依赖', 'dependency'),
      ek('association', '消息/事件', 'association')
    ],
    genHint: '集成与 API：服务/网关/队列/API/外部系统为节点，使用调用与消息关系。'
  },
  security: {
    nodeKinds: [
      nk('asset', '资产/数据', 'rect', { category: 'asset' }),
      nk('process', '处理/服务', 'rounded', { category: 'process' }),
      nk('boundary', '信任边界', 'rect', { category: 'boundary', color: '#dc2626' }),
      nk('threat', '威胁', 'hexagon', { category: 'threat', color: '#dc2626' }),
      nk('control', '安全控制', 'rounded', { category: 'control', color: '#16a34a' })
    ],
    edgeKinds: [
      ek('dependency', '数据流/威胁', 'dependency'),
      ek('association', '关联', 'association')
    ],
    genHint: '安全与运维：资产/处理/信任边界/威胁/控制为节点，数据流跨越信任边界。'
  }
}

/* --------------------------- 按图种覆盖（最具差异化的类型） --------------------------- */

const TYPE_OVERRIDE: Record<string, Partial<GroupBase>> = {
  /* ===== 数据建模 ===== */
  'conceptual-erd': {
    nodeKinds: [
      nk('entity', '实体', 'card', { allowsFields: true, category: 'entity', color: '#2563eb' }),
      nk('relationship', '关系（可选实体化）', 'diamond', { category: 'relationship', color: '#d97706' })
    ],
    edgeKinds: [ek('oneToOne', '一对一', 'oneToOne'), ek('oneToMany', '一对多', 'oneToMany'), ek('manyToMany', '多对多', 'manyToMany')],
    genHint: '概念数据模型：业务实体为节点（不含技术细节），关系标注一对一/一对多/多对多与基数。'
  },
  'logical-erd': {
    nodeKinds: [nk('entity', '实体', 'card', { allowsFields: true, category: 'entity', color: '#2563eb' })],
    edgeKinds: DATA_EDGES,
    genHint: '逻辑数据模型：实体含属性与主键/外键，关系用一对一/一对多/多对多/外键，暂不涉及物理类型。'
  },
  'physical-erd': {
    nodeKinds: [
      nk('table', '表', 'card', { allowsFields: true, category: 'table', color: '#2563eb' }),
      nk('view', '视图', 'card', { allowsFields: true, category: 'view', color: '#16a34a' })
    ],
    edgeKinds: DATA_EDGES,
    genHint: '物理数据模型：表/视图含列、数据类型、主外键、索引与约束，外键引用为关系。'
  },
  ontology: {
    nodeKinds: [
      nk('object', '对象类型', 'card', { allowsFields: true, defaultStereotype: 'object' }),
      nk('value', '值类型', 'card', { allowsFields: true, defaultStereotype: 'value' })
    ],
    edgeKinds: [ek('association', '链接类型', 'association')],
    genHint: '本体语义模型：对象类型/值类型为节点，链接类型为关系并标注两端基数。'
  },
  dimensional: {
    nodeKinds: [
      nk('fact', '事实表', 'card', { allowsFields: true, category: 'fact', color: '#dc2626' }),
      nk('dimension', '维度表', 'card', { allowsFields: true, category: 'dimension', color: '#2563eb' })
    ],
    edgeKinds: [ek('fk', '维度引用', 'fk')],
    genHint: '维度模型（星型）：中心事实表通过外键连接周围维度表，事实表含度量与维度键。'
  },
  snowflake: {
    nodeKinds: [
      nk('fact', '事实表', 'card', { allowsFields: true, category: 'fact', color: '#dc2626' }),
      nk('dimension', '维度表', 'card', { allowsFields: true, category: 'dimension', color: '#2563eb' }),
      nk('subdimension', '子维度表', 'card', { allowsFields: true, category: 'subdimension' })
    ],
    edgeKinds: [ek('fk', '外键引用', 'fk')],
    genHint: '雪花模型：事实表连接维度表，维度进一步规范化为子维度表（多层外键）。'
  },
  'data-vault': {
    nodeKinds: [
      nk('hub', 'Hub（业务键）', 'card', { allowsFields: true, category: 'hub', color: '#2563eb' }),
      nk('link', 'Link（关系）', 'card', { allowsFields: true, category: 'link', color: '#d97706' }),
      nk('satellite', 'Satellite（属性）', 'card', { allowsFields: true, category: 'satellite', color: '#16a34a' })
    ],
    edgeKinds: [ek('fk', '引用', 'fk')],
    genHint: 'Data Vault：Hub 存业务键、Link 存关系、Satellite 存描述性属性与历史。'
  },
  'data-flow': {
    nodeKinds: [
      nk('external', '外部实体', 'rect', { category: 'external', color: '#6b7280' }),
      nk('process', '处理过程', 'circle', { category: 'process', color: '#2563eb' }),
      nk('datastore', '数据存储', 'cylinder', { category: 'datastore' })
    ],
    edgeKinds: [ek('dependency', '数据流', 'dependency')],
    genHint: '数据流图(DFD)：外部实体/处理过程/数据存储为节点，有向数据流并标注数据名称。'
  },
  'data-lineage': {
    nodeKinds: [
      nk('source', '数据源', 'cylinder', { category: 'source', color: '#16a34a' }),
      nk('transform', '转换/加工', 'rounded', { category: 'transform', color: '#d97706' }),
      nk('target', '目标/去向', 'cylinder', { category: 'target', color: '#2563eb' })
    ],
    edgeKinds: [ek('dependency', '流向', 'dependency')],
    genHint: '数据血缘：数据源→转换→目标的有向流转链路，标注加工逻辑。'
  },
  'nosql-document': {
    nodeKinds: [
      nk('collection', '集合', 'card', { allowsFields: true, category: 'collection', color: '#16a34a' }),
      nk('document', '文档/子文档', 'card', { allowsFields: true, category: 'document' })
    ],
    edgeKinds: [ek('composition', '内嵌', 'composition'), ek('dependency', '引用', 'dependency')],
    genHint: 'NoSQL 文档模型：集合含文档，文档可内嵌子文档或引用其它集合。'
  },
  'graph-data': {
    nodeKinds: [
      nk('vertex', '节点/顶点', 'circle', { category: 'vertex', color: '#7c3aed' }),
      nk('vprop', '属性节点', 'rounded', { category: 'property' })
    ],
    edgeKinds: [ek('association', '关系边', 'association')],
    genHint: '图数据模型：顶点带标签与属性，关系边有类型与方向（如 Neo4j）。'
  },

  /* ===== UML 结构图 ===== */
  'uml-class': {
    nodeKinds: UML_NODE_KINDS,
    edgeKinds: UML_EDGES,
    genHint: 'UML 类图：类/接口/抽象类/枚举含属性与方法，关系用继承/实现/关联/聚合/组合/依赖并标注多重性。'
  },
  'uml-object': {
    nodeKinds: [nk('object', '对象（实例）', 'card', { allowsFields: true, defaultStereotype: 'object' })],
    edgeKinds: [ek('association', '链接', 'association', false)],
    genHint: 'UML 对象图：类的实例快照（对象:类），字段为具体属性值，链接为实例间关联。'
  },
  'uml-component': {
    nodeKinds: [
      nk('component', '组件', 'rect', { category: 'component', color: '#2563eb' }),
      nk('interface', '接口', 'circle', { category: 'interface' }),
      nk('port', '端口', 'rect', { category: 'port' })
    ],
    edgeKinds: [ek('dependency', '依赖', 'dependency'), ek('association', '提供/需要接口', 'association')],
    genHint: 'UML 组件图：组件通过提供/需要接口连接，标注依赖与端口。'
  },
  'uml-composite': {
    nodeKinds: [
      nk('part', '部件', 'rect', { category: 'part' }),
      nk('port', '端口', 'rect', { category: 'port' }),
      nk('classifier', '类元', 'card', { allowsFields: true })
    ],
    edgeKinds: [ek('association', '连接器', 'association', false)],
    genHint: 'UML 复合结构图：类元内部部件与端口，连接器表示内部装配。'
  },
  'uml-deployment': {
    nodeKinds: [
      nk('node', '节点/设备', 'rect', { category: 'node', color: '#2563eb' }),
      nk('artifact', '构件', 'rect', { category: 'artifact' }),
      nk('device', '执行环境', 'rounded', { category: 'device' })
    ],
    edgeKinds: [ek('dependency', '部署/通信', 'dependency'), ek('association', '连接', 'association', false)],
    genHint: 'UML 部署图：节点/设备承载构件，标注部署与通信路径。'
  },
  'uml-package': {
    nodeKinds: [nk('package', '包', 'rect', { category: 'package', color: '#d97706' })],
    edgeKinds: [ek('dependency', '导入/依赖', 'dependency'), ek('composition', '嵌套', 'composition')],
    genHint: 'UML 包图：包及其嵌套与导入/依赖关系。'
  },
  'uml-profile': {
    nodeKinds: [
      nk('stereotype', '构造型', 'rect', { category: 'stereotype', color: '#7c3aed' }),
      nk('metaclass', '元类', 'card', { allowsFields: true, category: 'metaclass' })
    ],
    edgeKinds: [ek('inheritance', '扩展', 'inheritance')],
    genHint: 'UML 配置文件图：构造型扩展元类，含标记值。'
  },

  /* ===== UML 行为图 ===== */
  'uml-usecase': {
    nodeKinds: [
      nk('actor', '参与者', 'actor', { category: 'actor' }),
      nk('usecase', '用例', 'ellipse', { category: 'usecase', color: '#2563eb' }),
      nk('boundary', '系统边界', 'rect', { category: 'boundary' })
    ],
    edgeKinds: [
      ek('association', '关联', 'association', false),
      ek('dependency', '包含/扩展', 'dependency'),
      ek('inheritance', '泛化', 'inheritance')
    ],
    genHint: 'UML 用例图：参与者(actor)、用例(椭圆)、系统边界为节点，关联/包含/扩展为关系。'
  },
  'uml-state': {
    nodeKinds: [
      nk('initial', '初始', 'circle', { color: '#16a34a' }),
      nk('state', '状态', 'rounded', { color: '#2563eb' }),
      nk('choice', '选择', 'diamond'),
      nk('final', '终止', 'circle', { color: '#dc2626' })
    ],
    edgeKinds: [ek('dependency', '转换', 'dependency')],
    genHint: 'UML 状态机：初始/状态/选择/终止为节点，转换为有向边并标注触发事件。'
  },
  'uml-activity': {
    nodeKinds: [
      nk('initial', '开始', 'circle', { color: '#16a34a' }),
      nk('action', '动作', 'rounded', { color: '#2563eb' }),
      nk('decision', '判断/合并', 'diamond', { color: '#d97706' }),
      nk('fork', '分叉/汇合', 'rect', { color: '#111827' }),
      nk('lane', '泳道', 'rect', { category: 'lane' }),
      nk('final', '结束', 'circle', { color: '#dc2626' })
    ],
    edgeKinds: [ek('dependency', '控制流', 'dependency'), ek('association', '对象流', 'association')],
    genHint: 'UML 活动图：开始/动作/判断/分叉汇合/结束为节点，控制流为有向边，可用泳道分区。'
  },
  'uml-sequence': {
    nodeKinds: [
      nk('actor', '参与者', 'actor', { category: 'actor' }),
      nk('lifeline', '生命线/对象', 'rect', { category: 'lifeline', color: '#2563eb' }),
      nk('fragment', '交互片段', 'rect', { category: 'fragment' })
    ],
    edgeKinds: [
      ek('dependency', '同步消息', 'dependency'),
      ek('association', '返回/异步消息', 'association')
    ],
    genHint: 'UML 时序图：参与者/生命线为节点，消息按时间顺序有向连接，标注消息名与参数。'
  },
  'uml-communication': {
    nodeKinds: [nk('object', '对象', 'rect', { category: 'object', color: '#2563eb' })],
    edgeKinds: [ek('association', '链接（带序号消息）', 'association', false)],
    genHint: 'UML 通信图：对象通过链接连接，链接上标注带序号的消息。'
  },
  'uml-timing': {
    nodeKinds: [
      nk('lifeline', '生命线', 'rect', { category: 'lifeline' }),
      nk('state', '状态', 'rounded', { color: '#2563eb' })
    ],
    edgeKinds: [ek('dependency', '状态迁移', 'dependency')],
    genHint: 'UML 时间图：生命线上状态随时间轴变化，标注时间约束。'
  },
  'uml-interaction': {
    nodeKinds: [
      nk('frame', '交互片段', 'rect', { category: 'frame', color: '#2563eb' }),
      nk('ref', '引用交互', 'rounded', { category: 'ref' }),
      nk('decision', '判断', 'diamond')
    ],
    edgeKinds: [ek('dependency', '控制流', 'dependency')],
    genHint: 'UML 交互概览图：以活动图骨架串联各交互片段(ref)。'
  },
  'org-chart': {
    nodeKinds: [nk('unit', '部门/岗位', 'rect')],
    edgeKinds: [ek('composition', '汇报/隶属', 'composition')],
    genHint: '组织结构图：部门/岗位为节点，自上而下的隶属/汇报关系（树形）。'
  },
  mindmap: {
    nodeKinds: [
      nk('central', '中心主题', 'ellipse', { color: '#7c3aed' }),
      nk('branch', '分支', 'rounded')
    ],
    edgeKinds: [ek('composition', '分支', 'composition')],
    genHint: '思维导图：单一中心主题向外发散多层分支（树形结构）。'
  },
  fishbone: {
    nodeKinds: [
      nk('effect', '问题/结果', 'rect', { color: '#dc2626' }),
      nk('cause', '原因类别', 'rounded'),
      nk('subcause', '子原因', 'rect')
    ],
    edgeKinds: [ek('dependency', '导致', 'dependency')],
    genHint: '鱼骨图：右侧为问题结果，多条原因类别分支汇入主干。'
  },

  /* ===== SysML ===== */
  'sysml-bdd': {
    nodeKinds: [
      nk('block', '块 (Block)', 'card', { allowsFields: true, allowsMethods: true, category: 'block', color: '#2563eb' }),
      nk('valueType', '值类型', 'rect', { category: 'value' }),
      nk('constraint', '约束块', 'hexagon', { category: 'constraint' })
    ],
    edgeKinds: [ek('composition', '组成', 'composition'), ek('association', '关联', 'association'), ek('inheritance', '泛化', 'inheritance')],
    genHint: 'SysML 块定义图(BDD)：块含属性/操作，通过组成/关联/泛化组织系统结构。'
  },
  'sysml-ibd': {
    nodeKinds: [
      nk('part', '部件', 'rect', { category: 'part', color: '#2563eb' }),
      nk('port', '端口', 'rect', { category: 'port' })
    ],
    edgeKinds: [ek('association', '连接器/流', 'association', false)],
    genHint: 'SysML 内部块图(IBD)：块内部部件通过端口与连接器互联，标注物质/能量/信息流。'
  },
  'sysml-parametric': {
    nodeKinds: [
      nk('constraint', '约束块', 'hexagon', { category: 'constraint', color: '#d97706' }),
      nk('parameter', '参数', 'rect', { category: 'parameter' })
    ],
    edgeKinds: [ek('association', '参数绑定', 'association', false)],
    genHint: 'SysML 参数图：约束块的参数与系统属性绑定，表达工程方程。'
  },
  'sysml-requirement': {
    nodeKinds: [
      nk('requirement', '需求', 'rect', { category: 'requirement', color: '#2563eb' }),
      nk('testcase', '测试用例', 'rounded', { category: 'testcase', color: '#16a34a' })
    ],
    edgeKinds: [ek('dependency', '派生/满足/验证', 'dependency'), ek('composition', '包含', 'composition')],
    genHint: 'SysML 需求图：需求层级 + 派生/满足/验证/精化追溯，测试用例验证需求。'
  },
  'sysml-activity': {
    nodeKinds: [
      nk('action', '动作', 'rounded', { color: '#2563eb' }),
      nk('decision', '判断', 'diamond'),
      nk('initial', '开始', 'circle', { color: '#16a34a' }),
      nk('final', '结束', 'circle', { color: '#dc2626' })
    ],
    edgeKinds: [ek('dependency', '控制/对象流', 'dependency')],
    genHint: 'SysML 活动图：系统行为按控制流/对象流串联动作。'
  },
  'sysml-sequence': {
    nodeKinds: [nk('lifeline', '生命线', 'rect', { category: 'lifeline', color: '#2563eb' })],
    edgeKinds: [ek('dependency', '消息', 'dependency')],
    genHint: 'SysML 时序图：生命线间按时间顺序传递消息。'
  },
  'sysml-state': {
    nodeKinds: [
      nk('initial', '初始', 'circle', { color: '#16a34a' }),
      nk('state', '状态', 'rounded', { color: '#2563eb' }),
      nk('final', '终止', 'circle', { color: '#dc2626' })
    ],
    edgeKinds: [ek('dependency', '转换', 'dependency')],
    genHint: 'SysML 状态机图：系统状态与事件驱动的转换。'
  },
  'sysml-usecase': {
    nodeKinds: [
      nk('actor', '参与者', 'actor', { category: 'actor' }),
      nk('usecase', '用例', 'ellipse', { category: 'usecase', color: '#2563eb' })
    ],
    edgeKinds: [ek('association', '关联', 'association', false), ek('dependency', '包含/扩展', 'dependency')],
    genHint: 'SysML 用例图：参与者与系统用例及其关系。'
  },
  'sysml-package': {
    nodeKinds: [nk('package', '包', 'rect', { category: 'package', color: '#d97706' })],
    edgeKinds: [ek('dependency', '依赖', 'dependency'), ek('composition', '包含', 'composition')],
    genHint: 'SysML 包图：模型元素的组织与命名空间。'
  },

  /* ===== BPMN ===== */
  'bpmn-process': {
    nodeKinds: [
      nk('startEvent', '开始事件', 'circle', { category: 'event', color: '#16a34a' }),
      nk('task', '任务', 'rounded', { color: '#2563eb' }),
      nk('gateway', '网关', 'diamond', { color: '#d97706' }),
      nk('subprocess', '子流程', 'rect', { color: '#7c3aed' }),
      nk('lane', '泳道', 'rect', { category: 'lane' }),
      nk('dataObject', '数据对象', 'note', { category: 'data' }),
      nk('endEvent', '结束事件', 'circle', { category: 'event', color: '#dc2626' })
    ],
    edgeKinds: [ek('dependency', '顺序流', 'dependency'), ek('association', '消息/关联', 'association')],
    genHint: 'BPMN 流程图：开始/任务/网关/子流程/结束用顺序流连接，可选泳道分区与数据对象。'
  },
  'bpmn-collaboration': {
    nodeKinds: [
      nk('pool', '池', 'rect', { category: 'pool' }),
      nk('lane', '泳道', 'rect', { category: 'lane' }),
      nk('task', '任务', 'rounded', { color: '#2563eb' }),
      nk('event', '事件', 'circle', { color: '#16a34a' }),
      nk('gateway', '网关', 'diamond', { color: '#d97706' })
    ],
    edgeKinds: [ek('dependency', '顺序流', 'dependency'), ek('association', '消息流', 'association')],
    genHint: 'BPMN 协作图：多个池/泳道间通过消息流协作，池内为顺序流。'
  },
  'bpmn-choreography': {
    nodeKinds: [
      nk('choreographyTask', '编排任务', 'rounded', { color: '#7c3aed' }),
      nk('participant', '参与者', 'rect', { category: 'participant' }),
      nk('event', '事件', 'circle', { color: '#16a34a' })
    ],
    edgeKinds: [ek('dependency', '顺序流', 'dependency')],
    genHint: 'BPMN 编排图：以编排任务描述参与者间的消息交换顺序。'
  },
  'bpmn-conversation': {
    nodeKinds: [
      nk('participant', '参与者', 'rect', { category: 'participant', color: '#2563eb' }),
      nk('conversation', '会话', 'hexagon', { category: 'conversation', color: '#d97706' })
    ],
    edgeKinds: [ek('association', '会话链接', 'association', false)],
    genHint: 'BPMN 会话图：参与者与会话节点的高层通信总览。'
  },

  /* ===== ArchiMate ===== */
  'archimate-business': {
    nodeKinds: [
      nk('actor', '业务角色/参与者', 'actor', { category: 'business', color: '#eab308' }),
      nk('process', '业务流程', 'rounded', { category: 'business', color: '#eab308' }),
      nk('service', '业务服务', 'rounded', { category: 'business' }),
      nk('object', '业务对象', 'rect', { category: 'business' })
    ],
    edgeKinds: ARCH_EDGES,
    genHint: 'ArchiMate 业务层：角色/流程/服务/对象，使用服务/实现/触发关系。'
  },
  'archimate-application': {
    nodeKinds: [
      nk('appComponent', '应用组件', 'rect', { category: 'application', color: '#0ea5e9' }),
      nk('appService', '应用服务', 'rounded', { category: 'application', color: '#0ea5e9' }),
      nk('appInterface', '应用接口', 'circle', { category: 'application' }),
      nk('dataObject', '数据对象', 'rect', { category: 'application' })
    ],
    edgeKinds: ARCH_EDGES,
    genHint: 'ArchiMate 应用层：应用组件/服务/接口/数据对象及其关系。'
  },
  'archimate-technology': {
    nodeKinds: [
      nk('node', '节点', 'rect', { category: 'technology', color: '#22c55e' }),
      nk('device', '设备', 'rect', { category: 'technology', color: '#22c55e' }),
      nk('systemSoftware', '系统软件', 'rounded', { category: 'technology' }),
      nk('network', '通信网络', 'hexagon', { category: 'technology' })
    ],
    edgeKinds: ARCH_EDGES,
    genHint: 'ArchiMate 技术层：节点/设备/系统软件/网络及其部署与连接。'
  },
  'archimate-motivation': {
    nodeKinds: [
      nk('stakeholder', '干系人', 'actor', { category: 'motivation', color: '#a855f7' }),
      nk('driver', '驱动因素', 'rounded', { category: 'motivation', color: '#a855f7' }),
      nk('goal', '目标', 'ellipse', { category: 'motivation' }),
      nk('requirement', '需求', 'rect', { category: 'motivation' })
    ],
    edgeKinds: [ek('dependency', '影响/实现', 'dependency'), ek('composition', '分解', 'composition')],
    genHint: 'ArchiMate 动机视图：干系人/驱动/目标/需求及其影响与实现关系。'
  },
  'archimate-strategy': {
    nodeKinds: [
      nk('resource', '资源', 'rect', { category: 'strategy', color: '#f97316' }),
      nk('capability', '能力', 'rounded', { category: 'strategy', color: '#f97316' }),
      nk('valueStream', '价值流', 'hexagon', { category: 'strategy' })
    ],
    edgeKinds: ARCH_EDGES,
    genHint: 'ArchiMate 战略视图：资源/能力/价值流及其实现关系。'
  },
  'archimate-migration': {
    nodeKinds: [
      nk('workPackage', '工作包', 'rect', { category: 'migration', color: '#0ea5e9' }),
      nk('deliverable', '交付物', 'rounded', { category: 'migration' }),
      nk('plateau', '过渡阶段', 'rect', { category: 'migration', color: '#16a34a' })
    ],
    edgeKinds: [ek('dependency', '触发/流', 'dependency'), ek('composition', '组成', 'composition')],
    genHint: 'ArchiMate 实施与迁移：工作包/交付物/过渡阶段及其顺序。'
  },
  'archimate-layered': {
    nodeKinds: [
      nk('business', '业务层', 'rounded', { category: 'business', color: '#eab308' }),
      nk('application', '应用层', 'rect', { category: 'application', color: '#0ea5e9' }),
      nk('technology', '技术层', 'rect', { category: 'technology', color: '#22c55e' })
    ],
    edgeKinds: ARCH_EDGES,
    genHint: 'ArchiMate 分层全景：业务/应用/技术三层元素纵向关联。'
  },

  /* ===== C4 ===== */
  'c4-context': {
    nodeKinds: [
      nk('person', '用户/角色', 'actor', { category: 'person' }),
      nk('system', '目标系统', 'rect', { category: 'system', color: '#2563eb' }),
      nk('externalSystem', '外部系统', 'rect', { category: 'external', color: '#6b7280' })
    ],
    edgeKinds: [ek('dependency', '使用/交互', 'dependency')],
    genHint: 'C4 系统上下文图：目标系统与用户、外部系统的交互，最高层视角。'
  },
  'c4-container': {
    nodeKinds: [
      nk('person', '用户', 'actor', { category: 'person' }),
      nk('container', '容器（应用/服务）', 'rounded', { category: 'container', color: '#2563eb' }),
      nk('db', '数据存储', 'cylinder', { category: 'db' }),
      nk('externalSystem', '外部系统', 'rect', { category: 'external', color: '#6b7280' })
    ],
    edgeKinds: [ek('dependency', '调用/读写', 'dependency')],
    genHint: 'C4 容器图：系统内部的应用/服务/数据存储容器及交互，标注技术栈。'
  },
  'c4-component': {
    nodeKinds: [
      nk('component', '组件', 'rounded', { category: 'component', color: '#2563eb' }),
      nk('container', '所在容器', 'rect', { category: 'container' }),
      nk('db', '数据存储', 'cylinder', { category: 'db' })
    ],
    edgeKinds: [ek('dependency', '调用', 'dependency')],
    genHint: 'C4 组件图：单个容器内部的组件及其职责与调用关系。'
  },
  'c4-code': {
    nodeKinds: UML_NODE_KINDS,
    edgeKinds: UML_EDGES,
    genHint: 'C4 代码图：以 UML 类图表达组件内部类级实现。'
  },
  'c4-dynamic': {
    nodeKinds: [
      nk('container', '容器', 'rounded', { category: 'container', color: '#2563eb' }),
      nk('component', '组件', 'rounded', { category: 'component' }),
      nk('person', '用户', 'actor', { category: 'person' })
    ],
    edgeKinds: [ek('dependency', '带序号调用', 'dependency')],
    genHint: 'C4 动态图：运行时元素间带序号的调用协作顺序。'
  },
  'c4-deployment': {
    nodeKinds: [
      nk('deploymentNode', '部署节点/环境', 'rect', { category: 'node', color: '#22c55e' }),
      nk('container', '容器实例', 'rounded', { category: 'container', color: '#2563eb' }),
      nk('db', '数据存储', 'cylinder', { category: 'db' })
    ],
    edgeKinds: [ek('dependency', '通信', 'dependency'), ek('composition', '部署于', 'composition')],
    genHint: 'C4 部署图：容器实例到基础设施节点的部署映射。'
  },
  'c4-landscape': {
    nodeKinds: [
      nk('system', '软件系统', 'rect', { category: 'system', color: '#2563eb' }),
      nk('externalSystem', '外部系统', 'rect', { category: 'external', color: '#6b7280' }),
      nk('person', '用户', 'actor', { category: 'person' })
    ],
    edgeKinds: [ek('dependency', '交互', 'dependency')],
    genHint: 'C4 系统全景图：企业内多个系统与用户的宏观关系。'
  },

  /* ===== 需求工程 ===== */
  'req-diagram': {
    nodeKinds: [
      nk('requirement', '需求', 'rect', { category: 'requirement', color: '#2563eb' }),
      nk('subrequirement', '子需求', 'rect', { category: 'requirement' }),
      nk('testcase', '测试/验证', 'rounded', { category: 'testcase', color: '#16a34a' })
    ],
    edgeKinds: [ek('composition', '包含/细化', 'composition'), ek('dependency', '派生/验证', 'dependency')],
    genHint: '需求图：需求层级 + 派生/细化/验证追溯关系。'
  },
  'req-matrix': {
    nodeKinds: [
      nk('requirement', '需求', 'card', { allowsFields: true, category: 'requirement', color: '#2563eb' }),
      nk('artifact', '实现/测试项', 'card', { allowsFields: true, category: 'artifact' })
    ],
    edgeKinds: [ek('dependency', '追溯', 'dependency')],
    genHint: '需求追溯矩阵：需求与实现/测试项的映射（行列矩阵）。'
  },
  'feature-model': {
    nodeKinds: [
      nk('feature', '特性', 'rounded', { category: 'feature', color: '#2563eb' }),
      nk('mandatory', '必选特性', 'rounded', { category: 'mandatory', color: '#16a34a' }),
      nk('optional', '可选特性', 'rounded', { category: 'optional', color: '#d97706' })
    ],
    edgeKinds: [ek('composition', '分解', 'composition'), ek('dependency', '依赖/互斥', 'dependency')],
    genHint: '特性模型：产品特性树 + 必选/可选/或/替代变体与约束。'
  },
  'user-story-map': {
    nodeKinds: [
      nk('activity', '用户活动', 'rect', { category: 'activity', color: '#2563eb' }),
      nk('step', '步骤', 'rounded', { category: 'step' }),
      nk('story', '用户故事', 'note', { category: 'story' }),
      nk('release', '发布切片', 'rect', { category: 'release', color: '#16a34a' })
    ],
    edgeKinds: [ek('composition', '归属', 'composition'), ek('dependency', '顺序', 'dependency')],
    genHint: '用户故事地图：活动→步骤→故事，横向为流程、纵向为发布优先级。'
  },

  /* ===== 流程与活动 ===== */
  swimlane: {
    nodeKinds: [
      nk('lane', '泳道', 'rect', { category: 'lane' }),
      nk('process', '处理', 'rect', { color: '#2563eb' }),
      nk('decision', '判断', 'diamond', { color: '#d97706' }),
      nk('start', '开始/结束', 'ellipse', { color: '#16a34a' })
    ],
    edgeKinds: FLOW_EDGES,
    genHint: '泳道图：按角色/部门划分泳道，流程活动落入对应泳道。'
  },
  'cross-functional': {
    nodeKinds: [
      nk('lane', '职能泳道', 'rect', { category: 'lane' }),
      nk('process', '活动', 'rect', { color: '#2563eb' }),
      nk('decision', '判断', 'diamond', { color: '#d97706' })
    ],
    edgeKinds: FLOW_EDGES,
    genHint: '跨职能流程图：跨部门协作，泳道表示职能，箭头跨泳道流转。'
  },
  'value-stream': {
    nodeKinds: [
      nk('process', '工序', 'rect', { color: '#2563eb' }),
      nk('inventory', '库存/等待', 'diamond', { color: '#d97706' }),
      nk('supplier', '供应商', 'rect', { category: 'supplier' }),
      nk('customer', '客户', 'rect', { category: 'customer' })
    ],
    edgeKinds: [ek('dependency', '物流/信息流', 'dependency')],
    genHint: '价值流图(VSM)：供应商→工序→客户，标注周期时间/等待时间/库存。'
  },
  epc: {
    nodeKinds: [
      nk('event', '事件', 'hexagon', { color: '#d97706' }),
      nk('function', '功能', 'rounded', { color: '#16a34a' }),
      nk('connector', '连接器(AND/OR/XOR)', 'circle', { category: 'connector' })
    ],
    edgeKinds: [ek('dependency', '控制流', 'dependency')],
    genHint: '事件驱动流程链(EPC)：事件与功能交替出现，用 AND/OR/XOR 连接器分支。'
  },
  'decision-tree': {
    nodeKinds: [
      nk('decision', '决策节点', 'diamond', { color: '#d97706' }),
      nk('branch', '分支/条件', 'rect' ),
      nk('leaf', '结果/叶子', 'rounded', { color: '#16a34a' })
    ],
    edgeKinds: [ek('dependency', '条件分支', 'dependency')],
    genHint: '决策树：决策节点按条件分支，叶子为结果（自上而下/左右树形）。'
  },
  'process-map': {
    nodeKinds: [
      nk('process', '流程', 'rect', { color: '#2563eb' }),
      nk('subprocess', '子流程', 'rounded' )
    ],
    edgeKinds: FLOW_EDGES,
    genHint: '流程地图：高层端到端流程与子流程概览。'
  },

  /* ===== 网络与基础设施 ===== */
  'network-topology': {
    nodeKinds: [
      nk('router', '路由器', 'hexagon', { category: 'network', color: '#2563eb' }),
      nk('switch', '交换机', 'rect', { category: 'network' }),
      nk('firewall', '防火墙', 'rect', { category: 'security', color: '#dc2626' }),
      nk('server', '服务器', 'rect', { category: 'server' }),
      nk('client', '终端', 'rounded', { category: 'client' })
    ],
    edgeKinds: [ek('association', '链路', 'association', false)],
    genHint: '网络拓扑图：路由/交换/防火墙/服务器/终端及物理链路。'
  },
  'infra-deployment': {
    nodeKinds: [
      nk('server', '服务器/主机', 'rect', { category: 'server', color: '#2563eb' }),
      nk('container', '容器/Pod', 'rounded', { category: 'container' }),
      nk('service', '服务', 'rounded', { category: 'service' }),
      nk('loadbalancer', '负载均衡', 'hexagon', { category: 'lb', color: '#d97706' })
    ],
    edgeKinds: [ek('dependency', '部署/调用', 'dependency')],
    genHint: '基础设施部署图：主机/容器/服务/负载均衡的部署与调用关系。'
  },
  'cloud-architecture': {
    nodeKinds: [
      nk('cloudService', '云服务', 'rounded', { category: 'cloud', color: '#0ea5e9' }),
      nk('compute', '计算', 'rect', { category: 'compute', color: '#2563eb' }),
      nk('storage', '存储', 'cylinder', { category: 'storage' }),
      nk('network', '网络/VPC', 'hexagon', { category: 'network' })
    ],
    edgeKinds: [ek('dependency', '调用/依赖', 'dependency')],
    genHint: '云架构图：云服务/计算/存储/网络资源拓扑（AWS/Azure/GCP 风格）。'
  },
  'rack-diagram': {
    nodeKinds: [
      nk('rack', '机柜', 'rect', { category: 'rack' }),
      nk('device', '设备(U位)', 'rect', { category: 'device', color: '#2563eb' })
    ],
    edgeKinds: [ek('association', '连接', 'association', false)],
    genHint: '机架图：机柜内按 U 位布局的设备。'
  },
  'data-center': {
    nodeKinds: [
      nk('room', '机房/区域', 'rect', { category: 'room' }),
      nk('rack', '机架', 'rect', { category: 'rack', color: '#2563eb' }),
      nk('device', '设备', 'rect', { category: 'device' })
    ],
    edgeKinds: [ek('composition', '包含', 'composition'), ek('association', '网络连接', 'association', false)],
    genHint: '数据中心图：机房→机架→设备的层级布局与网络。'
  },
  'system-context': {
    nodeKinds: [
      nk('system', '系统', 'rect', { category: 'system', color: '#2563eb' }),
      nk('external', '外部系统', 'rect', { category: 'external', color: '#6b7280' }),
      nk('actor', '用户', 'actor', { category: 'actor' })
    ],
    edgeKinds: [ek('dependency', '交互', 'dependency')],
    genHint: '系统上下文图：目标系统与外部环境（用户/外部系统）的边界与交互。'
  },

  /* ===== 企业架构与战略 ===== */
  'togaf-adm': {
    nodeKinds: [
      nk('phase', 'ADM 阶段', 'rounded', { category: 'phase', color: '#2563eb' }),
      nk('deliverable', '交付物', 'rect', { category: 'deliverable' })
    ],
    edgeKinds: [ek('dependency', '迭代/输入', 'dependency')],
    genHint: 'TOGAF ADM：预备/愿景/业务/信息系统/技术/机会/迁移等阶段循环。'
  },
  zachman: {
    nodeKinds: [nk('cell', '框架单元', 'card', { allowsFields: true, category: 'cell', color: '#2563eb' })],
    edgeKinds: [ek('association', '关联', 'association', false)],
    genHint: 'Zachman 框架：What/How/Where/Who/When/Why × 六视角的分类矩阵单元。'
  },
  'capability-map': {
    nodeKinds: [
      nk('capability', '业务能力', 'rounded', { category: 'capability', color: '#2563eb' }),
      nk('subcapability', '子能力', 'rect', { category: 'subcapability' })
    ],
    edgeKinds: [ek('composition', '分解', 'composition')],
    genHint: '能力地图：业务能力分层分解（L1/L2/L3）。'
  },
  bmc: {
    nodeKinds: [nk('segment', '画布模块', 'rect', { category: 'segment', color: '#2563eb' })],
    edgeKinds: [ek('association', '关联', 'association', false)],
    genHint: '商业模式画布：客户细分/价值主张/渠道/客户关系/收入/资源/活动/伙伴/成本九模块。'
  },
  'value-chain': {
    nodeKinds: [
      nk('primary', '主要活动', 'rect', { category: 'primary', color: '#2563eb' }),
      nk('support', '支持活动', 'rounded', { category: 'support', color: '#16a34a' })
    ],
    edgeKinds: [ek('dependency', '流向', 'dependency')],
    genHint: '价值链：入站物流/运营/出站物流/营销/服务等主要活动 + 支持活动。'
  },
  roadmap: {
    nodeKinds: [
      nk('phase', '阶段/时间段', 'rect', { category: 'phase' }),
      nk('initiative', '举措/工作项', 'rounded', { category: 'initiative', color: '#2563eb' }),
      nk('milestone', '里程碑', 'diamond', { category: 'milestone', color: '#dc2626' })
    ],
    edgeKinds: [ek('dependency', '依赖/顺序', 'dependency')],
    genHint: '路线图：时间轴上的阶段/举措/里程碑规划。'
  },
  raci: {
    nodeKinds: [
      nk('task', '任务/活动', 'card', { allowsFields: true, category: 'task', color: '#2563eb' }),
      nk('role', '角色', 'rounded', { category: 'role' })
    ],
    edgeKinds: [ek('association', 'R/A/C/I', 'association')],
    genHint: 'RACI 矩阵：任务×角色，标注负责/批准/咨询/知会。'
  },

  /* ===== 概念与知识 ===== */
  'concept-map': {
    nodeKinds: [nk('concept', '概念', 'rounded', { category: 'concept', color: '#7c3aed' })],
    edgeKinds: [ek('association', '命名关系', 'association')],
    genHint: '概念图：概念为节点，连线上标注命名关系（如"包含""导致"）。'
  },
  taxonomy: {
    nodeKinds: [
      nk('category', '分类', 'rect', { category: 'category', color: '#2563eb' }),
      nk('subcategory', '子分类', 'rounded', { category: 'subcategory' })
    ],
    edgeKinds: [ek('composition', '上下位', 'composition')],
    genHint: '分类法：层级分类体系（树形上下位关系）。'
  },
  'knowledge-graph': {
    nodeKinds: [
      nk('entity', '实体', 'circle', { category: 'entity', color: '#7c3aed' }),
      nk('literal', '属性值', 'rounded', { category: 'literal' })
    ],
    edgeKinds: [ek('association', '语义关系', 'association')],
    genHint: '知识图谱：实体节点 + 有向语义关系（主-谓-宾三元组）。'
  },
  affinity: {
    nodeKinds: [
      nk('group', '分组', 'rect', { category: 'group', color: '#2563eb' }),
      nk('idea', '想法/便签', 'note', { category: 'idea' })
    ],
    edgeKinds: [ek('composition', '归入', 'composition')],
    genHint: '亲和图：将想法便签按相似性归入分组。'
  },

  /* ===== UI / UX ===== */
  wireframe: {
    nodeKinds: [
      nk('screen', '页面/屏幕', 'rect', { category: 'screen', color: '#2563eb' }),
      nk('section', '区域', 'rect', { category: 'section' }),
      nk('button', '按钮', 'rounded', { category: 'ui-button', color: '#2563eb' }),
      nk('input', '输入框', 'rect', { category: 'ui-input' }),
      nk('text', '文本', 'rect', { category: 'ui-text' }),
      nk('image', '图片', 'rect', { category: 'ui-image' }),
      nk('checkbox', '复选框', 'rect', { category: 'ui-checkbox' }),
      nk('dropdown', '下拉框', 'rect', { category: 'ui-dropdown' }),
      nk('list', '列表', 'rect', { category: 'ui-list' }),
      nk('avatar', '头像', 'circle', { category: 'ui-avatar' })
    ],
    edgeKinds: [ek('composition', '包含', 'composition')],
    genHint: '线框图：页面内区域与真实 UI 控件（按钮/输入框/文本/图片/复选框/下拉/列表/头像）的低保真布局。'
  },
  sitemap: {
    nodeKinds: [
      nk('page', '页面', 'rect', { category: 'page', color: '#2563eb' }),
      nk('subpage', '子页面', 'rounded', { category: 'subpage' })
    ],
    edgeKinds: [ek('composition', '层级', 'composition')],
    genHint: '站点地图：页面层级结构（树形）。'
  },
  'user-flow': {
    nodeKinds: [
      nk('screen', '页面', 'rect', { category: 'screen', color: '#2563eb' }),
      nk('action', '操作', 'rounded', { category: 'action' }),
      nk('decision', '分支', 'diamond', { color: '#d97706' })
    ],
    edgeKinds: FLOW_EDGES,
    genHint: '用户流程图：页面/操作/分支组成的用户操作路径。'
  },
  'screen-flow': {
    nodeKinds: [
      nk('screen', '页面', 'rect', { category: 'screen', color: '#2563eb' }),
      nk('modal', '弹窗/浮层', 'rounded', { category: 'modal' })
    ],
    edgeKinds: [ek('dependency', '跳转', 'dependency')],
    genHint: '界面流转图：页面与弹窗之间的跳转关系。'
  },
  'journey-map': {
    nodeKinds: [
      nk('stage', '阶段', 'rect', { category: 'stage', color: '#2563eb' }),
      nk('touchpoint', '触点', 'rounded', { category: 'touchpoint' }),
      nk('emotion', '情绪/机会点', 'ellipse', { category: 'emotion', color: '#d97706' })
    ],
    edgeKinds: [ek('dependency', '顺序', 'dependency')],
    genHint: '用户旅程地图：阶段→触点，标注情绪曲线与机会点。'
  },
  'service-blueprint': {
    nodeKinds: [
      nk('customerAction', '客户行为', 'rounded', { category: 'customer', color: '#2563eb' }),
      nk('frontstage', '前台(可见)', 'rect', { category: 'frontstage' }),
      nk('backstage', '后台(不可见)', 'rect', { category: 'backstage' }),
      nk('support', '支撑流程', 'rect', { category: 'support', color: '#6b7280' })
    ],
    edgeKinds: [ek('dependency', '顺序/触发', 'dependency')],
    genHint: '服务蓝图：客户行为/前台/后台/支撑流程分层，跨可见性线交互。'
  },

  /* ===== 数据库与存储 ===== */
  'db-schema': {
    nodeKinds: [
      nk('table', '表', 'card', { allowsFields: true, category: 'table', color: '#2563eb' }),
      nk('view', '视图', 'card', { allowsFields: true, category: 'view', color: '#16a34a' })
    ],
    edgeKinds: DATA_EDGES,
    genHint: '数据库 Schema 图：表/视图结构 + 外键引用，列含类型与约束。'
  },
  'table-relationship': {
    nodeKinds: [nk('table', '表', 'card', { allowsFields: true, category: 'table', color: '#2563eb' })],
    edgeKinds: DATA_EDGES,
    genHint: '表关系图：以外键引用描述表间关系与基数。'
  },
  'index-design': {
    nodeKinds: [
      nk('table', '表', 'card', { allowsFields: true, category: 'table', color: '#2563eb' }),
      nk('index', '索引', 'rect', { category: 'index', color: '#d97706' })
    ],
    edgeKinds: [ek('dependency', '作用于', 'dependency')],
    genHint: '索引设计图：表与其索引（列/唯一/复合）及查询优化。'
  },
  'partition-design': {
    nodeKinds: [
      nk('table', '表', 'card', { allowsFields: true, category: 'table', color: '#2563eb' }),
      nk('partition', '分区/分片', 'cylinder', { category: 'partition' })
    ],
    edgeKinds: [ek('composition', '分区', 'composition')],
    genHint: '分区设计图：表的分区/分片策略（范围/列表/哈希）。'
  },
  replication: {
    nodeKinds: [
      nk('primary', '主库', 'cylinder', { category: 'primary', color: '#2563eb' }),
      nk('replica', '从库/副本', 'cylinder', { category: 'replica', color: '#16a34a' }),
      nk('cluster', '集群', 'rect', { category: 'cluster' })
    ],
    edgeKinds: [ek('dependency', '复制流', 'dependency')],
    genHint: '复制拓扑图：主从/集群的数据复制方向与关系。'
  },

  /* ===== 集成与 API ===== */
  'api-map': {
    nodeKinds: [
      nk('api', 'API/端点', 'rect', { category: 'api', color: '#2563eb' }),
      nk('service', '服务', 'rounded', { category: 'service' }),
      nk('consumer', '消费方', 'rounded', { category: 'consumer', color: '#6b7280' })
    ],
    edgeKinds: [ek('dependency', '调用', 'dependency')],
    genHint: 'API 地图：API 端点/服务/消费方及其调用依赖总览。'
  },
  'api-sequence': {
    nodeKinds: [
      nk('service', '服务/参与方', 'rect', { category: 'service', color: '#2563eb' }),
      nk('gateway', '网关', 'hexagon', { category: 'gateway' })
    ],
    edgeKinds: [ek('dependency', '请求/响应', 'dependency')],
    genHint: 'API 时序图：服务间 API 请求/响应按时间顺序排列。'
  },
  'event-storming': {
    nodeKinds: [
      nk('event', '领域事件', 'note', { category: 'event', color: '#f97316' }),
      nk('command', '命令', 'note', { category: 'command', color: '#2563eb' }),
      nk('aggregate', '聚合', 'rect', { category: 'aggregate', color: '#eab308' }),
      nk('policy', '策略', 'note', { category: 'policy', color: '#7c3aed' }),
      nk('actor', '参与者', 'actor', { category: 'actor' })
    ],
    edgeKinds: [ek('dependency', '触发/流转', 'dependency')],
    genHint: '事件风暴：命令→聚合→领域事件→策略的流转，参与者发起命令（DDD）。'
  },
  'message-flow': {
    nodeKinds: [
      nk('producer', '生产者', 'rect', { category: 'producer', color: '#2563eb' }),
      nk('queue', '队列/主题', 'cylinder', { category: 'queue', color: '#d97706' }),
      nk('consumer', '消费者', 'rect', { category: 'consumer', color: '#16a34a' })
    ],
    edgeKinds: [ek('dependency', '发布/订阅', 'dependency')],
    genHint: '消息流图：生产者→队列/主题→消费者的异步消息流转。'
  },
  'integration-map': {
    nodeKinds: [
      nk('system', '系统', 'rect', { category: 'system', color: '#2563eb' }),
      nk('middleware', '中间件/ESB', 'hexagon', { category: 'middleware', color: '#d97706' }),
      nk('adapter', '适配器', 'rounded', { category: 'adapter' })
    ],
    edgeKinds: [ek('dependency', '集成/调用', 'dependency')],
    genHint: '集成架构图：系统通过中间件/适配器互联的集成拓扑。'
  },
  microservice: {
    nodeKinds: [
      nk('service', '微服务', 'rounded', { category: 'service', color: '#2563eb' }),
      nk('gateway', 'API 网关', 'hexagon', { category: 'gateway', color: '#d97706' }),
      nk('registry', '服务注册/发现', 'rect', { category: 'registry' }),
      nk('db', '数据库', 'cylinder', { category: 'db' })
    ],
    edgeKinds: [ek('dependency', '调用/注册', 'dependency')],
    genHint: '微服务架构图：网关/服务/注册中心/独立数据库及其调用关系。'
  },

  /* ===== 安全与运维 ===== */
  'threat-model': {
    nodeKinds: [
      nk('asset', '资产/数据', 'rect', { category: 'asset', color: '#2563eb' }),
      nk('process', '处理/服务', 'rounded', { category: 'process' }),
      nk('datastore', '数据存储', 'cylinder', { category: 'datastore' }),
      nk('boundary', '信任边界', 'rect', { category: 'boundary', color: '#dc2626' }),
      nk('threat', '威胁(STRIDE)', 'hexagon', { category: 'threat', color: '#dc2626' })
    ],
    edgeKinds: [ek('dependency', '数据流', 'dependency')],
    genHint: '威胁建模图：资产/处理/数据存储 + 信任边界，标注跨边界数据流与 STRIDE 威胁。'
  },
  'security-architecture': {
    nodeKinds: [
      nk('zone', '安全分区', 'rect', { category: 'zone', color: '#dc2626' }),
      nk('control', '安全控制', 'rounded', { category: 'control', color: '#16a34a' }),
      nk('asset', '资产', 'rect', { category: 'asset', color: '#2563eb' })
    ],
    edgeKinds: [ek('dependency', '数据流/防护', 'dependency')],
    genHint: '安全架构图：安全分区/控制/资产，标注纵深防御与边界。'
  },
  'cicd-pipeline': {
    nodeKinds: [
      nk('stage', '阶段', 'rect', { category: 'stage', color: '#2563eb' }),
      nk('job', '任务/步骤', 'rounded', { category: 'job' }),
      nk('gate', '质量门/审批', 'diamond', { category: 'gate', color: '#d97706' })
    ],
    edgeKinds: [ek('dependency', '流水线顺序', 'dependency')],
    genHint: 'CI/CD 流水线图：构建→测试→部署阶段与任务，含质量门/审批。'
  },
  monitoring: {
    nodeKinds: [
      nk('source', '数据源/目标', 'rect', { category: 'source', color: '#2563eb' }),
      nk('collector', '采集/聚合', 'rounded', { category: 'collector' }),
      nk('dashboard', '仪表盘', 'rect', { category: 'dashboard', color: '#16a34a' }),
      nk('alert', '告警', 'hexagon', { category: 'alert', color: '#dc2626' })
    ],
    edgeKinds: [ek('dependency', '采集/告警流', 'dependency')],
    genHint: '监控架构图：指标/日志源→采集聚合→仪表盘/告警链路。'
  },
  flowchart: {
    genHint: '通用流程图：开始/处理/判断/输入输出为节点，按流向连接，判断分支标注是/否。'
  }
}

/* --------------------------- 通用兜底 --------------------------- */

const GENERIC_ARCH: GroupBase = {
  nodeKinds: GENERIC_BOX_KINDS,
  edgeKinds: ARCH_EDGES,
  genHint: '通用框图：节点盒 + 连线，按需要标注关系。'
}

/* --------------------------- 解析接口 --------------------------- */

/** 解析某图种的完整 Schema（图种覆盖 > 分组基线 > 通用兜底） */
export function getDiagramSchema(typeId?: string): DiagramSchema {
  const def = getDiagramType(typeId)
  const engine: ModelKind = def?.engine ?? 'architecture'
  const base: GroupBase = def ? GROUP_BASE[def.group] ?? GENERIC_ARCH : GENERIC_ARCH
  const override = typeId ? TYPE_OVERRIDE[typeId] : undefined
  const renderKind = getRenderKind(typeId)
  return {
    typeId: typeId ?? engine,
    engine,
    renderKind,
    nodeKinds: override?.nodeKinds ?? base.nodeKinds,
    edgeKinds: override?.edgeKinds ?? base.edgeKinds,
    nodeProps: override?.nodeProps ?? base.nodeProps,
    diagramProps: override?.diagramProps ?? base.diagramProps,
    layout: resolveLayoutSeed(typeId, renderKind, override, base),
    genHint: override?.genHint ?? base.genHint
  }
}

/* --------------------------- 结构化范式布局种子 --------------------------- */

/** 常见结构化图种的行/列/泳道/轨道种子（矩阵/时间轴/泳道） */
const LAYOUT_SEED_BY_TYPE: Record<string, LayoutSeed> = {
  // 矩阵 / 网格
  bmc: {
    rows: ['关键合作', '关键活动', '关键资源', '价值主张', '客户关系', '渠道通路', '客户细分', '成本结构', '收入来源'],
    cols: ['内容']
  },
  raci: { rows: ['任务 1', '任务 2'], cols: ['角色 A', '角色 B', '角色 C'] },
  zachman: {
    rows: ['范围 (情境)', '业务模型 (概念)', '系统模型 (逻辑)', '技术模型 (物理)', '详细表述', '运行系统'],
    cols: ['What 数据', 'How 功能', 'Where 网络', 'Who 人员', 'When 时间', 'Why 动机']
  },
  'togaf-adm': {
    rows: ['预备阶段', 'A 架构愿景', 'B 业务架构', 'C 信息系统架构', 'D 技术架构', 'E 机会与解决方案', 'F 迁移规划', 'G 实施治理', 'H 变更管理'],
    cols: ['目标', '交付物', '干系人']
  },
  'journey-map': {
    rows: ['用户行为', '触点', '想法', '情绪', '痛点', '机会'],
    cols: ['认知', '考虑', '购买', '使用', '忠诚']
  },
  'value-chain': {
    rows: ['支持活动', '主要活动'],
    cols: ['进货物流', '生产运营', '出货物流', '市场营销', '售后服务']
  },
  'req-matrix': { rows: ['需求 1', '需求 2'], cols: ['设计', '实现', '测试用例'] },
  affinity: { rows: ['分组 1', '分组 2', '分组 3'], cols: ['想法'] },
  // 时间轴
  roadmap: { tracks: ['产品', '平台', '数据'], periods: ['Q1', 'Q2', 'Q3', 'Q4'] },
  'archimate-migration': { tracks: ['业务', '应用', '技术'], periods: ['当前态', '过渡态', '目标态'] },
  'user-story-map': { tracks: ['用户活动', '任务步骤'], periods: ['发布 1', '发布 2', '发布 3'] },
  // 泳道
  'bpmn-collaboration': { lanes: ['发起方', '接收方'] },
  'cross-functional': { lanes: ['前台', '中台', '后台'] },
  'value-stream': { lanes: ['供应商', '生产', '客户'] },
  'service-blueprint': { lanes: ['用户行为', '前台交互', '后台流程', '支撑系统'] },
  'bpmn-process': { lanes: ['角色 A', '角色 B'] },
  'bpmn-choreography': { lanes: ['参与者 A', '参与者 B'] },
  'bpmn-conversation': { lanes: ['参与者 A', '参与者 B'] },
  swimlane: { lanes: ['角色 A', '角色 B', '角色 C'] },
  epc: { lanes: ['职能 1', '职能 2'] }
}

/** 各范式的兜底种子（无专用种子的图种也能有可用初始网格） */
const LAYOUT_SEED_BY_RENDER: Partial<Record<RenderKind, LayoutSeed>> = {
  matrix: { rows: ['行 1', '行 2'], cols: ['列 1', '列 2'] },
  timeline: { tracks: ['轨道 1', '轨道 2'], periods: ['阶段 1', '阶段 2', '阶段 3'] },
  swimlane: { lanes: ['泳道 1', '泳道 2', '泳道 3'] }
}

/** 解析图种的初始布局种子：图种覆盖 > 已知种子 > 分组基线 > 范式兜底 */
function resolveLayoutSeed(
  typeId: string | undefined,
  renderKind: RenderKind,
  override?: Partial<GroupBase>,
  base?: GroupBase
): LayoutSeed | undefined {
  return (
    override?.layout ??
    (typeId ? LAYOUT_SEED_BY_TYPE[typeId] : undefined) ??
    base?.layout ??
    LAYOUT_SEED_BY_RENDER[renderKind]
  )
}

/* --------------------------- 起始模板（新建图注入骨架） --------------------------- */

function tmplNode(kind: NodeKindDef | undefined, label: string, extra: Partial<DiagramNode> = {}): DiagramNode {
  return {
    id: nanoid(),
    label,
    fields: [],
    category: kind?.category ?? kind?.id,
    stereotype: kind?.defaultStereotype,
    nodeKind: kind?.id,
    position: { x: 0, y: 0 },
    ...extra
  }
}

/**
 * 为新建图生成一份最小可用骨架，使每种范式打开即"长得对"：
 *  - sequence : 2 参与者 + 1 条消息
 *  - swimlane : 泳道种子 + 第一条泳道上的一个任务节点
 *  - matrix   : 行/列种子 + 首格一条目
 *  - tree     : 1 个中心/根节点
 *  - timeline : 轨道/阶段种子 + 第一条目
 *  - graph    : 1 个默认种类节点（可立即编辑）
 */
export function resolveTemplate(typeId?: string): Pick<ModelDoc, 'nodes' | 'edges'> & {
  meta?: Record<string, unknown>
} {
  const schema = getDiagramSchema(typeId)
  const kinds = schema.nodeKinds
  const layout = schema.layout
  switch (schema.renderKind) {
    case 'sequence': {
      const a = tmplNode(kinds[0], '参与者1', { category: 'actor', position: { x: 40, y: 0 } })
      const b = tmplNode(kinds[0], '参与者2', { category: 'actor', position: { x: 210, y: 0 } })
      const msg: DiagramEdge = {
        id: nanoid(),
        source: a.id,
        target: b.id,
        relation: 'association',
        edgeKind: 'sync',
        label: '请求'
      }
      return { nodes: [a, b], edges: [msg] }
    }
    case 'swimlane': {
      const lanes = layout?.lanes ?? ['泳道 1', '泳道 2']
      const taskKind = kinds.find((k) => k.id === 'task') ?? kinds[0]
      const n = tmplNode(taskKind, taskKind?.label ?? '任务', {
        position: { x: 40, y: 0 },
        props: { lane: lanes[0] }
      })
      return { nodes: [n], edges: [], meta: { lanes } }
    }
    case 'matrix': {
      const rows = layout?.rows ?? ['行 1', '行 2']
      const cols = layout?.cols ?? ['列 1', '列 2']
      const item = tmplNode(kinds[0], '条目 1', {
        position: { x: 0, y: 0 },
        props: { row: rows[0], col: cols[0], tag: '' }
      })
      return { nodes: [item], edges: [], meta: { rows, cols } }
    }
    case 'timeline': {
      const tracks = layout?.tracks ?? ['轨道 1', '轨道 2']
      const periods = layout?.periods ?? ['阶段 1', '阶段 2', '阶段 3']
      const item = tmplNode(kinds[0], '里程碑', {
        position: { x: 0, y: 0 },
        props: { track: tracks[0], start: 0, end: 0 }
      })
      return { nodes: [item], edges: [], meta: { tracks, periods } }
    }
    case 'tree': {
      const root = tmplNode(kinds[0], '中心主题', { position: { x: 0, y: 0 } })
      return { nodes: [root], edges: [] }
    }
    default: {
      const n = tmplNode(kinds[0], kinds[0]?.label ?? '节点', { position: { x: 80, y: 80 } })
      return { nodes: [n], edges: [] }
    }
  }
}

/** 取图种的默认节点种类（用于"新增节点"默认项） */
export function defaultNodeKind(schema: DiagramSchema): NodeKindDef {
  return schema.nodeKinds[0]
}

/** 按引擎给出适配的兜底（用于无 diagramType 的旧图） */
export function schemaForKind(kind: ModelKind): DiagramSchema {
  const map: Record<ModelKind, string> = {
    conceptual: 'conceptual-erd',
    logical: 'logical-erd',
    physical: 'physical-erd',
    uml: 'uml-class',
    architecture: 'flowchart'
  }
  return getDiagramSchema(map[kind])
}
