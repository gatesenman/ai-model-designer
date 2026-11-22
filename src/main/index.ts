import { app, shell, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { attachAppQuitGuard, attachWindowCloseGuard } from './closeGuard'
import { IPC, type MenuEvent } from '../shared/types'
import { getAppMenuSpecs, type AppMenuItemSpec } from '../shared/appMenu'

function toElectronMenu(specs: AppMenuItemSpec[], send: (event: MenuEvent) => void): MenuItemConstructorOptions[] {
  return specs.map((spec) => {
    if (spec.type === 'separator') return { type: 'separator' }
    const item: MenuItemConstructorOptions = {}
    if (spec.label) item.label = spec.label
    if (spec.accelerator) item.accelerator = spec.accelerator
    if (spec.role) item.role = spec.role as MenuItemConstructorOptions['role']
    if (spec.event) item.click = () => send(spec.event!)
    if (spec.submenu) item.submenu = toElectronMenu(spec.submenu, send)
    return item
  })
}

function buildMenu(win: BrowserWindow): void {
  const send = (event: MenuEvent): void => win.webContents.send(IPC.MENU_EVENT, event)
  Menu.setApplicationMenu(Menu.buildFromTemplate(toElectronMenu(getAppMenuSpecs(), send)))
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: 'AI Model Designer',
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())
  attachWindowCloseGuard(mainWindow)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  buildMenu(mainWindow)

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  attachAppQuitGuard()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
