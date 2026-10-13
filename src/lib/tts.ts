import { useEffect, useState, useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { api, apiEnabled } from './api'
import { audioKeySource, cleanForSpeech, KEY_LENGTH, type AudioManifest, type VoiceLetter } from './audio-key'

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

export const clean = cleanForSpeech

/* ------------------------------------------------ облачные голоса ElevenLabs
 * 1) готовые файлы /audio/<ключ>.mp3 (слова, фразы, вопросы — сгенерированы заранее);
 * 2) наш сервер POST /api/tts (личные ответы; ключ ElevenLabs только на сервере);
 * 3) иначе — голос браузера.
 */

interface CloudCfg {
  /** Есть ли хоть какой-то облачный звук (готовые файлы или сервер). null — ещё не проверяли. */
  available: boolean | null
  /** Готовые файлы из манифеста. */
  staticKeys: Set<string>
  /** Сервер умеет озвучивать на лету. */
  server: boolean
  /** Включено ли в настройках. */
  enabled: boolean
  examiner: VoiceLetter
  me: VoiceLetter
}

export const useCloud = create<CloudCfg>(() => ({
  available: null, staticKeys: new Set(), server: false, enabled: true, examiner: 'm', me: 'f',
}))

export async function probeCloud() {
  const [manifest, server] = await Promise.all([
    fetch('/audio/manifest.json', { cache: 'no-cache' }).then((r) => (r.ok ? (r.json() as Promise<AudioManifest>) : null)).catch(() => null),
    apiEnabled ? api.ttsStatus().then((s) => s.configured).catch(() => false) : Promise.resolve(false),
  ])
  const staticKeys = new Set(manifest?.keys ?? [])
  useCloud.setState({ staticKeys, server, available: staticKeys.size > 0 || server })
}

async function keyOf(voice: VoiceLetter, text: string) {
  const bytes = new TextEncoder().encode(audioKeySource(voice, text))
  const hash = await crypto.subtle.digest('SHA-1', bytes)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, KEY_LENGTH)
}

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
  return lang === 'el' && c.enabled && c.available === true
}

/* Кеш звука: Cache Storage (переживает перезапуск, работает офлайн) + blob-URL в памяти. */
const CACHE = 'tts-v2'
const blobs = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()

/** Получить blob-URL звука: из памяти → Cache Storage → готовый файл или сервер. */
async function loadAudio(voice: VoiceLetter, text: string): Promise<string> {
  const key = await keyOf(voice, text)
  const hit = blobs.get(key)
  if (hit) return hit
  const pending = inflight.get(key)
  if (pending) return pending
  const p = (async () => {
    const { staticKeys, server } = useCloud.getState()
    const isStatic = staticKeys.has(key)
    // Для личных фраз в кеш кладём под служебным адресом — сам текст в URL не попадает.
    const cacheUrl = isStatic ? `/audio/${key}.mp3` : `/__tts/${key}.mp3`
    const cache = typeof caches !== 'undefined' ? await caches.open(CACHE).catch(() => undefined) : undefined
    let res = await cache?.match(cacheUrl)
    if (!res) {
      if (isStatic) {
        res = await fetch(cacheUrl)
        if (!res.ok) throw new Error(`audio ${res.status}`)
      } else if (server && navigator.onLine !== false) {
        res = new Response(await api.tts(cleanForSpeech(text), voice), { headers: { 'content-type': 'audio/mpeg' } })
      } else {
        throw new Error('нет облачного звука для этой фразы')
      }
      await cache?.put(cacheUrl, res.clone()).catch(() => undefined)
    }
    const obj = URL.createObjectURL(await res.blob())
    blobs.set(key, obj)
    if (blobs.size > 400) {
      const [k, v] = blobs.entries().next().value as [string, string]
      URL.revokeObjectURL(v)
      blobs.delete(k)
    }
    return obj
  })()
  inflight.set(key, p)
  try { return await p } finally { inflight.delete(key) }
}

/** Прогреть кеш: скачать звук заранее (например, следующую карточку). */
export function prefetch(texts: string[], role: Role = 'me') {
  const c = useCloud.getState()
  if (!(c.enabled && c.available)) return
  for (const t of texts) if (cleanForSpeech(t)) loadAudio(c[role], t).catch(() => undefined)
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
  try { src = await loadAudio(c[o.role ?? 'me'], text) } catch { return false }
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
    // Звук сгенерирован с обычной скоростью — темп пользователя задаём при воспроизведении.
    a.preservesPitch = true
    a.playbackRate = Math.min(1.5, Math.max(0.5, o.rate ?? 0.9))
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
