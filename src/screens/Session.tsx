import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Eye, Turtle, Languages, AlertCircle } from 'lucide-react'
import { countHoles, FieldsByKeys } from '../ui/fields'
import { useStore } from '../store'
import { useNav } from '../router'
import {
  allCards, answerOf, buildQueue, maxIvlFor, useCtx, useDecks, useTopics, vocabGr, type CardRef, type SessionFilter,
} from '../content'
import { previewLabel, type Rating, DAY } from '../lib/srs'
import { speak, speakAll, stop } from '../lib/tts'
import { haptic } from '../lib/telegram'
import { Btn, SpeakBtn, TriLine, cx, useTtsOpts, Bar } from '../ui/kit'
import type { Tri } from '../types'

const pickRandom = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

export default function Session({ filter, title }: { filter?: SessionFilter; title?: string }) {
  const store = useStore()
  const ctx = useCtx()
  const topics = useTopics()
  const decks = useDecks()
  const back = useNav((n) => n.back)

  // Очередь собираем один раз при входе.
  const initial = useMemo(() => buildQueue(allCards(topics, decks, ctx, useStore.getState()), useStore.getState(), filter), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [queue, setQueue] = useState<CardRef[]>(initial.queue)
  // Прогресс: сколько уникальных карточек уже «закрыто» (ушли из сессии).
  const [done, setDone] = useState(0)
  const [seen, setSeen] = useState<Set<string>>(() => new Set())
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState<Rating[]>([])
  const started = useRef(Date.now())
  const maxIvl = maxIvlFor(store)

  const card = queue[0]
  const total = initial.queue.length
  const progress = total ? (done + seen.size) / (2 * total) : 0

  // Учёт времени занятия
  useEffect(() => () => {
    const sec = Math.round((Date.now() - started.current) / 1000)
    if (sec > 5) useStore.getState().addSeconds(Math.min(sec, 3 * 3600))
    stop()
  }, [])

  const rate = useCallback((r: Rating) => {
    if (!card) return
    const st = useStore.getState()
    const isNew = !st.cards[card.id] || st.cards[card.id].reps === 0
    st.rate(card.id, r, isNew, maxIvl)
    r === 1 ? haptic.bad() : haptic.ok()
    stop()
    const next = useStore.getState().cards[card.id]
    const rest = queue.slice(1)
    // Если карточка снова «созреет» в ближайшие 20 минут — вернём её в эту же сессию.
    if (next.due - Date.now() < 20 * 60_000) {
      const pos = Math.min(rest.length, r === 1 ? 3 : 6)
      rest.splice(pos, 0, card)
    } else setDone((d) => d + 1)
    setSeen((x) => new Set(x).add(card.id))
    setResults((x) => [...x, r])
    setQueue(rest)
    setFlipped(false)
  }, [card, queue, maxIvl])

  // Клавиатура на десктопе: пробел — показать, 1–4 — оценка.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return
      if (!flipped && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setFlipped(true) }
      else if (flipped && ['1', '2', '3', '4'].includes(e.key)) rate(Number(e.key) as Rating)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [flipped, rate])

  if (!card) return <Done results={results} onClose={back} empty={initial.queue.length === 0} />

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <div className="safe-top sticky top-0 z-10 bg-bg/90 px-4 pt-3 pb-2 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={back} className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-accent-soft" aria-label="Закрыть"><X size={24} /></button>
          <Bar value={progress} className="flex-1" color="bg-accent" />
          <span className="min-w-12 text-right text-[14px] font-semibold tabular-nums text-muted" title="осталось карточек">{new Set(queue.map((c) => c.id)).size}</span>
        </div>
        {title && <div className="mt-1 text-center text-[13px] text-muted">{title}</div>}
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4">
        {card.kind === 'qa'
          ? <QaCard key={results.length} card={card} flipped={flipped} onFlip={() => setFlipped(true)} />
          : <VocabCard key={results.length} card={card} flipped={flipped} onFlip={() => setFlipped(true)} gr={vocabGr(card.v, ctx)} />}
      </div>

      <div className="safe-bottom sticky bottom-0 bg-bg/95 px-4 pt-2 backdrop-blur-md">
        {!flipped ? (
          <Btn big className="w-full" onClick={() => setFlipped(true)}>Показать ответ</Btn>
        ) : (
          <RatingBar card={card} onRate={rate} maxIvl={maxIvl} />
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------ карточка «вопрос → мой ответ» */

function QaCard({ card, flipped, onFlip }: { card: Extract<CardRef, { kind: 'qa' }>; flipped: boolean; onFlip: () => void }) {
  const ctx = useCtx()
  const overrides = useStore((s) => s.overrides)
  const autoplay = useStore((s) => s.settings.autoplay)
  const showEnDefault = useStore((s) => s.settings.showEn)
  const showRuDefault = useStore((s) => s.settings.showRu)
  const o = useTtsOpts()
  const questions = useMemo(() => card.item.questions(ctx), [card, ctx])
  const [q] = useState<Tri>(() => pickRandom(questions))
  const [qTr, setQTr] = useState(false)
  const [showEn, setShowEn] = useState(showEnDefault)
  const [showRu, setShowRu] = useState(showRuDefault)
  const [fill, setFill] = useState(false)
  const answer = useMemo(() => answerOf(card.item, ctx, overrides), [card, ctx, overrides])
  const isNew = !useStore.getState().cards[card.id]?.reps

  useEffect(() => { if (autoplay) speak(q.gr, { ...o, key: 'q' }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (flipped && autoplay) speakAll(answer.map((l) => l.gr), { ...o, keyPrefix: 'ans' }) }, [flipped]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flip-in mt-2 flex flex-1 flex-col">
      <div className="mb-2 flex items-center gap-2 text-[13px] text-muted">
        <span className="rounded-full bg-accent-soft px-2.5 py-0.5 font-semibold text-accent">Вопрос · {card.topic.num}. {card.topic.title}</span>
        {isNew && <span className="rounded-full bg-copper-soft px-2.5 py-0.5 font-semibold text-copper">новый</span>}
      </div>

      <div className="card p-5">
        <div className="flex items-start gap-2">
          <button onClick={() => speak(q.gr, { ...o, key: 'q' })} className="gr flex-1 text-left text-[24px] font-semibold leading-snug">{q.gr}</button>
          <SpeakBtn text={q.gr} speakKey="q" />
        </div>
        <div className="mt-2 flex items-center gap-1">
          <SpeakBtn text={q.gr} slow speakKey="q-slow" size={18} label={<><Turtle size={16} /> медленно</>} className="!bg-transparent !px-2 text-muted" />
          <button onClick={() => setQTr(!qTr)} className="flex min-h-9 items-center gap-1.5 rounded-full px-2 text-[14px] font-semibold text-muted active:bg-accent-soft">
            <Languages size={16} /> перевод
          </button>
        </div>
        {qTr && <div className="mt-1 text-[15px] text-muted">{q.ru}</div>}
      </div>

      {!flipped ? (
        <button onClick={onFlip} className="mt-4 flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line p-6 text-center text-muted active:bg-accent-soft">
          <Eye size={28} />
          <div className="text-[16px] font-medium">Ответьте вслух по-гречески</div>
          <div className="text-[14px]">Не получается — скажите по-английски.<br />Потом откройте эталон и сверьтесь.</div>
        </button>
      ) : (
        <div className="card mt-3 p-5 fade-in">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-muted">Мой ответ</span>
            <div className="flex items-center gap-1">
              <LangToggle on={showEn} set={setShowEn}>EN</LangToggle>
              <LangToggle on={showRu} set={setShowRu}>RU</LangToggle>
              <SpeakBtn texts={answer.map((l) => l.gr)} speakKey="ans" />
            </div>
          </div>
          {answer.map((l, i) => <TriLine key={i} line={l} idx={i} showEn={showEn} showRu={showRu} big />)}
          {countHoles(answer) > 0 && card.item.fields && (
            <div className="mt-2 border-t border-line pt-2">
              <button onClick={() => setFill(!fill)} className="flex min-h-9 items-center gap-1.5 text-[14px] font-semibold text-warn">
                <AlertCircle size={15} /> {fill ? 'Скрыть' : 'Заполнить пропуски прямо здесь'}
              </button>
              {fill && <FieldsByKeys keys={card.item.fields} />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LangToggle({ on, set, children }: { on: boolean; set: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <button onClick={() => { haptic.select(); set(!on) }}
      className={cx('min-h-8 rounded-full px-2.5 text-[12px] font-bold transition', on ? 'bg-copper text-white' : 'bg-line/70 text-muted')}>
      {children}
    </button>
  )
}

/* ------------------------------------------------ карточка слова/фразы */

function VocabCard({ card, flipped, onFlip, gr }: { card: Extract<CardRef, { kind: 'vr' | 'vp' }>; flipped: boolean; onFlip: () => void; gr: string }) {
  const autoplay = useStore((s) => s.settings.autoplay)
  const o = useTtsOpts()
  const v = card.v
  const recog = card.kind === 'vr'

  useEffect(() => { if (recog && autoplay) speak(gr, { ...o, key: 'w' }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (flipped && !recog && autoplay) speak(gr, { ...o, key: 'w' }) }, [flipped]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flip-in mt-2 flex flex-1 flex-col">
      <div className="mb-2 flex items-center gap-2 text-[13px]">
        <span className={cx('rounded-full px-2.5 py-0.5 font-semibold', card.deck.id === 'rescue' ? 'bg-ok-soft text-ok' : 'bg-line/70 text-muted')}>
          {card.deck.emoji} {card.deck.titleRu}
        </span>
        <span className="text-muted">{recog ? 'что значит?' : 'как сказать по-гречески?'}</span>
      </div>

      <div role="button" tabIndex={0} onClick={flipped ? undefined : onFlip} className={cx('card flex flex-1 flex-col items-center justify-center p-6 text-center', !flipped && 'cursor-pointer')}>
        {recog ? (
          <div className="flex items-center gap-2">
            <span className="gr text-[28px] font-semibold leading-snug">{gr}</span>
            <SpeakBtn text={gr} speakKey="w" />
          </div>
        ) : (
          <div className="text-[24px] font-semibold leading-snug">{v.ru}</div>
        )}

        {flipped && (
          <div className="mt-5 w-full border-t border-line pt-5 fade-in">
            {recog ? (
              <div className="text-[22px] font-medium">{v.ru}</div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <span className="gr text-[26px] font-semibold text-accent">{gr}</span>
                <SpeakBtn text={gr} speakKey="w" />
              </div>
            )}
            <div className="mt-3 inline-flex items-center gap-1.5 text-[16px] text-copper">
              <span className="rounded bg-copper-soft px-1 text-[10px] font-bold">EN</span> {v.en}
            </div>
            {v.grF && v.grF !== gr && <div className="mt-2 text-[14px] text-muted">Другой род: <span className="gr">{gr === v.gr ? v.grF : v.gr}</span></div>}
            {v.note && <div className="mt-3 rounded-xl bg-bg px-3 py-2 text-[14px] text-muted">{v.note}</div>}
          </div>
        )}
        {!flipped && !recog && <div className="mt-4 text-[14px] text-muted">Скажите вслух. Забыли — по-английски.</div>}
      </div>
    </div>
  )
}

/* ------------------------------------------------ оценка */

function RatingBar({ card, onRate, maxIvl }: { card: CardRef; onRate: (r: Rating) => void; maxIvl: number }) {
  const cs = useStore((s) => s.cards[card.id])
  const btns: { r: Rating; label: string; cls: string }[] = [
    { r: 1, label: 'Снова', cls: 'bg-bad-soft text-bad' },
    { r: 2, label: 'Трудно', cls: 'bg-warn-soft text-warn' },
    { r: 3, label: 'Хорошо', cls: 'bg-ok-soft text-ok' },
    { r: 4, label: 'Легко', cls: 'bg-accent-soft text-accent' },
  ]
  return (
    <div className="grid grid-cols-4 gap-2">
      {btns.map((b) => (
        <button key={b.r} onClick={() => onRate(b.r)} className={cx('flex min-h-14 flex-col items-center justify-center rounded-2xl font-semibold active:opacity-75', b.cls)}>
          <span className="text-[15px]">{b.label}</span>
          <span className="text-[11px] font-medium opacity-75">{previewLabel(cs, b.r, maxIvl)}</span>
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------ финиш */

function Done({ results, onClose, empty }: { results: Rating[]; onClose: () => void; empty: boolean }) {
  const push = useNav((n) => n.push)
  const replace = useNav((n) => n.replace)
  const good = results.filter((r) => r >= 3).length
  const tomorrow = useStore((s) => Object.values(s.cards).filter((c) => c.reps > 0 && c.due < Date.now() + DAY).length)
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 text-center fade-in">
      <div className="text-6xl">{empty ? '🌿' : '🎉'}</div>
      <h1 className="mt-4 text-[26px] font-bold">{empty ? 'Здесь пока нечего повторять' : 'Μπράβο! Занятие окончено'}</h1>
      {!empty && (
        <p className="mt-2 text-[16px] text-muted">
          Ответов: {results.length}, из них уверенно — {good}.<br />
          К повторению в ближайшие сутки: {tomorrow}.
        </p>
      )}
      {empty && <p className="mt-2 text-[16px] text-muted">Новые карточки на сегодня закончились, а повторять ещё рано. Проверьте себя в симуляции собеседования.</p>}
      <div className="mt-8 w-full space-y-3">
        <Btn big className="w-full" onClick={() => replace({ name: 'sim' })}>🎙 Симуляция собеседования</Btn>
        <Btn big kind="soft" className="w-full" onClick={() => { onClose(); setTimeout(() => push({ name: 'listen' }), 50) }}>👂 Узнай вопрос на слух</Btn>
        <Btn kind="ghost" className="w-full" onClick={onClose}>На главную</Btn>
      </div>
    </div>
  )
}
