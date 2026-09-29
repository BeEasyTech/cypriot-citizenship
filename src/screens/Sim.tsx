import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Timer, RotateCcw } from 'lucide-react'
import { useStore } from '../store'
import { useNav } from '../router'
import { answerOf, isActive, maxIvlFor, qaCardId, useCtx, useItemIndex } from '../content'
import type { QItem } from '../data/topics'
import { speak, stop } from '../lib/tts'
import { haptic } from '../lib/telegram'
import { Btn, Chip, Screen, Section, Toggle, TriLine, SpeakBtn, cx, useTtsOpts, Bar } from '../ui/kit'
import type { Tri } from '../types'

type Score = 1 | 2 | 3
interface Step { item: QItem; q: Tri }

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

export default function Sim() {
  const [steps, setSteps] = useState<Step[] | null>(null)
  const [scores, setScores] = useState<Record<number, Score>>({})
  const [i, setI] = useState(0)
  const started = useRef(Date.now())

  useEffect(() => () => {
    const sec = Math.round((Date.now() - started.current) / 1000)
    if (sec > 5) useStore.getState().addSeconds(Math.min(sec, 3 * 3600))
    stop()
  }, [])

  if (!steps) return <Setup onStart={(s) => { setSteps(s); setI(0); setScores({}) }} />
  if (i >= steps.length) return <Summary steps={steps} scores={scores} onRetry={(s) => { setSteps(s); setI(0); setScores({}) }} />
  return (
    <Question key={i} step={steps[i]} n={i} total={steps.length}
      onScore={(sc) => { setScores((x) => ({ ...x, [i]: sc })); setI(i + 1) }} />
  )
}

/* ------------------------------------------------ настройка */

function Setup({ onStart }: { onStart: (s: Step[]) => void }) {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const ctx = useCtx()
  const { all } = useItemIndex()
  const itemStats = useStore((s) => s.itemStats)
  const cards = useStore((s) => s.cards)
  const [mode, setMode] = useState<'real' | 'weak' | 'random'>('real')

  const active = useMemo(() => all.filter((it) => isActive(it, ctx)), [all, ctx])

  const start = () => {
    const weight = (it: QItem) => {
      const st = itemStats[it.id]
      const avg = st?.sim.length ? st.sim.reduce((a, b) => a + b, 0) / st.sim.length : 2
      const ivl = cards[qaCardId(it.id)]?.ivl ?? 0
      return mode === 'weak' ? (3.2 - avg) * 3 + (ivl < 7 ? 2 : 0) : mode === 'random' ? 1 : 1 + (3 - avg) + (ivl < 7 ? 1 : 0)
    }
    const n = settings.simCount >= 99 ? active.length : Math.min(settings.simCount, active.length)
    const pool = [...active]
    const chosen: QItem[] = []
    // Как на реальном собеседовании: начинают с приветствия и имени.
    if (mode === 'real') {
      for (const id of ['x-how', 'q01-name']) {
        const k = pool.findIndex((x) => x.id === id)
        if (k >= 0 && chosen.length < n) chosen.push(...pool.splice(k, 1))
      }
    }
    while (chosen.length < n && pool.length) {
      const total = pool.reduce((a, x) => a + weight(x), 0)
      let r = Math.random() * total
      let k = 0
      for (; k < pool.length - 1; k++) { r -= weight(pool[k]); if (r <= 0) break }
      chosen.push(...pool.splice(k, 1))
    }
    onStart(chosen.map((item) => ({ item, q: pick(item.questions(ctx)) })))
  }

  return (
    <Screen title="Симуляция собеседования" subtitle="Вопросы звучат по-гречески, вы отвечаете вслух">
      <div className="card mt-2 space-y-3 p-5 text-[15px] leading-relaxed">
        <p>🎧 Вопрос прозвучит <b>без текста</b> — как у экзаменатора, в случайной формулировке.</p>
        <p>🗣 Отвечайте <b>вслух</b>. Если не поняли, нажмите кнопку с греческой фразой — и <b>произнесите её</b>: так вы тренируете и фразы-спасатели.</p>
        <p>✅ Потом сверьтесь с эталоном и честно оцените себя. Слабые вопросы чаще попадут в тренировку.</p>
      </div>

      <Section title="Вопросы">
        <div className="card space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            {[5, 10, 15, 20, 99].map((n) => (
              <Chip key={n} on={settings.simCount === n} onClick={() => setSettings({ simCount: n })}>{n === 99 ? `Все (${active.length})` : n}</Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip on={mode === 'real'} onClick={() => setMode('real')}>Как на экзамене</Chip>
            <Chip on={mode === 'weak'} onClick={() => setMode('weak')}>Слабые места</Chip>
            <Chip on={mode === 'random'} onClick={() => setMode('random')}>Случайно</Chip>
          </div>
        </div>
      </Section>

      <Section title="Условия">
        <div className="card space-y-4 p-4">
          <div>
            <div className="mb-2 text-[14px] font-medium">Время на ответ</div>
            <div className="flex flex-wrap gap-2">
              {[0, 30, 60, 90].map((t) => <Chip key={t} on={settings.simTimer === t} onClick={() => setSettings({ simTimer: t })}>{t ? `${t} сек` : 'без таймера'}</Chip>)}
            </div>
          </div>
          <Toggle on={settings.simShowText} onChange={(v) => setSettings({ simShowText: v })} label="Сразу показывать текст вопроса" />
        </div>
      </Section>

      <Btn big className="mt-6 w-full" onClick={start} disabled={!active.length}>🎙 Начать</Btn>
    </Screen>
  )
}

