import { useEffect, useRef, useState } from 'react'
import { Button, Modal, Tooltip, message } from 'antd'
import {
  ProfileOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
  RobotOutlined,
  CloudOutlined,
  CloseOutlined,
  PlusOutlined,
  FolderOpenOutlined,
  ArrowLeftOutlined,
  TableOutlined,
  ClusterOutlined,
  DeploymentUnitOutlined,
  BlockOutlined,
  ApartmentOutlined,
  SearchOutlined,
  FormOutlined,
  SettingOutlined
} from '@ant-design/icons'
import CanvasHost from './canvas/CanvasHost'
import AIPanel from './panels/AIPanel'
import PropertiesPanel from './panels/PropertiesPanel'
import GeneratePanel from './panels/GeneratePanel'

import ValidationPanel from './panels/ValidationPanel'
import ProjectExplorer from './panels/ProjectExplorer'
import ProjectDashboard from './panels/ProjectDashboard'
import SettingsModal from './panels/SettingsModal'
import { useModelStore } from './store/modelStore'
import { useSettingsStore } from './store/settingsStore'
import { validateModel, summarize } from './validation/validationEngine'
import { saveProjectFile, openProjectFile } from './project/projectFile'
import { confirmUnsaved } from './project/confirmUnsaved'
import SearchPanel from './panels/SearchPanel'
import { exportModel } from './export/exporters'
import { generateAllArtifacts, generateProjectArtifacts } from './generate/generators'
import { MODEL_KIND_LABELS } from '@shared/types'
import { diagramTypeName } from '@shared/diagramCatalog'
import { describeProviderStatus } from '@shared/providerStatus'
import { APP_NAME, APP_VERSION } from '@shared/appInfo'
import type { ExportFormat, MenuEvent, ModelKind } from '@shared/types'

type AppView = 'home' | 'dashboard' | 'editor'
type LeftPanel = 'ai' | 'explorer' | 'search' | null
type RightPanel = 'props' | 'validate' | null

const KIND_ICONS: Record<ModelKind, React.ReactNode> = {
  conceptual: <ClusterOutlined />,
  logical: <TableOutlined />,
  physical: <DeploymentUnitOutlined />,
  uml: <BlockOutlined />,
  architecture: <ApartmentOutlined />
}

const KIND_DESCRIPTIONS: Record<ModelKind, string> = {
  conceptual: '概念模型 — 业务领域实体与关系',
  logical: '逻辑模型 — 属性、主外键、关系',
  physical: '物理模型 — 表、列、索引、约束',
  uml: 'UML 类图 — 类、方法、关联',
  architecture: '架构图 — 组件与依赖关系'
}

