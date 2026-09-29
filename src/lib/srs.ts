/**
 * Интервальное повторение (вариант SM-2 в стиле Anki).
 * Шаги изучения: 1 мин → 10 мин → 1 день. Дальше интервал × «лёгкость».
 */

export interface CardState {
  due: number
  /** Интервал в днях; 0 — карточка в стадии изучения. */
  ivl: number
  ease: number
  reps: number
  lapses: number
  step: number
  last: number
}

export type Rating = 1 | 2 | 3 | 4

const MIN = 60_000
export const DAY = 86_400_000
const STEPS = [1 * MIN, 10 * MIN]
const START_EASE = 2.5

export const newCardState = (now = Date.now()): CardState => ({ due: now, ivl: 0, ease: START_EASE, reps: 0, lapses: 0, step: 0, last: 0 })

/** Небольшой разброс, чтобы карточки не сбивались в одну дату. */
const fuzz = (days: number) => (days < 3 ? days : days * (0.95 + Math.random() * 0.1))

export function review(prev: CardState | undefined, r: Rating, now = Date.now(), maxIvl = 365): CardState {
  const s: CardState = { ...(prev ?? newCardState(now)), reps: (prev?.reps ?? 0) + 1, last: now }

  if (s.ivl === 0) {
    // изучение
    if (r === 1) { s.step = 0; s.due = now + STEPS[0] }
    else if (r === 2) { s.due = now + Math.round((STEPS[s.step] ?? STEPS[STEPS.length - 1]) * 1.5) }
    else if (r === 3) {
      s.step += 1
      if (s.step >= STEPS.length) { s.ivl = 1; s.due = now + DAY }
      else s.due = now + STEPS[s.step]
    } else { s.ivl = Math.min(4, maxIvl); s.due = now + s.ivl * DAY }
    return s
  }

  // повторение
  if (r === 1) {
    s.lapses += 1
    s.ease = Math.max(1.3, s.ease - 0.2)
    s.ivl = 0
    s.step = 1
    s.due = now + STEPS[1]
    return s
  }
  let ivl: number
  if (r === 2) { ivl = Math.max(s.ivl + 1, s.ivl * 1.2); s.ease = Math.max(1.3, s.ease - 0.15) }
  else if (r === 3) ivl = Math.max(s.ivl + 1, s.ivl * s.ease)
  else { ivl = Math.max(s.ivl + 2, s.ivl * s.ease * 1.3); s.ease += 0.15 }
  s.ivl = Math.max(1, Math.min(maxIvl, Math.round(fuzz(ivl))))
  s.due = now + s.ivl * DAY
  return s
}

/** Подпись интервала для кнопки оценки. */
export function previewLabel(prev: CardState | undefined, r: Rating, maxIvl = 365): string {
  const now = Date.now()
  const s = review(prev, r, now, maxIvl)
  const ms = s.due - now
  if (ms < 60 * MIN) return `${Math.max(1, Math.round(ms / MIN))} мин`
  if (ms < DAY) return `${Math.round(ms / (60 * MIN))} ч`
  const d = Math.round(ms / DAY)
  if (d < 31) return `${d} д`
  return `${Math.round(d / 30)} мес`
}

export type Level = 'new' | 'learning' | 'young' | 'mature'

export function level(s: CardState | undefined): Level {
  if (!s || s.reps === 0) return 'new'
  if (s.ivl === 0) return 'learning'
  if (s.ivl < 21) return 'young'
  return 'mature'
}

/** Оценка «насколько выучено» 0..1 для прогресс-баров. */
export function mastery(s: CardState | undefined): number {
  if (!s || s.reps === 0) return 0
  if (s.ivl === 0) return 0.15
  return Math.min(1, 0.3 + (Math.log(s.ivl + 1) / Math.log(22)) * 0.7)
}
