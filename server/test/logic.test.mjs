// Проверки без БД: подпись Telegram initData и расписание напоминаний.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
require('reflect-metadata')
const { validateInitData } = require('../dist/auth/telegram-init-data.js')
const { RemindersService, reminderVariant, staleSnooze, inactiveDays } = require('../dist/reminders/reminders.service.js')
const { localNow, daysUntil, countdownLine, weeklyText, reminderText } = require('../dist/reminders/texts.js')

const TOKEN = '123456:TEST-token'
function sign(fields, token = TOKEN) {
  const p = new URLSearchParams(fields)
  const dcs = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  p.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'))
  return p.toString()
}
const now = Math.floor(Date.now() / 1000)
const user = JSON.stringify({ id: 42, first_name: 'Ivan', allows_write_to_pm: true })

test('initData: верная подпись', () => {
  assert.equal(validateInitData(sign({ auth_date: String(now), user, query_id: 'x' }), TOKEN)?.id, 42)
})
test('initData: чужой токен', () => {
  assert.equal(validateInitData(sign({ auth_date: String(now), user }, '999:other'), TOKEN), null)
})
test('initData: подмена данных', () => {
  const s = sign({ auth_date: String(now), user }).replace('Ivan', 'Evil')
  assert.equal(validateInitData(s, TOKEN), null)
})
test('initData: устарела', () => {
  assert.equal(validateInitData(sign({ auth_date: String(now - 8 * 86400), user }), TOKEN), null)
})

// Время: 2026-09-30, Никосия UTC+3
const at = (hm) => new Date(`2026-09-30T${hm}:00+03:00`)
const svc = new RemindersService({}, {}, {}, undefined)
const u = (o = {}) => ({ remindEnabled: true, tz: 'Europe/Nicosia', remindTime: '19:00', eveningNudge: true, tgId: '1', tgBlocked: false, pushSubscriptions: [], lastActiveDate: '2026-09-29', createdAt: new Date('2026-09-01T10:00:00Z'), lastRemindedDate: null, lastEveningDate: null, ...o })

test('localNow учитывает часовой пояс', () => {
  assert.deepEqual(localNow('Europe/Nicosia', at('23:30')), { date: '2026-09-30', hm: '23:30' })
  assert.deepEqual(localNow('Europe/Moscow', at('23:30')), { date: '2026-09-30', hm: '23:30' })
  assert.equal(localNow('Asia/Tokyo', at('23:30')).date, '2026-10-01')
})
test('до времени — нет, в время — main', () => {
  assert.equal(svc.dueKind(u(), at('18:59')), null)
  assert.equal(svc.dueKind(u(), at('19:00')), 'main')
  assert.equal(svc.dueKind(u(), at('21:30')), 'main') // догоняем после перезапуска
  assert.equal(svc.dueKind(u(), at('22:01')), null) // но не позже 3 часов
})
test('уже занимался сегодня — не напоминаем', () => {
  assert.equal(svc.dueKind(u({ lastActiveDate: '2026-09-30' }), at('19:05')), null)
})
test('уже напомнили — второй раз не шлём, вечером — evening', () => {
  const x = u({ lastRemindedDate: '2026-09-30' })
  assert.equal(svc.dueKind(x, at('20:00')), null)
  assert.equal(svc.dueKind(x, at('21:00')), 'evening')
  assert.equal(svc.dueKind({ ...x, lastEveningDate: '2026-09-30' }, at('21:10')), null)
  assert.equal(svc.dueKind({ ...x, eveningNudge: false }, at('21:10')), null)
})
test('нет каналов доставки — не напоминаем', () => {
  assert.equal(svc.dueKind(u({ tgId: null }), at('19:00')), null)
  assert.equal(svc.dueKind(u({ tgBlocked: true }), at('19:00')), null)
  assert.equal(svc.dueKind(u({ tgId: null, pushSubscriptions: [{}] }), at('19:00')), 'main')
})
test('выключено — не напоминаем', () => {
  assert.equal(svc.dueKind(u({ remindEnabled: false }), at('19:00')), null)
})

