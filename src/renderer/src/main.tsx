import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div style={{ padding: 24, color: 'var(--color-fg)' }}>code-by-wire — shell up</div>
  </React.StrictMode>,
)
