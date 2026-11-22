import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Radio, Segmented, Select, Space, message } from 'antd'
import {
  CopyOutlined,
  DownloadOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  CodeOutlined
} from '@ant-design/icons'
import MarkdownView from './MarkdownView'
import hljs from 'highlight.js/lib/core'
import sql from 'highlight.js/lib/languages/sql'
import java from 'highlight.js/lib/languages/java'
import python from 'highlight.js/lib/languages/python'
import typescript from 'highlight.js/lib/languages/typescript'
import go from 'highlight.js/lib/languages/go'
import csharp from 'highlight.js/lib/languages/csharp'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import javascript from 'highlight.js/lib/languages/javascript'
import 'highlight.js/styles/github.css'

hljs.registerLanguage('sql', sql)
hljs.registerLanguage('java', java)
hljs.registerLanguage('python', python)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('go', go)
hljs.registerLanguage('csharp', csharp)
hljs.registerLanguage('json', json)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('javascript', javascript)
import { useModelStore } from '../store/modelStore'
import { useSettingsStore } from '../store/settingsStore'
import {
  generateCodeArtifact,
  generateDataArtifact,
  generateDocArtifact
} from '../ai/aiClient'
import type { GenOptions } from '../generate/generators'
import { isOutputSavable } from '@shared/projectSession'
import { describeProviderStatus } from '@shared/providerStatus'
import {
  describeGenerateSource,
  generateOutputKey,
  lookupGenerateSlot
} from '@shared/generateOutput'
import {
  CODE_TARGET_LABELS,
  DATA_TARGET_LABELS,
  DOC_TARGET_LABELS,
  SQL_DIALECT_LABELS,
  type ArtifactCategory,
  type CodeTarget,
  type DataTarget,
  type DocTarget,
  type NamingConvention,
  type SqlDialect
} from '@shared/types'

const CATEGORY_OPTIONS = [
  { value: 'code', label: '代码' },
  { value: 'doc', label: '文档' },
  { value: 'data', label: '数据' }
]

const NAMING_LABELS: Record<NamingConvention, string> = {
  snake_case: 'snake_case',
  camelCase: 'camelCase',
  PascalCase: 'PascalCase',
  original: '原样'
}

const CODE_EXT: Record<CodeTarget, string> = {
  sql: 'sql',
  'java-pojo': 'java',
  'java-jpa': 'java',
  'python-dataclass': 'py',
  'python-sqlalchemy': 'py',
  'python-pydantic': 'py',
  'typescript-interface': 'ts',
  'typescript-typeorm': 'ts',
  'typescript-prisma': 'prisma',
  'go-struct': 'go',
  'csharp-class': 'cs',
  mongoose: 'js'
}

const CODE_LANG: Record<CodeTarget, string> = {
  sql: 'sql',
  'java-pojo': 'java',
  'java-jpa': 'java',
  'python-dataclass': 'python',
  'python-sqlalchemy': 'python',
  'python-pydantic': 'python',
  'typescript-interface': 'typescript',
  'typescript-typeorm': 'typescript',
  'typescript-prisma': 'typescript',
  'go-struct': 'go',
  'csharp-class': 'csharp',
  mongoose: 'javascript'
}
const DATA_EXT: Record<DataTarget, string> = { json: 'json', csv: 'csv', sqlInsert: 'sql' }

function CodeBlock({ code, language }: { code: string; language: string }) {
  const codeRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.removeAttribute('data-highlighted')
      codeRef.current.textContent = code
      hljs.highlightElement(codeRef.current)
    }
  }, [code, language])

  return (
    <div className="code-block">
      <pre className="code-block__pre">
        <code ref={codeRef} className={`language-${language}`}>
          {code}
        </code>
      </pre>
    </div>
  )
}

