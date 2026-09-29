import { useEffect, useState, useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { HOLE_RE } from './grammar'

export type Lang = 'el' | 'en' | 'ru'
const LOCALE: Record<Lang, string> = { el: 'el-GR', en: 'en-US', ru: 'ru-RU' }

/** Кто говорит: экзаменатор (вопросы) или я (ответы, слова). От этого зависит облачный голос. */
export type Role = 'examiner' | 'me'

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
export const ttsSupported = !!synth

/* ------------------------------------------------ системные голоса */

let voices: SpeechSynthesisVoice[] = []
const listeners = new Set<() => void>()
const refresh = () => {
  voices = synth?.getVoices() ?? []
  listeners.forEach((l) => l())
}
if (synth) {
  refresh()
  synth.addEventListener?.('voiceschanged', refresh)
}

export function useVoices(lang: Lang = 'el') {
  const all = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => voices,
  )
  return all.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(lang))
}

function pickVoice(lang: Lang, preferred?: string) {
  const list = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(lang))
  if (preferred) {
    const p = list.find((v) => v.voiceURI === preferred)
    if (p) return p
  }
  return list.find((v) => /premium|enhanced|natural|neural/i.test(v.name)) ?? list.find((v) => v.localService) ?? list[0]
}

export const clean = (s: string) => s.replace(HOLE_RE, ' … ').replace(/[«»"]/g, '').replace(/\s+/g, ' ').trim()

/* ------------------------------------------------ облачный голос (Azure через /api/tts) */

interface CloudCfg {
  /** Доступен ли сервер с ключом. null — ещё не проверяли. */
  available: boolean | null
  /** Включено ли в настройках. */
  enabled: boolean
  examiner: 'm' | 'f'
  me: 'm' | 'f'
}

export const useCloud = create<CloudCfg>(() => ({ available: null, enabled: true, examiner: 'm', me: 'f' }))

export async function probeCloud() {
  try {
    const r = await fetch('/api/tts?ping=1', { cache: 'no-store' })
    const j = r.ok ? await r.json() : null
    useCloud.setState({ available: !!j?.configured })
  } catch {
    useCloud.setState({ available: false })
  }
}

const cloudUrl = (text: string, voice: 'm' | 'f', rate: number) =>
  `/api/tts?v=${voice}&r=${(Math.round(rate * 20) / 20).toFixed(2)}&t=${encodeURIComponent(clean(text))}`

/** Одно общее аудио: на iOS его достаточно «разблокировать» первым касанием. */
let audio: HTMLAudioElement | undefined
const getAudio = () => (audio ??= new Audio())

if (typeof window !== 'undefined') {
  const unlock = () => {
    const a = getAudio()
    a.muted = true
    a.play().catch(() => undefined).finally(() => { a.pause(); a.muted = false })
    window.removeEventListener('pointerdown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
}

const useCloudFor = (lang: Lang) => {
  const c = useCloud.getState()
  return lang === 'el' && c.enabled && c.available === true && navigator.onLine !== false
}

/* Кеш звука: Cache Storage (переживает перезапуск, работает офлайн) + blob-URL в памяти. */
const CACHE = 'tts-v1'
const blobs = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()

async function loadAudio(url: string): Promise<string> {
  const hit = blobs.get(url)
  if (hit) return hit
  const pending = inflight.get(url)
  if (pending) return pending
  const p = (async () => {
    let res: Response | undefined
    const cache = typeof caches !== 'undefined' ? await caches.open(CACHE).catch(() => undefined) : undefined
    res = await cache?.match(url)
    if (!res) {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 10000)
      try { res = await fetch(url, { signal: ctrl.signal }) } finally { clearTimeout(t) }
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('audio')) throw new Error(`tts ${res.status}`)
      await cache?.put(url, res.clone()).catch(() => undefined)
    }
    const obj = URL.createObjectURL(await res.blob())
    blobs.set(url, obj)
    if (blobs.size > 400) {
      const [k, v] = blobs.entries().next().value as [string, string]
      URL.revokeObjectURL(v)
      blobs.delete(k)
    }
    return obj
  })()
  inflight.set(url, p)
  try { return await p } finally { inflight.delete(url) }
}

/** Прогреть кеш: скачать звук заранее (например, следующую карточку). */
export function prefetch(texts: string[], role: Role = 'me', rate = 0.9) {
  const c = useCloud.getState()
  if (!(c.enabled && c.available)) return
  for (const t of texts) if (clean(t)) loadAudio(cloudUrl(t, c[role], rate)).catch(() => undefined)
}

/* ------------------------------------------------ общий плеер */

let speakingId = 0
const speakingListeners = new Set<() => void>()
let currentKey: string | null = null
const setCurrent = (k: string | null) => { currentKey = k; speakingListeners.forEach((l) => l()) }

export function useSpeakingKey() {
  return useSyncExternalStore(
    (cb) => { speakingListeners.add(cb); return () => speakingListeners.delete(cb) },
    () => currentKey,
  )
}

export interface SpeakOpts {
  lang?: Lang
  rate?: number
  voiceURI?: string
  role?: Role
  /** Ключ для подсветки «что сейчас звучит». */
  key?: string
}

export function stop() {
  speakingId++
  synth?.cancel()
  if (audio) { audio.pause(); audio.onended?.(new Event('ended')) }
  setCurrent(null)
}

function speakBrowser(text: string, o: SpeakOpts, id: number): Promise<void> {
  if (!synth) return Promise.resolve()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(clean(text))
    const lang = o.lang ?? 'el'
    u.lang = LOCALE[lang]
    const v = pickVoice(lang, lang === 'el' ? o.voiceURI : undefined)
    if (v) u.voice = v
    u.rate = o.rate ?? 0.9
    let done = false
    const finish = () => { if (done) return; done = true; if (id === speakingId) setCurrent(null); resolve() }
    u.onend = finish
    u.onerror = finish
    synth.resume()
    synth.speak(u)
    setTimeout(finish, 1500 + clean(text).length * 180 / (o.rate ?? 0.9))
  })
}

