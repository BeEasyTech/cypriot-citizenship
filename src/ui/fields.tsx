import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { FIELD_BY_KEY, SCHOOLS, type Child, type FieldDef, type NameValue, type Profile } from '../data/profile'
import { CITIES, guessFem, placeNom, type KnownPlace, type PlaceValue } from '../lib/grammar'
import { useStore } from '../store'
import { Chip, Segmented, cx } from './kit'

export function FieldEditor({ f }: { f: FieldDef }) {
  const value = useStore((s) => s.profile[f.key])
  const setProfile = useStore((s) => s.setProfile)
  const set = (v: unknown) => setProfile({ [f.key]: v })
  return (
    <div className="py-3">
      {f.type !== 'children' && <div className="mb-1.5 text-[14px] font-semibold">{f.label}</div>}
      <Editor f={f} value={value} set={set} />
      {f.hint && <div className="mt-1 text-[12px] text-muted">{f.hint}</div>}
    </div>
  )
}

export function FieldsByKeys({ keys }: { keys: string[] }) {
  const profile = useStore((s) => s.profile)
  const defs = keys.map((k) => FIELD_BY_KEY[k]).filter((f): f is FieldDef => !!f && (!f.showIf || f.showIf(profile)))
  return <div className="divide-y divide-line">{defs.map((f) => <FieldEditor key={f.key} f={f} />)}</div>
}

function Editor({ f, value, set }: { f: FieldDef; value: unknown; set: (v: unknown) => void }) {
  switch (f.type) {
    case 'gender':
      return <Segmented value={(value as string) || 'm'} onChange={set} options={[{ value: 'm', label: 'Мужской' }, { value: 'f', label: 'Женский' }]} />
    case 'text':
      return <input value={(value as string) ?? ''} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} lang="el" autoCapitalize="sentences" />
    case 'textarea':
      return <textarea value={(value as string) ?? ''} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} lang="el" rows={3} />
    case 'name':
      return <NameEditor value={value as NameValue} set={set} placeholder={f.placeholder} placeholderEn={f.placeholderEn} />
    case 'date':
      return <input type="date" value={(value as string) ?? ''} onChange={(e) => set(e.target.value)} />
    case 'time':
      return <input type="time" value={(value as string) ?? ''} onChange={(e) => set(e.target.value)} />
    case 'year':
    case 'number':
      return (
        <input type="number" inputMode="numeric" value={value === undefined || value === null ? '' : String(value)}
          placeholder={f.type === 'year' ? '2020' : f.placeholder ?? '0'}
          onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))} />
      )
    case 'bool':
      return (
        <Segmented value={value === true ? 'y' : value === false ? 'n' : ''} onChange={(v) => set(v === 'y')}
          options={[{ value: 'y', label: 'Да' }, { value: 'n', label: 'Нет' }]} />
      )
    case 'select':
      return (
        <div className="flex flex-wrap gap-2">
          {f.options!.map((o) => <Chip key={o.value} on={value === o.value} onClick={() => set(value === o.value ? '' : o.value)}>{o.label}</Chip>)}
        </div>
      )
    case 'multi': {
      const arr = Array.isArray(value) ? (value as string[]) : []
      return (
        <div className="flex flex-wrap gap-2">
          {f.options!.map((o) => {
            const i = arr.indexOf(o.value)
            return (
              <Chip key={o.value} on={i >= 0} onClick={() => set(i >= 0 ? arr.filter((x) => x !== o.value) : [...arr, o.value])}>
                {i >= 0 && <span className="mr-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white/25 px-1 text-[11px] font-bold">{i + 1}</span>}
                {o.label}
              </Chip>
            )
          })}
        </div>
      )
    }
    case 'city':
    case 'country':
      return <PlaceEditor value={value as PlaceValue} set={set} places={f.places ?? CITIES} kind={f.type} />
    case 'children':
      return <ChildrenEditor value={(value as Child[]) ?? []} set={set} />
  }
}

function NameEditor({ value, set, placeholder, placeholderEn }: { value?: NameValue; set: (v: NameValue) => void; placeholder?: string; placeholderEn?: string }) {
  const v = value ?? {}
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase text-muted">По-гречески</span>
        <input value={v.gr ?? ''} placeholder={placeholder} lang="el" onChange={(e) => set({ ...v, gr: e.target.value })} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase text-muted">Латиницей</span>
        <input value={v.en ?? ''} placeholder={placeholderEn ?? 'Latin'} onChange={(e) => set({ ...v, en: e.target.value })} />
      </label>
    </div>
  )
}

