import { Button, Input, Tooltip, Typography, message, Segmented, Tag } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
  EditOutlined,
  TableOutlined,
  ClusterOutlined,
  DeploymentUnitOutlined,
  BlockOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  FolderOutlined,
  FileOutlined
} from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { useModelStore } from '../store/modelStore'
import { MODEL_KIND_LABELS } from '@shared/types'
import type { ModelKind } from '@shared/types'
import { diagramTypeName } from '@shared/diagramCatalog'
import NewDiagramModal from './NewDiagramModal'
import GenerateProjectModal from './GenerateProjectModal'
import VersionModal from './VersionModal'
import { ThunderboltOutlined, HistoryOutlined } from '@ant-design/icons'

const KIND_ICONS: Record<ModelKind, React.ReactNode> = {
  conceptual: <ClusterOutlined />,
  logical: <TableOutlined />,
  physical: <DeploymentUnitOutlined />,
  uml: <BlockOutlined />,
  architecture: <ApartmentOutlined />
}

const KIND_COLORS: Record<ModelKind, string> = {
  conceptual: '#00a884',
  logical: '#3b6cff',
  physical: '#7c3aed',
  uml: '#6b3bff',
  architecture: '#d4690a'
}

const KIND_DESCRIPTIONS: Record<ModelKind, string> = {
  conceptual: '实体 + 关系，概念层面描述业务领域',
  logical: '实体 + 属性 + 主外键 + 关系',
  physical: '表 + 列 + 类型 + 索引 + 约束',
  uml: '类 + 属性 + 方法 + 关联',
  architecture: '组件 + 依赖，系统架构设计'
}

const KIND_NODE_LABEL: Record<ModelKind, string> = {
  conceptual: '实体',
  logical: '实体',
  physical: '表',
  uml: '类',
  architecture: '组件'
}

const KIND_EDGE_LABEL: Record<ModelKind, string> = {
  conceptual: '关系',
  logical: '关系',
  physical: '引用',
  uml: '关联',
  architecture: '依赖'
}

type ViewMode = 'grid' | 'list'
type FilterType = 'all' | ModelKind

interface Props {
  onEnterDiagram: (modelId: string) => void
}

