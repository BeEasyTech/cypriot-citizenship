/** Фразы дня: короткие и полезные на собеседовании. */
const PHRASES: [string, string][] = [
  ['Μπορείτε να επαναλάβετε, παρακαλώ;', 'Повторите, пожалуйста.'],
  ['Πιο αργά, παρακαλώ.', 'Медленнее, пожалуйста.'],
  ['Συγγνώμη, δεν κατάλαβα την ερώτηση.', 'Извините, я не понял(а) вопрос.'],
  ['Ένα λεπτό, να σκεφτώ.', 'Минутку, дайте подумать.'],
  ['Πώς το λέμε στα ελληνικά;', 'Как это сказать по-гречески?'],
  ['Μπορώ να το πω στα αγγλικά;', 'Можно я скажу по-английски?'],
  ['Μαθαίνω ελληνικά κάθε μέρα.', 'Я учу греческий каждый день.'],
  ['Καταλαβαίνω περισσότερα απ’ όσα μπορώ να πω.', 'Я понимаю больше, чем могу сказать.'],
  ['Η Κύπρος είναι το σπίτι μου.', 'Кипр — мой дом.'],
  ['Μένω στην Κύπρο εδώ και πολλά χρόνια.', 'Я живу на Кипре уже много лет.'],
  ['Μου αρέσει πολύ η κυπριακή κουζίνα.', 'Мне очень нравится кипрская кухня.'],
  ['Οι Κύπριοι είναι φιλικοί και φιλόξενοι.', 'Киприоты дружелюбные и гостеприимные.'],
  ['Θέλω να μείνω στην Κύπρο για πάντα.', 'Я хочу остаться на Кипре навсегда.'],
  ['Εννοείτε…;', 'Вы имеете в виду…?'],
  ['Ναι, ακριβώς.', 'Да, именно.'],
  ['Δεν θυμάμαι ακριβώς, περίπου…', 'Точно не помню, примерно…'],
  ['Ευχαριστώ πολύ για τον χρόνο σας.', 'Большое спасибо за ваше время.'],
  ['Καλημέρα σας! Χαίρω πολύ.', 'Доброе утро! Очень приятно.'],
  ['Είμαι λίγο αγχωμένος / αγχωμένη.', 'Я немного волнуюсь.'],
  ['Θα προσπαθήσω να εξηγήσω.', 'Я попробую объяснить.'],
]

const MAIN = [
  '⏰ Пора позаниматься греческим! Даже 10 минут сегодня — шаг к паспорту.',
  '🇨🇾 Время для греческого: пара вопросов собеседования и несколько слов.',
  '📚 Καλησπέρα! Ежедневное занятие ждёт — это займёт всего несколько минут.',
  '🗣 Потренируйте ответы вслух сегодня — на собеседовании будет легче.',
  '✨ Маленький шаг каждый день: откройте тренажёр и повторите карточки.',
]

const EVENING = [
  '🌙 Сегодня ещё не было занятия. Ещё не поздно — 5 минут перед сном!',
  '🌙 Καληνύχτα скоро, а греческого сегодня ещё не было. Всего пару карточек?',
  '🌙 Не прерывайте привычку: короткое повторение перед сном отлично запоминается.',
]

const dayIndex = (date: string) => Math.floor(Date.parse(date + 'T00:00:00Z') / 86_400_000)

export function phraseOfDay(date: string) {
  const [gr, ru] = PHRASES[dayIndex(date) % PHRASES.length]
  return { gr, ru }
}

export type ReminderKind = 'main' | 'evening' | 'snooze'

/** Вариант текста основного напоминания: онбординг в первые дни, «возвращение» после пропусков. */
export type ReminderVariant = 'normal' | 'onboard1' | 'onboard2' | 'onboard3' | 'comeback'

const ONBOARD: Record<'onboard1' | 'onboard2' | 'onboard3', string> = {
  onboard1: '👋 С чего начать: заполните анкету (вкладка «Анкета») — за 5–10 минут приложение соберёт ваши личные ответы на греческом.',
  onboard2: '🎙 Попробуйте симуляцию собеседования: вопросы звучат на слух, а вы отвечаете вслух. Это главный тренажёр перед экзаменом.',
  onboard3: '🛟 Выучите фразы-спасатели — «Μπορείτε να επαναλάβετε;» и другие. Они выручат, если вопрос непонятен.',
}

const COMEBACK = [
  '👋 Давно не виделись! Не страшно — начните с 5 минут: пара карточек, и привычка вернётся.',
  '🌱 Перерыв — это нормально. Сегодня хватит одного вопроса в симуляции собеседования.',
  '💡 Подберите удобное время напоминаний в /settings — так проще заниматься регулярно.',
]

