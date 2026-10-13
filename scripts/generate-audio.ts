/**
 * Генерация готового звука (ElevenLabs) для слов, фраз и вопросов — один раз, заранее.
 * Файлы кладутся в public/audio/<ключ>.mp3, список — в public/audio/manifest.json.
 * Личные ответы (с данными анкеты) сюда не попадают: их озвучивает сервер на лету.
 *
 *   npm run audio:generate -- --dry-run            # только посчитать символы, без запросов
 *   npm run audio:generate                         # сгенерировать (нужен ELEVENLABS_API_KEY)
 *
 * Опции:
 *   --groups=vocab,questions,answers   какие группы озвучивать (по умолчанию все)
 *   --me=m,f                           голоса для слов и ответов (по умолчанию оба)
 *   --examiner=m                       голоса экзаменатора для вопросов (по умолчанию мужской)
 *   --limit=N                          сгенерировать не больше N новых файлов (для пробы)
 *   --concurrency=2                    параллельных запросов (лимит тарифа ElevenLabs: Free/Starter — 2)
 *
 * Переменные (из окружения или .env.local): ELEVENLABS_API_KEY, ELEVENLABS_MODEL,
 * ELEVENLABS_VOICE_MALE, ELEVENLABS_VOICE_FEMALE — те же, что на сервере, чтобы голоса совпадали.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { TOPICS } from '../src/data/topics'
import { VOCAB_DECKS } from '../src/data/vocab'
import * as P from '../src/data/profile'
import { makeCtx } from '../src/lib/ctx'
import { audioKeySource, cleanForSpeech, KEY_LENGTH, type AudioManifest, type VoiceLetter } from '../src/lib/audio-key'

try { process.loadEnvFile('.env.local') } catch { /* нет файла — берём из окружения */ }

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=')
  return [k, v ?? 'true']
}))
const DRY = args['dry-run'] === 'true'
const GROUPS = (args.groups ?? 'vocab,questions,answers').split(',')
const ME = (args.me ?? 'm,f').split(',') as VoiceLetter[]
const EXAMINER = (args.examiner ?? 'm').split(',') as VoiceLetter[]
const LIMIT = args.limit ? Number(args.limit) : Infinity
const CONCURRENCY = Math.max(1, Number(args.concurrency ?? 2))
const LIST = args.list // --list=answers — вывести тексты группы (для проверки)

const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2'
const VOICES: Record<VoiceLetter, string> = {
  m: process.env.ELEVENLABS_VOICE_MALE || 'JBFqnCBsd6RMkjVDRZzb',
  f: process.env.ELEVENLABS_VOICE_FEMALE || 'EXAVITQu4vr4xnSDxMaL',
}
const OUT = join(process.cwd(), 'public', 'audio')

const keyOf = (voice: VoiceLetter, text: string) =>
  createHash('sha1').update(audioKeySource(voice, text)).digest('hex').slice(0, KEY_LENGTH)

/* ------------------------------------------------ что озвучивать */

type Job = { group: string; voice: VoiceLetter; text: string }
const jobs = new Map<string, Job>()
const add = (group: string, voice: VoiceLetter, text: string) => {
  const t = cleanForSpeech(text)
  if (!t || t.includes('…')) return // строки с пропусками анкеты не озвучиваем
  const k = keyOf(voice, t)
  if (!jobs.has(k)) jobs.set(k, { group, voice, text: t })
}

