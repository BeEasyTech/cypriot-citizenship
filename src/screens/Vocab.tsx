import { useMemo, useState } from 'react'
import { ChevronRight, Play, Search, Plus, Pencil, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { useNav } from '../router'
import { CUSTOM_DECK_ID, useCtx, useDecks, vocabCardId, vocabGr } from '../content'
import { mastery } from '../lib/srs'
import type { VocabItem } from '../types'
import { Screen, Ring, SpeakBtn, Btn, Toggle, cx, Empty } from '../ui/kit'

export function VocabList() {
  const decks = useDecks()
  const cards = useStore((s) => s.cards)
  const disabled = useStore((s) => s.settings.disabledDecks)
  const toggleDeck = useStore((s) => s.toggleDeck)
  const push = useNav((n) => n.push)
  const total = decks.reduce((a, d) => a + d.items.length, 0)

  return (
    <Screen title="Словарь" subtitle={`${decks.length} колод · ${total} слов и фраз`} back={false}>
      <p className="mt-1 px-1 text-[14px] text-muted">У каждого слова есть английский эквивалент — запасной вариант, если греческое слово вылетело из головы.</p>
      <div className="card mt-3 divide-y divide-line overflow-hidden">
        {decks.map((d) => {
          const ids = d.items.flatMap((v) => [vocabCardId(v.id, 'r'), vocabCardId(v.id, 'p')])
          const m = ids.length ? ids.reduce((a, id) => a + mastery(cards[id]), 0) / ids.length : 0
          const off = disabled.includes(d.id)
          return (
            <div key={d.id} className={cx('flex items-center gap-3 px-4 py-3', off && 'opacity-55')}>
              <button onClick={() => push({ name: 'deck', id: d.id })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <Ring value={m} size={42}><span className="text-[18px]">{d.emoji}</span></Ring>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">{d.titleRu}</span>
                  <span className="block text-[13px] text-muted">{d.items.length} · {Math.round(m * 100)}% выучено</span>
                </span>
                <ChevronRight size={18} className="text-muted" />
              </button>
              <Toggle on={!off} onChange={() => toggleDeck(d.id)} />
            </div>
          )
        })}
      </div>
      <p className="mt-2 px-1 text-[13px] text-muted">Переключатель — включить колоду в ежедневные занятия.</p>
    </Screen>
  )
}

export function DeckDetail({ id }: { id: string }) {
  const decks = useDecks()
  const d = decks.find((x) => x.id === id)
  const ctx = useCtx()
  const cards = useStore((s) => s.cards)
  const push = useNav((n) => n.push)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<VocabItem | null>(null)
  const custom = id === CUSTOM_DECK_ID

  const items = useMemo(() => {
    if (!d) return []
    const n = q.trim().toLowerCase()
    return n ? d.items.filter((v) => [v.gr, v.grF, v.en, v.ru, v.note].some((x) => x?.toLowerCase().includes(n))) : d.items
  }, [d, q])

  if (!d) return <Screen title="Колода не найдена"><div /></Screen>

  return (
    <Screen title={`${d.emoji} ${d.titleRu}`} subtitle={`${d.items.length} карточек`}
      right={d.items.length > 0 ? <SpeakBtn texts={items.map((v) => vocabGr(v, ctx))} speakKey={`deck:${d.id}`} /> : undefined}>
      <div className="mt-1 flex gap-2">
        <Btn className="flex-1" disabled={!d.items.length} onClick={() => push({ name: 'session', filter: { deckId: d.id }, title: d.titleRu })}>
          <Play size={17} fill="currentColor" /> Учить колоду
        </Btn>
        {custom && <Btn kind="soft" onClick={() => setEditing({ id: `u-${Date.now().toString(36)}`, gr: '', en: '', ru: '' })}><Plus size={17} /> Добавить</Btn>}
      </div>

      {editing && <VocabForm v={editing} onClose={() => setEditing(null)} />}

      {d.items.length > 8 && (
        <div className="relative mt-3">
          <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по-гречески, по-русски или по-английски" className="!bg-card !pl-10" />
        </div>
      )}

      {custom && d.items.length === 0 && !editing && (
        <div className="mt-3"><Empty>Сюда можно добавить свои слова и фразы — например, от преподавателя.</Empty></div>
      )}

      <div className="card mt-3 divide-y divide-line overflow-hidden">
        {items.map((v) => {
          const gr = vocabGr(v, ctx)
          const m = (mastery(cards[vocabCardId(v.id, 'r')]) + mastery(cards[vocabCardId(v.id, 'p')])) / 2
          return (
            <div key={v.id} className="flex items-start gap-2 px-4 py-3">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: m ? `color-mix(in srgb, var(--ok) ${Math.round(m * 100)}%, var(--border))` : 'var(--border)' }} />
              <div className="min-w-0 flex-1">
                <div className="gr text-[17px] font-semibold">{gr}</div>
                {v.grF && v.grF !== v.gr && <div className="gr text-[13px] text-muted">{ctx.gender === 'f' ? `муж.: ${v.gr}` : `жен.: ${v.grF}`}</div>}
                <div className="text-[14px]"><span className="text-copper">{v.en}</span> <span className="text-muted">· {v.ru}</span></div>
                {v.note && <div className="mt-0.5 text-[12px] text-muted">{v.note}</div>}
              </div>
              {custom && <button onClick={() => setEditing(v)} className="flex h-9 w-9 items-center justify-center rounded-full text-muted active:bg-accent-soft"><Pencil size={16} /></button>}
              <SpeakBtn text={gr} size={18} />
            </div>
          )
        })}
      </div>
    </Screen>
  )
}

function VocabForm({ v, onClose }: { v: VocabItem; onClose: () => void }) {
  const upsert = useStore((s) => s.upsertCustomVocab)
  const del = useStore((s) => s.deleteCustomVocab)
  const exists = useStore((s) => s.customVocab.some((x) => x.id === v.id))
  const [x, setX] = useState<VocabItem>(v)
  const set = (p: Partial<VocabItem>) => setX({ ...x, ...p })
  return (
    <div className="card mt-3 space-y-2 p-4 fade-in">
      <div className="flex gap-2">
        <input lang="el" value={x.gr} placeholder="По-гречески" onChange={(e) => set({ gr: e.target.value })} className="gr" />
        <SpeakBtn text={x.gr} />
      </div>
      <input value={x.en} placeholder="English" onChange={(e) => set({ en: e.target.value })} />
      <input value={x.ru} placeholder="По-русски" onChange={(e) => set({ ru: e.target.value })} />
      <input value={x.note ?? ''} placeholder="Заметка (необязательно)" onChange={(e) => set({ note: e.target.value })} />
      <div className="flex gap-2 pt-1">
        <Btn className="flex-1" disabled={!x.gr.trim() || !(x.ru.trim() || x.en.trim())} onClick={() => { upsert({ ...x, gr: x.gr.trim(), en: x.en.trim() || x.gr.trim(), ru: x.ru.trim() || x.en.trim() }); onClose() }}>Сохранить</Btn>
        <Btn kind="soft" onClick={onClose}>Отмена</Btn>
        {exists && <Btn kind="bad" onClick={() => { del(v.id); onClose() }}><Trash2 size={16} /></Btn>}
      </div>
    </div>
  )
}
