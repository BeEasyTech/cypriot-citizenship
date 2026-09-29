import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initTelegram, loadTelegramSdk } from './lib/telegram'
import { startSync } from './sync'

async function boot() {
  await loadTelegramSdk()
  initTelegram()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  startSync()
}

boot()