test('«через час»: ждём, потом snooze; если уже позанимался — ничего', () => {
  const x = u({ lastRemindedDate: '2026-09-30', snoozeUntil: at('21:30') })
  assert.equal(svc.dueKind(x, at('20:30')), null)
  assert.equal(svc.dueKind(x, at('21:00')), null) // пока ждём snooze, вечернее не шлём
  assert.equal(svc.dueKind(x, at('21:30')), 'snooze')
  assert.equal(svc.dueKind({ ...x, lastActiveDate: '2026-09-30' }, at('21:35')), null)
})
test('итоги недели: воскресенье 12:00, только тем, кто занимался', () => {
  const sun = (hm) => new Date(`2026-10-04T${hm}:00+03:00`) // 4 октября 2026 — воскресенье
  assert.equal(svc.dueKind(u({ lastActiveDate: '2026-10-03' }), sun('11:59')), null)
  assert.equal(svc.dueKind(u({ lastActiveDate: '2026-10-03' }), sun('12:00')), 'weekly')
  assert.equal(svc.dueKind(u({ lastActiveDate: '2026-10-03', lastWeeklyDate: '2026-10-04' }), sun('12:30')), null)
  assert.equal(svc.dueKind(u({ lastActiveDate: null }), sun('12:00')), null)
  assert.equal(svc.dueKind(u({ lastActiveDate: '2026-10-03' }), at('12:00')), null) // среда
})
test('обратный отсчёт', () => {
  assert.equal(daysUntil('2026-11-09', '2026-09-30'), 40)
  assert.equal(daysUntil('2026-09-29', '2026-09-30'), null)
  assert.equal(countdownLine(40), '📅 До собеседования: 40 дней')
  assert.equal(countdownLine(1), '📅 До собеседования: 1 день — финишная прямая: прогоните симуляцию и слабые вопросы.')
  assert.match(countdownLine(0), /сегодня/)
  assert.match(reminderText('main', '2026-09-30', 22).html, /До собеседования: 22 дня/)
  assert.doesNotMatch(reminderText('main', '2026-09-30', null).html, /До собеседования/)
})
test('текст итогов недели', () => {
  const t = weeklyText({ from: '2026-09-28', to: '2026-10-04', activeDays: 5, streak: 12, cards: 240, sims: 10, listen: 30, minutes: 95 }, 34)
  assert.match(t.html, /28 сентября — 4 октября/)
  assert.match(t.html, /5 из 7/)
  assert.match(t.html, /Серия: 12 дней/)
  assert.match(t.html, /До собеседования: 34 дня/)
})

test('тихие часы: догоняющее напоминание ночью не шлём, своё время — уважаем', () => {
  assert.equal(svc.dueKind(u(), at('22:45')), null) // 19:00 + догон, но уже тихие часы
  assert.equal(svc.dueKind(u({ remindTime: '23:00' }), at('23:00')), 'main')
  assert.equal(svc.dueKind(u({ remindTime: '23:00' }), at('23:20')), null)
  assert.equal(svc.dueKind(u({ remindTime: '07:30' }), at('07:30')), 'main')
})
test('«через час» с прошлого дня или в тихие часы — устарело', () => {
  const tz = 'Europe/Nicosia'
  assert.equal(staleSnooze(u({ snoozeUntil: new Date('2026-09-29T23:30:00+03:00') }), at('19:00'), tz), true)
  assert.equal(staleSnooze(u({ snoozeUntil: at('23:00') }), at('23:00'), tz), true)
  assert.equal(staleSnooze(u({ snoozeUntil: at('20:00') }), at('19:30'), tz), false)
  // устаревший snooze не мешает утреннему напоминанию
  assert.equal(svc.dueKind(u({ snoozeUntil: new Date('2026-09-29T23:30:00+03:00') }), at('19:00')), 'main')
})
test('неактивность: 3+ дня — «возвращение» без вечернего, 14+ — тишина', () => {
  const tz = 'Europe/Nicosia'
  const back = u({ lastActiveDate: '2026-09-25' })
  assert.equal(inactiveDays(back, '2026-09-30', tz), 5)
  assert.equal(svc.dueKind(back, at('19:00')), 'main')
  assert.equal(reminderVariant(back, '2026-09-30', tz), 'comeback')
  assert.equal(svc.dueKind({ ...back, lastRemindedDate: '2026-09-30' }, at('21:00')), null)
  const gone = u({ lastActiveDate: '2026-09-10' })
  assert.equal(svc.dueKind(gone, at('19:00')), null)
  assert.equal(svc.dueKind(gone, new Date('2026-10-04T12:00:00+03:00')), 'weekly') // итоги недели остаются
})
test('онбординг в первые три дня, если ещё не занимались', () => {
  const tz = 'Europe/Nicosia'
  const fresh = (d) => u({ lastActiveDate: null, createdAt: new Date(`${d}T09:00:00+03:00`) })
  assert.equal(reminderVariant(fresh('2026-09-30'), '2026-09-30', tz), 'onboard1')
  assert.equal(reminderVariant(fresh('2026-09-29'), '2026-09-30', tz), 'onboard2')
  assert.equal(reminderVariant(fresh('2026-09-28'), '2026-09-30', tz), 'onboard3')
  assert.equal(reminderVariant(fresh('2026-09-27'), '2026-09-30', tz), 'comeback')
  assert.equal(reminderVariant(u(), '2026-09-30', tz), 'normal')
  assert.match(reminderText('main', '2026-09-30', null, 'onboard1').html, /анкету/)
  assert.match(reminderText('main', '2026-09-30', null, 'comeback').html, /\S/)
})
