import { useEffect, useState, useSyncExternalStore } from 'react'
import { HOLE_RE } from './grammar'

export type Lang = 'el' | 'en' | 'ru'
const LOCALE: Record<Lang, string> = { el: 'el-GR', en: 'en-US', ru: 'ru-RU' }

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
export const ttsSupported = !!synth

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

/** Лучший голос: выбранный пользователем → «улучшенный/premium» → любой нужного языка. */
function pickVoice(lang: Lang, preferred?: string) {
  const list = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(lang))
  if (preferred) {
    const p = list.find((v) => v.voiceURI === preferred)
    if (p) return p
  }
  return list.find((v) => /premium|enhanced|natural|neural/i.test(v.name)) ?? list.find((v) => v.localService) ?? list[0]
}

export const clean = (s: string) => s.replace(HOLE_RE, ' … ').replace(/[«»"]/g, '')

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
  /** Ключ для подсветки «что сейчас звучит». */
  key?: string
}

export function stop() {
  speakingId++
  synth?.cancel()
  setCurrent(null)
}

/** Произнести текст; промис завершается по окончании (или при остановке). */
export function speak(text: string, o: SpeakOpts = {}): Promise<void> {
  if (!synth) return Promise.resolve()
  const id = ++speakingId
  synth.cancel()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(clean(text))
    const lang = o.lang ?? 'el'
    u.lang = LOCALE[lang]
    const v = pickVoice(lang, lang === 'el' ? o.voiceURI : undefined)
    if (v) u.voice = v
    u.rate = o.rate ?? 0.9
    let done = false
    const finish = () => {
      if (done) return
      done = true
      if (id === speakingId) setCurrent(null)
      resolve()
    }
    u.onend = finish
    u.onerror = finish
    setCurrent(o.key ?? text)
    // Chrome иногда «зависает» без cancel+resume
    synth.resume()
    synth.speak(u)
    // страховка: если onend так и не пришёл
    setTimeout(finish, 1500 + clean(text).length * 180 / (o.rate ?? 0.9))
  })
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
