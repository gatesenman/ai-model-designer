import type { MenuEvent } from './types'

export interface AppMenuItemSpec {
  type?: 'separator'
  label?: string
  accelerator?: string
  role?: string
  event?: MenuEvent
  submenu?: AppMenuItemSpec[]
}

function item(label: string, event: MenuEvent, accelerator?: string): AppMenuItemSpec {
  return accelerator ? { label, event, accelerator } : { label, event }
}

/** 应用原生菜单规格。帮助菜单不使用 role: help，以免平台替换掉自定义项。 */
export function getAppMenuSpecs(): AppMenuItemSpec[] {
  return [
    {
      label: '文件',
      submenu: [
        item('新建项目', 'new-project', 'CmdOrCtrl+N'),
        {
          label: '新建图表',
          submenu: [
            item('概念模型 / 本体语义', 'new-model-conceptual', 'CmdOrCtrl+M'),
            item('逻辑模型', 'new-model-logical'),
            item('物理模型', 'new-model-physical'),
            item('UML 类图', 'new-model-uml'),
            item('架构图', 'new-model-architecture')
          ]
        },
        { type: 'separator' },
        item('打开项目…', 'open-project', 'CmdOrCtrl+O'),
        item('保存项目', 'save-project', 'CmdOrCtrl+S'),
        item('项目另存为…', 'save-project-as', 'CmdOrCtrl+Shift+S'),
        item('关闭项目', 'close-project'),
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        item('撤销', 'undo', 'CmdOrCtrl+Z'),
        item('重做', 'redo', 'CmdOrCtrl+Shift+Z'),
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { type: 'separator' },
        item('查找…', 'find', 'CmdOrCtrl+F')
      ]
    },
    {
      label: '视图',
      submenu: [
        item('切换主题', 'toggle-theme', 'CmdOrCtrl+T'),
        item('设置…', 'settings', 'CmdOrCtrl+,'),
        item('键盘快捷键', 'help-shortcuts', 'F1'),
        { type: 'separator' },
        { role: 'reload', label: '刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '导出',
      submenu: [
        {
          label: '导出当前图表',
          submenu: [
            item('JSON 模型', 'export-json'),
            item('SQL DDL', 'export-sql'),
            item('Markdown 文档', 'export-markdown'),
            { type: 'separator' },
            item('PNG 图片', 'export-png'),
            item('SVG 矢量图', 'export-svg'),
            item('PDF 文档', 'export-pdf')
          ]
        },
        { type: 'separator' },
        item('批量导出当前图表全部产物…', 'export-batch-model'),
        item('批量导出整个项目全部产物…', 'export-batch-project')
      ]
    },
    {
      label: '帮助',
      submenu: [
        item('键盘快捷键', 'help-shortcuts', 'F1'),
        { type: 'separator' },
        item('关于', 'about')
      ]
    }
  ]
}

export function menuSection(specs: AppMenuItemSpec[], title: string): AppMenuItemSpec | undefined {
  return specs.find((s) => s.label === title)
}

export function submenuLabels(section?: AppMenuItemSpec): string[] {
  return (section?.submenu ?? []).map((i) => i.label).filter((x): x is string => !!x)
}

export function helpMenuIsDiscoverable(specs: AppMenuItemSpec[] = getAppMenuSpecs()): boolean {
  const help = menuSection(specs, '帮助')
  if (!help || help.role === 'help') return false
  const labels = submenuLabels(help)
  return labels.includes('键盘快捷键') && labels.includes('关于')
}
