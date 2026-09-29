import { useMemo } from 'react'
import { Settings as Gear, Play, Mic, Ear, LifeBuoy, ClipboardList, Flame, ChevronRight } from 'lucide-react'
import { useStore, todayKey } from '../store'
import { useNav } from '../router'
import { allCards, buildQueue, daysLeft, isActive, streak, topicMastery, useCtx, useDecks, useTopics, answerOf } from '../content'
import { mastery } from '../lib/srs'
import { ruPlural } from '../lib/grammar'
import { FIELDS, OPTIONAL_FIELDS, isFieldFilled, isFieldVisible } from '../data/profile'
import { Screen, Btn, Section, Bar, cx } from '../ui/kit'
import { countHoles } from '../ui/fields'

export default function Home() {
  const s = useStore()
  const push = useNav((n) => n.push)
  const ctx = useCtx()
  const topics = useTopics()
  const decks = useDecks()

  const pools = useMemo(() => allCards(topics, decks, ctx, s), [topics, decks, ctx, s])
  const { due, fresh } = useMemo(() => buildQueue(pools, s), [pools, s])
  const left = daysLeft(s)
  const today = s.days[todayKey()]
  const st = streak(s.days)

  const fill = useMemo(() => {
    const vis = FIELDS.filter((f) => isFieldVisible(f, s.profile) && !OPTIONAL_FIELDS.has(f.key))
    return vis.filter((f) => isFieldFilled(f, s.profile)).length / Math.max(1, vis.length)
  }, [s.profile])

  const holes = useMemo(() => {
    let n = 0
    for (const t of topics) for (const i of t.items) if (isActive(i, ctx)) n += countHoles(answerOf(i, ctx, s.overrides))
    return n
  }, [topics, ctx, s.overrides])

  const name = s.profile.name?.gr?.trim()
  const minutes = Math.max(1, Math.round((due * 12 + fresh * 30) / 60))

  return (
    <Screen
      title={name ? `Γεια σας, ${name}!` : 'Γεια σας!'}
      subtitle={left === null ? 'Подготовка к собеседованию на гражданство' : left > 0 ? `До собеседования ${left} ${ruPlural(left, 'день', 'дня', 'дней')}` : left === 0 ? 'Собеседование сегодня. Καλή επιτυχία!' : 'Собеседование прошло'}
      right={<button onClick={() => push({ name: 'settings' })} className="flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-accent-soft" aria-label="Настройки"><Gear size={22} /></button>}
    >
      {/* Сегодня */}
      <div className="card mt-2 overflow-hidden">
        <div className="bg-gradient-to-br from-accent to-[color-mix(in_srgb,var(--accent)_70%,#0a2a5c)] p-5 text-white">
          <div className="text-[13px] font-semibold uppercase tracking-wide opacity-80">Занятие на сегодня</div>
          <div className="mt-2 flex items-end gap-6">
            <Stat n={due} label="повторить" />
            <Stat n={fresh} label="новых" />
            <div className="ml-auto text-right text-[13px] opacity-85">≈ {minutes} мин</div>
          </div>
          <button
            onClick={() => push({ name: 'session' })}
            disabled={due + fresh === 0}
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[17px] font-bold text-accent active:opacity-90 disabled:opacity-60"
          >
            <Play size={20} fill="currentColor" /> {due + fresh === 0 ? 'На сегодня всё!' : 'Начать занятие'}
          </button>
        </div>
        <div className="flex items-center gap-4 px-5 py-3 text-[14px] text-muted">
          <span className="flex items-center gap-1.5"><Flame size={17} className={st ? 'text-copper' : ''} /> {st} {ruPlural(st, 'день', 'дня', 'дней')} подряд</span>
          <span>Сегодня: {today?.reviews ?? 0} карт. · {Math.round((today?.seconds ?? 0) / 60)} мин</span>
        </div>
      </div>

      {left === null && (
        <button onClick={() => push({ name: 'settings' })} className="card mt-3 flex w-full items-center gap-3 p-4 text-left active:opacity-80">
          <span className="text-2xl">📅</span>
          <span className="flex-1 text-[15px]">Укажите дату собеседования — интервалы подстроятся, чтобы всё повторилось вовремя</span>
          <ChevronRight size={18} className="text-muted" />
        </button>
      )}

      {/* Режимы */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Mode icon={<Mic size={22} />} tone="accent" title="Собеседование" desc="Вопросы на слух — отвечайте вслух" onClick={() => push({ name: 'sim' })} />
        <Mode icon={<Ear size={22} />} tone="copper" title="Узнай вопрос" desc="Понимание на слух" onClick={() => push({ name: 'listen' })} />
        <Mode icon={<LifeBuoy size={22} />} tone="ok" title="Фразы-спасатели" desc="«Повторите, пожалуйста»" onClick={() => push({ name: 'session', filter: { deckId: 'rescue' }, title: 'Фразы-спасатели' })} />
        <Mode icon={<ClipboardList size={22} />} tone="warn" title={`Анкета ${Math.round(fill * 100)}%`} desc={holes ? `${holes} пропусков в ответах` : 'Все ответы заполнены'} onClick={() => useNav.getState().tab('profile')} />
      </div>

      {/* Прогресс по темам */}
      <Section title="Темы собеседования" right={<button onClick={() => useNav.getState().tab('topics')} className="text-[14px] font-semibold text-accent">Все</button>}>
        <div className="card p-4">
          <div className="grid grid-cols-7 gap-2">
            {topics.map((t) => {
              const m = topicMastery(t, ctx, s, mastery)
              return (
                <button key={t.id} onClick={() => push({ name: 'topic', id: t.id })}
                  className={cx('relative flex aspect-square items-center justify-center overflow-hidden rounded-xl text-[14px] font-bold active:scale-95 transition',
                    m >= 0.8 ? 'text-white' : 'text-fg')}
                  style={{ background: `color-mix(in srgb, var(--ok) ${Math.round(m * 100)}%, var(--border))` }}
                  title={t.title}
                >
                  {t.num}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[12px] text-muted">
            <span className="h-3 w-3 rounded bg-line" /> не начато
            <span className="ml-2 h-3 w-3 rounded" style={{ background: 'color-mix(in srgb, var(--ok) 50%, var(--border))' }} /> учу
            <span className="ml-2 h-3 w-3 rounded bg-ok" /> выучено
          </div>
        </div>
      </Section>

      <Section title="Общий прогресс">
        <div className="card space-y-3 p-4">
          <ProgressRow label="Ответы на вопросы" cards={pools.qa.map((c) => c.id)} />
          <ProgressRow label="Фразы-спасатели" cards={pools.rescue.map((c) => c.id)} />
          <ProgressRow label="Слова" cards={pools.words.map((c) => c.id)} />
        </div>
      </Section>

      {!s.settings.onboarded && (
        <div className="card mt-5 space-y-2 p-4 text-[14px] leading-relaxed">
          <div className="text-[16px] font-bold">Как заниматься 👇</div>
          <p><b>1. Анкета.</b> Заполните её — приложение соберёт ваши личные ответы на греческом (с EN-подстраховкой).</p>
          <p><b>2. Каждый день — «Начать занятие».</b> Карточки с интервальным повторением: ответы на вопросы, фразы-спасатели, слова. Произносите ответ <b>вслух</b>, потом честно оценивайте.</p>
          <p><b>3. Раз в пару дней — «Собеседование».</b> Вопросы звучат в разных формулировках, как у экзаменатора.</p>
          <p><b>Забыли слово?</b> Скажите по-английски — это нормально. EN-версия есть у каждого ответа.</p>
          <Btn kind="soft" className="mt-1 w-full" onClick={() => s.setSettings({ onboarded: true })}>Понятно</Btn>
        </div>
      )}
      <div className="h-4" />
      <div className="text-center text-[12px] text-muted">
        <button onClick={() => push({ name: 'telegram' })} className="underline-offset-2 active:underline">Как открыть в Telegram и установить на телефон</button>
      </div>
    </Screen>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="text-[34px] font-bold leading-none">{n}</div>
      <div className="mt-1 text-[13px] opacity-85">{label}</div>
    </div>
  )
}

const TONES = {
  accent: 'bg-accent-soft text-accent',
  copper: 'bg-copper-soft text-copper',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
}

function Mode({ icon, title, desc, onClick, tone }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void; tone: keyof typeof TONES }) {
  return (
    <button onClick={onClick} className="card flex flex-col items-start gap-2 p-4 text-left transition active:scale-[0.98]">
      <span className={cx('flex h-10 w-10 items-center justify-center rounded-xl', TONES[tone])}>{icon}</span>
      <span className="text-[16px] font-bold leading-tight">{title}</span>
      <span className="text-[13px] leading-snug text-muted">{desc}</span>
    </button>
  )
}

function ProgressRow({ label, cards }: { label: string; cards: string[] }) {
  const all = useStore((s) => s.cards)
  const m = cards.length ? cards.reduce((a, id) => a + mastery(all[id]), 0) / cards.length : 0
  const learned = cards.filter((id) => (all[id]?.ivl ?? 0) >= 21).length
  const started = cards.filter((id) => (all[id]?.reps ?? 0) > 0).length
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[14px]">
        <span className="font-medium">{label}</span>
        <span className="text-muted">{started}/{cards.length} начато · {learned} выучено</span>
      </div>
      <Bar value={m} />
    </div>
  )
}

