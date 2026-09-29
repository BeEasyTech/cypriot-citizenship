import { useState } from 'react'
import { Plus, Trash2, RotateCcw } from 'lucide-react'
import { useStore, type CustomItem } from '../store'
import { useNav } from '../router'
import { answerOf, isCustomId, isOverridden, useCtx, useItemIndex, useTopics } from '../content'
import { Screen, Btn, Section, SpeakBtn } from '../ui/kit'
import type { Tri } from '../types'

const blank = (): Tri => ({ gr: '', en: '', ru: '' })
const cleanLines = (xs: Tri[]) => xs.map((l) => ({ gr: l.gr.trim(), en: l.en.trim(), ru: l.ru.trim() })).filter((l) => l.gr || l.en || l.ru)

export function EditItem({ id }: { id: string }) {
  const { items } = useItemIndex()
  const item = items[id]
  if (!item) return <Screen title="Вопрос не найден"><div /></Screen>
  return isCustomId(id) ? <CustomEditor existing={useStore.getState().customItems.find((c) => c.id === id)} /> : <OverrideEditor id={id} />
}

export function NewItem({ topicId }: { topicId: string }) {
  return <CustomEditor topicId={topicId} />
}

/* ------------------------------------------------ правка шаблонного ответа */

function OverrideEditor({ id }: { id: string }) {
  const { items } = useItemIndex()
  const item = items[id]
  const ctx = useCtx()
  const overrides = useStore((s) => s.overrides)
  const setOverride = useStore((s) => s.setOverride)
  const back = useNav((n) => n.back)
  const [lines, setLines] = useState<Tri[]>(() => answerOf(item, ctx, overrides).map((l) => ({ ...l })))
  const edited = isOverridden(id, overrides)

  return (
    <Screen title="Изменить ответ" subtitle={item.title}>
      <div className="mt-1 rounded-2xl bg-warn-soft p-3 text-[14px] text-warn">
        Отредактированный ответ больше не обновляется из анкеты. Вернуть шаблон можно в любой момент.
      </div>
      <Section title="Вопрос">
        <div className="card p-4">
          {item.questions(ctx).map((q, i) => <div key={i} className="gr text-[16px] font-semibold text-accent">{q.gr}</div>)}
        </div>
      </Section>
      <LinesEditor lines={lines} setLines={setLines} />
      <div className="mt-6 space-y-3">
        <Btn big className="w-full" onClick={() => { const c = cleanLines(lines); setOverride(id, c.length ? c : null); back() }}>Сохранить</Btn>
        {edited && (
          <Btn kind="soft" className="w-full" onClick={() => { setOverride(id, null); back() }}><RotateCcw size={16} /> Вернуть шаблон из анкеты</Btn>
        )}
      </div>
    </Screen>
  )
}

/* ------------------------------------------------ свой вопрос */

function CustomEditor({ existing, topicId }: { existing?: CustomItem; topicId?: string }) {
  const topics = useTopics()
  const upsert = useStore((s) => s.upsertCustomItem)
  const del = useStore((s) => s.deleteCustomItem)
  const back = useNav((n) => n.back)
  const [tid, setTid] = useState(existing?.topicId ?? topicId ?? 't28')
  const [title, setTitle] = useState(existing?.title ?? '')
  const [questions, setQuestions] = useState<Tri[]>(existing?.questions.map((q) => ({ ...q })) ?? [blank()])
  const [answer, setAnswer] = useState<Tri[]>(existing?.answer.map((q) => ({ ...q })) ?? [blank()])

  const qs = cleanLines(questions).filter((q) => q.gr)
  const ans = cleanLines(answer)
  const valid = qs.length > 0 && ans.length > 0

  const save = () => {
    upsert({
      id: existing?.id ?? `c-${Date.now().toString(36)}`,
      topicId: tid,
      title: title.trim() || qs[0].ru || qs[0].gr,
      questions: qs.map((q) => ({ gr: q.gr, en: q.en || q.gr, ru: q.ru || q.en || q.gr })),
      answer: ans.map((a) => ({ gr: a.gr, en: a.en, ru: a.ru })),
      updated: Date.now(),
    })
    back()
  }

  return (
    <Screen title={existing ? 'Мой вопрос' : 'Новый вопрос'} subtitle="Вопрос экзаменатора и ваш ответ">
      <Section title="Тема">
        <select value={tid} onChange={(e) => setTid(e.target.value)} className="!bg-card">
          {topics.map((t) => <option key={t.id} value={t.id}>{t.num}. {t.title}</option>)}
        </select>
      </Section>
      <Section title="Короткое название (по-русски)">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Почему именно Лимассол?" className="!bg-card" />
      </Section>
      <Section title="Формулировки вопроса">
        <div className="space-y-2">
          {questions.map((q, i) => (
            <div key={i} className="card space-y-2 p-3">
              <div className="flex gap-2">
                <input lang="el" value={q.gr} placeholder="Γιατί μένετε στη Λεμεσό;" onChange={(e) => setQuestions(questions.map((x, j) => j === i ? { ...x, gr: e.target.value } : x))} />
                <SpeakBtn text={q.gr} />
                {questions.length > 1 && (
                  <button onClick={() => setQuestions(questions.filter((_, j) => j !== i))} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-bad active:bg-bad-soft"><Trash2 size={17} /></button>
                )}
              </div>
              <input value={q.ru} placeholder="Перевод на русский" onChange={(e) => setQuestions(questions.map((x, j) => j === i ? { ...x, ru: e.target.value } : x))} />
            </div>
          ))}
          <button onClick={() => setQuestions([...questions, blank()])} className="flex min-h-10 items-center gap-1.5 px-2 text-[14px] font-semibold text-accent"><Plus size={16} /> Ещё формулировка</button>
        </div>
      </Section>
      <LinesEditor lines={answer} setLines={setAnswer} />
      <div className="mt-6 space-y-3">
        <Btn big className="w-full" disabled={!valid} onClick={save}>Сохранить</Btn>
        {existing && <Btn kind="bad" className="w-full" onClick={() => { if (confirm('Удалить этот вопрос?')) { del(existing.id); back() } }}><Trash2 size={16} /> Удалить вопрос</Btn>}
      </div>
    </Screen>
  )
}

/* ------------------------------------------------ редактор строк ответа */

function LinesEditor({ lines, setLines }: { lines: Tri[]; setLines: (x: Tri[]) => void }) {
  const upd = (i: number, patch: Partial<Tri>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  return (
    <Section title="Ответ по предложениям">
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="card space-y-2 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-muted">Предложение {i + 1}</span>
              <div className="flex items-center">
                <SpeakBtn text={l.gr} size={18} />
                {lines.length > 1 && (
                  <button onClick={() => setLines(lines.filter((_, j) => j !== i))} className="flex h-9 w-9 items-center justify-center rounded-full text-bad active:bg-bad-soft" aria-label="Удалить"><Trash2 size={16} /></button>
                )}
              </div>
            </div>
            <textarea lang="el" rows={2} value={l.gr} placeholder="По-гречески" onChange={(e) => upd(i, { gr: e.target.value })} className="gr !text-[17px]" />
            <input value={l.en} placeholder="English (запасной вариант)" onChange={(e) => upd(i, { en: e.target.value })} />
            <input value={l.ru} placeholder="Перевод на русский" onChange={(e) => upd(i, { ru: e.target.value })} />
          </div>
        ))}
        <button onClick={() => setLines([...lines, blank()])} className="flex min-h-10 items-center gap-1.5 px-2 text-[14px] font-semibold text-accent"><Plus size={16} /> Добавить предложение</button>
      </div>
    </Section>
  )
}
