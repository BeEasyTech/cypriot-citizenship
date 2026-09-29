import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Tri, VocabItem } from './types'
import { DEFAULT_PROFILE, type Profile } from './data/profile'
import { review, type CardState, type Rating } from './lib/srs'

export interface Override {
  lines: Tri[]
  updated: number
}

/** Свой вопрос, добавленный пользователем. */
export interface CustomItem {
  id: string
  topicId: string
  title: string
  questions: Tri[]
  answer: Tri[]
  updated: number
}

export interface DayStats {
  reviews: number
  newCount: number
  sims: number
  listen: number
  listenOk: number
  seconds: number
}

export interface ItemStats {
  /** Последние самооценки в симуляции: 1 не смог, 2 с трудом, 3 уверенно. */
  sim: number[]
  listenOk: number
  listenTotal: number
}

export interface Settings {
  interviewDate: string
  newPerDay: number
  rate: number
  voiceURI: string
  autoplay: boolean
  showEn: boolean
  showRu: boolean
  disabledDecks: string[]
  recognition: boolean
  production: boolean
  simCount: number
  simTimer: number
  simShowText: boolean
  onboarded: boolean
  updated: number
}

export interface State {
  profile: Profile
  profileUpdated: number
  overrides: Record<string, Override>
  customItems: CustomItem[]
  customVocab: (VocabItem & { updated: number })[]
  deleted: Record<string, number>
  cards: Record<string, CardState>
  days: Record<string, DayStats>
  itemStats: Record<string, ItemStats>
  settings: Settings
}

interface Actions {
  setProfile: (patch: Profile) => void
  setOverride: (itemId: string, lines: Tri[] | null) => void
  upsertCustomItem: (it: CustomItem) => void
  deleteCustomItem: (id: string) => void
  upsertCustomVocab: (v: VocabItem) => void
  deleteCustomVocab: (id: string) => void
  rate: (cardId: string, r: Rating, isNew: boolean, maxIvl?: number) => void
  logSim: (itemId: string, score: 1 | 2 | 3) => void
  logListen: (itemId: string, ok: boolean) => void
  addSeconds: (s: number) => void
  setSettings: (patch: Partial<Settings>) => void
  toggleDeck: (deckId: string) => void
  resetProgress: () => void
  replaceAll: (s: State) => void
}

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const emptyDay = (): DayStats => ({ reviews: 0, newCount: 0, sims: 0, listen: 0, listenOk: 0, seconds: 0 })

export const DEFAULT_SETTINGS: Settings = {
  interviewDate: '',
  newPerDay: 15,
  rate: 0.9,
  voiceURI: '',
  autoplay: true,
  showEn: false,
  showRu: false,
  disabledDecks: [],
  recognition: true,
  production: true,
  simCount: 10,
  simTimer: 60,
  simShowText: false,
  onboarded: false,
  updated: 0,
}

export const initialState = (): State => ({
  profile: { ...DEFAULT_PROFILE },
  profileUpdated: 0,
  overrides: {},
  customItems: [],
  customVocab: [],
  deleted: {},
  cards: {},
  days: {},
  itemStats: {},
  settings: { ...DEFAULT_SETTINGS },
})

const bumpDay = (days: Record<string, DayStats>, patch: (d: DayStats) => void) => {
  const k = todayKey()
  const d = { ...(days[k] ?? emptyDay()) }
  patch(d)
  return { ...days, [k]: d }
}

