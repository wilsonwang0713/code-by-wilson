import { useEffect, useState } from 'react'
import type { Session, ProviderCapabilities } from '@shared/types'
import { Overview } from './Overview'
import { Workspace } from './workspace/Workspace'

export function App() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [caps, setCaps] = useState<ProviderCapabilities | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Session | null>(null)

  async function load(): Promise<void> {
    setLoading(true)
    try {
      const [s, c] = await Promise.all([window.api.listSessions(), window.api.capabilities()])
      setSessions(s)
      setCaps(c)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function refresh(): Promise<void> {
    setLoading(true)
    try {
      setSessions(await window.api.refresh())
    } finally {
      setLoading(false)
    }
  }

  if (selected) {
    return <Workspace session={selected} onBack={() => setSelected(null)} />
  }

  return (
    <Overview
      sessions={sessions}
      caps={caps}
      loading={loading}
      onRefresh={() => void refresh()}
      onOpen={setSelected}
    />
  )
}