export default function App() {
  const project = useModelStore((s) => s.project)
  const doc = useModelStore((s) => s.doc)
  const dirty = useModelStore((s) => s.dirty)
  const newProject = useModelStore((s) => s.newProject)
  const addModel = useModelStore((s) => s.addModel)
  const loadProject = useModelStore((s) => s.loadProject)
  const switchModel = useModelStore((s) => s.switchModel)
  const markSaved = useModelStore((s) => s.markSaved)
  const filePath = useModelStore((s) => s.filePath)
  const setFilePath = useModelStore((s) => s.setFilePath)
  const undo = useModelStore((s) => s.undo)
  const redo = useModelStore((s) => s.redo)
  const selectedNodeId = useModelStore((s) => s.selectedNodeId)
  const selectedEdgeId = useModelStore((s) => s.selectedEdgeId)
  const selectedNodeIds = useModelStore((s) => s.selectedNodeIds)
  const selectedActivationId = useModelStore((s) => s.selectedActivationId)

  const provider = useSettingsStore((s) => s.settings.provider)
  const autosaveInterval = useSettingsStore((s) => s.settings.autosaveInterval)
  const defaultModelKind = useSettingsStore((s) => s.settings.defaultModelKind)
  const toggleTheme = useSettingsStore((s) => s.toggleTheme)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [view, setView] = useState<AppView>('home')
  const [leftPanel, setLeftPanel] = useState<LeftPanel>('ai')
  const [rightPanel, setRightPanel] = useState<RightPanel>(null)
  const restoredRef = useRef(false)

  const issues = validateModel(doc)
  const counts = summarize(issues)

  // 是否有选中元素（节点 / 多选 / 关系 / 激活条）。不含激活条时，点选条体不会自动打开属性面板。
  const hasSelection =
    !!selectedNodeId || !!selectedEdgeId || selectedNodeIds.length > 0 || !!selectedActivationId
  // 属性面板可手动打开（图级属性入口）；校验面板同样可常驻
  const rightVisible = rightPanel === 'validate' || rightPanel === 'props'

  // 选中元素时自动展示属性面板；取消选中不自动关闭，以便继续编辑图级属性
  useEffect(() => {
    if (hasSelection) {
      setRightPanel((prev) => (prev === 'validate' ? prev : 'props'))
    }
  }, [hasSelection])

  const persistSession = async (): Promise<void> => {
    if (!window.api?.setSession) return
    const s = useModelStore.getState()
    await window.api.setSession({
      project: s.project,
      filePath: s.filePath,
      fileSaved: !s.dirty && !!s.filePath,
      dirty: s.dirty
    })
  }

  const fileHint = (): string | null => {
    const p = useModelStore.getState().filePath
    if (!p) return null
    const parts = p.split(/[/\\]/)
    return parts[parts.length - 1] || p
  }

  const handleSaveProject = async (saveAs = false): Promise<{ ok: boolean; canceled?: boolean }> => {
    const state = useModelStore.getState()
    const res = await saveProjectFile(state.project, { filePath: state.filePath, saveAs })
    if (res.ok && res.filePath) {
      setFilePath(res.filePath)
      markSaved()
      await persistSession()
      message.success('项目已保存：' + res.filePath)
      return { ok: true }
    }
    return { ok: false, canceled: res.canceled }
  }

  const leaveIfAllowed = async (): Promise<boolean> => {
    if (!useModelStore.getState().dirty) return true
    const choice = await confirmUnsaved(fileHint())
    if (choice === 'cancel') return false
    if (choice === 'discard') return true
    const res = await handleSaveProject(false)
    return !!res.ok
  }

  // Restore last project on mount（自动暂存 ≠ 已保存到文件）
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    if (!window.api?.getSession) return
    window.api
      .getSession()
      .then((session) => {
        if (session?.project && Array.isArray(session.project.models) && session.project.models.length > 0) {
          loadProject(session.project, {
            dirty: !session.fileSaved,
            filePath: session.filePath
          })
        }
      })
      .catch(() => undefined)
  }, [loadProject])

  // 自动暂存到本机会话，不把状态改成「已保存」
  useEffect(() => {
    if (!autosaveInterval || autosaveInterval <= 0) return
    const timer = setInterval(() => {
      if (!useModelStore.getState().dirty) return
      const s = useModelStore.getState()
      window.api
        ?.setSession?.({
          project: s.project,
          filePath: s.filePath,
          fileSaved: false,
          dirty: true
        })
        .catch(() => undefined)
    }, autosaveInterval * 1000)
    return () => clearInterval(timer)
  }, [autosaveInterval])

  const handleOpenProject = async (): Promise<void> => {
    if (!(await leaveIfAllowed())) return
    try {
      const opened = await openProjectFile()
      if (opened) {
        loadProject(opened.project, { dirty: false, filePath: opened.filePath })
        await persistSession()
        setView('dashboard')
        message.success('已打开项目：' + opened.project.name)
      }
    } catch {
      message.error('文件解析失败，请确认是有效的 .amdproj 或模型 JSON')
    }
  }

  const handleNewProject = async (): Promise<void> => {
    if (!(await leaveIfAllowed())) return
    newProject()
    await persistSession()
    setView('dashboard')
  }

  const handleCloseProject = async (): Promise<void> => {
    if (!(await leaveIfAllowed())) return
    newProject()
    await persistSession()
    setView('home')
  }

  const handleUndo = (): void => {
    if (!useModelStore.getState().canUndo()) {
      message.info('没有可撤销的编辑')
      return
    }
    undo()
  }

  const handleRedo = (): void => {
    if (!useModelStore.getState().canRedo()) {
      message.info('没有可重做的编辑')
      return
    }
    redo()
  }

  useEffect(() => {
    window.api?.rendererReady?.()
  }, [])

  // 编辑后尽快把草稿与 dirty 同步到主进程，避免只靠长间隔自动保存
  useEffect(() => {
    if (!window.api?.setSession) return
    const timer = window.setTimeout(() => {
      void persistSession()
    }, 400)
    return () => window.clearTimeout(timer)
  }, [dirty, project, filePath])

  useEffect(() => {
    if (!window.api?.onCloseRequest) return
    const off = window.api.onCloseRequest(() => {
      window.api.ackClose?.()
      void (async () => {
        try {
          await persistSession()
          if (await leaveIfAllowed()) await window.api.confirmClose()
          else window.api.cancelClose?.()
        } catch (err) {
          console.error('[close] renderer close flow failed, requesting native dialog', err)
          window.api.requestNativeClose?.()
        }
      })()
    })
    return off
  }, [])

  const handleEnterDiagram = (modelId: string) => {
    switchModel(modelId)
    setView('editor')
  }

  const handleMenuExport = async (format: ExportFormat) => {
    const currentDoc = useModelStore.getState().doc
    if (currentDoc.nodes.length === 0) {
      message.warning('画布为空，无法导出')
      return
    }
    try {
      const res = await exportModel(currentDoc, format)
      const saved = await window.api.saveFile({
        defaultName: `${currentDoc.name}.${res.ext}`,
        data: res.data,
        encoding: res.encoding,
        filters: [{ name: res.ext.toUpperCase(), extensions: [res.ext] }]
      })
      if (saved.ok) message.success('已导出：' + saved.filePath)
    } catch (err) {
      message.error('导出失败：' + (err as Error).message)
    }
  }

  const handleMenuBatchExport = async (scope: 'model' | 'project') => {
    const state = useModelStore.getState()
    const codegen = useSettingsStore.getState().settings.codegen
    const opts = { sqlDialect: codegen.sqlDialect, naming: codegen.naming }
    const files =
      scope === 'model'
        ? generateAllArtifacts(state.doc, opts)
        : generateProjectArtifacts(state.project, opts)
    if (files.length === 0) {
      message.warning('没有可导出的内容')
      return
    }
    try {
      const folderName =
        scope === 'model'
          ? `${state.doc.name}-产物`
          : `${state.project.name}-全部产物`
      const res = await window.api.saveDirFiles({ folderName, files })
      if (res.ok) message.success(`已导出 ${res.count} 个文件到：${res.dir}`)
    } catch (err) {
      message.error('批量导出失败：' + (err as Error).message)
    }
  }

  // Menu events
  useEffect(() => {
    const off = window.api.onMenuEvent((event: MenuEvent) => {
      switch (event) {
        case 'new-project':
          void handleNewProject()
          break
        case 'new-model':
          addModel(defaultModelKind)
          setView('editor')
          break
        case 'new-model-conceptual':
          addModel('conceptual')
          setView('editor')
          break
        case 'new-model-logical':
          addModel('logical')
          setView('editor')
          break
        case 'new-model-physical':
          addModel('physical')
          setView('editor')
          break
        case 'new-model-uml':
          addModel('uml')
          setView('editor')
          break
        case 'new-model-architecture':
          addModel('architecture')
          setView('editor')
          break
        case 'open-project':
          void handleOpenProject()
          break
        case 'save-project':
          void handleSaveProject(false)
          break
        case 'save-project-as':
          void handleSaveProject(true)
          break
        case 'close-project':
          void handleCloseProject()
          break
        case 'find':
          setView((v) => (v === 'home' ? v : 'editor'))
          setLeftPanel('search')
          break
        case 'help-shortcuts':
          setShortcutsOpen(true)
          break
        case 'export':
          message.info('请在「导出」菜单中选择具体格式（JSON / SQL / 图片等）')
          break
        case 'export-json':
        case 'export-sql':
        case 'export-markdown':
        case 'export-png':
        case 'export-svg':
        case 'export-pdf': {
          const formatMap: Record<string, ExportFormat> = {
            'export-json': 'json',
            'export-sql': 'sql',
            'export-markdown': 'markdown',
            'export-png': 'png',
            'export-svg': 'svg',
            'export-pdf': 'pdf'
          }
          const fmt = formatMap[event]
          if (fmt) handleMenuExport(fmt)
          break
        }
        case 'export-batch-model':
          handleMenuBatchExport('model')
          break
        case 'export-batch-project':
          handleMenuBatchExport('project')
          break
        case 'undo':
          handleUndo()
          break
        case 'redo':
          handleRedo()
          break
        case 'toggle-theme':
          toggleTheme()
          break
        case 'settings':
          setSettingsOpen(true)
          break
        case 'about':
          Modal.info({
            title: `关于 ${APP_NAME}`,
            content: `${APP_NAME} ${APP_VERSION}。桌面模型设计工具，支持概念/逻辑/物理/UML/架构与多种图表范式。真实大模型能力取决于你在设置中配置的供应商与密钥；内置模拟仅供离线预览，不能代表真实模型效果。Windows 安装包需在目标机器上自行安装验证。`
          })
          break
      }
    })
    return off
  }, [defaultModelKind, view])

  const toggleLeftPanel = (panel: LeftPanel) => {
    setLeftPanel((prev) => (prev === panel ? null : panel))
  }

  const toggleRightPanel = (panel: RightPanel) => {
    setRightPanel((prev) => (prev === panel ? null : panel))
  }

  /* ==================== View: Home ==================== */
  if (view === 'home') {
    return (
      <div className="app-layout">
        <div className="project-home">
          <div className="project-home__inner">
            <div className="project-home__left">
              <div className="project-home__logo">
                <div className="project-home__logo-icon">
                  <RobotOutlined />
                </div>
                <span className="project-home__logo-text">AI Model Designer</span>
              </div>
              <div className="project-home__subtitle">
                AI 驱动的建模工具，支持概念模型、逻辑模型、物理模型、UML 类图和架构图的可视化设计与代码生成。
              </div>
              <div className="project-home__actions">
                <Button
                  type="primary"
                  size="large"
                  icon={<PlusOutlined />}
                  onClick={handleNewProject}
                  className="home-btn-primary"
                >
                  新建项目
                </Button>
                <Button
                  size="large"
                  icon={<FolderOpenOutlined />}
                  onClick={handleOpenProject}
                  className="home-btn-secondary"
                >
                  打开项目
                </Button>
              </div>
            </div>
            <div className="project-home__right">
              {project.models.length > 0 && project.models[0].nodes.length > 0 ? (
                <div>
                  <div className="project-home__recent-title">最近项目</div>
                  <div className="project-home__list">
                    <div
                      className="project-home__item"
                      onClick={() => setView('dashboard')}
                    >
                      <div className="project-home__item-icon">
                        <FolderOpenOutlined />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="project-home__item-name">{project.name}</div>
                        <div className="project-home__item-meta">
                          {project.models.length} 个图表 · {project.updatedAt?.slice(0, 10)}
                        </div>
                      </div>
                      <span className="project-home__item-arrow">→</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="project-home__recent-title">支持的图表类型</div>
                  <div className="project-home__types">
                    {(Object.keys(KIND_DESCRIPTIONS) as ModelKind[]).map((k) => (
                      <div key={k} className="project-home__type-card">
                        <div className="project-home__type-card-name">
                          {KIND_ICONS[k]}
                          <span>{MODEL_KIND_LABELS[k]}</span>
                        </div>
                        <div className="project-home__type-card-desc">
                          {KIND_DESCRIPTIONS[k].split(' — ')[1]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="project-home__footer">
            {APP_NAME} {APP_VERSION} · 支持概念/逻辑/物理/UML/架构模型
          </div>
        </div>
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </div>
    )
  }

  /* ==================== View: Dashboard ==================== */
  if (view === 'dashboard') {
    return (
      <div className="app-layout">
        <div className="dashboard-nav">
          <Tooltip title="返回首页">
            <Button
              size="small"
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => setView('home')}
            />
          </Tooltip>
          <span className="dashboard-nav__title">{project.name}</span>
          <span className="dashboard-nav__level">资产管理</span>
        </div>
        <ProjectDashboard onEnterDiagram={handleEnterDiagram} />
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </div>
    )
  }

  /* ==================== View: Editor ==================== */
  return (
    <div className="app-layout">
      {/* Editor Nav Bar */}
      <div className="editor-nav">
        <Tooltip title="返回资产管理">
          <Button
            size="small"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => setView('dashboard')}
          />
        </Tooltip>
        <span className="editor-nav__breadcrumb">
          <span className="editor-nav__project" onClick={() => setView('dashboard')}>
            {project.name}
          </span>
          <span className="editor-nav__sep">/</span>
          <span className="editor-nav__kind-badge" data-kind={doc.kind}>
            {doc.kind === 'conceptual' && <ClusterOutlined />}
            {doc.kind === 'logical' && <TableOutlined />}
            {doc.kind === 'physical' && <DeploymentUnitOutlined />}
            {doc.kind === 'uml' && <BlockOutlined />}
            {doc.kind === 'architecture' && <ApartmentOutlined />}
            {diagramTypeName(doc.diagramType, MODEL_KIND_LABELS[doc.kind])}
          </span>
          <span className="editor-nav__sep">/</span>
          <span className="editor-nav__name">{doc.name}</span>
        </span>
        <div className="editor-nav__actions">
          <Button
            size="small"
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={() => setGenerateOpen(true)}
          >
            生成
          </Button>
          <Tooltip title="元素 / 图级属性">
            <Button
              size="small"
              type={rightPanel === 'props' ? 'primary' : 'text'}
              icon={<FormOutlined />}
              onClick={() => toggleRightPanel('props')}
            >
              属性
            </Button>
          </Tooltip>
          <Tooltip title="模型校验">
            <Button
              size="small"
              type={rightPanel === 'validate' ? 'primary' : 'text'}
              icon={<SafetyCertificateOutlined />}
              onClick={() => toggleRightPanel('validate')}
            >
              校验{counts.errors > 0 ? ` ${counts.errors}` : ''}
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="app-body">
        {/* Activity Bar */}
        <div className="activity-bar">
          <Tooltip title="AI 助手" placement="right">
            <button
              type="button"
              aria-label="AI 助手"
              className={`activity-bar__item ${leftPanel === 'ai' ? 'active' : ''}`}
              onClick={() => toggleLeftPanel('ai')}
            >
              <RobotOutlined />
            </button>
          </Tooltip>
          <Tooltip title="项目资源" placement="right">
            <button
              type="button"
              aria-label="项目资源"
              className={`activity-bar__item ${leftPanel === 'explorer' ? 'active' : ''}`}
              onClick={() => toggleLeftPanel('explorer')}
            >
              <ProfileOutlined />
            </button>
          </Tooltip>
          <Tooltip title="搜索（Ctrl+F）" placement="right">
            <button
              type="button"
              aria-label="搜索"
              className={`activity-bar__item ${leftPanel === 'search' ? 'active' : ''}`}
              onClick={() => toggleLeftPanel('search')}
            >
              <SearchOutlined />
            </button>
          </Tooltip>
          <div className="activity-bar__spacer" />
          <Tooltip title="设置" placement="right">
            <button
              type="button"
              aria-label="设置"
              className="activity-bar__item"
              onClick={() => setSettingsOpen(true)}
            >
              <SettingOutlined />
            </button>
          </Tooltip>
        </div>

        {/* Left Side Panel */}
        <div className={`side-panel ${leftPanel === null ? 'side-panel--collapsed' : ''}`}>
          {leftPanel === 'ai' && (
            <>
              <div className="side-panel__header">
                <span className="side-panel__header-icon"><RobotOutlined /></span>
                AI 助手
              </div>
              <div className="side-panel__body">
                <AIPanel />
              </div>
            </>
          )}
          {leftPanel === 'explorer' && (
            <>
              <div className="side-panel__header">
                <span className="side-panel__header-icon"><ProfileOutlined /></span>
                项目资源
              </div>
              <div className="side-panel__body">
                <ProjectExplorer />
              </div>
            </>
          )}
          {leftPanel === 'search' && (
            <>
              <div className="side-panel__header">
                <span className="side-panel__header-icon"><SearchOutlined /></span>
                搜索
              </div>
              <div className="side-panel__body">
                <SearchPanel autoFocus onOpenDiagram={() => setView('editor')} />
              </div>
            </>
          )}
        </div>

        {/* Canvas */}
        <CanvasHost />

        {/* Right Panel */}
        <div className={`right-panel ${rightVisible ? '' : 'right-panel--collapsed'}`}>
          <div className="right-panel__header">
            <span className="right-panel__title">
              {rightPanel === 'validate' ? (
                <>
                  <SafetyCertificateOutlined /> 模型校验
                  {counts.errors > 0 ? `（${counts.errors}）` : ''}
                </>
              ) : (
                <>
                  <FormOutlined />{' '}
                  {selectedNodeIds.length > 1
                    ? `已选 ${selectedNodeIds.length} 项`
                    : selectedActivationId
                      ? '激活条属性'
                      : hasSelection
                        ? '元素属性'
                        : '图级属性'}
                </>
              )}
            </span>
            <button
              className="right-panel__close"
              onClick={() => setRightPanel(null)}
              title="关闭面板"
            >
              <CloseOutlined style={{ fontSize: 12 }} />
            </button>
          </div>
          <div className="right-panel__body">
            {rightPanel === 'validate' ? <ValidationPanel /> : <PropertiesPanel />}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="app-status-bar">
        <span>{MODEL_KIND_LABELS[doc.kind]}：{doc.name}</span>
        <span className="sep">|</span>
        <span>
          {doc.kind === 'physical' ? '表' : doc.kind === 'uml' ? '类' : doc.kind === 'architecture' ? '组件' : '实体'}{' '}
          {doc.nodes.length} ·{' '}
          {doc.kind === 'physical' ? '引用' : doc.kind === 'uml' ? '关联' : doc.kind === 'architecture' ? '依赖' : '关系'}{' '}
          {doc.edges.length}
        </span>
        <span className="sep">|</span>
        <span className={counts.errors > 0 ? 'status-error' : 'status-ok'}>
          校验 {counts.errors}/{counts.warnings}
        </span>
        <div style={{ flex: 1 }} />
        <span title={describeProviderStatus(provider).hint}>
          <CloudOutlined /> {describeProviderStatus(provider).label}
        </span>
        <span className="sep">|</span>
        <span
          className={dirty || !filePath ? 'status-dirty' : 'status-ok'}
          title={filePath ?? '尚未保存到 .amdproj 文件'}
        >
          {dirty ? '未保存' : filePath ? '已保存' : '未保存到文件'}
        </span>
      </div>

      <Modal
        open={generateOpen}
        onCancel={() => setGenerateOpen(false)}
        footer={null}
        width="min(1180px, 92vw)"
        title={<><ThunderboltOutlined /> 基于模型生成代码 / 文档 / 数据</>}
        className="generate-modal"
        styles={{ body: { paddingTop: 8 } }}
      >
        <GeneratePanel />
      </Modal>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  )
}

function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element {
  const rows: { keys: string; desc: string }[] = [
    { keys: 'Ctrl+N', desc: '新建项目' },
    { keys: 'Ctrl+O', desc: '打开项目' },
    { keys: 'Ctrl+S', desc: '保存项目（已有路径则覆盖）' },
    { keys: 'Ctrl+Shift+S', desc: '项目另存为' },
    { keys: 'Ctrl+Z', desc: '撤销' },
    { keys: 'Ctrl+Shift+Z', desc: '重做' },
    { keys: 'Ctrl+F', desc: '搜索节点' },
    { keys: 'Ctrl+T', desc: '切换主题' },
    { keys: 'Ctrl+,', desc: '打开设置' },
    { keys: 'Delete / Backspace', desc: '删除选中元素（输入框内除外）' },
    { keys: 'F2', desc: '重命名选中的矩阵条目' },
    { keys: '双击标签', desc: '矩阵条目进入就地编辑' }
  ]
  return (
    <Modal title="键盘快捷键" open={open} onCancel={onClose} onOk={onClose} okText="关闭" cancelButtonProps={{ style: { display: 'none' } }}>
      <table className="shortcut-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>
          {rows.map((r) => (
            <tr key={r.keys}>
              <td style={{ padding: '6px 8px', fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap', width: 200 }}>{r.keys}</td>
              <td style={{ padding: '6px 8px' }}>{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  )
}
