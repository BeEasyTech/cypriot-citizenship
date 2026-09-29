import { useMemo } from 'react'
import type { Tri, VocabDeck, VocabItem } from './types'
import { TOPICS, type QItem, type Topic } from './data/topics'
import { VOCAB_DECKS } from './data/vocab'
import { makeCtx, type Ctx } from './lib/ctx'
import { DAY, type CardState } from './lib/srs'
import { useStore, todayKey, type CustomItem, type State } from './store'
import { parseDate } from './lib/grammar'

/* ------------------------------------------------ контекст и темы */

export function useCtx(): Ctx {
  const profile = useStore((s) => s.profile)
  return useMemo(() => makeCtx(profile), [profile])
}

const customToItem = (c: CustomItem): QItem => ({
  id: c.id,
  title: c.title || c.questions[0]?.ru || c.questions[0]?.gr || 'Свой вопрос',
  questions: () => c.questions,
  answer: () => c.answer,
})

export const isCustomId = (id: string) => id.startsWith('c-')

export function buildTopics(customItems: CustomItem[]): Topic[] {
  return TOPICS.map((t) => ({
    ...t,
    items: [...t.items, ...customItems.filter((c) => c.topicId === t.id).map(customToItem)],
  }))
}

export function useTopics() {
  const custom = useStore((s) => s.customItems)
  return useMemo(() => buildTopics(custom), [custom])
}

export function useItemIndex() {
  const topics = useTopics()
  return useMemo(() => {
    const items: Record<string, QItem> = {}
    const topicOf: Record<string, Topic> = {}
    for (const t of topics) for (const i of t.items) { items[i.id] = i; topicOf[i.id] = t }
    return { items, topicOf, all: topics.flatMap((t) => t.items) }
  }, [topics])
}

export const isActive = (item: QItem, ctx: Ctx) => !item.when || item.when(ctx)

/** Ответ с учётом ручной правки. */
export function answerOf(item: QItem, ctx: Ctx, overrides: State['overrides']): Tri[] {
  const o = overrides[item.id]
  if (o && o.lines.length) return o.lines
  return item.answer(ctx)
}

export const isOverridden = (id: string, overrides: State['overrides']) => !!overrides[id]?.lines.length

/* ------------------------------------------------ колоды слов */

export const CUSTOM_DECK_ID = 'mine'

export function useDecks(): VocabDeck[] {
  const custom = useStore((s) => s.customVocab)
  return useMemo(() => {
    const decks = [...VOCAB_DECKS]
    decks.push({ id: CUSTOM_DECK_ID, titleRu: 'Мои слова и фразы', emoji: '⭐', kind: 'phrases', items: custom })
    return decks
  }, [custom])
}

/** Греческий текст слова с учётом рода говорящего. */
export const vocabGr = (v: VocabItem, ctx: Ctx) => (ctx.gender === 'f' && v.grF ? v.grF : v.gr)

/* ------------------------------------------------ карточки */

export type CardRef =
  | { id: string; kind: 'qa'; item: QItem; topic: Topic }
  | { id: string; kind: 'vr' | 'vp'; v: VocabItem; deck: VocabDeck }

export const qaCardId = (itemId: string) => `qa:${itemId}`
export const vocabCardId = (vId: string, dir: 'r' | 'p') => `v:${vId}:${dir}`

export interface Pools {
  qa: CardRef[]
  rescue: CardRef[]
  words: CardRef[]
}

export function allCards(topics: Topic[], decks: VocabDeck[], ctx: Ctx, s: State): Pools {
  const dis = new Set(s.settings.disabledDecks)
  const qa: CardRef[] = []
  for (const t of topics) {
    if (dis.has(t.id)) continue
    for (const item of t.items) if (isActive(item, ctx)) qa.push({ id: qaCardId(item.id), kind: 'qa', item, topic: t })
  }
  const rescue: CardRef[] = [], words: CardRef[] = []
  for (const d of decks) {
    if (dis.has(d.id)) continue
    for (const v of d.items) {
      const target = d.id === 'rescue' ? rescue : words
      // Для фраз сначала учим «сказать по-гречески», для слов — «узнать».
      const dirs: ('r' | 'p')[] = []
      if (s.settings.recognition) dirs.push('r')
      if (s.settings.production) dirs.push('p')
      if (d.kind === 'phrases') dirs.reverse()
      for (const dir of dirs) target.push({ id: vocabCardId(v.id, dir), kind: dir === 'r' ? 'vr' : 'vp', v, deck: d })
    }
  }
  return { qa, rescue, words }
}

