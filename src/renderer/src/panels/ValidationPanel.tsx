import { useMemo, useState } from 'react'
import { Button, Empty, Tag, Tooltip, message } from 'antd'
import {
  CloseCircleTwoTone,
  WarningTwoTone,
  InfoCircleTwoTone,
  SafetyCertificateTwoTone,
  ReloadOutlined
} from '@ant-design/icons'
import { useModelStore } from '../store/modelStore'
import { validateModel, summarize } from '../validation/validationEngine'
import type { ValidationIssue } from '@shared/types'

function icon(sev: ValidationIssue['severity']) {
  if (sev === 'error') return <CloseCircleTwoTone twoToneColor="#ff4d4f" />
  if (sev === 'warning') return <WarningTwoTone twoToneColor="#faad14" />
  return <InfoCircleTwoTone twoToneColor="#1677ff" />
}

export default function ValidationPanel() {
  const doc = useModelStore((s) => s.doc)
  const selectNode = useModelStore((s) => s.selectNode)

  const [tick, setTick] = useState(0)
  const issues = useMemo(() => validateModel(doc), [doc, tick])
  const counts = summarize(issues)

  return (
    <div>
      <div className="panel-section">
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ flex: 1 }}>模型校验</span>
          <Tooltip title="重新校验">
            <Button
              size="small"
              type="text"
              icon={<ReloadOutlined />}
              onClick={() => {
                setTick((n) => n + 1)
                const next = validateModel(useModelStore.getState().doc)
                const c = summarize(next)
                message.success(
                  next.length === 0
                    ? '已重新校验，未发现问题'
                    : `已重新校验：${c.errors} 个错误，${c.warnings} 个警告，${c.infos} 个提示。点击条目可定位到对应节点。`
                )
              }}
            />
          </Tooltip>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Tag color="error">错误 {counts.errors}</Tag>
          <Tag color="warning">警告 {counts.warnings}</Tag>
          <Tag color="blue">提示 {counts.infos}</Tag>
        </div>
      </div>

      <div className="panel-section">
        {issues.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                <SafetyCertificateTwoTone twoToneColor="#52c41a" /> 未发现问题
              </span>
            }
          />
        ) : (
          <div className="issue-list">
            {issues.map((i) => (
              <div
                key={i.id}
                className={`issue-item issue-${i.severity} ${i.nodeId ? 'clickable' : ''}`}
                onClick={() => i.nodeId && selectNode(i.nodeId)}
              >
                <span className="issue-icon">{icon(i.severity)}</span>
                <span className="issue-msg">{i.message}</span>
                <span className="issue-rule">{i.rule}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
