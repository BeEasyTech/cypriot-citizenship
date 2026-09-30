import { tg } from './telegram'

/** Адрес бэкенда (Railway). Без него напоминания недоступны, остальное приложение работает. */
export const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '')
export const apiEnabled = !!API_URL

const DEVICE_KEY = 'gi_device_id'

/** Анонимный идентификатор устройства для PWA вне Telegram. */
function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

function authHeaders(): Record<string, string> {
  const w = tg()
  if (w?.initData) return { Authorization: `tma ${w.initData}` }
  return { 'X-Device-Id': deviceId() }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { ...authHeaders(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const j = await res.json().catch(() => null)
    const msg = Array.isArray(j?.message) ? j.message.join(', ') : j?.message
    throw new Error(msg || `Ошибка сервера (${res.status})`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export interface Me {
  telegram: boolean
  tgBlocked: boolean
  tgWriteAllowed: boolean | null
  tz: string
  remindEnabled: boolean
  remindTime: string
  eveningNudge: boolean
  lastActiveDate: string | null
  pushDevices: number
}

export const localTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Nicosia'

export const api = {
  me: () => call<Me>('GET', '/api/me'),
  update: (patch: Partial<Pick<Me, 'remindEnabled' | 'remindTime' | 'eveningNudge' | 'tz'>>) => call<Me>('PATCH', '/api/me', patch),
  activity: (date: string) => call<void>('POST', '/api/activity', { date, tz: localTz() }),
  vapid: () => call<{ publicKey: string }>('GET', '/api/push/vapid'),
  subscribe: (s: PushSubscriptionJSON) => call<void>('POST', '/api/push/subscribe', { endpoint: s.endpoint, keys: s.keys }),
  unsubscribe: (endpoint: string) => call<void>('DELETE', '/api/push/subscribe', { endpoint }),
  test: () => call<{ telegram: boolean; push: number }>('POST', '/api/reminders/test'),
}

/* ------------------------------------------------ Web Push */

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

const b64ToUint8 = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function currentPushSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** Запросить разрешение и подписаться на push (вызывать из обработчика нажатия). */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error('Этот браузер не поддерживает уведомления')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Уведомления запрещены в настройках браузера')
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Service worker не активен — перезагрузите страницу')), 8000)),
  ])
  const { publicKey } = await api.vapid()
  const sub = (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(publicKey) }))
  await api.subscribe(sub.toJSON())
}

export async function disablePush(): Promise<void> {
  const sub = await currentPushSubscription()
  if (!sub) return
  await api.unsubscribe(sub.endpoint).catch(() => undefined)
  await sub.unsubscribe()
}
