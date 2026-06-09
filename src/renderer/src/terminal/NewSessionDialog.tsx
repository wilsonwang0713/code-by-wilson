import { useState, useEffect } from 'react'
import type { ModelId } from '@shared/types'
import { MODEL_IDS } from '@shared/models'
import { MODEL_LABEL } from '../ui/meta'

/** The create-a-Managed-session form: choose a directory (native picker) and a model, then spawn. */
export function NewSessionDialog({
  onCreate,
  onCancel,
}: {
  onCreate: (cwd: string, model: ModelId) => void | Promise<void>
  onCancel: () => void
}) {
  const [cwd, setCwd] = useState<string | null>(null)
  const [model, setModel] = useState<ModelId>('claude-sonnet-4-6')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  async function pick() {
    const dir = await window.api.terminal.pickDirectory()
    if (dir) setCwd(dir)
  }

  async function create() {
    if (!cwd || busy) return
    setBusy(true)
    setError(null)
    try {
      await onCreate(cwd, model)
    } catch (e) {
      setBusy(false)
      setError(e instanceof Error ? e.message : 'Failed to start the session')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={busy ? undefined : onCancel}>
      <div
        className="w-[28rem] rounded-xl border border-ink-800 bg-ink-925 p-5 text-fg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-medium">New Managed session</div>
        <p className="mt-1 text-[12px] text-fg-faint">
          Spawns <span className="font-mono">claude</span> in the chosen directory and drives it from a live terminal.
        </p>

        <label className="mt-4 block text-[11px] uppercase tracking-wider text-fg-muted">Directory</label>
        <div className="mt-1 flex items-center gap-2">
          <button
            onClick={() => void pick()}
            className="rounded-md border border-ink-700 bg-ink-800 px-2.5 py-1 text-[12px] hover:bg-ink-700"
          >
            Choose…
          </button>
          <span className="truncate font-mono text-[12px] text-fg-faint">{cwd ?? 'No directory chosen'}</span>
        </div>

        <label className="mt-4 block text-[11px] uppercase tracking-wider text-fg-muted">Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as ModelId)}
          className="mt-1 w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-[13px]"
        >
          {MODEL_IDS.map((id) => (
            <option key={id} value={id}>
              {MODEL_LABEL[id]}
            </option>
          ))}
        </select>

        {error && <p className="mt-3 text-[12px] text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md px-3 py-1.5 text-[13px] text-fg-muted hover:text-fg">
            Cancel
          </button>
          <button
            onClick={create}
            disabled={!cwd || busy}
            className="rounded-md bg-primary/20 px-3 py-1.5 text-[13px] text-primary-bright ring-1 ring-primary/30 enabled:hover:bg-primary/30 disabled:opacity-40"
          >
            {busy ? 'Starting…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
