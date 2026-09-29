import type { Gender, Tri } from '../types'
import {
  CITIES, COUNTRIES, duration, hole, inMonth, money, onDate, parseDate, placeForms, tri, triAll, yearsBetween,
  type PlaceForms,
} from './grammar'
import type { Choice, GTri, NameValue, Profile } from '../data/profile'

/** Контекст для шаблонов ответов: профиль + помощники с учётом рода. */
export interface Ctx {
  p: Profile
  gender: Gender
  /** Выбор формы по роду говорящего. */
  g: <T>(m: T, f: T) => T
  /** Строка по роду говорящего из GTri. */
  gt: (x: GTri) => Tri
  /** Текстовое поле (по-гречески); в en/ru подставляется то же значение. */
  text: (key: string, label: string) => Tri
  name: (key: string, label: string) => Tri
  city: (key: string, label: string) => PlaceForms
  country: (key: string, label: string) => PlaceForms
  date: (key: string, label: string) => Tri
  month: (key: string, label: string) => Tri
  money: (key: string, label: string) => Tri
  num: (key: string) => number | undefined
  year: (key: string, label: string) => Tri
  sinceYears: (key: string, label: string) => Tri
  age: (key: string, label: string) => Tri
  pick: <T>(choices: Choice<T>[], key: string) => Choice<T> | undefined
  picks: <T>(choices: Choice<T>[], key: string) => Choice<T>[]
  has: (key: string) => boolean
}

export function makeCtx(p: Profile): Ctx {
  const gender: Gender = p.gender === 'f' ? 'f' : 'm'
  const g = <T,>(m: T, f: T) => (gender === 'f' ? f : m)
  const gt = (x: GTri): Tri => tri(gender === 'f' && x.grF ? x.grF : x.gr, x.en, x.ru)

  const str = (key: string) => (typeof p[key] === 'string' ? (p[key] as string).trim() : '')
  const num = (key: string) => {
    const v = p[key]
    if (v === '' || v === null || v === undefined) return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }

  return {
    p,
    gender,
    g,
    gt,
    text: (key, label) => {
      const s = str(key)
      return s ? triAll(s) : triAll(hole(label))
    },
    name: (key, label) => {
      const v = p[key] as NameValue | undefined
      const gr = v?.gr?.trim()
      if (!gr) return triAll(hole(label))
      const en = v?.en?.trim() || gr
      return tri(gr, en, en)
    },
    city: (key, label) => placeForms(p[key], CITIES, label),
    country: (key, label) => placeForms(p[key], COUNTRIES, label),
    date: (key, label) => onDate(p[key], label),
    month: (key, label) => inMonth(p[key], label),
    money: (key, label) => money(p[key], label),
    num,
    year: (key, label) => {
      const n = num(key)
      return n ? triAll(String(n)) : triAll(hole(label))
    },
    sinceYears: (key, label) => {
      const d = parseDate(p[key])
      return d ? duration(d) : triAll(hole(label))
    },
    age: (key, label) => {
      const d = parseDate(p[key])
      return d ? triAll(String(yearsBetween(d))) : triAll(hole(label))
    },
    pick: (choices, key) => choices.find((c) => c.value === p[key]),
    picks: (choices, key) => {
      const v = p[key]
      if (!Array.isArray(v)) return []
      return v.map((x: string) => choices.find((c) => c.value === x)).filter(Boolean) as Choice<never>[]
    },
    has: (key) => {
      const v = p[key]
      return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
    },
  }
}
