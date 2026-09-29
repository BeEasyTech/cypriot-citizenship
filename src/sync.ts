import { create } from 'zustand'
import { cloudAvailable, cloudLoad, cloudSave } from './lib/telegram'
import { initialState, mergeStates, pickState, useStore, type State } from './store'

interface SyncState {
  status: 'off' | 'idle' | 'saving' | 'error'
  last: number
  error?: string
}

export const useSync = create<SyncState>(() => ({ status: 'off', last: 0 }))

let timer: ReturnType<typeof setTimeout> | undefined
let applying = false

async function push() {
  useSync.setState({ status: 'saving' })
  try {
    await cloudSave(JSON.stringify(pickState(useStore.getState())))
    useSync.setState({ status: 'idle', last: Date.now(), error: undefined })
  } catch (e) {
    useSync.setState({ status: 'error', error: (e as Error).message })
  }
}

export async function syncNow() {
  if (!cloudAvailable()) return
  try {
    const raw = await cloudLoad()
    if (raw) {
      const remote = JSON.parse(raw) as State
      applying = true
      useStore.getState().replaceAll(mergeStates(pickState(useStore.getState()), { ...initialState(), ...remote }))
      applying = false
    }
    await push()
  } catch (e) {
    applying = false
    useSync.setState({ status: 'error', error: (e as Error).message })
  }
}

/** Синхронизация через Telegram CloudStorage: при старте слить, дальше — сохранять с задержкой. */
export async function startSync() {
  if (!cloudAvailable()) return
  useSync.setState({ status: 'idle' })
  await syncNow()
  useStore.subscribe(() => {
    if (applying) return
    clearTimeout(timer)
    timer = setTimeout(push, 2500)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { clearTimeout(timer); push() }
    else syncNow()
  })
}

/* ------------------------------------------------ экспорт / импорт файла */

export function exportJson() {
  const data = JSON.stringify({ app: 'greek-interview', v: 1, at: new Date().toISOString(), state: pickState(useStore.getState()) }, null, 1)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `greek-interview-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function importJson(file: File, mode: 'merge' | 'replace') {
  const txt = await file.text()
  const parsed = JSON.parse(txt)
  const st = (parsed.state ?? parsed) as State
  if (!st || typeof st !== 'object' || !('profile' in st)) throw new Error('Это не файл этого приложения')
  const incoming = { ...initialState(), ...st }
  useStore.getState().replaceAll(mode === 'replace' ? incoming : mergeStates(pickState(useStore.getState()), incoming))
}