/* ------------------------------------------------ вопрос */

function Question({ step, n, total, onScore }: { step: Step; n: number; total: number; onScore: (s: Score) => void }) {
  const ctx = useCtx()
  const overrides = useStore((s) => s.overrides)
  const settings = useStore((s) => s.settings)
  const back = useNav((x) => x.back)
  const o = useTtsOpts()
  const [showText, setShowText] = useState(settings.simShowText)
  const [showTr, setShowTr] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [showEn, setShowEn] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [asked, setAsked] = useState(0)
  const answer = useMemo(() => answerOf(step.item, ctx, overrides), [step, ctx, overrides])

  const play = (slow = false) => {
    setAsked((a) => a + 1)
    speak(step.q.gr, { ...o, rate: slow ? Math.max(0.5, o.rate * 0.7) : o.rate, key: 'simq' })
  }

  useEffect(() => { const t = setTimeout(() => play(), 350); return () => clearTimeout(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (revealed) return
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [revealed])

  const limit = settings.simTimer
  const over = limit > 0 && elapsed >= limit

  const score = (sc: Score) => {
    const st = useStore.getState()
    st.logSim(step.item.id, sc)
    st.rate(qaCardId(step.item.id), sc, false, maxIvlFor(st))
    sc === 1 ? haptic.bad() : haptic.ok()
    stop()
    onScore(sc)
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <div className="safe-top sticky top-0 z-10 bg-bg/90 px-4 pt-3 pb-2 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={back} className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-accent-soft" aria-label="Закрыть"><X size={24} /></button>
          <Bar value={n / total} className="flex-1" color="bg-accent" />
          <span className="text-[14px] font-semibold tabular-nums text-muted">{n + 1}/{total}</span>
        </div>
      </div>

      <div className="flex-1 px-4 pb-6">
        {/* экзаменатор */}
        <div className="card mt-2 flex flex-col items-center p-6 text-center">
          <button onClick={() => play()} className="relative flex h-24 w-24 items-center justify-center rounded-full bg-accent-soft text-5xl active:scale-95 transition">
            🧑‍💼
          </button>
          <div className="mt-3 text-[13px] font-semibold uppercase tracking-wide text-muted">Экзаменатор спрашивает</div>
          {showText ? (
            <div className="gr mt-2 text-[22px] font-semibold leading-snug fade-in">{step.q.gr}</div>
          ) : !revealed ? (
            <div className="mt-2 text-[15px] text-muted">Слушайте внимательно…</div>
          ) : null}
          {showTr && <div className="mt-1 text-[15px] text-muted fade-in">{step.q.ru}</div>}
          {!revealed && limit > 0 && (
            <div className={cx('mt-3 flex items-center gap-1.5 text-[15px] font-semibold tabular-nums', over ? 'text-bad' : 'text-muted')}>
              <Timer size={16} /> {Math.max(0, limit - elapsed)} сек
            </div>
          )}
        </div>

        {/* фразы-спасатели как кнопки */}
        {!revealed && (
          <div className="mt-4 space-y-2">
            <div className="px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Не расслышали? Скажите и нажмите:</div>
            <RescueBtn gr="Μπορείτε να επαναλάβετε, παρακαλώ;" ru="Повторите, пожалуйста" onClick={() => play()} />
            <RescueBtn gr="Πιο αργά, παρακαλώ." ru="Медленнее, пожалуйста" onClick={() => play(true)} />
            <RescueBtn gr="Συγγνώμη, δεν κατάλαβα την ερώτηση." ru="Не понял(а) вопрос — показать текст" onClick={() => { if (showText) setShowTr(true); setShowText(true); play(true) }} />
            {asked > 2 && !showTr && (
              <button onClick={() => setShowTr(true)} className="w-full py-2 text-[14px] font-semibold text-muted">Показать перевод вопроса</button>
            )}
          </div>
        )}

        {revealed && (
          <div className="mt-4 fade-in">
            {!showText && (
              <div className="card mb-3 p-4">
                <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">Вопрос был</div>
                <div className="mt-1 flex items-start gap-2">
                  <div className="gr flex-1 text-[18px] font-medium">{step.q.gr}</div>
                  <SpeakBtn text={step.q.gr} speakKey="simq" />
                </div>
                <div className="text-[14px] text-muted">{step.q.ru}</div>
              </div>
            )}
            <div className="card p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[13px] font-semibold uppercase tracking-wide text-muted">Эталон</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowEn(!showEn)} className={cx('min-h-8 rounded-full px-2.5 text-[12px] font-bold', showEn ? 'bg-copper text-white' : 'bg-line/70 text-muted')}>EN</button>
                  <SpeakBtn texts={answer.map((l) => l.gr)} speakKey="simans" />
                </div>
              </div>
              {answer.map((l, k) => <TriLine key={k} line={l} idx={k} showEn={showEn} speakPrefix="simans" />)}
            </div>
          </div>
        )}
      </div>

      <div className="safe-bottom sticky bottom-0 bg-bg/95 px-4 pt-2 backdrop-blur-md">
        {!revealed ? (
          <Btn big className="w-full" onClick={() => { stop(); setRevealed(true) }}>Я ответил(а) — сверить</Btn>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => score(1)} className="min-h-14 rounded-2xl bg-bad-soft text-[15px] font-semibold text-bad active:opacity-75">✗ Не смог(ла)</button>
            <button onClick={() => score(2)} className="min-h-14 rounded-2xl bg-warn-soft text-[15px] font-semibold text-warn active:opacity-75">〜 С трудом</button>
            <button onClick={() => score(3)} className="min-h-14 rounded-2xl bg-ok-soft text-[15px] font-semibold text-ok active:opacity-75">✓ Уверенно</button>
          </div>
        )}
      </div>
    </div>
  )
}

