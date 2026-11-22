import { useMemo, useState } from 'react'
import { Input, Modal, Empty } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import {
  DIAGRAM_CATALOG,
  DIAGRAM_GROUP_LABELS,
  DIAGRAM_GROUP_ORDER,
  type DiagramGroupId,
  type DiagramTypeDef
} from '@shared/diagramCatalog'
import { MODEL_KIND_LABELS } from '@shared/types'

interface Props {
  open: boolean
  onClose: () => void
  onPick: (type: DiagramTypeDef) => void
}

const ENGINE_BADGE: Record<string, string> = {
  conceptual: '#00a884',
  logical: '#3b6cff',
  physical: '#7c3aed',
  uml: '#6b3bff',
  architecture: '#d4690a'
}

export default function NewDiagramModal({ open, onClose, onPick }: Props) {
  const [query, setQuery] = useState('')
  const [activeGroup, setActiveGroup] = useState<DiagramGroupId | 'all'>('all')

  const q = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    return DIAGRAM_CATALOG.filter((t) => {
      if (activeGroup !== 'all' && t.group !== activeGroup) return false
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        (t.subtitle ?? '').toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      )
    })
  }, [q, activeGroup])

  const grouped = useMemo(() => {
    const map = new Map<DiagramGroupId, DiagramTypeDef[]>()
    for (const t of filtered) {
      const arr = map.get(t.group) ?? []
      arr.push(t)
      map.set(t.group, arr)
    }
    return DIAGRAM_GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      group: g,
      label: DIAGRAM_GROUP_LABELS[g],
      items: map.get(g)!
    }))
  }, [filtered])

  const handlePick = (t: DiagramTypeDef): void => {
    onPick(t)
    onClose()
    setQuery('')
    setActiveGroup('all')
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={920}
      title="新建图表"
      className="new-diagram-modal"
      styles={{ body: { padding: 0 } }}
    >
      <div className="ndm">
        <div className="ndm__sidebar">
          <div
            className={`ndm__group-item ${activeGroup === 'all' ? 'active' : ''}`}
            onClick={() => setActiveGroup('all')}
          >
            全部类型
            <span className="ndm__group-count">{DIAGRAM_CATALOG.length}</span>
          </div>
          {DIAGRAM_GROUP_ORDER.map((g) => {
            const count = DIAGRAM_CATALOG.filter((t) => t.group === g).length
            return (
              <div
                key={g}
                className={`ndm__group-item ${activeGroup === g ? 'active' : ''}`}
                onClick={() => setActiveGroup(g)}
              >
                {DIAGRAM_GROUP_LABELS[g]}
                <span className="ndm__group-count">{count}</span>
              </div>
            )
          })}
        </div>

        <div className="ndm__main">
          <div className="ndm__search">
            <Input
              allowClear
              size="middle"
              prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
              placeholder="搜索图表类型，如 时序图 / ERD / BPMN / C4 …"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="ndm__content">
            {grouped.length === 0 ? (
              <Empty description="未找到匹配的图表类型" style={{ marginTop: 60 }} />
            ) : (
              grouped.map(({ group, label, items }) => (
                <div key={group} className="ndm__section">
                  <div className="ndm__section-title">{label}</div>
                  <div className="ndm__grid">
                    {items.map((t) => (
                      <button
                        key={t.id}
                        className="ndm__card"
                        onClick={() => handlePick(t)}
                        title={t.description}
                      >
                        <div className="ndm__card-top">
                          <span className="ndm__card-name">{t.name}</span>
                          <span
                            className="ndm__card-engine"
                            style={{ color: ENGINE_BADGE[t.engine] }}
                          >
                            {MODEL_KIND_LABELS[t.engine]}
                          </span>
                        </div>
                        {t.subtitle && <div className="ndm__card-sub">{t.subtitle}</div>}
                        <div className="ndm__card-desc">{t.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