function PlaceEditor({ value, set, places, kind }: { value?: PlaceValue; set: (v: PlaceValue) => void; places: KnownPlace[]; kind: 'city' | 'country' }) {
  const v = value ?? {}
  const [custom, setCustom] = useState(!v.id && !!v.name)
  const selectVal = custom ? '__custom' : v.id ?? ''
  return (
    <div className="space-y-2">
      <select value={selectVal} onChange={(e) => {
        if (e.target.value === '__custom') { setCustom(true); set({ name: v.name ?? '' }) }
        else { setCustom(false); set({ id: e.target.value }) }
      }}>
        <option value="">— выберите —</option>
        {places.map((p) => <option key={p.id} value={p.id}>{p.ru[0]} — {placeNom(p)}</option>)}
        <option value="__custom">{kind === 'city' ? 'Другой город…' : 'Другая страна…'}</option>
      </select>
      {custom && (
        <div className="space-y-2 rounded-xl bg-bg p-3">
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted">Название по-гречески (именительный падеж)</span>
            <input value={v.name ?? ''} lang="el" placeholder={kind === 'city' ? 'Όμσκ' : 'Τουρκμενιστάν'} onChange={(e) => set({ ...v, name: e.target.value })} />
          </label>
          <div>
            <span className="mb-1 block text-[12px] text-muted">Род (для «στο / στη»)</span>
            <Segmented
              value={(v.fem ?? guessFem(v.name ?? '')) ? 'f' : 'n'}
              onChange={(x) => set({ ...v, fem: x === 'f' })}
              options={[{ value: 'n', label: `στο ${v.name || '…'}` }, { value: 'f', label: `στη(ν) ${v.name || '…'}` }]}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={v.en ?? ''} placeholder="English" onChange={(e) => set({ ...v, en: e.target.value })} />
            <input value={v.ru ?? ''} placeholder="По-русски" onChange={(e) => set({ ...v, ru: e.target.value })} />
          </div>
        </div>
      )}
    </div>
  )
}

function ChildrenEditor({ value, set }: { value: Child[]; set: (v: Child[]) => void }) {
  const upd = (i: number, patch: Partial<Child>) => set(value.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  return (
    <div className="space-y-3">
      <div className="text-[14px] font-semibold">Дети</div>
      {value.length === 0 && <div className="text-[14px] text-muted">Детей нет — ответ будет «Όχι, δεν έχω παιδιά».</div>}
      {value.map((c, i) => (
        <div key={c.id} className="space-y-2.5 rounded-2xl bg-bg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-muted">Ребёнок {i + 1}</span>
            <button onClick={() => set(value.filter((_, j) => j !== i))} className="flex h-8 w-8 items-center justify-center rounded-full text-bad active:bg-bad-soft" aria-label="Удалить">
              <Trash2 size={17} />
            </button>
          </div>
          <Segmented value={c.gender ?? 'm'} onChange={(g) => upd(i, { gender: g })} options={[{ value: 'm', label: 'Сын' }, { value: 'f', label: 'Дочь' }]} />
          <NameEditor value={c.name} set={(n) => upd(i, { name: n })} placeholder="Μαξίμ" placeholderEn="Maxim" />
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted">Дата рождения</span>
            <input type="date" value={c.birthDate ?? ''} onChange={(e) => upd(i, { birthDate: e.target.value })} />
          </label>
          <div>
            <span className="mb-1 block text-[12px] text-muted">Где родился(-ась)</span>
            <PlaceEditor value={c.birthPlace} set={(p) => upd(i, { birthPlace: p })} places={CITIES} kind="city" />
          </div>
          <div>
            <span className="mb-1 block text-[12px] text-muted">Школа / сад</span>
            <div className="flex flex-wrap gap-1.5">
              {SCHOOLS.map((s) => <Chip key={s.value} on={c.school === s.value} onClick={() => upd(i, { school: s.value })} className="text-[13px]">{s.label}</Chip>)}
            </div>
          </div>
          {c.school && !['home', 'adult'].includes(c.school) && (
            <input value={c.schoolName ?? ''} placeholder="Название (необязательно): Foley's School" onChange={(e) => upd(i, { schoolName: e.target.value })} />
          )}
        </div>
      ))}
      <button onClick={() => set([...value, { id: Math.random().toString(36).slice(2, 9), gender: 'm' }])}
        className={cx('flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-[15px] font-semibold text-accent active:bg-accent-soft')}>
        <Plus size={18} /> Добавить ребёнка
      </button>
    </div>
  )
}

/** Сколько «дырок» во всех ответах — для индикаторов. */
export function countHoles(lines: { gr: string }[]) {
  return lines.reduce((n, l) => n + (l.gr.match(/⟨[^⟩]+⟩/g)?.length ?? 0), 0)
}

export type { Profile }