export default function ProjectDashboard({ onEnterDiagram }: Props) {
  const project = useModelStore((s) => s.project)
  const addModel = useModelStore((s) => s.addModel)
  const removeModel = useModelStore((s) => s.removeModel)
  const duplicateModel = useModelStore((s) => s.duplicateModel)
  const renameModel = useModelStore((s) => s.renameModel)
  const renameProject = useModelStore((s) => s.renameProject)
  const setProjectMeta = useModelStore((s) => s.setProjectMeta)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editingProject, setEditingProject] = useState(false)
  const [projectName, setProjectName] = useState(project.name)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [filter, setFilter] = useState<FilterType>('all')
  const [newOpen, setNewOpen] = useState(false)
  const [genProjectOpen, setGenProjectOpen] = useState(false)
  const [versionOpen, setVersionOpen] = useState(false)

  const commitRename = (): void => {
    if (editingId && editName.trim()) {
      renameModel(editingId, editName.trim())
    }
    setEditingId(null)
  }

  const commitProjectRename = (): void => {
    if (projectName.trim()) {
      renameProject(projectName.trim())
    }
    setEditingProject(false)
  }

  // Statistics by type
  const stats = useMemo(() => {
    const byType: Partial<Record<ModelKind, number>> = {}
    let totalNodes = 0
    let totalEdges = 0
    for (const m of project.models) {
      byType[m.kind] = (byType[m.kind] ?? 0) + 1
      totalNodes += m.nodes.length
      totalEdges += m.edges.length
    }
    return { byType, totalNodes, totalEdges, total: project.models.length }
  }, [project.models])

  // Filtered models
  const filteredModels = useMemo(() => {
    if (filter === 'all') return project.models
    return project.models.filter((m) => m.kind === filter)
  }, [project.models, filter])


  const filterOptions = [
    { label: `全部 (${stats.total})`, value: 'all' as FilterType },
    ...(Object.entries(MODEL_KIND_LABELS) as [ModelKind, string][])
      .filter(([kind]) => stats.byType[kind])
      .map(([kind, label]) => ({
        label: `${label} (${stats.byType[kind]})`,
        value: kind as FilterType
      }))
  ]

  return (
    <div className="dashboard">
      {/* Project Header */}
      <div className="dashboard__header">
        <div className="dashboard__project-info">
          {editingProject ? (
            <Input
              size="large"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={commitProjectRename}
              onPressEnter={commitProjectRename}
              autoFocus
              style={{ width: 300, fontSize: 20, fontWeight: 700 }}
            />
          ) : (
            <div className="dashboard__project-name">
              <FolderOutlined style={{ color: '#3b6cff', fontSize: 20 }} />
              <span
                onDoubleClick={() => {
                  setEditingProject(true)
                  setProjectName(project.name)
                }}
              >
                {project.name}
              </span>
              <Tooltip title="重命名项目">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditingProject(true)
                    setProjectName(project.name)
                  }}
                />
              </Tooltip>
            </div>
          )}
          <Input.TextArea
            placeholder="项目描述（可选）"
            rows={1}
            value={project.description}
            onChange={(e) => setProjectMeta({ description: e.target.value })}
            style={{ marginTop: 8, maxWidth: 500 }}
            autoSize={{ minRows: 1, maxRows: 3 }}
          />
        </div>
        <div className="dashboard__header-actions">
          <Tooltip title="保存/恢复项目版本快照">
            <Button size="large" icon={<HistoryOutlined />} onClick={() => setVersionOpen(true)}>
              版本
            </Button>
          </Tooltip>
          <Button
            size="large"
            icon={<ThunderboltOutlined />}
            onClick={() => setGenProjectOpen(true)}
          >
            AI 生成多图
          </Button>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => setNewOpen(true)}
          >
            新建图表
          </Button>
        </div>
      </div>

      {/* Statistics Bar */}
      <div className="asset-stats">
        <div className="asset-stats__item">
          <FileOutlined />
          <span className="asset-stats__value">{stats.total}</span>
          <span className="asset-stats__label">图表</span>
        </div>
        {(Object.entries(MODEL_KIND_LABELS) as [ModelKind, string][]).map(([kind, label]) => {
          const count = stats.byType[kind]
          if (!count) return null
          return (
            <div className="asset-stats__item" key={kind}>
              <span style={{ color: KIND_COLORS[kind] }}>{KIND_ICONS[kind]}</span>
              <span className="asset-stats__value">{count}</span>
              <span className="asset-stats__label">{label}</span>
            </div>
          )
        })}
        <div className="asset-stats__sep" />
        <div className="asset-stats__item">
          <span className="asset-stats__value">{stats.totalNodes}</span>
          <span className="asset-stats__label">节点</span>
        </div>
        <div className="asset-stats__item">
          <span className="asset-stats__value">{stats.totalEdges}</span>
          <span className="asset-stats__label">关系</span>
        </div>
      </div>

      {/* Filter + View Toggle Bar */}
      <div className="asset-toolbar">
        <div className="asset-toolbar__filters">
          <Segmented
            size="small"
            value={filter}
            onChange={(v) => setFilter(v as FilterType)}
            options={filterOptions}
          />
        </div>
        <div className="asset-toolbar__view">
          <Segmented
            size="small"
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
            options={[
              { value: 'grid', icon: <AppstoreOutlined /> },
              { value: 'list', icon: <UnorderedListOutlined /> }
            ]}
          />
        </div>
      </div>

      {/* Asset List / Grid */}
      {viewMode === 'grid' ? (
        <div className="dashboard__grid">
          {filteredModels.map((m) => {
            const kind = m.kind
            const color = KIND_COLORS[kind]
            return (
              <div
                key={m.id}
                className="diagram-card"
                onClick={() => onEnterDiagram(m.id)}
              >
                <div
                  className="diagram-card__header"
                  style={{ background: color }}
                >
                  <span className="diagram-card__icon">{KIND_ICONS[kind]}</span>
                  <span className="diagram-card__kind">
                    {diagramTypeName(m.diagramType, MODEL_KIND_LABELS[kind])}
                  </span>
                </div>
                <div className="diagram-card__body">
                  {editingId === m.id ? (
                    <Input
                      size="small"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={commitRename}
                      onPressEnter={commitRename}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <div className="diagram-card__name">{m.name}</div>
                  )}
                  <div className="diagram-card__meta">
                    {m.nodes.length} {KIND_NODE_LABEL[kind]} · {m.edges.length} {KIND_EDGE_LABEL[kind]}
                  </div>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {m.description || KIND_DESCRIPTIONS[kind]}
                  </Typography.Text>
                </div>
                <div className="diagram-card__footer">
                  <span className="diagram-card__date">
                    {m.updatedAt ? m.updatedAt.slice(0, 10) : ''}
                  </span>
                  <div className="diagram-card__actions" onClick={(e) => e.stopPropagation()}>
                    <Tooltip title="重命名">
                      <Button
                        size="small"
                        type="text"
                        icon={<EditOutlined style={{ fontSize: 12 }} />}
                        onClick={() => {
                          setEditingId(m.id)
                          setEditName(m.name)
                        }}
                      />
                    </Tooltip>
                    <Tooltip title="复制">
                      <Button
                        size="small"
                        type="text"
                        icon={<CopyOutlined style={{ fontSize: 12 }} />}
                        onClick={() => {
                          duplicateModel(m.id)
                          message.success('已复制图表')
                        }}
                      />
                    </Tooltip>
                    <Tooltip title="删除">
                      <Button
                        size="small"
                        type="text"
                        danger
                        disabled={project.models.length <= 1}
                        icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                        onClick={() => {
                          removeModel(m.id)
                          message.success('已删除图表')
                        }}
                      />
                    </Tooltip>
                  </div>
                </div>
              </div>
            )
          })}

          <div className="diagram-card diagram-card--add" onClick={() => setNewOpen(true)}>
            <PlusOutlined style={{ fontSize: 32, color: '#ccc' }} />
            <div style={{ marginTop: 8, color: '#999' }}>新建图表</div>
          </div>
        </div>
      ) : (
        /* List View */
        <div className="asset-list">
          <div className="asset-list__header">
            <span className="asset-list__col asset-list__col--name">名称</span>
            <span className="asset-list__col asset-list__col--type">类型</span>
            <span className="asset-list__col asset-list__col--count">节点</span>
            <span className="asset-list__col asset-list__col--count">关系</span>
            <span className="asset-list__col asset-list__col--desc">描述</span>
            <span className="asset-list__col asset-list__col--date">更新日期</span>
            <span className="asset-list__col asset-list__col--ops">操作</span>
          </div>
          {filteredModels.map((m) => {
            const kind = m.kind
            return (
              <div
                key={m.id}
                className="asset-list__row"
                onClick={() => onEnterDiagram(m.id)}
              >
                <span className="asset-list__col asset-list__col--name">
                  {editingId === m.id ? (
                    <Input
                      size="small"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={commitRename}
                      onPressEnter={commitRename}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <span className="asset-list__name-text">{m.name}</span>
                  )}
                </span>
                <span className="asset-list__col asset-list__col--type">
                  <Tag
                    color={KIND_COLORS[kind]}
                    style={{ margin: 0, fontSize: 11 }}
                    icon={KIND_ICONS[kind]}
                  >
                    {diagramTypeName(m.diagramType, MODEL_KIND_LABELS[kind])}
                  </Tag>
                </span>
                <span className="asset-list__col asset-list__col--count">{m.nodes.length}</span>
                <span className="asset-list__col asset-list__col--count">{m.edges.length}</span>
                <span className="asset-list__col asset-list__col--desc">
                  {m.description || KIND_DESCRIPTIONS[kind]}
                </span>
                <span className="asset-list__col asset-list__col--date">
                  {m.updatedAt ? m.updatedAt.slice(0, 10) : '-'}
                </span>
                <span className="asset-list__col asset-list__col--ops" onClick={(e) => e.stopPropagation()}>
                  <Tooltip title="重命名">
                    <Button
                      size="small"
                      type="text"
                      icon={<EditOutlined style={{ fontSize: 12 }} />}
                      onClick={() => {
                        setEditingId(m.id)
                        setEditName(m.name)
                      }}
                    />
                  </Tooltip>
                  <Tooltip title="复制">
                    <Button
                      size="small"
                      type="text"
                      icon={<CopyOutlined style={{ fontSize: 12 }} />}
                      onClick={() => {
                        duplicateModel(m.id)
                        message.success('已复制图表')
                      }}
                    />
                  </Tooltip>
                  <Tooltip title="删除">
                    <Button
                      size="small"
                      type="text"
                      danger
                      disabled={project.models.length <= 1}
                      icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                      onClick={() => {
                        removeModel(m.id)
                        message.success('已删除图表')
                      }}
                    />
                  </Tooltip>
                </span>
              </div>
            )
          })}
        </div>
      )}

      <NewDiagramModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onPick={(t) => {
          addModel(t.engine, t.name, t.id)
          message.success(`已创建「${t.name}」`)
        }}
      />
      <GenerateProjectModal open={genProjectOpen} onClose={() => setGenProjectOpen(false)} />
      <VersionModal open={versionOpen} onClose={() => setVersionOpen(false)} />
    </div>
  )
}
