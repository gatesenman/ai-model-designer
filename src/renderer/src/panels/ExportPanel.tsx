import { useState } from 'react'
import { Button, Divider, Select, Space, Typography, message } from 'antd'
import {
  FileImageOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  CodeOutlined,
  FileMarkdownOutlined,
  DatabaseOutlined,
  FolderOpenOutlined,
  SaveOutlined,
  FileZipOutlined
} from '@ant-design/icons'
import { useModelStore } from '../store/modelStore'
import { useSettingsStore } from '../store/settingsStore'
import { exportModel } from '../export/exporters'
import { generateAllArtifacts, generateProjectArtifacts } from '../generate/generators'
import { saveProjectFile, openProjectFile } from '../project/projectFile'
import {
  SQL_DIALECT_LABELS,
  type ExportFormat,
  type SqlDialect
} from '@shared/types'

const FORMATS: { value: ExportFormat; label: string; icon: React.ReactNode }[] = [
  { value: 'json', label: 'JSON 模型', icon: <FileTextOutlined /> },
  { value: 'sql', label: 'SQL DDL', icon: <DatabaseOutlined /> },
  { value: 'markdown', label: 'Markdown 文档', icon: <FileMarkdownOutlined /> },
  { value: 'png', label: 'PNG 图片', icon: <FileImageOutlined /> },
  { value: 'svg', label: 'SVG 矢量图', icon: <CodeOutlined /> },
  { value: 'pdf', label: 'PDF 文档', icon: <FilePdfOutlined /> }
]

export default function ExportPanel() {
  const doc = useModelStore((s) => s.doc)
  const project = useModelStore((s) => s.project)
  const loadProject = useModelStore((s) => s.loadProject)
  const markSaved = useModelStore((s) => s.markSaved)
  const codegen = useSettingsStore((s) => s.settings.codegen)
  const [busy, setBusy] = useState<ExportFormat | null>(null)
  const [batchBusy, setBatchBusy] = useState(false)
  const [dialect, setDialect] = useState<SqlDialect>(codegen.sqlDialect)

  const handleExport = async (format: ExportFormat) => {
    if (doc.nodes.length === 0) {
      message.warning('画布为空，无法导出')
      return
    }
    setBusy(format)
    try {
      const res = await exportModel(doc, format)
      const saved = await window.api.saveFile({
        defaultName: `${doc.name}.${res.ext}`,
        data: res.data,
        encoding: res.encoding,
        filters: [{ name: res.ext.toUpperCase(), extensions: [res.ext] }]
      })
      if (saved.ok) message.success('已导出：' + saved.filePath)
    } catch (err) {
      message.error('导出失败：' + (err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const filePath = useModelStore((s) => s.filePath)
  const setFilePath = useModelStore((s) => s.setFilePath)

  const handleSaveProject = async () => {
    const res = await saveProjectFile(project, { filePath })
    if (res.ok && res.filePath) {
      setFilePath(res.filePath)
      markSaved()
      message.success('项目已保存：' + res.filePath)
    }
  }

  const handleOpenProject = async () => {
    try {
      const opened = await openProjectFile()
      if (opened) {
        loadProject(opened.project, { dirty: false, filePath: opened.filePath })
        message.success('已打开项目：' + opened.project.name)
      }
    } catch {
      message.error('文件解析失败')
    }
  }

  const handleBatch = async (scope: 'model' | 'project') => {
    const opts = { sqlDialect: dialect, naming: codegen.naming }
    const files =
      scope === 'model'
        ? generateAllArtifacts(doc, opts)
        : generateProjectArtifacts(project, opts)
    if (files.length === 0) {
      message.warning('没有可导出的内容')
      return
    }
    setBatchBusy(true)
    try {
      const folderName =
        scope === 'model' ? `${doc.name}-产物` : `${project.name}-全部产物`
      const res = await window.api.saveDirFiles({ folderName, files })
      if (res.ok) message.success(`已导出 ${res.count} 个文件到：${res.dir}`)
    } catch (err) {
      message.error('批量导出失败：' + (err as Error).message)
    } finally {
      setBatchBusy(false)
    }
  }

  return (
    <div>
      <div className="panel-section">
        <div className="panel-title">项目文件</div>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button block icon={<SaveOutlined />} onClick={handleSaveProject}>
            保存项目 (.amdproj)
          </Button>
          <Button block icon={<FolderOpenOutlined />} onClick={handleOpenProject}>
            打开项目 / 导入模型
          </Button>
        </Space>
      </div>

      <Divider style={{ margin: '4px 0' }} />

      <div className="panel-section">
        <div className="panel-title">导出当前模型</div>
        <Space direction="vertical" style={{ width: '100%' }}>
          {FORMATS.map((f) => (
            <Button
              key={f.value}
              block
              icon={f.icon}
              loading={busy === f.value}
              onClick={() => handleExport(f.value)}
              style={{ textAlign: 'left' }}
            >
              {f.label}
            </Button>
          ))}
        </Space>
      </div>

      <Divider style={{ margin: '4px 0' }} />

      <div className="panel-section">
        <div className="panel-title">
          <FileZipOutlined /> 批量导出全部产物
        </div>
        <Select
          style={{ width: '100%', marginBottom: 8 }}
          value={dialect}
          onChange={setDialect}
          options={Object.entries(SQL_DIALECT_LABELS).map(([v, label]) => ({
            value: v,
            label: `SQL 方言：${label}`
          }))}
        />
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            block
            type="primary"
            loading={batchBusy}
            icon={<FileZipOutlined />}
            onClick={() => handleBatch('model')}
          >
            导出当前模型全部产物
          </Button>
          <Button
            block
            loading={batchBusy}
            icon={<FileZipOutlined />}
            onClick={() => handleBatch('project')}
          >
            导出整个项目全部产物
          </Button>
        </Space>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
          产物含：模型 JSON、SQL DDL、JPA/SQLAlchemy/TS 实体、需求文档、数据字典、AI 规格说明、AI
          提示词、样例数据。PNG/SVG/PDF 基于当前画布渲染。
        </Typography.Paragraph>
      </div>
    </div>
  )
}