export default function GeneratePanel() {
  const doc = useModelStore((s) => s.doc)
  const provider = useSettingsStore((s) => s.settings.provider)
  const codegen = useSettingsStore((s) => s.settings.codegen)

  const [category, setCategory] = useState<ArtifactCategory>('code')
  const [codeTarget, setCodeTarget] = useState<CodeTarget>('sql')
  const [docTarget, setDocTarget] = useState<DocTarget>('aiSpec')
  const [dataTarget, setDataTarget] = useState<DataTarget>('json')
  const [dialect, setDialect] = useState<SqlDialect>(codegen.sqlDialect)
  const [naming, setNaming] = useState<NamingConvention>(codegen.naming)
  const [cache, setCache] = useState<Record<string, string>>({})
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [docView, setDocView] = useState<'preview' | 'source'>('preview')

  const opts: GenOptions = useMemo(
    () => ({ sqlDialect: dialect, naming }),
    [dialect, naming]
  )

  const currentTarget = (): string => {
    if (category === 'code') return codeTarget
    if (category === 'data') return dataTarget
    return docTarget
  }

  const outputKey = generateOutputKey({
    modelId: doc.id,
    category,
    target: currentTarget(),
    dialect,
    naming
  })
  const slot = lookupGenerateSlot(cache, outputKey)
  const output = slot.text
  const loading = loadingKey === outputKey

  const categoryLabel = category === 'code' ? '代码' : category === 'doc' ? '文档' : '数据'
  const targetLabel =
    category === 'code'
      ? CODE_TARGET_LABELS[codeTarget]
      : category === 'data'
        ? DATA_TARGET_LABELS[dataTarget]
        : DOC_TARGET_LABELS[docTarget]
  const dialectLabel =
    category === 'code' && (codeTarget === 'sql' || codeTarget === 'typescript-prisma')
      ? SQL_DIALECT_LABELS[dialect]
      : undefined
  const sourceLabel = describeGenerateSource({
    modelName: doc.name,
    categoryLabel,
    targetLabel,
    dialectLabel,
    naming: category === 'code' ? naming : undefined
  })

  const handleGenerate = async () => {
    if (doc.nodes.length === 0) {
      message.warning('请先创建模型')
      return
    }
    const key = outputKey
    setLoadingKey(key)
    setCache((prev) => ({ ...prev, [key]: '生成中…' }))
    try {
      let res = ''
      if (category === 'code') res = await Promise.resolve(generateCodeArtifact(doc, codeTarget, opts))
      else if (category === 'data') res = await Promise.resolve(generateDataArtifact(doc, dataTarget, opts))
      else res = await generateDocArtifact(provider, doc, docTarget)
      setCache((prev) => ({ ...prev, [key]: res }))
    } catch (err) {
      setCache((prev) => ({ ...prev, [key]: '生成失败：' + (err as Error).message }))
    } finally {
      setLoadingKey((k) => (k === key ? null : k))
    }
  }

  const handleCopy = async () => {
    if (!isOutputSavable(output)) {
      message.warning('没有可复制的生成结果')
      return
    }
    try {
      await navigator.clipboard.writeText(output)
      message.success('已复制到剪贴板')
    } catch (err) {
      message.error('复制失败：' + (err as Error).message)
    }
  }

  const currentExt = (): string => {
    if (category === 'code') return CODE_EXT[codeTarget]
    if (category === 'data') return DATA_EXT[dataTarget]
    return 'md'
  }
  const currentName = (): string => {
    if (category === 'code') return codeTarget
    if (category === 'data') return dataTarget
    return docTarget
  }

  const currentLang = (): string => {
    if (category === 'code') return CODE_LANG[codeTarget]
    if (category === 'data') return dataTarget === 'json' ? 'json' : 'sql'
    return 'markdown'
  }

  const handleSave = async () => {
    if (!isOutputSavable(output)) {
      message.warning('没有可保存的生成结果')
      return
    }
    const ext = currentExt()
    const res = await window.api.saveFile({
      defaultName: `${doc.name}-${currentName()}.${ext}`,
      data: output,
      encoding: 'utf8',
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
    })
    if (res.ok) message.success('已保存：' + res.filePath)
  }

  return (
    <div>
      <div className="panel-section">
        <div className="panel-title">
          <ThunderboltOutlined /> 基于模型生成
        </div>
        <Segmented
          block
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={(v) => setCategory(v as ArtifactCategory)}
        />

        {category === 'code' && (
          <>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              value={codeTarget}
              onChange={setCodeTarget}
              options={Object.entries(CODE_TARGET_LABELS).map(([v, label]) => ({
                value: v,
                label
              }))}
            />
            {(codeTarget === 'sql' || codeTarget === 'typescript-prisma') && (
              <Select
                style={{ width: '100%', marginTop: 8 }}
                value={dialect}
                onChange={setDialect}
                options={Object.entries(SQL_DIALECT_LABELS).map(([v, label]) => ({
                  value: v,
                  label: `SQL 方言：${label}`
                }))}
              />
            )}
            <Select
              style={{ width: '100%', marginTop: 8 }}
              value={naming}
              onChange={setNaming}
              options={Object.entries(NAMING_LABELS).map(([v, label]) => ({
                value: v,
                label: `命名：${label}`
              }))}
            />
          </>
        )}

        {category === 'doc' && (
          <Select
            style={{ width: '100%', marginTop: 8 }}
            value={docTarget}
            onChange={setDocTarget}
            options={Object.entries(DOC_TARGET_LABELS).map(([v, label]) => ({
              value: v,
              label
            }))}
          />
        )}

        {category === 'data' && (
          <Select
            style={{ width: '100%', marginTop: 8 }}
            value={dataTarget}
            onChange={setDataTarget}
            options={Object.entries(DATA_TARGET_LABELS).map(([v, label]) => ({
              value: v,
              label
            }))}
          />
        )}

        <Button
          type="primary"
          block
          loading={loading}
          icon={<ThunderboltOutlined />}
          onClick={handleGenerate}
          style={{ marginTop: 8 }}
          data-testid="generate-run"
        >
          生成
        </Button>
        <div className="generate-local-hint" data-testid="generate-local-hint" role="note">
          {category === 'code' || category === 'data'
            ? '这是顶部「生成」面板的本地模板导出（代码/数据），无需 AI Key，也不会调用外部模型。对话式生成请用左侧「AI 助手」。'
            : describeProviderStatus(provider).mode === 'ready'
              ? '文档默认可用本地模板生成，无需 Key。仅在已配置密钥时，部分文档类型才会尝试模型润色，失败会回退本地结果，不会阻断生成。对话式生成请用左侧「AI 助手」。'
              : '文档将由本地模板生成，无需 AI Key，也不会调用外部模型。左侧「AI 助手」才是需要密钥的对话面板，请勿与本面板混淆。'}
        </div>
      </div>

      <div className="panel-section code-output-section">
        {slot.status === 'empty' ? (
          <div className="generate-empty" data-testid="generate-output-empty" role="status">
            尚未为当前图与当前类型生成结果。切换类别、语言或图表后不会沿用上一份输出。可用键盘聚焦「生成」按钮后按 Enter 生成。
          </div>
        ) : (
          <>
            <div
              className="generate-source"
              data-testid="generate-output-source"
              role={slot.status === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {sourceLabel}
              {slot.status === 'pending' ? ' · 生成中' : ''}
              {slot.status === 'error' ? ' · 生成失败，不可复制或保存' : ''}
            </div>
            <Space style={{ marginBottom: 8 }} wrap>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={handleCopy}
                disabled={!isOutputSavable(output)}
                data-testid="generate-copy"
              >
                复制
              </Button>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={handleSave}
                disabled={!isOutputSavable(output)}
                data-testid="generate-save"
              >
                保存文件
              </Button>
              {category === 'doc' && (
                <Radio.Group
                  size="small"
                  value={docView}
                  onChange={(e) => setDocView(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                >
                  <Radio.Button value="preview">
                    <EyeOutlined /> 预览
                  </Radio.Button>
                  <Radio.Button value="source">
                    <CodeOutlined /> 源码
                  </Radio.Button>
                </Radio.Group>
              )}
            </Space>
            {category === 'doc' && docView === 'preview' && slot.status === 'ready' ? (
              <div className="code-block markdown-output">
                <MarkdownView content={output} />
              </div>
            ) : (
              <CodeBlock code={output} language={currentLang()} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
