// Проверки без БД: подпись Telegram initData и расписание напоминаний.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
require('reflect-metadata')
const { validateInitData } = require('../dist/auth/telegram-init-data.js')
const { RemindersService } = require('../dist/reminders/reminders.service.js')
const { localNow } = require('../dist/reminders/texts.js')

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
const svc = new RemindersService({}, {}, undefined)
const u = (o = {}) => ({ remindEnabled: true, tz: 'Europe/Nicosia', remindTime: '19:00', eveningNudge: true, tgId: '1', tgBlocked: false, pushSubscriptions: [], lastActiveDate: null, lastRemindedDate: null, lastEveningDate: null, ...o })

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
