import { useEffect, type ReactNode } from 'react'
import { ChevronLeft, Volume2, Square } from 'lucide-react'
import { useNav } from '../router'
import { tg, haptic } from '../lib/telegram'
import { speak, speakAll, stop, useSpeakingKey, type Lang, type Role } from '../lib/tts'
import { useStore } from '../store'
import type { Tri } from '../types'

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')

/* ------------------------------------------------ каркас экрана */

export function Screen({ title, subtitle, right, children, back = true, footer }: {
  title?: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  children: ReactNode
  back?: boolean
  footer?: ReactNode
}) {
  const depth = useNav((s) => s.stack.length)
  const goBack = useNav((s) => s.back)
  const inTg = !!tg()
  const showBack = back && depth > 1

  // В Telegram — нативная кнопка «Назад».
  useEffect(() => {
    const w = tg()
    if (!w) return
    if (showBack) {
      w.BackButton.show()
      w.BackButton.onClick(goBack)
      return () => w.BackButton.offClick(goBack)
    }
    w.BackButton.hide()
  }, [showBack, goBack])

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col fade-in">
      {(title || right) && (
        <header className="safe-top sticky top-0 z-20 bg-bg/90 backdrop-blur-md print:hidden">
          <div className="flex min-h-14 items-center gap-1 px-4">
            {showBack && !inTg && (
              <button onClick={goBack} className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-accent active:bg-accent-soft" aria-label="Назад">
                <ChevronLeft size={26} />
              </button>
            )}
            <div className="min-w-0 flex-1 py-2">
              <h1 className="truncate text-[19px] font-bold leading-tight">{title}</h1>
              {subtitle && <div className="truncate text-[13px] text-muted">{subtitle}</div>}
            </div>
            {right}
          </div>
        </header>
      )}
      <main className="flex-1 px-4 pb-28 print:p-0">{children}</main>
      {footer}
    </div>
  )
}