/** Две анкеты с одинаковыми выборами, но разными личными данными — общие строки и есть «типовые». */
function profilePair(gender: 'm' | 'f', spouseGender: 'm' | 'f', marital: string) {
  const common = {
    ...P.DEFAULT_PROFILE, gender, spouseGender, marital,
    workStatus: 'employee', job: 'dev', duties: ['code', 'team'], tenure: 'own', loan: true, moneySources: ['savings', 'loan'],
    spouseWorks: true, investments: ['stocks'], hobbies: ['swim', 'read', 'cook'],
    foods: ['halloumi', 'kleftiko'], cyFriendsMet: 'work', ref1Met: 'work', ref2Met: 'neighbours', oldHome: 'sold',
    permitType: 'permanent', visitHome: 'yearly', lastTripWhy: 'holiday', pet: 'dog', favPlace: ['troodos', 'akamas'],
  }
  const kid = (name: string, d: string, city: string) => ({ id: name, name: { gr: name, en: name }, gender: 'm', birthDate: d, birthPlace: { id: city }, school: 'primary' })
  const a = {
    ...common, name: { gr: 'Άλφα', en: 'Alfa' }, surname: { gr: 'Ένα', en: 'One' }, birthDate: '1980-01-05', birthCity: { id: 'moscow' }, country: { id: 'ru' },
    moveDate: '2015-03-10', cyCity: { id: 'limassol' }, area: 'Περιοχή Α', address: 'Οδός Α 1', phone: '99111111', salary: 1111, price: 111111, monthly: 111,
    employer: 'Εταιρεία Α', workSince: 2015, spouseName: { gr: 'Σύζυγος Α' }, spouseBirthDate: '1981-02-02', spouseBirthCity: { id: 'kyiv' },
    weddingDate: '2005-05-05', weddingCity: { id: 'minsk' }, spouseJob: 'Επάγγελμα Α', spouseEmployer: 'Εργοδότης Α', spouseSalary: 1112,
    children: [kid('Παιδί Α', '2010-01-01', 'riga')], parentsCity: { id: 'samara' }, parentsCountry: { id: 'ru' }, fatherName: { gr: 'Πατέρας Α' }, motherName: { gr: 'Μητέρα Α' },
    uni: 'Πανεπιστήμιο Α', uniCity: { id: 'kazan' }, subject: 'μάθημα Α', gradYear: 2002, profession: 'Επάγγελμα Α', greekSince: 2019, cyFriends: 'Φίλοι Α',
    ref1Name: { gr: 'Εγγυητής Α' }, ref1Job: 'Δουλειά Α', ref1Since: 2016, ref2Name: { gr: 'Εγγυήτρια Α' }, ref2Job: 'Δουλειά Α2', ref2Since: 2017,
    tripsPerYear: 2, daysAbroad: 20, lastTripPlace: { id: 'gr' }, lastTripDate: '2025-08-01', applicationDate: '2025-01-01', permitSince: 2018, petName: 'Ζώο Α',
    bonus: 1111, dividends: 111, wakeTime: '06:10', workStart: '08:10', workEnd: '17:10', sleepTime: '22:10', bedrooms: 2,
  }
  const b = {
    ...common, name: { gr: 'Βήτα', en: 'Beta' }, surname: { gr: 'Δύο', en: 'Two' }, birthDate: '1990-11-25', birthCity: { id: 'kyiv' }, country: { id: 'ua' },
    moveDate: '2020-07-20', cyCity: { id: 'paphos' }, area: 'Περιοχή Β', address: 'Οδός Β 2', phone: '99222222', salary: 2222, price: 222222, monthly: 222,
    employer: 'Εταιρεία Β', workSince: 2021, spouseName: { gr: 'Σύζυγος Β' }, spouseBirthDate: '1992-03-03', spouseBirthCity: { id: 'odesa' },
    weddingDate: '2015-06-06', weddingCity: { id: 'tbilisi' }, spouseJob: 'Επάγγελμα Β', spouseEmployer: 'Εργοδότης Β', spouseSalary: 2223,
    children: [kid('Παιδί Β', '2018-02-02', 'larnaca')], parentsCity: { id: 'almaty' }, parentsCountry: { id: 'kz' }, fatherName: { gr: 'Πατέρας Β' }, motherName: { gr: 'Μητέρα Β' },
    uni: 'Πανεπιστήμιο Β', uniCity: { id: 'minsk' }, subject: 'μάθημα Β', gradYear: 2012, profession: 'Επάγγελμα Β', greekSince: 2022, cyFriends: 'Φίλοι Β',
    ref1Name: { gr: 'Εγγυητής Β' }, ref1Job: 'Δουλειά Β', ref1Since: 2021, ref2Name: { gr: 'Εγγυήτρια Β' }, ref2Job: 'Δουλειά Β2', ref2Since: 2022,
    tripsPerYear: 5, daysAbroad: 45, lastTripPlace: { id: 'it' }, lastTripDate: '2026-04-01', applicationDate: '2026-02-01', permitSince: 2021, petName: 'Ζώο Β',
    bonus: 2222, dividends: 222, wakeTime: '07:20', workStart: '09:20', workEnd: '18:20', sleepTime: '23:20', bedrooms: 3,
  }
  return [makeCtx(a), makeCtx(b)] as const
}

const combos: ['m' | 'f', 'm' | 'f', string][] = [['m', 'f', 'married'], ['f', 'm', 'married'], ['m', 'f', 'partner'], ['f', 'm', 'partner'], ['m', 'f', 'single'], ['f', 'm', 'single']]

