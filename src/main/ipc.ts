import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import type { Provider } from './provider/types'
import { getSessions, replaceSessions, type AppDb } from './db'

export interface IpcDeps {
  db: AppDb
  provider: Provider
}

export function registerIpc({ db, provider }: IpcDeps): { sync: () => Promise<void> } {
  const sync = async (): Promise<void> => {
    const sessions = await provider.listSessions()
    replaceSessions(db, sessions)
  }

  ipcMain.handle(IPC.listSessions, () => getSessions(db))
  ipcMain.handle(IPC.refresh, async () => {
    await sync()
    return getSessions(db)
  })
  ipcMain.handle(IPC.capabilities, () => provider.capabilities)

  return { sync }
}