async function speakCloud(text: string, o: SpeakOpts, id: number): Promise<boolean> {
  const c = useCloud.getState()
  let src: string
  try { src = await loadAudio(cloudUrl(text, c[o.role ?? 'me'], o.rate ?? 0.9)) } catch { return false }
  if (id !== speakingId) return true // пока грузили, пользователь нажал другое
  const a = getAudio()
  return new Promise((resolve) => {
    let settled = false
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      a.onended = a.onerror = null
      if (ok && id === speakingId) setCurrent(null)
      resolve(ok)
    }
    a.onended = () => done(true)
    a.onerror = () => done(false)
    a.src = src
    a.play().catch(() => done(false))
  })
}

/** Произнести текст; промис завершается по окончании (или при остановке). */
export async function speak(text: string, o: SpeakOpts = {}): Promise<void> {
  if (!clean(text)) return
  const id = ++speakingId
  synth?.cancel()
  audio?.pause()
  setCurrent(o.key ?? text)
  if (useCloudFor(o.lang ?? 'el')) {
    const ok = await speakCloud(text, o, id)
    if (ok || id !== speakingId) return
  }
  await speakBrowser(text, o, id)
}

/** Произнести несколько фраз подряд с паузой. */
export async function speakAll(texts: string[], o: SpeakOpts & { pause?: number; keyPrefix?: string } = {}) {
  const id = speakingId + 1
  for (let i = 0; i < texts.length; i++) {
    await speak(texts[i], { ...o, key: o.keyPrefix ? `${o.keyPrefix}:${i}` : texts[i] })
    if (speakingId !== id + i) return // остановили или начали другое
    await new Promise((r) => setTimeout(r, o.pause ?? 350))
  }
}

/** Есть ли в системе греческий голос. */
export function useHasGreekVoice() {
  const v = useVoices('el')
  const [ready, setReady] = useState(voices.length > 0)
  useEffect(() => {
    if (ready) return
    const t = setTimeout(() => setReady(true), 1500)
    return () => clearTimeout(t)
  }, [ready])
  return { ready: ready || v.length > 0, has: v.length > 0 }
}
