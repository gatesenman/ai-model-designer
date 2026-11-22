// 渲染范式（RenderKind）：决定一个图种用哪套“真实图形”渲染器。
// 不同于 engine（数据语义层），renderKind 是“视觉语言/交互范式”层。
//
// 映射表是 renderKind 的数据真源。getDiagramSchema() 从本表写入 schema.renderKind。
// getRenderKind() 只查本表、不反向调用 getDiagramSchema()，以避免
// diagramSchema.ts ↔ diagramRender.ts 的模块循环依赖。

export type RenderKind = 'graph' | 'sequence' | 'swimlane' | 'matrix' | 'tree' | 'timeline'

export const RENDER_KIND_LABELS: Record<RenderKind, string> = {
  graph: '节点连线',
  sequence: '时序',
  swimlane: '泳道',
  matrix: '矩阵',
  tree: '树形',
  timeline: '时间轴'
}

/**
 * 104 图种的显式范式映射（无隐式兜底）。
 *
 * 活动图 / 状态机 / 用户流程：当前只有 6 种范式，没有独立的状态机或分区活动图渲染器。
 * 其节点种类（动作/判断/开始/结束或状态）适合通用节点连线，故保持 graph，避免误塞进泳道。
 * 已有明确结构化交互的图种（时序、泳道、矩阵、树、时间轴）映射到对应范式。
 */
export const RENDER_KIND_BY_TYPE: Record<string, RenderKind> = {
  // ----- 数据建模：实体关系 / 数据流均为节点连线 -----
  'conceptual-erd': 'graph',
  'logical-erd': 'graph',
  'physical-erd': 'graph',
  dimensional: 'graph',
  snowflake: 'graph',
  'data-vault': 'graph',
  'data-flow': 'graph',
  'data-lineage': 'graph',
  'nosql-document': 'graph',
  'graph-data': 'graph',
  ontology: 'graph',

  // ----- UML 结构图 -----
  'uml-class': 'graph',
  'uml-object': 'graph',
  'uml-component': 'graph',
  'uml-composite': 'graph',
  'uml-deployment': 'graph',
  'uml-package': 'graph',
  'uml-profile': 'graph',

  // ----- UML 行为图 -----
  'uml-usecase': 'graph',
  // 活动图：动作为节点、控制流为边；无专用分区活动图渲染器
  'uml-activity': 'graph',
  // 状态机：无独立状态机渲染器，状态/转换用节点连线表达
  'uml-state': 'graph',
  'uml-sequence': 'sequence',
  'uml-communication': 'sequence',
  'uml-timing': 'sequence',
  'uml-interaction': 'graph',

  // ----- SysML -----
  'sysml-bdd': 'graph',
  'sysml-ibd': 'graph',
  'sysml-parametric': 'graph',
  'sysml-requirement': 'graph',
  'sysml-activity': 'graph', // 同 uml-activity，保持 graph
  'sysml-sequence': 'sequence',
  'sysml-state': 'graph', // 同 uml-state，保持 graph
  'sysml-usecase': 'graph',
  'sysml-package': 'graph',

  // ----- BPMN / 流程泳道 -----
  'bpmn-process': 'swimlane',
  'bpmn-collaboration': 'swimlane',
  'bpmn-choreography': 'swimlane',
  'bpmn-conversation': 'swimlane',
  swimlane: 'swimlane',
  'cross-functional': 'swimlane',
  'value-stream': 'swimlane',
  'service-blueprint': 'swimlane',
  epc: 'swimlane',

  // ----- 矩阵 / 网格 -----
  bmc: 'matrix',
  raci: 'matrix',
  zachman: 'matrix',
  'req-matrix': 'matrix',
  'journey-map': 'matrix',
  'value-chain': 'matrix',
  'togaf-adm': 'matrix',
  affinity: 'matrix',

  // ----- 树形 / 放射 -----
  mindmap: 'tree',
  'org-chart': 'tree',
  taxonomy: 'tree',
  sitemap: 'tree',
  'decision-tree': 'tree',
  fishbone: 'tree',
  'feature-model': 'tree',
  'capability-map': 'tree',

  // ----- 时间轴 -----
  roadmap: 'timeline',
  'archimate-migration': 'timeline',
  'user-story-map': 'timeline',

  // ----- ArchiMate 其余分层视图：盒 + 关系 -----
  'archimate-business': 'graph',
  'archimate-application': 'graph',
  'archimate-technology': 'graph',
  'archimate-motivation': 'graph',
  'archimate-strategy': 'graph',
  'archimate-layered': 'graph',

  // ----- C4 -----
  'c4-context': 'graph',
  'c4-container': 'graph',
  'c4-component': 'graph',
  'c4-code': 'graph',
  'c4-dynamic': 'sequence',
  'c4-deployment': 'graph',
  'c4-landscape': 'graph',

  // ----- 需求 / 流程 / 网络 / 企业 / 概念 / UX / 库 / 集成 / 安全 -----
  'req-diagram': 'graph',
  flowchart: 'graph',
  'process-map': 'graph',
  'network-topology': 'graph',
  'infra-deployment': 'graph',
  'cloud-architecture': 'graph',
  'rack-diagram': 'graph',
  'data-center': 'graph',
  'system-context': 'graph',
  'concept-map': 'graph',
  'knowledge-graph': 'graph',
  wireframe: 'graph',
  // 用户流程是页面/步骤节点的有向图，不是泳道；无专用流程分区渲染器
  'user-flow': 'graph',
  'screen-flow': 'graph',
  'db-schema': 'graph',
  'table-relationship': 'graph',
  'index-design': 'graph',
  'partition-design': 'graph',
  replication: 'graph',
  'api-map': 'graph',
  'api-sequence': 'sequence',
  'event-storming': 'graph',
  'message-flow': 'graph',
  'integration-map': 'graph',
  microservice: 'graph',
  'threat-model': 'graph',
  'security-architecture': 'graph',
  'cicd-pipeline': 'graph',
  monitoring: 'graph'
}

/** 按图种 id 解析渲染范式。未列入目录的未知 id 才兜底 graph。 */
export function getRenderKind(typeId?: string): RenderKind {
  if (!typeId) return 'graph'
  return RENDER_KIND_BY_TYPE[typeId] ?? 'graph'
}
