import { useState } from 'react'
import {
  Button,
  Checkbox,
  Divider,
  Dropdown,
  Empty,
  Input,
  Select,
  Space,
  Tooltip
} from 'antd'
import { DeleteOutlined, PlusOutlined, MoreOutlined } from '@ant-design/icons'
import { useModelStore } from '../store/modelStore'
import { RELATION_LABELS, NODE_STEREOTYPE_LABELS } from '@shared/types'
import type { DiagramEdge, DiagramNode, Field, ModelDoc, NodeStereotype, RelationKind } from '@shared/types'
import { getDiagramSchema, type PropDef } from '@shared/diagramSchema'
import { getRenderKind, type RenderKind } from '@shared/diagramRender'
import { parentOf, reparentNode, treeLevel, wouldCreateCycle } from '@shared/editOps'
import { removeActivation, resolveActivations, updateActivation } from '@shared/sequenceActivations'
import SequenceActivationList from '../canvas/SequenceActivationList'

/* ---------- STRIDE 威胁分类 ---------- */
const STRIDE_DEFS: [string, string][] = [
  ['S', 'Spoofing 仿冒身份'],
  ['T', 'Tampering 篡改'],
  ['R', 'Repudiation 抵赖'],
  ['I', 'Information Disclosure 信息泄露'],
  ['D', 'Denial of Service 拒绝服务'],
  ['E', 'Elevation of Privilege 权限提升']
]
function strideSet(raw: unknown): Set<string> {
  if (Array.isArray(raw)) return new Set(raw.map((x) => String(x).toUpperCase()))
  if (typeof raw === 'string')
    return new Set(raw.split(/[,\s]+/).map((x) => x.toUpperCase()).filter(Boolean))
  return new Set()
}

