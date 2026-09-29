/* Минимальная обёртка над Telegram Mini App SDK (telegram-web-app.js). */

interface CloudStorage {
  setItem(key: string, value: string, cb?: (err: string | null, ok?: boolean) => void): void
  getItem(key: string, cb: (err: string | null, value?: string) => void): void
  getItems(keys: string[], cb: (err: string | null, values?: Record<string, string>) => void): void
  removeItems(keys: string[], cb?: (err: string | null, ok?: boolean) => void): void
}

interface BackButton {
  show(): void
  hide(): void
  onClick(cb: () => void): void
  offClick(cb: () => void): void
}

interface HapticFeedback {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
  notificationOccurred(type: 'error' | 'success' | 'warning'): void
  selectionChanged(): void
}

export interface TgWebApp {
  initData: string
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string>
  ready(): void
  expand(): void
  isVersionAtLeast(v: string): boolean
  disableVerticalSwipes?: () => void
  setHeaderColor?: (c: string) => void
  setBackgroundColor?: (c: string) => void
  openLink(url: string): void
  onEvent(ev: string, cb: () => void): void
  BackButton: BackButton
  HapticFeedback: HapticFeedback
  CloudStorage: CloudStorage
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp }
  }
}

/** Запущены ли мы внутри Telegram (по параметрам запуска в hash). */
export const launchedInTelegram = () =>
  /tgWebApp(Data|Version|Platform)=/.test(window.location.hash) || !!sessionStorage.getItem('__telegram__initParams')

export function loadTelegramSdk(): Promise<void> {
  if (!launchedInTelegram()) return Promise.resolve()
  return new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://telegram.org/js/telegram-web-app.js'
    s.onload = () => resolve()
    s.onerror = () => resolve()
    document.head.appendChild(s)
    setTimeout(resolve, 4000)
  })
}

export const tg = (): TgWebApp | undefined => {
  const w = window.Telegram?.WebApp
  return w && w.initData !== undefined && w.platform !== 'unknown' ? w : undefined
}

export function initTelegram() {
  const w = tg()
  if (!w) return
  document.documentElement.dataset.tg = '1'
  w.ready()
  w.expand()
  if (w.isVersionAtLeast('7.7')) w.disableVerticalSwipes?.()
  applyTheme()
  w.onEvent('themeChanged', applyTheme)
}

function applyTheme() {
  const w = tg()
  if (!w) return
  const p = w.themeParams
  const root = document.documentElement
  root.dataset.theme = w.colorScheme
  const map: Record<string, string> = {
    bg_color: '--tg-bg',
    secondary_bg_color: '--tg-bg2',
    section_bg_color: '--tg-card',
    text_color: '--tg-text',
    hint_color: '--tg-hint',
    button_color: '--tg-accent',
    button_text_color: '--tg-accent-text',
    link_color: '--tg-link',
    destructive_text_color: '--tg-bad',
  }
  for (const [k, v] of Object.entries(map)) if (p[k]) root.style.setProperty(v, p[k])
  if (p.secondary_bg_color) {
    w.setHeaderColor?.(p.secondary_bg_color)
    w.setBackgroundColor?.(p.secondary_bg_color)
  }
}

export const haptic = {
  tap: () => tg()?.HapticFeedback.impactOccurred('light'),
  ok: () => tg()?.HapticFeedback.notificationOccurred('success'),
  bad: () => tg()?.HapticFeedback.notificationOccurred('error'),
  select: () => tg()?.HapticFeedback.selectionChanged(),
}

/* ------------------------------------------------ CloudStorage (до 1024 ключей по 4096 символов) */

const CHUNK = 4000
const META = 'gi_meta'

const cs = () => {
  const w = tg()
  return w && w.isVersionAtLeast('6.9') ? w.CloudStorage : undefined
}

const call = <T,>(fn: (cb: (err: string | null, v?: T) => void) => void) =>
  new Promise<T | undefined>((resolve, reject) => fn((err, v) => (err ? reject(new Error(err)) : resolve(v))))

export const cloudAvailable = () => !!cs()

export async function cloudLoad(): Promise<string | null> {
  const c = cs()
  if (!c) return null
  const meta = await call<string>((cb) => c.getItem(META, cb))
  if (!meta) return null
  const { n } = JSON.parse(meta) as { n: number }
  const keys = Array.from({ length: n }, (_, i) => `gi_${i}`)
  const parts: string[] = []
  for (let i = 0; i < keys.length; i += 50) {
    const vals = await call<Record<string, string>>((cb) => c.getItems(keys.slice(i, i + 50), cb))
    for (const k of keys.slice(i, i + 50)) parts.push(vals?.[k] ?? '')
  }
  return parts.join('')
}

export async function cloudSave(json: string): Promise<void> {
  const c = cs()
  if (!c) return
  const n = Math.ceil(json.length / CHUNK)
  if (n > 1000) throw new Error('Слишком много данных для облака Telegram')
  const prevMeta = await call<string>((cb) => c.getItem(META, cb)).catch(() => undefined)
  const prevN = prevMeta ? (JSON.parse(prevMeta).n as number) : 0
  await Promise.all(Array.from({ length: n }, (_, i) => call<boolean>((cb) => c.setItem(`gi_${i}`, json.slice(i * CHUNK, (i + 1) * CHUNK), cb))))
  await call<boolean>((cb) => c.setItem(META, JSON.stringify({ n, t: Date.now() }), cb))
  if (prevN > n) {
    const stale = Array.from({ length: prevN - n }, (_, i) => `gi_${n + i}`)
    await call<boolean>((cb) => c.removeItems(stale, cb)).catch(() => undefined)
  }
}
