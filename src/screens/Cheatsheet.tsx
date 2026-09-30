import { useMemo, useState } from 'react'
import { Printer, Copy, Check, Share2, AlertCircle } from 'lucide-react'
import { useStore } from '../store'
import { answerOf, isActive, useCtx, useTopics } from '../content'
import { tg } from '../lib/telegram'
import { Screen, Btn, Segmented, Toggle, Holey } from '../ui/kit'
import { countHoles } from '../ui/fields'
import type { Tri } from '../types'

type Langs = 'gr' | 'en' | 'all'

interface Block { num: number; title: string; items: { title: string; questions: Tri[]; answer: Tri[] }[] }

export default function Cheatsheet() {
  const ctx = useCtx()
  const topics = useTopics()
  const overrides = useStore((s) => s.overrides)
  const name = useStore((s) => s.profile.name?.gr?.trim())
  const [langs, setLangs] = useState<Langs>('en')
  const [allQ, setAllQ] = useState(false)
  const [copied, setCopied] = useState(false)

  const blocks: Block[] = useMemo(() => topics.map((t) => ({
    num: t.num,
    title: t.title,
    items: t.items.filter((i) => isActive(i, ctx)).map((i) => ({ title: i.title, questions: i.questions(ctx), answer: answerOf(i, ctx, overrides) })),
  })).filter((b) => b.items.length), [topics, ctx, overrides])

  const holes = blocks.reduce((n, b) => n + b.items.reduce((m, i) => m + countHoles(i.answer), 0), 0)
  const date = new Date().toLocaleDateString('ru-RU')

  const plain = () => {
    const lines: string[] = [`Συνέντευξη — мои ответы${name ? ` (${name})` : ''}, ${date}`, '']
    for (const b of blocks) {
      lines.push(`${b.num}. ${b.title.toUpperCase()}`)
      for (const i of b.items) {
        const qs = allQ ? i.questions : i.questions.slice(0, 1)
        lines.push(`❓ ${qs.map((q) => q.gr).join(' / ')}`)
        lines.push(i.answer.map((l) => l.gr).join(' '))
        if (langs !== 'gr') lines.push(`EN: ${i.answer.map((l) => l.en).join(' ')}`)
        if (langs === 'all') lines.push(`RU: ${i.answer.map((l) => l.ru).join(' ')}`)
        lines.push('')
      }
    }
    return lines.join('\n').replace(/⟨([^⟩]+)⟩/g, '[$1]')
  }

  const copy = async () => {
    const text = plain()
    try { await navigator.clipboard.writeText(text) } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const canShare = typeof navigator.share === 'function'
  const inTg = !!tg()

  return (
    <Screen title="Шпаргалка" subtitle="Все ваши ответы на одной странице">
      <div className="space-y-3 print:hidden">
        <Segmented<Langs> value={langs} onChange={setLangs} options={[{ value: 'gr', label: 'GR' }, { value: 'en', label: 'GR + EN' }, { value: 'all', label: 'GR + EN + RU' }]} />
        <Toggle on={allQ} onChange={setAllQ} label="Все формулировки вопросов" />
        <div className="flex flex-wrap gap-2">
          {!inTg && <Btn onClick={() => window.print()}><Printer size={17} /> Печать / PDF</Btn>}
          <Btn kind="soft" onClick={copy}>{copied ? <Check size={17} /> : <Copy size={17} />} {copied ? 'Скопировано' : 'Копировать текст'}</Btn>
          {canShare && <Btn kind="soft" onClick={() => navigator.share({ title: 'Мои ответы', text: plain() }).catch(() => undefined)}><Share2 size={17} /> Поделиться</Btn>}
        </div>
        {inTg && <div className="text-[13px] text-muted">В Telegram печать недоступна: скопируйте текст и вставьте в заметки или отправьте преподавателю.</div>}
        {!inTg && <div className="text-[13px] text-muted">Для PDF выберите в окне печати «Сохранить как PDF».</div>}
        {holes > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-warn-soft p-3 text-[14px] text-warn">
            <AlertCircle size={16} /> В ответах {holes} незаполненных мест — заполните анкету перед печатью.
          </div>
        )}
      </div>

      <article className="cheat card mt-4 p-4 print:mt-0 print:p-0 print:shadow-none">
        <h2 className="mb-3 text-[17px] font-bold print:text-[13pt]">
          Συνέντευξη — мои ответы{name ? ` · ${name}` : ''} <span className="text-[13px] font-normal text-muted">· {date}</span>
        </h2>
        {blocks.map((b) => (
          <section key={b.num} className="cheat-topic mb-3">
            <h3 className="mb-1 border-b border-line pb-0.5 text-[13px] font-bold uppercase tracking-wide text-muted">{b.num}. {b.title}</h3>
            {b.items.map((i, k) => (
              <div key={k} className="cheat-item mb-2">
                <div className="gr text-[14px] font-semibold text-accent">{(allQ ? i.questions : i.questions.slice(0, 1)).map((q) => q.gr).join(' / ')}</div>
                <div className="gr text-[15px] leading-snug"><Holey text={i.answer.map((l) => l.gr).join(' ')} /></div>
                {langs !== 'gr' && <div className="text-[12.5px] leading-snug text-copper"><Holey text={i.answer.map((l) => l.en).join(' ')} /></div>}
                {langs === 'all' && <div className="text-[12.5px] leading-snug text-muted"><Holey text={i.answer.map((l) => l.ru).join(' ')} /></div>}
              </div>
            ))}
          </section>
        ))}
      </article>
    </Screen>
  )
}
