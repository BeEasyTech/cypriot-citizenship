import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initTelegram, loadTelegramSdk } from './lib/telegram'
import { startSync } from './sync'
import { probeCloud, useCloud } from './lib/tts'
import { useStore } from './store'

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
}

boot()