/** Тихие часы: с 22:30 до 08:00 по местному времени. */
export const QUIET_FROM = '22:30'
export const QUIET_TO = '08:00'
export function isQuiet(hm: string) {
  const m = minutes(hm)
  return m >= minutes(QUIET_FROM) || m < minutes(QUIET_TO)
}

/** Разница в днях между датами YYYY-MM-DD. */
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000)

const SNOOZE = '⏰ Как договаривались — напоминаю: пора позаниматься греческим!'

export function ruPlural(n: number, one: string, few: string, many: string) {
  const n10 = n % 10, n100 = n % 100
  if (n10 === 1 && n100 !== 11) return one
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few
  return many
}

/** Дней до собеседования (от локальной даты), null — если дата не задана или прошла. */
export function daysUntil(interviewDate: string | null | undefined, today: string): number | null {
  if (!interviewDate) return null
  const d = Math.round((Date.parse(interviewDate + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86_400_000)
  return d >= 0 ? d : null
}

export function countdownLine(days: number | null): string {
  if (days === null) return ''
  if (days === 0) return '🍀 Собеседование сегодня! Καλή επιτυχία!'
  const base = `📅 До собеседования: ${days} ${ruPlural(days, 'день', 'дня', 'дней')}`
  return days <= 7 ? `${base} — финишная прямая: прогоните симуляцию и слабые вопросы.` : base
}

export function reminderText(kind: ReminderKind, date: string, daysLeft: number | null = null, variant: ReminderVariant = 'normal') {
  const pick = (xs: string[]) => xs[dayIndex(date) % xs.length]
  const head = kind === 'snooze' ? SNOOZE
    : kind === 'evening' ? pick(EVENING)
    : variant === 'normal' ? pick(MAIN)
    : variant === 'comeback' ? pick(COMEBACK)
    : ONBOARD[variant]
  const p = phraseOfDay(date)
  const cd = countdownLine(daysLeft)
  return {
    /** Для Telegram (HTML). */
    html: `${head}${cd ? `\n${cd}` : ''}\n\n💬 <b>Фраза дня:</b> <i>${p.gr}</i>\n${p.ru}`,
    /** Для Web Push. */
    title: kind === 'evening' ? 'Ещё не поздно 🌙' : 'Время для греческого 🇨🇾',
    body: `${head.replace(/^\S+\s/, '')}${cd ? `\n${cd}` : ''}\n💬 ${p.gr}`,
  }
}

const RU_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const dayMonth = (d: string) => `${Number(d.slice(8, 10))} ${RU_MONTHS[Number(d.slice(5, 7)) - 1]}`

export function weeklyText(w: { from: string; to: string; activeDays: number; streak: number; cards: number; sims: number; listen: number; minutes: number }, daysLeft: number | null) {
  const cheer = w.activeDays >= 6 ? 'Μπράβο! Отличная неделя 💪'
    : w.activeDays >= 3 ? 'Хороший темп. Попробуйте добавить ещё пару дней на следующей неделе.'
    : w.activeDays > 0 ? 'Главное — регулярность: даже 10 минут в день дают результат.'
    : 'На этой неделе занятий не было. Начнём заново — всего 10 минут сегодня?'
  const lines = [
    `📊 <b>Итоги недели</b> (${dayMonth(w.from)} — ${dayMonth(w.to)})`,
    '',
    `📆 Дней с занятиями: <b>${w.activeDays} из 7</b>`,
    `🃏 Карточек: ${w.cards} · 🎙 Вопросов в симуляции: ${w.sims} · 👂 Квиз: ${w.listen}`,
    `⏱ Минут: ${w.minutes}`,
    `🔥 Серия: ${w.streak} ${ruPlural(w.streak, 'день', 'дня', 'дней')} подряд`,
  ]
  const cd = countdownLine(daysLeft)
  if (cd) lines.push(cd)
  lines.push('', cheer)
  return {
    html: lines.join('\n'),
    title: 'Итоги недели 📊',
    body: `Дней с занятиями: ${w.activeDays} из 7 · карточек: ${w.cards} · серия: ${w.streak}${cd ? `\n${cd}` : ''}`,
  }
}

/** День недели (0 — воскресенье) для локальной даты. */
export const weekday = (date: string) => new Date(date + 'T00:00:00Z').getUTCDay()

/** Локальные дата и время в часовом поясе пользователя. */
export function localNow(tz: string, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hm: `${parts.hour}:${parts.minute}` }
}

/** Минуты с полуночи для «HH:MM». */
export const minutes = (hm: string) => {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}
