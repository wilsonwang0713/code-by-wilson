import { contextBridge } from 'electron'

// The real window.api bridge is wired in a later task. This keeps the
// preload bundle present so the window has a preload to load.
contextBridge.exposeInMainWorld('api', {})
