import { useMemo, useState } from 'react'
import { ChevronRight, Search, AlertCircle, Play, Pencil, Plus, SlidersHorizontal, ChevronDown } from 'lucide-react'
import { useStore } from '../store'
import { useNav } from '../router'
import { answerOf, isActive, isOverridden, qaCardId, topicMastery, useCtx, useTopics } from '../content'
import { mastery, level } from '../lib/srs'
import type { QItem, Topic } from '../data/topics'
import { Screen, Ring, SpeakBtn, TriLine, Btn, Segmented, cx } from '../ui/kit'
import { countHoles, FieldsByKeys } from '../ui/fields'

export function TopicsList() {
  const s = useStore()
  const ctx = useCtx()
  const topics = useTopics()
  const push = useNav((n) => n.push)
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return topics
    return topics.filter((t) => t.title.toLowerCase().includes(needle) ||
      t.items.some((i) => i.title.toLowerCase().includes(needle) || i.questions(ctx).some((x) => x.gr.toLowerCase().includes(needle) || x.ru.toLowerCase().includes(needle))))
  }, [q, topics, ctx])

  return (
    <Screen title="Вопросы собеседования" subtitle={`${topics.length} тем · ${topics.reduce((a, t) => a + t.items.filter((i) => isActive(i, ctx)).length, 0)} вопросов`} back={false}>
      <div className="relative mt-1">
        <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск: «μισθός», «дети»…" className="!bg-card !pl-10" />
      </div>
      <div className="card mt-3 divide-y divide-line overflow-hidden">
        {filtered.map((t) => {
          const m = topicMastery(t, ctx, s, mastery)
          const active = t.items.filter((i) => isActive(i, ctx))
          const holes = active.reduce((n, i) => n + countHoles(answerOf(i, ctx, s.overrides)), 0)
          const off = s.settings.disabledDecks.includes(t.id)
          return (
            <button key={t.id} onClick={() => push({ name: 'topic', id: t.id })} className={cx('flex w-full items-center gap-3 px-4 py-3 text-left active:bg-accent-soft', off && 'opacity-50')}>
              <Ring value={m} size={40}><span className="text-[13px] font-bold">{t.num}</span></Ring>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-semibold">{t.emoji} {t.title}</div>
                <div className="flex items-center gap-2 text-[13px] text-muted">
                  <span>{active.length} {active.length === 1 ? 'вопрос' : active.length < 5 ? 'вопроса' : 'вопросов'}</span>
                  {holes > 0 && <span className="flex items-center gap-0.5 text-warn"><AlertCircle size={13} /> {holes} пропуск.</span>}
                  {off && <span>· выключена</span>}
                </div>
              </div>
              <ChevronRight size={18} className="text-muted" />
            </button>
          )
        })}
      </div>
    </Screen>
  )
}

type View = 'gr' | 'en' | 'all'

export function TopicDetail({ id }: { id: string }) {
  const topics = useTopics()
  const t = topics.find((x) => x.id === id)
  const push = useNav((n) => n.push)
  const disabled = useStore((s) => s.settings.disabledDecks.includes(id))
  const toggleDeck = useStore((s) => s.toggleDeck)
  const [view, setView] = useState<View>('en')
  const ctx = useCtx()
  if (!t) return <Screen title="Тема не найдена"><div /></Screen>

  const answers = t.items.filter((i) => isActive(i, ctx)).flatMap((i) => answerOf(i, ctx, useStore.getState().overrides).map((l) => l.gr))

  return (
    <Screen title={`${t.num}. ${t.title}`} subtitle={`${t.items.length} вопрос(ов) в теме`}
      right={<SpeakBtn texts={answers} speakKey={`topic:${t.id}`} />}>
      <div className="mt-1 flex gap-2">
        <Btn className="flex-1" onClick={() => push({ name: 'session', filter: { topicId: t.id }, title: `${t.num}. ${t.title}` })}><Play size={17} fill="currentColor" /> Учить тему</Btn>
        <Btn kind="soft" onClick={() => toggleDeck(t.id)}>{disabled ? 'Включить' : 'Выключить'}</Btn>
      </div>
      {disabled && <div className="mt-2 text-[13px] text-muted">Тема выключена из ежедневных занятий и симуляции.</div>}

      <div className="mt-4">
        <Segmented<View> value={view} onChange={setView} options={[{ value: 'gr', label: 'Только GR' }, { value: 'en', label: 'GR + EN' }, { value: 'all', label: 'GR + EN + RU' }]} />
      </div>

      <div className="mt-3 space-y-3">
        {t.items.map((item) => <ItemCard key={item.id} item={item} topic={t} view={view} />)}
      </div>

      <button onClick={() => push({ name: 'newItem', topicId: t.id })}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-[15px] font-semibold text-accent active:bg-accent-soft">
        <Plus size={18} /> Добавить свой вопрос в тему
      </button>
    </Screen>
  )
}