/* ---------- Schema 驱动属性编辑器 ---------- */
function SchemaProps({
  defs,
  node,
  onChange
}: {
  defs: PropDef[]
  node: DiagramNode
  onChange: (key: string, value: string | number | boolean) => void
}) {
  if (defs.length === 0) return null
  const props = node.props ?? {}
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={8}>
      {defs.map((d) => {
        const val = props[d.key] ?? d.default
        if (d.type === 'boolean') {
          return (
            <Checkbox
              key={d.key}
              checked={!!val}
              onChange={(e) => onChange(d.key, e.target.checked)}
            >
              {d.label}
            </Checkbox>
          )
        }
        if (d.type === 'enum') {
          return (
            <Select
              key={d.key}
              style={{ width: '100%' }}
              placeholder={d.label}
              allowClear
              value={val as string | undefined}
              onChange={(v) => onChange(d.key, v)}
              options={(d.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
            />
          )
        }
        return (
          <Input
            key={d.key}
            addonBefore={d.label}
            type={d.type === 'number' ? 'number' : 'text'}
            value={val == null ? '' : String(val)}
            onChange={(e) =>
              onChange(d.key, d.type === 'number' ? Number(e.target.value) : e.target.value)
            }
          />
        )
      })}
    </Space>
  )
}

/* ---------- 图级属性（diagramProps）编辑器 ---------- */
function DiagramProps({
  defs,
  values,
  onChange
}: {
  defs: PropDef[]
  values: Record<string, unknown>
  onChange: (key: string, value: string | number | boolean) => void
}) {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={8}>
      {defs.map((d) => {
        const val = values[d.key] ?? d.default
        if (d.type === 'boolean') {
          return (
            <Checkbox key={d.key} checked={!!val} onChange={(e) => onChange(d.key, e.target.checked)}>
              {d.label}
            </Checkbox>
          )
        }
        if (d.type === 'enum') {
          return (
            <Select
              key={d.key}
              style={{ width: '100%' }}
              placeholder={d.label}
              allowClear
              value={val as string | undefined}
              onChange={(v) => onChange(d.key, v)}
              options={(d.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
            />
          )
        }
        return (
          <Input
            key={d.key}
            addonBefore={d.label}
            type={d.type === 'number' ? 'number' : 'text'}
            value={val == null ? '' : String(val)}
            onChange={(e) =>
              onChange(d.key, d.type === 'number' ? Number(e.target.value) : e.target.value)
            }
          />
        )
      })}
    </Space>
  )
}

const UML_STEREOTYPES: NodeStereotype[] = ['class', 'interface', 'abstract', 'enum']
const ONTOLOGY_STEREOTYPES: NodeStereotype[] = ['object', 'link', 'action', 'value']

/* ---------- Field Card ---------- */
interface FieldCardProps {
  field: Field
  index: number
  total: number
  nodeId: string
  isUml: boolean
  isOntology: boolean
  updateField: (nodeId: string, fieldId: string, patch: Partial<Field>) => void
  removeField: (nodeId: string, fieldId: string) => void
  moveField: (nodeId: string, fieldId: string, dir: 1 | -1) => void
}

function FieldCard({
  field: f,
  index: idx,
  total,
  nodeId,
  isUml,
  isOntology,
  updateField,
  removeField,
  moveField
}: FieldCardProps) {
  const [expanded, setExpanded] = useState(false)

  const moreItems = [
    { key: 'up', label: '上移', disabled: idx === 0, onClick: () => moveField(nodeId, f.id, -1) },
    {
      key: 'down',
      label: '下移',
      disabled: idx === total - 1,
      onClick: () => moveField(nodeId, f.id, 1)
    },
    { type: 'divider' as const },
    { key: 'del', label: '删除', danger: true, onClick: () => removeField(nodeId, f.id) }
  ]

  return (
    <div className="field-card">
      <div className="field-card__row1">
        <Input
          size="small"
          placeholder="字段名"
          value={f.name}
          onChange={(e) => updateField(nodeId, f.id, { name: e.target.value })}
          style={{ flex: 2, minWidth: 0 }}
        />
        <Input
          size="small"
          placeholder="类型"
          value={f.type}
          onChange={(e) => updateField(nodeId, f.id, { type: e.target.value })}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Dropdown menu={{ items: moreItems }} trigger={['click']}>
          <Button size="small" type="text" icon={<MoreOutlined />} />
        </Dropdown>
      </div>

      <div className="field-card__row2">
        <Input
          size="small"
          placeholder="中文名 / 备注"
          value={f.comment}
          onChange={(e) => updateField(nodeId, f.id, { comment: e.target.value })}
          style={{ width: '100%' }}
        />
      </div>

      <div className="field-card__flags">
        <Checkbox
          checked={f.primaryKey}
          onChange={(e) => updateField(nodeId, f.id, { primaryKey: e.target.checked })}
        >
          <span className="flag-label">PK</span>
        </Checkbox>
        <Checkbox
          checked={f.notNull}
          onChange={(e) => updateField(nodeId, f.id, { notNull: e.target.checked })}
        >
          <span className="flag-label">NN</span>
        </Checkbox>
        <Checkbox
          checked={f.foreignKey}
          onChange={(e) => updateField(nodeId, f.id, { foreignKey: e.target.checked })}
        >
          <span className="flag-label">FK</span>
        </Checkbox>
        <Checkbox
          checked={f.unique}
          onChange={(e) => updateField(nodeId, f.id, { unique: e.target.checked })}
        >
          <span className="flag-label">UQ</span>
        </Checkbox>
        {isOntology && (
          <Checkbox
            checked={f.isTitle}
            onChange={(e) => updateField(nodeId, f.id, { isTitle: e.target.checked })}
          >
            <span className="flag-label">标题</span>
          </Checkbox>
        )}
        {!expanded && (isUml || !isOntology) && (
          <Button
            size="small"
            type="link"
            style={{ padding: 0, fontSize: 11, height: 'auto' }}
            onClick={() => setExpanded(true)}
          >
            更多…
          </Button>
        )}
      </div>

      {expanded && (
        <div className="field-card__extra">
          {!isUml && (
            <>
              <Checkbox
                checked={f.autoIncrement}
                onChange={(e) => updateField(nodeId, f.id, { autoIncrement: e.target.checked })}
              >
                <span className="flag-label">自增</span>
              </Checkbox>
              <Input
                size="small"
                placeholder="默认值"
                value={f.defaultValue}
                onChange={(e) => updateField(nodeId, f.id, { defaultValue: e.target.value })}
                style={{ flex: 1, minWidth: 0 }}
              />
            </>
          )}
          {isUml && (
            <Select
              size="small"
              style={{ width: 120 }}
              value={f.visibility ?? 'private'}
              onChange={(v) => updateField(nodeId, f.id, { visibility: v })}
              options={[
                { value: 'public', label: '+ public' },
                { value: 'private', label: '- private' },
                { value: 'protected', label: '# protected' }
              ]}
            />
          )}
          <Button
            size="small"
            type="link"
            style={{ padding: 0, fontSize: 11, height: 'auto' }}
            onClick={() => setExpanded(false)}
          >
            收起
          </Button>
        </div>
      )}
    </div>
  )
}



/* ---------- 范式专属属性 ---------- */

const MSG_KIND_OPTIONS = [
  { value: 'sync', label: '同步消息' },
  { value: 'async', label: '异步消息' },
  { value: 'reply', label: '返回消息' }
]

function SequenceEdgeProps({
  edge,
  doc,
  updateEdge,
  removeEdge
}: {
  edge: DiagramEdge
  doc: ModelDoc
  updateEdge: (id: string, patch: Partial<DiagramEdge>) => void
  removeEdge: (id: string) => void
}) {
  const kind = edge.edgeKind === 'async' || edge.edgeKind === 'reply' ? edge.edgeKind : 'sync'
  return (
    <div className="panel-section">
      <div className="panel-title">消息属性</div>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Input
          addonBefore="文案"
          placeholder="消息内容"
          value={edge.label ?? ''}
          onChange={(e) => updateEdge(edge.id, { label: e.target.value })}
        />
        <Select
          style={{ width: '100%' }}
          value={kind}
          onChange={(v) => updateEdge(edge.id, { edgeKind: v })}
          options={MSG_KIND_OPTIONS}
        />
        <Select
          style={{ width: '100%' }}
          value={edge.source}
          onChange={(v) => updateEdge(edge.id, { source: v })}
          options={doc.nodes.map((n) => ({ value: n.id, label: n.label || n.id }))}
        />
        <Select
          style={{ width: '100%' }}
          value={edge.target}
          onChange={(v) => updateEdge(edge.id, { target: v })}
          options={doc.nodes.map((n) => ({ value: n.id, label: n.label || n.id }))}
        />
        <Button
          danger
          type="text"
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => removeEdge(edge.id)}
          style={{ alignSelf: 'flex-start', paddingLeft: 0 }}
        >
          删除消息
        </Button>
      </Space>
    </div>
  )
}

function SwimlaneNodeProps({
  node,
  lanes,
  updateNode
}: {
  node: DiagramNode
  lanes: string[]
  updateNode: (id: string, patch: Partial<DiagramNode>) => void
}) {
  const lane = (node.props?.lane as string) ?? ''
  return (
    <div className="panel-section">
      <div className="panel-title">泳道</div>
      <Select
        style={{ width: '100%' }}
        placeholder="所属泳道"
        value={lane || undefined}
        onChange={(v) => updateNode(node.id, { props: { ...(node.props ?? {}), lane: v } })}
        options={lanes.map((l) => ({ value: l, label: l }))}
      />
    </div>
  )
}

function MatrixNodeProps({
  node,
  rows,
  cols,
  updateNode
}: {
  node: DiagramNode
  rows: string[]
  cols: string[]
  updateNode: (id: string, patch: Partial<DiagramNode>) => void
}) {
  const row = (node.props?.row as string) ?? ''
  const col = (node.props?.col as string) ?? ''
  const tag = (node.props?.tag as string) ?? ''
  return (
    <div className="panel-section">
      <div className="panel-title">单元格</div>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Select
          style={{ width: '100%' }}
          placeholder="行"
          value={row || undefined}
          onChange={(v) => updateNode(node.id, { props: { ...(node.props ?? {}), row: v } })}
          options={rows.map((r) => ({ value: r, label: r }))}
        />
        <Select
          style={{ width: '100%' }}
          placeholder="列"
          value={col || undefined}
          onChange={(v) => updateNode(node.id, { props: { ...(node.props ?? {}), col: v } })}
          options={cols.map((c) => ({ value: c, label: c }))}
        />
        <Input
          addonBefore="标记"
          placeholder="如 R/A/C/I 或高/中/低"
          value={tag}
          onChange={(e) => updateNode(node.id, { props: { ...(node.props ?? {}), tag: e.target.value } })}
        />
      </Space>
    </div>
  )
}

function TreeNodeProps({
  node,
  doc,
  setDoc
}: {
  node: DiagramNode
  doc: ModelDoc
  setDoc: (doc: ModelDoc) => void
}) {
  const parentId = parentOf(doc.edges, node.id)
  const level = treeLevel(doc.edges, node.id)
  const options = doc.nodes
    .filter((n) => n.id !== node.id && !wouldCreateCycle(doc.edges, node.id, n.id))
    .map((n) => ({ value: n.id, label: n.label || n.id }))
  return (
    <div className="panel-section">
      <div className="panel-title">树节点</div>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Select
          style={{ width: '100%' }}
          placeholder="父节点"
          allowClear
          value={parentId ?? undefined}
          onChange={(v) => setDoc(reparentNode(doc, node.id, v ?? null))}
          options={options}
        />
        <Input addonBefore="层级" value={String(level)} disabled />
      </Space>
    </div>
  )
}

function TimelineNodeProps({
  node,
  tracks,
  periods,
  updateNode
}: {
  node: DiagramNode
  tracks: string[]
  periods: string[]
  updateNode: (id: string, patch: Partial<DiagramNode>) => void
}) {
  const track = (node.props?.track as string) ?? ''
  const start = Number(node.props?.start ?? 0)
  const end = Number(node.props?.end ?? start)
  const periodOpts = periods.map((name, i) => ({ value: i, label: `${i + 1}. ${name}` }))
  const setRange = (nextStart: number, nextEnd: number): void => {
    const s = Math.max(0, Math.min(periods.length - 1, nextStart))
    const e = Math.max(s, Math.min(periods.length - 1, nextEnd))
    updateNode(node.id, { props: { ...(node.props ?? {}), start: s, end: e } })
  }
  return (
    <div className="panel-section">
      <div className="panel-title">里程碑</div>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Select
          style={{ width: '100%' }}
          placeholder="轨道"
          value={track || undefined}
          onChange={(v) => updateNode(node.id, { props: { ...(node.props ?? {}), track: v } })}
          options={tracks.map((tr) => ({ value: tr, label: tr }))}
        />
        <Select
          style={{ width: '100%' }}
          placeholder="开始阶段"
          value={Number.isFinite(start) ? start : 0}
          onChange={(v) => setRange(Number(v), end)}
          options={periodOpts}
        />
        <Select
          style={{ width: '100%' }}
          placeholder="结束阶段"
          value={Number.isFinite(end) ? end : 0}
          onChange={(v) => setRange(start, Number(v))}
          options={periodOpts}
        />
      </Space>
    </div>
  )
}

function paradigmExtras(
  renderKind: RenderKind,
  node: DiagramNode,
  doc: ModelDoc,
  updateNode: (id: string, patch: Partial<DiagramNode>) => void,
  setDoc: (doc: ModelDoc) => void
): JSX.Element | null {
  if (renderKind === 'swimlane') {
    const lanes = (doc.meta?.lanes as string[]) ?? []
    return <SwimlaneNodeProps node={node} lanes={lanes} updateNode={updateNode} />
  }
  if (renderKind === 'matrix') {
    const rows = (doc.meta?.rows as string[]) ?? []
    const cols = (doc.meta?.cols as string[]) ?? []
    return <MatrixNodeProps node={node} rows={rows} cols={cols} updateNode={updateNode} />
  }
  if (renderKind === 'tree') {
    return <TreeNodeProps node={node} doc={doc} setDoc={setDoc} />
  }
  if (renderKind === 'timeline') {
    const tracks = (doc.meta?.tracks as string[]) ?? []
    const periods = (doc.meta?.periods as string[]) ?? []
    return <TimelineNodeProps node={node} tracks={tracks} periods={periods} updateNode={updateNode} />
  }
  return null
}

export default function PropertiesPanel() {
  const doc = useModelStore((s) => s.doc)
  const selectedNodeId = useModelStore((s) => s.selectedNodeId)
  const selectedEdgeId = useModelStore((s) => s.selectedEdgeId)
  const selectedActivationId = useModelStore((s) => s.selectedActivationId)
  const selectActivation = useModelStore((s) => s.selectActivation)
  const updateNode = useModelStore((s) => s.updateNode)
  const removeNode = useModelStore((s) => s.removeNode)
  const addField = useModelStore((s) => s.addField)
  const updateField = useModelStore((s) => s.updateField)
  const removeField = useModelStore((s) => s.removeField)
  const moveField = useModelStore((s) => s.moveField)
  const addMethod = useModelStore((s) => s.addMethod)
  const updateMethod = useModelStore((s) => s.updateMethod)
  const removeMethod = useModelStore((s) => s.removeMethod)
  const updateEdge = useModelStore((s) => s.updateEdge)
  const removeEdge = useModelStore((s) => s.removeEdge)
  const setDoc = useModelStore((s) => s.setDoc)

  const node = doc.nodes.find((n) => n.id === selectedNodeId)
  const edge = doc.edges.find((e) => e.id === selectedEdgeId)
  const schema = getDiagramSchema(doc.diagramType)
  const renderKind = getRenderKind(doc.diagramType)
  const diagramPropDefs = schema.diagramProps ?? []
  const diagramPropValues = (doc.meta?.diagramProps as Record<string, unknown>) ?? {}
  const setDiagramProp = (key: string, value: string | number | boolean): void => {
    setDoc({
      ...doc,
      meta: {
        ...(doc.meta ?? {}),
        diagramProps: { ...diagramPropValues, [key]: value }
      }
    })
  }
  const diagramSection =
    diagramPropDefs.length > 0 ? (
      <div className="panel-section">
        <div className="panel-title">图级属性</div>
        <DiagramProps defs={diagramPropDefs} values={diagramPropValues} onChange={setDiagramProp} />
      </div>
    ) : null
  const isUml = doc.kind === 'uml'
  const isArch = doc.kind === 'architecture'
  const isOntology = doc.kind === 'conceptual'
  const stereotypeOptions = isUml
    ? UML_STEREOTYPES
    : isOntology
      ? ONTOLOGY_STEREOTYPES
      : []

  if (renderKind === 'sequence' && selectedActivationId) {
    const { mode, activations } = resolveActivations(doc)
    const act = activations.find((a) => a.id === selectedActivationId)
    if (act) {
      const max = Math.max(0, doc.edges.length - 1)
      const msgLabel = (i: number): string => {
        const e = doc.edges[i]
        if (!e) return `消息 ${i + 1}`
        return e.label ? `消息 ${i + 1}：${e.label}` : `消息 ${i + 1}`
      }
      return (
        <div>
          {diagramSection}
          <div className="panel-section" data-testid="seq-activation-props">
            <div className="panel-title">激活条</div>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ fontSize: 12, color: '#8b93a7' }}>
                {mode === 'auto' ? '当前为自动模式，修改后将转为手动激活条并保留现有自动结果。' : '手动模式：可独立调整参与者与起止消息。'}
              </div>
              <Select
                style={{ width: '100%' }}
                value={act.participantId}
                onChange={(v: string) => setDoc(updateActivation(doc, act.id, { participantId: v }))}
                options={doc.nodes.map((n) => ({ value: n.id, label: n.label || n.id }))}
              />
              <Select
                style={{ width: '100%' }}
                value={act.from}
                onChange={(v: number) => setDoc(updateActivation(doc, act.id, { from: v }))}
                options={Array.from({ length: max + 1 }, (_, i) => ({ value: i, label: `起始 ${msgLabel(i)}` }))}
              />
              <Select
                style={{ width: '100%' }}
                value={act.to}
                onChange={(v: number) => setDoc(updateActivation(doc, act.id, { to: v }))}
                options={Array.from({ length: max + 1 }, (_, i) => ({ value: i, label: `结束 ${msgLabel(i)}` }))}
              />
              <Button
                danger
                icon={<DeleteOutlined />}
                data-testid="seq-activation-delete"
                onClick={() => {
                  setDoc(removeActivation(doc, act.id))
                  selectActivation(null)
                }}
              >
                删除激活条
              </Button>
            </Space>
          </div>
        </div>
      )
    }
  }

  if (edge) {
    if (renderKind === 'sequence') {
      return (
        <div>
          {diagramSection}
          <SequenceEdgeProps edge={edge} doc={doc} updateEdge={updateEdge} removeEdge={removeEdge} />
        </div>
      )
    }
    const srcLabel = doc.nodes.find((n) => n.id === edge.source)?.label
    const tgtLabel = doc.nodes.find((n) => n.id === edge.target)?.label
    const showFk = renderKind === 'graph'
    return (
      <div>
        {diagramSection}
        <div className="panel-section">
          <div className="panel-title">关系属性</div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
            {srcLabel} → {tgtLabel}
          </div>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select
              style={{ width: '100%' }}
              value={edge.relation}
              onChange={(v: RelationKind) => updateEdge(edge.id, { relation: v })}
              options={Object.entries(RELATION_LABELS).map(([k, label]) => ({
                value: k,
                label
              }))}
            />
            <Input
              placeholder="关系标签"
              value={edge.label}
              onChange={(e) => updateEdge(edge.id, { label: e.target.value })}
            />
            {showFk && (
              <>
            <Input
              placeholder="源端字段（外键）"
              value={edge.sourceField}
              onChange={(e) => updateEdge(edge.id, { sourceField: e.target.value })}
            />
            <Input
              placeholder="目标端字段（引用）"
              value={edge.targetField}
              onChange={(e) => updateEdge(edge.id, { targetField: e.target.value })}
            />
              </>
            )}
            {isOntology && (
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  addonBefore="源基数"
                  placeholder="1 / 0..1 / * / 1..*"
                  value={edge.sourceCardinality}
                  onChange={(e) => updateEdge(edge.id, { sourceCardinality: e.target.value })}
                />
                <Input
                  addonBefore="目标基数"
                  placeholder="1 / 0..1 / * / 1..*"
                  value={edge.targetCardinality}
                  onChange={(e) => updateEdge(edge.id, { targetCardinality: e.target.value })}
                />
              </Space.Compact>
            )}
            <Button
              danger
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => removeEdge(edge.id)}
              style={{ alignSelf: 'flex-start', paddingLeft: 0 }}
            >
              删除关系
            </Button>
          </Space>
        </div>
      </div>
    )
  }

  if (!node) {
    return (
      <div>
        {diagramSection}
        {renderKind === 'sequence' && (
          <div className="panel-section">
            <div className="panel-title">激活条</div>
            <p className="seq-activation-list__hint">
              可点击画布上的激活条，或从下方列表选中后编辑参与者、起止消息或删除。
            </p>
            <SequenceActivationList />
          </div>
        )}
        <div className="panel-section">
          <Empty
            description="点击画布元素编辑专属属性，或在上方修改图级属性"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      {diagramSection}
      <div className="panel-section">
        <div className="panel-title">节点属性</div>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            addonBefore="名称"
            value={node.label}
            onChange={(e) => updateNode(node.id, { label: e.target.value })}
          />
          {schema.nodeKinds.length > 1 && (
            <Select
              style={{ width: '100%' }}
              placeholder="节点种类"
              value={node.nodeKind ?? schema.nodeKinds[0]?.id}
              onChange={(v) => {
                const k = schema.nodeKinds.find((x) => x.id === v)
                updateNode(node.id, {
                  nodeKind: v,
                  category: k?.category ?? node.category,
                  stereotype: k?.defaultStereotype ?? node.stereotype
                })
              }}
              options={schema.nodeKinds.map((k) => ({ value: k.id, label: k.label }))}
            />
          )}
          {stereotypeOptions.length > 0 && (
            <Select
              style={{ width: '100%' }}
              placeholder={isOntology ? '构造型（对象/链接/动作/值类型）' : '构造型（类/接口/抽象/枚举）'}
              allowClear
              value={node.stereotype}
              onChange={(v) => updateNode(node.id, { stereotype: v })}
              options={stereotypeOptions.map((s) => ({
                value: s,
                label: NODE_STEREOTYPE_LABELS[s]
              }))}
            />
          )}
          {isArch && (
            <Input
              addonBefore="类别"
              placeholder="service/db/ui/external"
              value={node.category}
              onChange={(e) => updateNode(node.id, { category: e.target.value })}
            />
          )}
          <Input.TextArea
            placeholder="备注"
            autoSize={{ minRows: 1, maxRows: 4 }}
            value={node.comment}
            onChange={(e) => updateNode(node.id, { comment: e.target.value })}
          />
          <Button
            danger
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => removeNode(node.id)}
            style={{ alignSelf: 'flex-start', paddingLeft: 0 }}
          >
            删除节点
          </Button>
        </Space>
      </div>

      {paradigmExtras(renderKind, node, doc, updateNode, setDoc)}

      {(node.nodeKind === 'threat' || node.category === 'threat') && (
        <div className="panel-section">
          <div className="panel-title">STRIDE 威胁分类</div>
          <Space wrap>
            {STRIDE_DEFS.map(([letter, name]) => {
              const cur = strideSet(node.props?.stride)
              const on = cur.has(letter)
              return (
                <Button
                  key={letter}
                  size="small"
                  danger={on}
                  type={on ? 'primary' : 'default'}
                  title={name}
                  onClick={() => {
                    const next = new Set(cur)
                    if (on) next.delete(letter)
                    else next.add(letter)
                    const ordered = ['S', 'T', 'R', 'I', 'D', 'E'].filter((l) => next.has(l))
                    updateNode(node.id, { props: { ...(node.props ?? {}), stride: ordered.join(',') } })
                  }}
                >
                  {letter}
                </Button>
              )
            })}
          </Space>
        </div>
      )}

      {(() => {
        const kind = schema.nodeKinds.find((k) => k.id === (node.nodeKind ?? schema.nodeKinds[0]?.id))
        const propDefs = [...(schema.nodeProps ?? []), ...(kind?.props ?? [])]
        if (propDefs.length === 0) return null
        return (
          <div className="panel-section">
            <div className="panel-title">图元属性</div>
            <SchemaProps
              defs={propDefs}
              node={node}
              onChange={(key, value) =>
                updateNode(node.id, { props: { ...(node.props ?? {}), [key]: value } })
              }
            />
          </div>
        )
      })()}

      {(() => {
        const kind = schema.nodeKinds.find((k) => k.id === (node.nodeKind ?? schema.nodeKinds[0]?.id))
        const showFields = renderKind === 'graph' && (kind?.allowsFields || doc.kind === 'logical' || doc.kind === 'physical' || doc.kind === 'conceptual' || isUml)
        if (!showFields) return null
        return (
      <div className="panel-section">
        <div className="panel-title">字段 / 属性（{node.fields.length}）</div>
        <div className="field-cards">
          {node.fields.map((f, idx) => (
            <FieldCard
              key={f.id}
              field={f}
              index={idx}
              total={node.fields.length}
              nodeId={node.id}
              isUml={isUml}
              isOntology={isOntology}
              updateField={updateField}
              removeField={removeField}
              moveField={moveField}
            />
          ))}
        </div>
        <Button
          block
          size="small"
          icon={<PlusOutlined />}
          onClick={() => addField(node.id)}
          style={{ marginTop: 8 }}
        >
          添加字段
        </Button>
      </div>
        )
      })()}

      {isUml && renderKind === 'graph' && (
        <div className="panel-section">
          <div className="panel-title">方法</div>
          <Space direction="vertical" style={{ width: '100%' }} size={10}>
            {(node.methods ?? []).map((m) => (
              <div
                key={m.id}
                style={{ border: '1px solid #eee', borderRadius: 6, padding: 8, background: '#fff' }}
              >
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    placeholder="方法名"
                    value={m.name}
                    onChange={(e) => updateMethod(node.id, m.id, { name: e.target.value })}
                  />
                  <Input
                    placeholder="返回类型"
                    value={m.returnType}
                    onChange={(e) => updateMethod(node.id, m.id, { returnType: e.target.value })}
                  />
                </Space.Compact>
                <Space.Compact style={{ width: '100%', marginTop: 6 }}>
                  <Input
                    placeholder="参数"
                    value={m.params}
                    onChange={(e) => updateMethod(node.id, m.id, { params: e.target.value })}
                  />
                  <Tooltip title="删除方法">
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeMethod(node.id, m.id)}
                    />
                  </Tooltip>
                </Space.Compact>
                <Space size={8} wrap style={{ marginTop: 6 }}>
                  <Select
                    size="small"
                    style={{ width: 130 }}
                    value={m.visibility ?? 'public'}
                    onChange={(v) => updateMethod(node.id, m.id, { visibility: v })}
                    options={[
                      { value: 'public', label: '+ public' },
                      { value: 'private', label: '- private' },
                      { value: 'protected', label: '# protected' }
                    ]}
                  />
                  <Checkbox
                    checked={m.static}
                    onChange={(e) => updateMethod(node.id, m.id, { static: e.target.checked })}
                  >
                    静态
                  </Checkbox>
                  <Checkbox
                    checked={m.abstract}
                    onChange={(e) => updateMethod(node.id, m.id, { abstract: e.target.checked })}
                  >
                    抽象
                  </Checkbox>
                </Space>
              </div>
            ))}
            <Button block icon={<PlusOutlined />} onClick={() => addMethod(node.id)}>
              添加方法
            </Button>
          </Space>
        </div>
      )}

      <Divider style={{ margin: 0 }} />
    </div>
  )
}
