import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Turtle, Volume2 } from 'lucide-react'
import { useStore } from '../store'
import { useNav } from '../router'
import { isActive, useCtx, useItemIndex } from '../content'
import type { QItem } from '../data/topics'
import { speak, stop } from '../lib/tts'
import { haptic } from '../lib/telegram'
import { Btn, cx, useTtsOpts } from '../ui/kit'
import type { Tri } from '../types'

interface Round { item: QItem; q: Tri; options: QItem[] }

const shuffle = <T,>(xs: T[]) => {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

export default function Listen() {
  const ctx = useCtx()
  const { all } = useItemIndex()
  const itemStats = useStore((s) => s.itemStats)
  const back = useNav((n) => n.back)
  const o = useTtsOpts()
  const active = useMemo(() => all.filter((i) => isActive(i, ctx)), [all, ctx])
  const [round, setRound] = useState<Round | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const [score, setScore] = useState({ ok: 0, total: 0 })
  const last = useRef<string[]>([])
  const started = useRef(Date.now())

  const next = () => {
    // чаще спрашиваем то, что хуже узнаётся
    const weight = (i: QItem) => {
      const st = itemStats[i.id]
      const acc = st?.listenTotal ? st.listenOk / st.listenTotal : 0.5
      return last.current.includes(i.id) ? 0.05 : 0.3 + (1 - acc) * 2
    }
    const total = active.reduce((a, i) => a + weight(i), 0)
    let r = Math.random() * total
    let item = active[0]
    for (const i of active) { r -= weight(i); if (r <= 0) { item = i; break } }
    last.current = [item.id, ...last.current].slice(0, 6)
    const qs = item.questions(ctx)
    const q = qs[Math.floor(Math.random() * qs.length)]
    const distract = shuffle(active.filter((i) => i.id !== item.id && i.title !== item.title)).slice(0, 3)
    setRound({ item, q, options: shuffle([item, ...distract]) })
    setChosen(null)
    setTimeout(() => speak(q.gr, { ...o, role: 'examiner', key: 'lq' }), 250)
  }

  useEffect(() => {
    if (active.length >= 4) next()
    return () => {
      const sec = Math.round((Date.now() - started.current) / 1000)
      if (sec > 5) useStore.getState().addSeconds(Math.min(sec, 3 * 3600))
      stop()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (id: string) => {
    if (!round || chosen) return
    const ok = id === round.item.id
    setChosen(id)
    setScore((s) => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }))
    useStore.getState().logListen(round.item.id, ok)
    ok ? haptic.ok() : haptic.bad()
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <div className="safe-top sticky top-0 z-10 bg-bg/90 px-4 pt-3 pb-2 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={back} className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-accent-soft" aria-label="Закрыть"><X size={24} /></button>
          <div className="flex-1 text-[17px] font-bold">Узнай вопрос</div>
          <div className="rounded-full bg-ok-soft px-3 py-1 text-[14px] font-bold tabular-nums text-ok">✓ {score.ok}/{score.total}</div>
        </div>
      </div>

      {round && (
        <div className="flex-1 px-4 pb-4">
          <div className="card mt-2 flex flex-col items-center p-6 text-center">
            <div className="text-[14px] text-muted">О чём спрашивает экзаменатор?</div>
            <div className="mt-4 flex items-center gap-3">
              <button onClick={() => speak(round.q.gr, { ...o, role: 'examiner', key: 'lq' })} className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg active:scale-95 transition" aria-label="Прослушать">
                <Volume2 size={34} />
              </button>
              <button onClick={() => speak(round.q.gr, { ...o, role: 'examiner', rate: Math.max(0.5, o.rate * 0.65), key: 'lq' })} className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent active:scale-95 transition" aria-label="Медленно">
                <Turtle size={24} />
              </button>
            </div>
            {chosen && (
              <div className="mt-5 fade-in">
                <div className="gr text-[20px] font-semibold">{round.q.gr}</div>
                <div className="text-[14px] text-muted">{round.q.ru}</div>
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {round.options.map((opt) => {
              const isRight = opt.id === round.item.id
              const state = !chosen ? 'idle' : isRight ? 'right' : chosen === opt.id ? 'wrong' : 'dim'
              return (
                <button key={opt.id} onClick={() => choose(opt.id)}
                  className={cx('card flex min-h-14 w-full items-center px-4 py-3 text-left text-[16px] font-medium transition',
                    state === 'idle' && 'active:scale-[0.99]',
                    state === 'right' && '!bg-ok-soft text-ok ring-2 ring-ok',
                    state === 'wrong' && '!bg-bad-soft text-bad ring-2 ring-bad',
                    state === 'dim' && 'opacity-50')}>
                  {opt.title}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {!round && active.length < 4 && <div className="p-6 text-center text-muted">Недостаточно вопросов для квиза.</div>}

      <div className="safe-bottom sticky bottom-0 bg-bg/95 px-4 pt-2 backdrop-blur-md">
        <Btn big className="w-full" disabled={!chosen} onClick={next}>Дальше</Btn>
      </div>
    </div>
  )
}