function ItemCard({ item, view }: { item: QItem; topic: Topic; view: View }) {
  const ctx = useCtx()
  const overrides = useStore((s) => s.overrides)
  const card = useStore((s) => s.cards[qaCardId(item.id)])
  const push = useNav((n) => n.push)
  const [fieldsOpen, setFieldsOpen] = useState(false)
  const active = isActive(item, ctx)
  const questions = item.questions(ctx)
  const answer = answerOf(item, ctx, overrides)
  const edited = isOverridden(item.id, overrides)
  const holes = countHoles(answer)
  const lv = level(card)

  return (
    <div className={cx('card p-4', !active && 'opacity-55')}>
      <div className="flex items-center gap-2">
        <div className="flex-1 text-[13px] font-semibold uppercase tracking-wide text-muted">{item.title}</div>
        <LevelBadge lv={lv} />
      </div>
      {!active && <div className="mt-1 text-[13px] text-muted">Сейчас не относится к вам (по анкете) — не попадёт в тренировки.</div>}

      <div className="mt-2 space-y-1.5">
        {questions.map((q, i) => (
          <div key={i} className="flex items-start gap-1">
            <div className="flex-1">
              <div className="gr text-[16px] font-semibold text-accent">{q.gr}</div>
              {view === 'all' && <div className="text-[13px] text-muted">{q.ru}</div>}
            </div>
            <SpeakBtn text={q.gr} size={18} speakKey={`${item.id}:q${i}`} />
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-2xl bg-bg p-3">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="flex-1 text-[12px] font-semibold uppercase tracking-wide text-muted">
            Мой ответ {edited && <span className="ml-1 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] text-accent normal-case">изменён</span>}
          </span>
          <SpeakBtn texts={answer.map((l) => l.gr)} size={18} speakKey={`${item.id}:ans`} />
        </div>
        {answer.map((l, i) => <TriLine key={i} line={l} idx={i} showEn={view !== 'gr'} showRu={view === 'all'} speakPrefix={`${item.id}:ans`} />)}
        {holes > 0 && (
          <div className="mt-1 flex items-center gap-1.5 text-[13px] text-warn"><AlertCircle size={14} /> Заполните данные ниже — пропуски подставятся автоматически</div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <button onClick={() => push({ name: 'edit', id: item.id })} className="flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-accent active:bg-accent-soft">
          <Pencil size={15} /> {item.id.startsWith('c-') ? 'Редактировать' : 'Изменить ответ'}
        </button>
        {item.fields && item.fields.length > 0 && !edited && (
          <button onClick={() => setFieldsOpen(!fieldsOpen)} className={cx('flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold active:bg-accent-soft', holes ? 'text-warn' : 'text-muted')}>
            <SlidersHorizontal size={15} /> Данные анкеты <ChevronDown size={15} className={cx('transition', fieldsOpen && 'rotate-180')} />
          </button>
        )}
      </div>
      {fieldsOpen && item.fields && <div className="mt-1 border-t border-line fade-in"><FieldsByKeys keys={item.fields} /></div>}
    </div>
  )
}

export function LevelBadge({ lv }: { lv: ReturnType<typeof level> }) {
  const map = {
    new: ['новый', 'bg-line/70 text-muted'],
    learning: ['учу', 'bg-warn-soft text-warn'],
    young: ['повторяю', 'bg-accent-soft text-accent'],
    mature: ['выучен', 'bg-ok-soft text-ok'],
  } as const
  const [label, cls] = map[lv]
  return <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold', cls)}>{label}</span>
}