function RescueBtn({ gr, ru, onClick }: { gr: string; ru: string; onClick: () => void }) {
  return (
    <button onClick={() => { haptic.tap(); onClick() }} className="card flex w-full items-center gap-3 px-4 py-3 text-left active:opacity-75">
      <span className="text-xl">🛟</span>
      <span className="flex-1">
        <span className="gr block text-[16px] font-semibold">{gr}</span>
        <span className="block text-[13px] text-muted">{ru}</span>
      </span>
    </button>
  )
}

/* ------------------------------------------------ итоги */

function Summary({ steps, scores, onRetry }: { steps: Step[]; scores: Record<number, Score>; onRetry: (s: Step[]) => void }) {
  const back = useNav((x) => x.back)
  const push = useNav((x) => x.push)
  const ctx = useCtx()
  const { topicOf } = useItemIndex()
  const vals = Object.values(scores)
  const pct = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) - vals.length) / (2 * vals.length) * 100) : 0
  const weak = steps.filter((_, k) => (scores[k] ?? 1) < 3)
  const verdict = pct >= 85 ? 'Отлично! Вы готовы 💪' : pct >= 60 ? 'Хорошо, но есть над чем поработать' : 'Нужно ещё потренироваться'

  return (
    <Screen title="Итоги собеседования" subtitle={verdict}>
      <div className="card mt-2 flex items-center gap-4 p-5">
        <div className="text-[44px] font-bold text-accent">{pct}%</div>
        <div className="text-[15px] text-muted">
          Уверенно: {vals.filter((v) => v === 3).length}<br />
          С запинками: {vals.filter((v) => v === 2).length}<br />
          Не смог(ла): {vals.filter((v) => v === 1).length}
        </div>
      </div>

      <Section title="Вопросы">
        <div className="card divide-y divide-line overflow-hidden">
          {steps.map((st, k) => (
            <button key={k} onClick={() => push({ name: 'topic', id: topicOf[st.item.id]?.id ?? 't01' })} className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-accent-soft">
              <span className="mt-0.5 text-[18px]">{scores[k] === 3 ? '✅' : scores[k] === 2 ? '🟡' : '❌'}</span>
              <span className="flex-1">
                <span className="gr block text-[15px] font-medium">{st.q.gr}</span>
                <span className="block text-[13px] text-muted">{st.item.title}</span>
              </span>
            </button>
          ))}
        </div>
      </Section>

      <div className="mt-6 space-y-3">
        {weak.length > 0 && (
          <Btn big className="w-full" onClick={() => onRetry(weak.map((s) => ({ item: s.item, q: pick(s.item.questions(ctx)) })))}>
            <RotateCcw size={18} /> Повторить слабые ({weak.length})
          </Btn>
        )}
        <Btn big kind="soft" className="w-full" onClick={() => onRetry(steps.map((s) => ({ item: s.item, q: pick(s.item.questions(ctx)) })).sort(() => Math.random() - 0.5))}>
          Ещё раз, в другом порядке
        </Btn>
        <Btn kind="ghost" className="w-full" onClick={back}>Готово</Btn>
      </div>
    </Screen>
  )
}
