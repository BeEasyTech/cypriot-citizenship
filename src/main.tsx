import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { inject } from '@vercel/analytics'
import * as Sentry from '@sentry/react'
import App from './App'
import { initTelegram, loadTelegramSdk } from './lib/telegram'
import { startSync } from './sync'
import { probeCloud, useCloud } from './lib/tts'
import { useStore, todayKey } from './store'
import { api, apiEnabled } from './lib/api'

// Анонимная статистика посещений (работает только на Vercel).
inject()

// Ошибки фронтенда — в Sentry, если задан DSN. Без содержимого анкеты.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    environment: import.meta.env.MODE,
    beforeBreadcrumb: (b) => (b.category === 'ui.input' ? null : b),
  })
}

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

  // Серверу уходят только числа за день и дата собеседования — для напоминаний и итогов недели.
  // Анкета и ответы на сервер не отправляются.
  if (apiEnabled) {
    let lastSent = ''
    let timer: ReturnType<typeof setTimeout> | undefined
    const payload = () => {
      const { days, settings } = useStore.getState()
      const today = todayKey()
      const d = days[today]
      return {
        date: today,
        cards: d?.reviews ?? 0,
        sims: d?.sims ?? 0,
        listen: d?.listen ?? 0,
        minutes: Math.round((d?.seconds ?? 0) / 60),
        interviewDate: settings.interviewDate || '',
      }
    }
    const send = () => {
      const p = payload()
      const key = JSON.stringify(p)
      if (key === lastSent) return
      lastSent = key // сразу, чтобы не отправить то же самое дважды
      api.activity(p).catch(() => { if (lastSent === key) lastSent = '' })
    }
    const schedule = () => { clearTimeout(timer); timer = setTimeout(send, 15_000) }
    send()
    useStore.subscribe(schedule)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { clearTimeout(timer); send() } })
  }
}

boot()
