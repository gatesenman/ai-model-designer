import { useState } from 'react'
import { Button, Empty, Input, Tooltip, Typography } from 'antd'
import {
  FileAddOutlined,
  DeleteOutlined,
  CopyOutlined,
  DatabaseOutlined,
  EditOutlined
} from '@ant-design/icons'
import { useModelStore } from '../store/modelStore'
import { MODEL_KIND_LABELS } from '@shared/types'
import { diagramTypeName } from '@shared/diagramCatalog'
import NewDiagramModal from './NewDiagramModal'

export default function ProjectExplorer() {
  const project = useModelStore((s) => s.project)
  const activeId = useModelStore((s) => s.doc.id)
  const activeDoc = useModelStore((s) => s.doc)
  const switchModel = useModelStore((s) => s.switchModel)
  const addModel = useModelStore((s) => s.addModel)
  const removeModel = useModelStore((s) => s.removeModel)
  const duplicateModel = useModelStore((s) => s.duplicateModel)
  const renameProject = useModelStore((s) => s.renameProject)
  const renameModel = useModelStore((s) => s.renameModel)
  const setDescription = useModelStore((s) => s.setDescription)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const startRename = (id: string, currentName: string): void => {
    setEditingId(id)
    setEditName(currentName)
    setTimeout(() => {
      const el = document.querySelector('.model-rename-input input') as HTMLInputElement | null
      el?.focus()
      el?.select()
    }, 50)
  }

  const commitRename = (): void => {
    if (editingId && editName.trim()) {
      renameModel(editingId, editName.trim())
    }
    setEditingId(null)
  }

  return (
    <div className="explorer">
      <div className="panel-section">
        <div className="panel-title">
          <DatabaseOutlined /> 项目
        </div>
        <Input
          size="small"
          value={project.name}
          onChange={(e) => renameProject(e.target.value)}
          placeholder="项目名称"
        />
        <div className="explorer-desc">
          <div className="explorer-desc__label">当前图表描述</div>
          <Input.TextArea
            size="small"
            autoSize={{ minRows: 2, maxRows: 4 }}
            placeholder="图表描述（可选）"
            value={activeDoc.description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      <div className="panel-section" style={{ flex: 1, overflow: 'auto' }}>
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ flex: 1 }}>模型（{project.models.length}）</span>
          <Tooltip title="新建图表">
            <Button
              size="small"
              type="text"
              icon={<FileAddOutlined />}
              onClick={() => setPickerOpen(true)}
            />
          </Tooltip>
        </div>
        <div className="model-list">
          {project.models.length === 0 && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="项目中还没有图表。可点击上方「+」或下面按钮新建。"
            >
              <Button type="primary" size="small" icon={<FileAddOutlined />} onClick={() => setPickerOpen(true)}>
                新建图表
              </Button>
            </Empty>
          )}
          {project.models.map((m) => (
            <div
              key={m.id}
              className={`model-list__item ${m.id === activeId ? 'active' : ''}`}
              onClick={() => switchModel(m.id)}
            >
              <div className="model-list__main">
                {editingId === m.id ? (
                  <Input
                    className="model-rename-input"
                    size="small"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={commitRename}
                    onPressEnter={commitRename}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div
                    className="model-list__name"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      startRename(m.id, m.name)
                    }}
                  >
                    {m.name}
                  </div>
                )}
                <div className="model-list__meta">
                  {diagramTypeName(m.diagramType, MODEL_KIND_LABELS[m.kind])} · {m.nodes.length} 节点
                </div>
              </div>
              <div className="model-list__actions" onClick={(e) => e.stopPropagation()}>
                <Tooltip title="重命名模型">
                  <Button
                    size="small"
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => startRename(m.id, m.name)}
                  />
                </Tooltip>
                <Tooltip title="复制模型">
                  <Button
                    size="small"
                    type="text"
                    icon={<CopyOutlined />}
                    onClick={() => duplicateModel(m.id)}
                  />
                </Tooltip>
                <Tooltip title={project.models.length <= 1 ? '项目至少保留一张图，因此不能删除' : '删除模型'}>
                  <Button
                    size="small"
                    type="text"
                    danger
                    disabled={project.models.length <= 1}
                    icon={<DeleteOutlined />}
                    onClick={() => removeModel(m.id)}
                  />
                </Tooltip>
              </div>
            </div>
          ))}
        </div>

        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
          双击模型名称可重命名；点击切换模型；可保存为 .amdproj 项目文件。
        </Typography.Paragraph>
      </div>

      <NewDiagramModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(t) => {
          const id = addModel(t.engine, t.name, t.id)
          switchModel(id)
        }}
      />
    </div>
  )
}
