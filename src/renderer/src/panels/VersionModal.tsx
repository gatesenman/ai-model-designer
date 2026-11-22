import { useState } from 'react'
import { Button, Empty, Input, Modal, Popconfirm, Tag, Tooltip, message } from 'antd'
import { HistoryOutlined, SaveOutlined, DeleteOutlined, RollbackOutlined } from '@ant-design/icons'
import { useModelStore } from '../store/modelStore'

interface Props {
  open: boolean
  onClose: () => void
}

export default function VersionModal({ open, onClose }: Props) {
  const project = useModelStore((s) => s.project)
  const saveSnapshot = useModelStore((s) => s.saveSnapshot)
  const restoreSnapshot = useModelStore((s) => s.restoreSnapshot)
  const deleteSnapshot = useModelStore((s) => s.deleteSnapshot)
  const [label, setLabel] = useState('')

  const snapshots = [...(project.snapshots ?? [])].sort((a, b) => b.version - a.version)

  const handleSave = (): void => {
    saveSnapshot(label.trim() || undefined)
    setLabel('')
    message.success('已保存版本快照')
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      title={
        <span>
          <HistoryOutlined style={{ marginRight: 8 }} />
          版本快照
          <Tag style={{ marginLeft: 8 }}>当前 v{project.version ?? 1}</Tag>
        </span>
      }
    >
      <div className="version-modal">
        <div className="version-modal__save">
          <Input
            placeholder="给这个版本写个备注（可选），如：完成订单域建模"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onPressEnter={handleSave}
          />
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
            保存当前为新版本
          </Button>
        </div>

        <div className="version-modal__list">
          {snapshots.length === 0 ? (
            <Empty description="还没有版本快照" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            snapshots.map((s) => (
              <div key={s.id} className="version-item">
                <div className="version-item__main">
                  <div className="version-item__title">
                    <Tag color="blue">v{s.version}</Tag>
                    <span className="version-item__label">{s.label || '未命名版本'}</span>
                  </div>
                  <div className="version-item__meta">
                    {s.createdAt.replace('T', ' ').slice(0, 16)} · {s.stats.models} 图 ·{' '}
                    {s.stats.nodes} 节点 · {s.stats.edges} 关系
                  </div>
                </div>
                <div className="version-item__ops">
                  <Popconfirm
                    title="恢复此版本？"
                    description="当前未保存的修改将被覆盖（建议先保存为新版本）"
                    okText="恢复"
                    cancelText="取消"
                    onConfirm={() => {
                      restoreSnapshot(s.id)
                      message.success(`已恢复到 v${s.version}`)
                      onClose()
                    }}
                  >
                    <Tooltip title="恢复到此版本">
                      <Button size="small" icon={<RollbackOutlined />}>
                        恢复
                      </Button>
                    </Tooltip>
                  </Popconfirm>
                  <Popconfirm
                    title="删除此快照？"
                    okText="删除"
                    cancelText="取消"
                    onConfirm={() => {
                      deleteSnapshot(s.id)
                      message.success('已删除快照')
                    }}
                  >
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}