/** Максимальный интервал: чтобы всё успело повториться до собеседования. */
export function maxIvlFor(s: State): number {
  const d = parseDate(s.settings.interviewDate)
  if (!d) return 365
  const days = Math.ceil((d.getTime() - Date.now()) / DAY)
  if (days <= 0) return 365
  return Math.max(2, Math.floor(days * 0.5))
}

export function daysLeft(s: State): number | null {
  const d = parseDate(s.settings.interviewDate)
  if (!d) return null
  return Math.ceil((d.getTime() - new Date().setHours(0, 0, 0, 0)) / DAY)
}

const isDue = (c: CardState | undefined, now: number) => !!c && c.reps > 0 && c.due <= now

export interface SessionFilter {
  deckId?: string
  topicId?: string
  /** Только вопросы-ответы. */
  qaOnly?: boolean
}

/** Собрать очередь карточек на занятие: сначала просроченные, потом новые (с лимитом в день). */
export function buildQueue(pools: Pools, s: State, f: SessionFilter = {}): { queue: CardRef[]; due: number; fresh: number } {
  const now = Date.now()
  const match = (c: CardRef) => {
    if (f.qaOnly && c.kind !== 'qa') return false
    if (f.deckId) return c.kind !== 'qa' && c.deck.id === f.deckId
    if (f.topicId) return c.kind === 'qa' && c.topic.id === f.topicId
    return true
  }
  const all = [...pools.qa, ...pools.rescue, ...pools.words].filter(match)
  const due = all.filter((c) => isDue(s.cards[c.id], now)).sort((a, b) => s.cards[a.id].due - s.cards[b.id].due)

  const focused = !!(f.deckId || f.topicId)
  const doneToday = s.days[todayKey()]?.newCount ?? 0
  const limit = focused ? 20 : Math.max(0, s.settings.newPerDay - doneToday)
  const isNew = (c: CardRef) => !s.cards[c.id] || s.cards[c.id].reps === 0

  // Порядок новых: ответ на вопрос, фраза-спасатель, 2 слова — и по кругу.
  const nq = pools.qa.filter(match).filter(isNew)
  const nr = pools.rescue.filter(match).filter(isNew)
  const nw = pools.words.filter(match).filter(isNew)
  const fresh: CardRef[] = []
  const pattern: CardRef[][] = [nq, nr, nw, nw]
  let i = 0
  while (fresh.length < limit && (nq.length || nr.length || nw.length)) {
    const src = pattern[i++ % pattern.length]
    const c = src.shift()
    if (c) fresh.push(c)
  }

  // Новые перемешиваем с повторениями (каждая 3-я — новая), чтобы не было «стены».
  const queue: CardRef[] = []
  const d = [...due], n = [...fresh]
  while (d.length || n.length) {
    if (d.length) queue.push(d.shift()!)
    if (d.length) queue.push(d.shift()!)
    if (n.length) queue.push(n.shift()!)
  }
  return { queue, due: due.length, fresh: fresh.length }
}

/** Прогресс по теме 0..1. */
export function topicMastery(t: Topic, ctx: Ctx, s: State, mastery: (c: CardState | undefined) => number) {
  const items = t.items.filter((i) => isActive(i, ctx))
  if (!items.length) return 0
  return items.reduce((a, i) => a + mastery(s.cards[qaCardId(i.id)]), 0) / items.length
}

/** Серия дней подряд с занятиями. */
export function streak(days: State['days']): number {
  let n = 0
  const d = new Date()
  const active = (k: string) => { const x = days[k]; return !!x && (x.reviews + x.sims + x.listen) > 0 }
  if (!active(todayKey(d))) d.setDate(d.getDate() - 1)
  while (active(todayKey(d))) { n++; d.setDate(d.getDate() - 1) }
  return n
}
