// Renders build/icon.svg to a 1024x1024 transparent PNG using the already-installed
// Electron/Chromium. No external image tooling required. electron-builder converts the
// PNG to platform icons at build time. Run: pnpm run icon
import { app, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'build', 'icon.svg'), 'utf8')
const html =
  '<!doctype html><meta charset="utf-8">' +
  '<style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>' +
  svg

app.disableHardwareAcceleration()

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    useContentSize: true,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: false },
  })

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 500))

  let image = await win.webContents.capturePage()
  if (image.getSize().width !== 1024) {
    image = image.resize({ width: 1024, height: 1024, quality: 'best' })
  }
  writeFileSync(join(root, 'build', 'icon.png'), image.toPNG())
  console.log('wrote build/icon.png')
  app.quit()
})