export const useStore = create<State & Actions>()(
  persist(
    (set) => ({
      ...initialState(),

      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch }, profileUpdated: Date.now() })),

      setOverride: (itemId, lines) => set((s) => {
        const overrides = { ...s.overrides }
        if (lines) overrides[itemId] = { lines, updated: Date.now() }
        else overrides[itemId] = { lines: [], updated: Date.now() } // пустой = вернуть шаблон
        return { overrides }
      }),

      upsertCustomItem: (it) => set((s) => ({
        customItems: [...s.customItems.filter((x) => x.id !== it.id), { ...it, updated: Date.now() }],
      })),
      deleteCustomItem: (id) => set((s) => ({
        customItems: s.customItems.filter((x) => x.id !== id),
        deleted: { ...s.deleted, [id]: Date.now() },
      })),
      upsertCustomVocab: (v) => set((s) => ({
        customVocab: [...s.customVocab.filter((x) => x.id !== v.id), { ...v, updated: Date.now() }],
      })),
      deleteCustomVocab: (id) => set((s) => ({
        customVocab: s.customVocab.filter((x) => x.id !== id),
        deleted: { ...s.deleted, [id]: Date.now() },
      })),

      rate: (cardId, r, isNew, maxIvl) => set((s) => ({
        cards: { ...s.cards, [cardId]: review(s.cards[cardId], r, Date.now(), maxIvl) },
        days: bumpDay(s.days, (d) => { d.reviews++; if (isNew) d.newCount++ }),
      })),

      logSim: (itemId, score) => set((s) => {
        const st = s.itemStats[itemId] ?? { sim: [], listenOk: 0, listenTotal: 0 }
        return {
          itemStats: { ...s.itemStats, [itemId]: { ...st, sim: [...st.sim, score].slice(-5) } },
          days: bumpDay(s.days, (d) => { d.sims++ }),
        }
      }),
      logListen: (itemId, ok) => set((s) => {
        const st = s.itemStats[itemId] ?? { sim: [], listenOk: 0, listenTotal: 0 }
        return {
          itemStats: { ...s.itemStats, [itemId]: { ...st, listenOk: st.listenOk + (ok ? 1 : 0), listenTotal: st.listenTotal + 1 } },
          days: bumpDay(s.days, (d) => { d.listen++; if (ok) d.listenOk++ }),
        }
      }),
      addSeconds: (sec) => set((s) => ({ days: bumpDay(s.days, (d) => { d.seconds += sec }) })),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch, updated: Date.now() } })),
      toggleDeck: (deckId) => set((s) => {
        const dis = new Set(s.settings.disabledDecks)
        if (dis.has(deckId)) dis.delete(deckId)
        else dis.add(deckId)
        return { settings: { ...s.settings, disabledDecks: [...dis], updated: Date.now() } }
      }),

      resetProgress: () => set(() => ({ cards: {}, days: {}, itemStats: {} })),
      replaceAll: (st) => set(() => ({ ...st })),
    }),
    {
      name: 'greek-interview-v1',
      version: 1,
      partialize: (s) => pickState(s),
    },
  ),
)

export function pickState(s: State): State {
  return {
    profile: s.profile,
    profileUpdated: s.profileUpdated,
    overrides: s.overrides,
    customItems: s.customItems,
    customVocab: s.customVocab,
    deleted: s.deleted,
    cards: s.cards,
    days: s.days,
    itemStats: s.itemStats,
    settings: s.settings,
  }
}

/* ------------------------------------------------ слияние (для синхронизации между устройствами) */

const byUpdated = <T extends { id: string; updated: number }>(a: T[], b: T[], deleted: Record<string, number>) => {
  const m = new Map<string, T>()
  for (const x of [...a, ...b]) {
    const cur = m.get(x.id)
    if (!cur || x.updated > cur.updated) m.set(x.id, x)
  }
  return [...m.values()].filter((x) => !(deleted[x.id] && deleted[x.id] >= x.updated))
}

export function mergeStates(a: State, b: State): State {
  const deleted = { ...a.deleted }
  for (const [k, v] of Object.entries(b.deleted ?? {})) deleted[k] = Math.max(deleted[k] ?? 0, v)

  const cards = { ...a.cards }
  for (const [k, v] of Object.entries(b.cards ?? {})) if (!cards[k] || v.last > cards[k].last) cards[k] = v

  const overrides = { ...a.overrides }
  for (const [k, v] of Object.entries(b.overrides ?? {})) if (!overrides[k] || v.updated > overrides[k].updated) overrides[k] = v

  const days = { ...a.days }
  for (const [k, v] of Object.entries(b.days ?? {})) {
    const c = days[k]
    days[k] = c ? {
      reviews: Math.max(c.reviews, v.reviews), newCount: Math.max(c.newCount, v.newCount), sims: Math.max(c.sims, v.sims),
      listen: Math.max(c.listen, v.listen), listenOk: Math.max(c.listenOk, v.listenOk), seconds: Math.max(c.seconds, v.seconds),
    } : v
  }

  const itemStats = { ...a.itemStats }
  for (const [k, v] of Object.entries(b.itemStats ?? {})) {
    const c = itemStats[k]
    itemStats[k] = !c || v.listenTotal + v.sim.length > c.listenTotal + c.sim.length ? v : c
  }

  const newerProfile = (b.profileUpdated ?? 0) > (a.profileUpdated ?? 0)
  const newerSettings = (b.settings?.updated ?? 0) > (a.settings?.updated ?? 0)

  return {
    profile: newerProfile ? b.profile : a.profile,
    profileUpdated: Math.max(a.profileUpdated ?? 0, b.profileUpdated ?? 0),
    overrides,
    customItems: byUpdated(a.customItems ?? [], b.customItems ?? [], deleted),
    customVocab: byUpdated(a.customVocab ?? [], b.customVocab ?? [], deleted),
    deleted,
    cards,
    days,
    itemStats,
    settings: { ...DEFAULT_SETTINGS, ...(newerSettings ? b.settings : a.settings) },
  }
}