export function Section({ title, children, right, className }: { title?: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={cx('mt-5', className)}>
      {(title || right) && (
        <div className="mb-2 flex items-end justify-between px-1">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

/* ------------------------------------------------ кнопки */

type BtnKind = 'primary' | 'soft' | 'ghost' | 'ok' | 'bad' | 'warn' | 'copper'

const BTN: Record<BtnKind, string> = {
  primary: 'bg-accent text-accent-fg active:opacity-85',
  soft: 'bg-accent-soft text-accent active:opacity-75',
  ghost: 'bg-transparent text-accent active:bg-accent-soft',
  ok: 'bg-ok-soft text-ok active:opacity-75',
  bad: 'bg-bad-soft text-bad active:opacity-75',
  warn: 'bg-warn-soft text-warn active:opacity-75',
  copper: 'bg-copper text-white active:opacity-85',
}

export function Btn({ kind = 'primary', className, children, onClick, disabled, big }: {
  kind?: BtnKind
  className?: string
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  big?: boolean
}) {
  return (
    <button
      disabled={disabled}
      onClick={() => { haptic.tap(); onClick?.() }}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 rounded-2xl font-semibold transition disabled:opacity-40',
        big ? 'min-h-14 px-5 text-[17px]' : 'min-h-11 px-4 text-[15px]',
        BTN[kind], className,
      )}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------ греческий текст с «дырками» и озвучкой */

export function Holey({ text }: { text: string }) {
  const parts = text.split(/(⟨[^⟩]+⟩)/g)
  return (
    <>
      {parts.map((p, i) => p.startsWith('⟨') ? <span key={i} className="hole">{p.slice(1, -1)}</span> : <span key={i}>{p}</span>)}
    </>
  )
}

export function useTtsOpts() {
  const rate = useStore((s) => s.settings.rate)
  const voiceURI = useStore((s) => s.settings.voiceURI)
  return { rate, voiceURI }
}

/** Кнопка «прослушать»: одна фраза или последовательность. */
export function SpeakBtn({ text, texts, lang = 'el', slow, size = 20, className, label, speakKey, role = 'me' }: {
  text?: string
  texts?: string[]
  lang?: Lang
  slow?: boolean
  size?: number
  className?: string
  label?: ReactNode
  speakKey?: string
  role?: Role
}) {
  const o = useTtsOpts()
  const cur = useSpeakingKey()
  const key = speakKey ?? (texts ? `seq:${texts.join('|')}` : text ?? '')
  const active = cur !== null && (cur === key || (texts && cur.startsWith(key + ':')))
  const rate = slow ? Math.max(0.5, o.rate * 0.7) : o.rate
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        haptic.tap()
        if (active) return stop()
        if (texts) speakAll(texts, { ...o, rate, lang, role, keyPrefix: key })
        else if (text) speak(text, { ...o, rate, lang, role, key })
      }}
      className={cx('inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full text-accent active:bg-accent-soft',
        label ? 'min-h-9 px-3 text-[14px] font-semibold bg-accent-soft' : 'h-9 w-9', className)}
      aria-label="Прослушать"
    >
      {active ? <Square size={size - 4} fill="currentColor" /> : <Volume2 size={size} />}
      {label}
    </button>
  )
}

/** Строка ответа: греческий крупно (тап = озвучка), под ним EN/RU. */
export function TriLine({ line, idx, showEn, showRu, big, speakPrefix = 'ans' }: {
  line: Tri
  idx: number
  showEn?: boolean
  showRu?: boolean
  big?: boolean
  speakPrefix?: string
}) {
  const o = useTtsOpts()
  const cur = useSpeakingKey()
  const key = `${speakPrefix}:${idx}`
  const active = cur === key
  return (
    <div className="py-1.5">
      <button
        onClick={() => { haptic.tap(); if (active) stop(); else speak(line.gr, { ...o, key }) }}
        className={cx('gr w-full text-left leading-snug transition', big ? 'text-[21px] font-medium' : 'text-[18px]', active && 'speaking')}
      >
        <Holey text={line.gr} />
      </button>
      {showEn && (
        <div className="mt-0.5 flex items-start gap-1 text-[14px] text-copper">
          <span className="mt-[3px] rounded bg-copper-soft px-1 text-[10px] font-bold">EN</span>
          <span><Holey text={line.en} /></span>
        </div>
      )}
      {showRu && <div className="mt-0.5 text-[14px] text-muted"><Holey text={line.ru} /></div>}
    </div>
  )
}

/* ------------------------------------------------ мелочи */

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <button onClick={() => { haptic.select(); onChange(!on) }} className={cx('flex items-center gap-3 text-left', !!label && 'w-full')} role="switch" aria-checked={on}>
      <span className={cx('relative inline-block h-[30px] w-[50px] shrink-0 rounded-full transition', on ? 'bg-ok' : 'bg-line')}>
        <span className={cx('absolute top-[3px] h-6 w-6 rounded-full bg-white shadow transition-all', on ? 'left-[23px]' : 'left-[3px]')} />
      </span>
      {label && <span className="min-w-0 flex-1 text-[15px] leading-snug">{label}</span>}
    </button>
  )
}

export function Chip({ on, children, onClick, className }: { on?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={() => { haptic.select(); onClick?.() }}
      className={cx('min-h-9 rounded-full border px-3.5 text-[14px] font-medium transition',
        on ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-card text-fg active:bg-accent-soft', className)}
    >
      {children}
    </button>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-line/60 p-1">
      {options.map((o) => (
        <button key={o.value} onClick={() => { haptic.select(); onChange(o.value) }}
          className={cx('flex-1 rounded-lg px-2 py-1.5 text-[14px] font-medium transition', value === o.value ? 'bg-card shadow-sm' : 'text-muted')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Bar({ value, className, color = 'bg-ok' }: { value: number; className?: string; color?: string }) {
  return (
    <div className={cx('h-1.5 overflow-hidden rounded-full bg-line', className)}>
      <div className={cx('h-full rounded-full transition-all', color)} style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </div>
  )
}

export function Ring({ value, size = 44, stroke = 4, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--ok)" strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} strokeLinecap="round" className="transition-all" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

export function Row({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick ? () => { haptic.tap(); onClick() } : undefined}
      className={cx('flex w-full items-center gap-3 px-4 py-3 text-left', onClick && 'active:bg-accent-soft', className)}>
      {children}
    </Tag>
  )
}

export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('card divide-y divide-line overflow-hidden', className)}>{children}</div>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card p-6 text-center text-[15px] text-muted">{children}</div>
}
