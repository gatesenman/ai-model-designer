import { useEffect, useMemo, useRef, useState } from 'react'
import { Empty, Input, type InputRef } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useModelStore } from '../store/modelStore'
import { searchProject } from '@shared/searchModel'

interface Props {
  autoFocus?: boolean
  onOpenDiagram?: (modelId: string) => void
}

export default function SearchPanel({ autoFocus, onOpenDiagram }: Props) {
  const project = useModelStore((s) => s.project)
  const switchModel = useModelStore((s) => s.switchModel)
  const selectNode = useModelStore((s) => s.selectNode)
  const [query, setQuery] = useState('')
  const inputRef = useRef<InputRef>(null)

  useEffect(() => {
    if (autoFocus) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 0)
      return () => window.clearTimeout(t)
    }
    return undefined
  }, [autoFocus])

  const hits = useMemo(() => searchProject(project, query), [project, query])

  return (
    <div className="search-panel" style={{ padding: 12 }}>
      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="搜索节点、字段、方法…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        ref={inputRef}
        aria-label="在项目中搜索节点"
      />
      {!query.trim() ? (
        <div style={{ color: '#8b93a7', fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>
          输入关键字可在整个项目的图表中查找节点名称、字段或方法。点击结果将打开对应图表并选中该节点。
        </div>
      ) : hits.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的节点" style={{ marginTop: 24 }} />
      ) : (
        <ul className="search-panel__list" style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
          {hits.map((h, i) => (
            <li key={`${h.modelId}-${h.nodeId}-${h.field ?? ''}-${i}`}>
              <button
                type="button"
                className="search-panel__hit"
                onClick={() => {
                  switchModel(h.modelId)
                  selectNode(h.nodeId)
                  onOpenDiagram?.(h.modelId)
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: '1px solid #e6e9f2',
                  background: '#fff',
                  borderRadius: 8,
                  padding: '8px 10px',
                  marginBottom: 6,
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{h.label}</div>
                <div style={{ fontSize: 11, color: '#8b93a7' }}>
                  {h.modelName}
                  {h.field ? ` · ${h.field}` : ''}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