for (const [gender, spouseGender, marital] of combos) {
  const [a, b] = profilePair(gender, spouseGender, marital)
  for (const t of TOPICS) for (const item of t.items) {
    if (GROUPS.includes('questions')) {
      const qa = item.questions(a).map((q) => q.gr)
      const qb = new Set(item.questions(b).map((q) => q.gr))
      for (const q of qa) if (qb.has(q)) for (const v of EXAMINER) add('questions', v, q)
    }
    if (GROUPS.includes('answers') && (!item.when || item.when(a))) {
      const la = item.answer(a).map((l) => l.gr)
      const lb = new Set(item.answer(b).map((l) => l.gr))
      // Голос ответов — по роду говорящего (настройка «как мой род»).
      for (const l of la) if (lb.has(l) && ME.includes(gender)) add('answers', gender, l)
    }
  }
}

if (GROUPS.includes('vocab')) {
  for (const d of VOCAB_DECKS) for (const it of d.items) {
    for (const v of ME) add('vocab', v, v === 'f' && it.grF ? it.grF : it.gr)
  }
}

/* ------------------------------------------------ подсчёт и генерация */

mkdirSync(OUT, { recursive: true })
const existing = new Set(readdirSync(OUT).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)))
const todo = [...jobs.entries()].filter(([k]) => !existing.has(k)).slice(0, LIMIT)

const stats = new Map<string, { n: number; chars: number }>()
for (const [, j] of jobs) {
  const s = stats.get(`${j.group}/${j.voice}`) ?? { n: 0, chars: 0 }
  s.n++
  s.chars += j.text.length
  stats.set(`${j.group}/${j.voice}`, s)
}
console.log(`Модель: ${MODEL}; голоса: m=${VOICES.m}, f=${VOICES.f}`)
for (const [k, s] of [...stats].sort()) console.log(`  ${k.padEnd(14)} ${String(s.n).padStart(5)} фраз  ${String(s.chars).padStart(7)} символов`)
const todoChars = todo.reduce((a, [, j]) => a + j.text.length, 0)
const ready = [...jobs.keys()].filter((k) => existing.has(k)).length
console.log(`Всего: ${jobs.size} фраз; уже готово: ${ready}; к генерации: ${todo.length} (${todoChars} символов)`)
if (LIST) for (const [, j] of jobs) if (`${j.group}/${j.voice}`.startsWith(LIST)) console.log(`  · ${j.text}`)

function writeManifest() {
  const keys = readdirSync(OUT).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)).sort()
  const m: AudioManifest = { version: 1, provider: 'elevenlabs', model: MODEL, voices: VOICES, generatedAt: new Date().toISOString(), keys }
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(m))
  return keys.length
}

if (DRY) {
  console.log('Пробный запуск (--dry-run): запросов не было.')
  process.exit(0)
}

const KEY = process.env.ELEVENLABS_API_KEY
if (!KEY) {
  console.error('Нет ELEVENLABS_API_KEY (задайте в окружении или в .env.local)')
  process.exit(1)
}

async function synth(j: Job, attempt = 1): Promise<Buffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICES[j.voice]}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY!, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: j.text,
      model_id: MODEL,
      ...(MODEL.startsWith('eleven_multilingual_v2') ? {} : { language_code: 'el' }),
      voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 1 },
    }),
  })
  // 429 — превышен лимит параллельных запросов или частоты: ждём и повторяем (до ~1 минуты суммарно).
  if ((res.status === 429 || res.status >= 500) && attempt < 8) {
    await new Promise((r) => setTimeout(r, 1000 * 2 ** Math.min(attempt, 5) + Math.random() * 500))
    return synth(j, attempt + 1)
  }
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`)
  return Buffer.from(await res.arrayBuffer())
}

let done = 0
let failed = 0
let hinted = false
const queue = [...todo]
async function worker() {
  for (;;) {
    const next = queue.shift()
    if (!next) return
    const [k, j] = next
    try {
      writeFileSync(join(OUT, `${k}.mp3`), await synth(j))
      done++
      if (done % 25 === 0) { writeManifest(); console.log(`  … ${done}/${todo.length}`) }
    } catch (e) {
      failed++
      console.error(`✗ ${j.group}/${j.voice} «${j.text.slice(0, 40)}»: ${(e as Error).message}`)
      const msg = (e as Error).message
      if (/quota|credits|401|403/i.test(msg)) queue.length = 0 // кончились кредиты, неверный ключ или аккаунт ограничен
      if (/detected_unusual_activity/.test(msg) && !hinted) {
        hinted = true
        console.error('\n⚠ ElevenLabs отключил бесплатный тариф для этого аккаунта (подозрение на VPN/прокси или несколько бесплатных аккаунтов).'
          + '\n  Нужен платный тариф (Starter) либо обращение в поддержку ElevenLabs, если это ошибка. Готовые файлы сохранены — запуск продолжится с места остановки.\n')
      }
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
const total = writeManifest()
console.log(`Готово: +${done}, ошибок: ${failed}. Всего файлов в манифесте: ${total}.`)
if (failed) process.exitCode = 1
