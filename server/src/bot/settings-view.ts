import { Markup } from 'telegraf'
import type { InlineKeyboardButton } from 'telegraf/types'
import type { User } from '../entities/user.entity'
import { QUIET_FROM, QUIET_TO } from '../reminders/texts'

/** Часовые пояса для быстрого выбора. */
export const TZ_CHOICES: [string, string][] = [
  ['Europe/Nicosia', '🇨🇾 Кипр'],
  ['Europe/Athens', '🇬🇷 Греция'],
  ['Europe/Moscow', '🇷🇺 Москва'],
  ['Europe/Kyiv', '🇺🇦 Киев'],
  ['Europe/Minsk', '🇧🇾 Минск'],
  ['Asia/Tbilisi', '🇬🇪 Тбилиси'],
  ['Asia/Yerevan', '🇦🇲 Ереван'],
  ['Asia/Almaty', '🇰🇿 Алматы'],
  ['Asia/Dubai', '🇦🇪 Дубай'],
  ['Asia/Jerusalem', '🇮🇱 Израиль'],
  ['Europe/Berlin', '🇩🇪 Берлин'],
  ['Europe/London', '🇬🇧 Лондон'],
]

/** Синонимы поясов (геолокация возвращает канонические имена IANA). */
export const TZ_ALIASES: Record<string, string> = {
  'Asia/Nicosia': 'Europe/Nicosia',
  'Asia/Famagusta': 'Europe/Nicosia',
  'Europe/Kiev': 'Europe/Kyiv',
}

export const TIME_PRESETS = ['07:00', '08:00', '09:00', '10:00', '12:00', '13:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00']

/** «Кипр (GMT+3)» или «Europe/Paris (GMT+2)». */
export function tzLabel(tz: string) {
  let offset = ''
  try {
    offset = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? ''
  } catch { /* неизвестный пояс */ }
  const known = TZ_CHOICES.find(([id]) => id === (TZ_ALIASES[tz] ?? tz))?.[1].replace(/^\S+\s/, '')
  return `${known ?? tz}${offset ? ` (${offset})` : ''}`
}

export function settingsText(u: User) {
  return [
    '⚙️ <b>Настройки напоминаний</b>',
    '',
    `🔔 Напоминания: <b>${u.remindEnabled ? 'включены' : 'выключены'}</b>`,
    `⏰ Время: <b>${u.remindTime}</b>`,
    `🌙 Вечером в 21:00 «ещё не поздно»: <b>${u.eveningNudge ? 'да' : 'нет'}</b>`,
    `🕰 Часовой пояс: <b>${tzLabel(u.tz)}</b>`,
    `🤫 Тихие часы: ${QUIET_FROM}–${QUIET_TO} — в это время бот не пишет`,
  ].join('\n')
}

const cb = Markup.button.callback

export function settingsKeyboard(u: User): InlineKeyboardButton[][] {
  return [
    [cb(`⏰ Время: ${u.remindTime}`, 's:time'), cb('🕰 Часовой пояс', 's:tz')],
    [cb(u.remindEnabled ? '🔕 Выключить напоминания' : '🔔 Включить напоминания', 's:toggle:on')],
    [cb(u.eveningNudge ? '🌙 Без вечернего напоминания' : '🌙 С вечерним напоминанием', 's:toggle:evening')],
    [cb('✖️ Закрыть', 's:close')],
  ]
}

export function timeKeyboard(u: User): InlineKeyboardButton[][] {
  const rows: InlineKeyboardButton[][] = []
  for (let i = 0; i < TIME_PRESETS.length; i += 4) {
    rows.push(TIME_PRESETS.slice(i, i + 4).map((t) => cb(t === u.remindTime ? `✓ ${t}` : t, `s:t:${t}`)))
  }
  rows.push([cb('« Назад', 's:menu')])
  return rows
}

export function tzKeyboard(u: User): InlineKeyboardButton[][] {
  const rows: InlineKeyboardButton[][] = []
  for (let i = 0; i < TZ_CHOICES.length; i += 2) {
    rows.push(TZ_CHOICES.slice(i, i + 2).map(([id, label]) => cb(id === (TZ_ALIASES[u.tz] ?? u.tz) ? `✓ ${label}` : label, `s:z:${id}`)))
  }
  rows.push([cb('📍 Определить по геолокации', 's:loc')])
  rows.push([cb('« Назад', 's:menu')])
  return rows
}
