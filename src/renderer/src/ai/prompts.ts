import type { ModelDoc, ModelKind } from '@shared/types'
import { MODEL_KIND_LABELS } from '@shared/types'

/** 要求 AI 严格返回的 JSON Schema 说明 */
const MODEL_JSON_SPEC = `
请只返回一个 JSON 对象（不要任何额外文字、不要 markdown 代码块围栏），结构如下：
{
  "name": "模型名称",
  "description": "简要描述",
  "nodes": [
    {
      "label": "实体/表/类/组件/对象类型名",
      "comment": "说明(可选)",
      "category": "architecture类型时可填 service/db/ui/external",
      "stereotype": "构造型(可选)：UML 用 class|interface|abstract|enum；本体用 object|link|action|value",
      "fields": [
        { "name": "字段/属性名", "type": "类型", "primaryKey": false, "foreignKey": false, "notNull": false, "unique": false, "visibility": "public|private|protected(UML用)", "isTitle": false, "comment": "说明" }
      ],
      "methods": [
        { "name": "方法名", "returnType": "返回类型", "params": "参数列表", "visibility": "public", "static": false, "abstract": false }
      ]
    }
  ],
  "edges": [
    { "source": "源节点label", "target": "目标节点label", "relation": "oneToMany|manyToMany|oneToOne|fk|association|inheritance|composition|aggregation|dependency", "label": "关系/链接说明", "sourceField": "外键字段(可选)", "targetField": "引用字段(可选)", "sourceCardinality": "本体链接源端基数如 1/0..1/*/1..*(可选)", "targetCardinality": "目标端基数(可选)" }
  ]
}
edges 中的 source/target 必须与某个 node 的 label 完全一致。`

const KIND_GUIDE: Record<ModelKind, string> = {
  conceptual:
    '这是【概念模型 / 本体语义建模】，请采用类似 Palantir Foundry Ontology 的本体建模范式：' +
    '每个 node 代表一个「对象类型(Object Type)」，stereotype 填 "object"；' +
    '其 fields 为属性(Property)，为业务主键/唯一标识的属性设 primaryKey:true，作为对象显示名的属性设 isTitle:true；' +
    '实体间关系用「链接类型(Link Type)」表达，写在 edges 中并用 sourceCardinality/targetCardinality 标注基数(如 1、0..1、*、1..*)，' +
    'relation 选 oneToMany/manyToMany/oneToOne/association；需要时可额外用 stereotype:"action" 的 node 表达「动作类型(Action Type)」，用 stereotype:"value" 表达共享值类型。专注业务语义而非存储实现。',
  logical:
    '这是【逻辑模型】：需要实体、完整属性、主键(primaryKey)、外键(foreignKey)、以及实体间关系(oneToMany/manyToMany 等)，与具体数据库无关的通用类型。',
  physical:
    '这是【物理模型】：面向具体数据库，节点是数据表，字段需含具体 SQL 类型(如 VARCHAR(255)、BIGINT)、主键、外键、非空、唯一约束，关系用 fk 并标注 sourceField/targetField。',
  uml: '这是【UML 类图】：节点是类，需含属性(fields，带 visibility)与方法(methods)，关系用 inheritance/association/composition/aggregation/dependency。',
  architecture:
    '这是【软件架构图】：节点是系统组件/服务，category 标注类型(service/db/ui/external/queue 等)，fields 可列关键职责或接口，关系用 dependency/association 表示调用与依赖。'
}

export function buildGenerateMessages(
  prompt: string,
  kind: ModelKind,
  diagramHint?: { name: string; genHint: string }
) {
  const typeGuide = diagramHint
    ? `\n本次要生成的具体图种是【${diagramHint.name}】：${diagramHint.genHint}`
    : ''
  const system = `你是一名资深的软件与数据建模专家。根据用户需求生成${MODEL_KIND_LABELS[kind]}。${KIND_GUIDE[kind]}${typeGuide}\n${MODEL_JSON_SPEC}`
  const target = diagramHint ? diagramHint.name : MODEL_KIND_LABELS[kind]
  const user = `需求描述：\n${prompt}\n\n请生成 ${target}。`
  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user }
  ]
}

/** 项目驱动多图生成：先产出共享领域术语表，保证多张图实体词汇一致 */
export function buildProjectPlanMessages(
  prompt: string,
  diagrams: { name: string; genHint: string }[]
) {
  const list = diagrams.map((d, i) => `${i + 1}. ${d.name}`).join('\n')
  const system =
    '你是一名资深的企业架构与建模专家。请阅读领域需求，提炼一份「共享领域术语表」，' +
    '供后续生成多张相互关联的模型图复用，保证各图中的实体/概念命名一致。\n' +
    '只返回一个 JSON 对象（不要 markdown 围栏），结构：\n' +
    '{ "domain": "领域名", "summary": "一句话概述", "terms": [ { "name": "术语/实体名", "aliases": ["同义词"], "description": "含义" } ] }'
  const user = `领域需求：\n${prompt}\n\n后续将基于该术语表生成以下图：\n${list}\n\n请先给出术语表 JSON。`
  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user }
  ]
}

/** 在多图生成里，把术语表注入单图生成 */
export function buildProjectDiagramMessages(
  prompt: string,
  kind: ModelKind,
  diagramHint: { name: string; genHint: string },
  glossary: string
) {
  const system = `你是一名资深建模专家。根据领域需求与共享术语表生成${MODEL_KIND_LABELS[kind]}。${KIND_GUIDE[kind]}\n本次图种【${diagramHint.name}】：${diagramHint.genHint}\n务必复用术语表中的实体命名，保证与同项目其他图一致。\n${MODEL_JSON_SPEC}`
  const user = `领域需求：\n${prompt}\n\n共享术语表：\n${glossary}\n\n请生成 ${diagramHint.name}。`
  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user }
  ]
}

export function buildRefineMessages(
  doc: ModelDoc,
  instruction: string,
  scopeLabels?: string[]
) {
  const system = `你是一名资深建模专家，需要在保留现有模型结构的基础上做局部微调。${KIND_GUIDE[doc.kind]}\n${MODEL_JSON_SPEC}\n注意：返回完整的、调整后的模型 JSON（包含未改动的节点与边），尽量保留原有 label 不变以便对应。`
  const scopeText =
    scopeLabels && scopeLabels.length
      ? `\n本次微调重点针对这些节点：${scopeLabels.join('、')}。`
      : ''
  const user = `当前模型 JSON：\n${JSON.stringify(
    { name: doc.name, description: doc.description, nodes: doc.nodes, edges: doc.edges },
    null,
    2
  )}\n\n微调指令：${instruction}${scopeText}`
  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user }
  ]
}

export function buildArtifactMessages(doc: ModelDoc, systemRole: string, task: string) {
  const modelJson = JSON.stringify(
    { name: doc.name, kind: doc.kind, description: doc.description, nodes: doc.nodes, edges: doc.edges },
    null,
    2
  )
  return [
    { role: 'system' as const, content: systemRole },
    { role: 'user' as const, content: `${task}\n\n模型 JSON：\n${modelJson}` }
  ]
}
