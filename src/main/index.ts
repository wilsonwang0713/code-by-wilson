import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { openDb } from './db'
import { createClaudeProvider } from './provider/claude'
import { registerIpc } from './ipc'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    backgroundColor: '#141413',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  const db = openDb(join(app.getPath('userData'), 'index.db'))
  const provider = createClaudeProvider()
  const { sync } = registerIpc({ db, provider })

  await sync() // parse ~/.claude → SQLite once, before the window asks for rows

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
