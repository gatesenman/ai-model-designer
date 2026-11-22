import { describe, expect, it } from 'vitest'
import {
  NATIVE_CANCEL,
  NATIVE_CLOSE_BUTTONS,
  NATIVE_DISCARD,
  NATIVE_SAVE,
  RENDERER_CLOSE_TIMEOUT_MS,
  nativeCloseChoice,
  nativeUnsavedDialogOptions,
  needsUnsavedPrompt,
  shouldUseNativeUnsavedDialog
} from '@shared/appClosePolicy'
import {
  getAppMenuSpecs,
  helpMenuIsDiscoverable,
  menuSection,
  submenuLabels
} from '@shared/appMenu'
import { normalizeProjectSession } from '@shared/projectSession'

describe('关闭保护策略', () => {
  it('dirty 为 true 时必须提示，已保存且 dirty 为 false 时不提示', () => {
    expect(
      needsUnsavedPrompt({ dirty: true, fileSaved: false, filePath: '/a.amdproj', hasProject: true })
    ).toBe(true)
    expect(
      needsUnsavedPrompt({ dirty: false, fileSaved: true, filePath: '/a.amdproj', hasProject: true })
    ).toBe(false)
    expect(
      needsUnsavedPrompt({ dirty: false, fileSaved: false, filePath: null, hasProject: true })
    ).toBe(false)
  })

  it('renderer 未同步 dirty 时，有未写入文件的项目也要提示，避免静默丢草稿', () => {
    expect(
      needsUnsavedPrompt({
        dirty: false,
        dirtyKnown: false,
        fileSaved: false,
        filePath: null,
        hasProject: true
      })
    ).toBe(true)
    expect(
      needsUnsavedPrompt({
        dirty: false,
        dirtyKnown: false,
        fileSaved: true,
        filePath: '/a.amdproj',
        hasProject: true
      })
    ).toBe(false)
  })

  it('renderer 未就绪、崩溃、销毁或超时未应答时改走原生确认', () => {
    const base = {
      rendererReady: true,
      rendererCrashed: false,
      rendererDestroyed: false,
      ackReceived: false,
      timedOut: false
    }
    expect(shouldUseNativeUnsavedDialog(base)).toBe(false)
    expect(shouldUseNativeUnsavedDialog({ ...base, rendererReady: false })).toBe(true)
    expect(shouldUseNativeUnsavedDialog({ ...base, rendererCrashed: true })).toBe(true)
    expect(shouldUseNativeUnsavedDialog({ ...base, rendererDestroyed: true })).toBe(true)
    expect(shouldUseNativeUnsavedDialog({ ...base, timedOut: true, ackReceived: false })).toBe(true)
    expect(shouldUseNativeUnsavedDialog({ ...base, timedOut: true, ackReceived: true })).toBe(false)
  })

  it('原生按钮顺序为 保存 / 不保存 / 取消，取消不应被当成丢弃', () => {
    expect([...NATIVE_CLOSE_BUTTONS]).toEqual(['保存', '不保存', '取消'])
    expect(nativeCloseChoice(NATIVE_SAVE)).toBe('save')
    expect(nativeCloseChoice(NATIVE_DISCARD)).toBe('discard')
    expect(nativeCloseChoice(NATIVE_CANCEL)).toBe('cancel')
    expect(nativeCloseChoice(99)).toBe('cancel')
    const opts = nativeUnsavedDialogOptions('/tmp/qa-pointer-raci.amdproj')
    expect(opts.buttons).toEqual(['保存', '不保存', '取消'])
    expect(opts.cancelId).toBe(NATIVE_CANCEL)
    expect(opts.detail).toContain('qa-pointer-raci.amdproj')
    expect(opts.detail).toContain('不能代替保存')
    expect(RENDERER_CLOSE_TIMEOUT_MS).toBeGreaterThanOrEqual(2000)
  })

  it('会话归一化保留 dirty 标记', () => {
    const n = normalizeProjectSession({
      project: { name: 'A', models: [] },
      filePath: '/a.amdproj',
      fileSaved: false,
      dirty: true
    })
    expect(n.dirty).toBe(true)
    expect(n.fileSaved).toBe(false)
  })
})

describe('原生菜单可发现性', () => {
  const specs = getAppMenuSpecs()

  it('帮助菜单含「键盘快捷键」和「关于」，且不使用 role:help 以免被平台替换', () => {
    expect(helpMenuIsDiscoverable(specs)).toBe(true)
    const help = menuSection(specs, '帮助')
    expect(help?.role).toBeUndefined()
    expect(submenuLabels(help)).toEqual(['键盘快捷键', '关于'])
    const shortcut = help?.submenu?.find((i) => i.label === '键盘快捷键')
    expect(shortcut?.event).toBe('help-shortcuts')
    expect(shortcut?.accelerator).toBe('F1')
  })

  it('视图菜单同样提供快捷键清单，文件菜单含关闭项目', () => {
    const view = menuSection(specs, '视图')
    expect(submenuLabels(view)).toContain('键盘快捷键')
    const file = menuSection(specs, '文件')
    expect(submenuLabels(file)).toContain('关闭项目')
    expect(submenuLabels(file)).toContain('退出')
  })
})
