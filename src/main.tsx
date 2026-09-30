import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initTelegram, loadTelegramSdk } from './lib/telegram'
import { startSync } from './sync'
import { probeCloud, useCloud } from './lib/tts'
import { useStore, todayKey } from './store'
import { api, apiEnabled } from './lib/api'

async function boot() {
  await loadTelegramSdk()
  initTelegram()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  startSync()
  probeCloud()
  const applyCloud = () => {
    const { settings, profile } = useStore.getState()
    useCloud.setState({
      enabled: settings.cloudTts,
      examiner: settings.examinerVoice,
      me: settings.myVoice === 'auto' ? (profile.gender === 'f' ? 'f' : 'm') : settings.myVoice,
    })
  }
  applyCloud()
  useStore.subscribe(applyCloud)

  // Сообщаем серверу только факт «сегодня занимался(ась)» — чтобы не присылать лишних напоминаний.
  if (apiEnabled) {
    const KEY = 'gi_active_ping'
    const ping = () => {
      const today = todayKey()
      const d = useStore.getState().days[today]
      if (!d || d.reviews + d.sims + d.listen === 0) return
      let last: string | null = null
      try { last = localStorage.getItem(KEY) } catch { /* нет доступа */ }
      if (last === today) return
      api.activity(today).then(() => { try { localStorage.setItem(KEY, today) } catch { /* нет доступа */ } }).catch(() => undefined)
    }
    ping()
    useStore.subscribe(ping)
  }
}

boot()
