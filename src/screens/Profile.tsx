import { useMemo, useRef, useState } from 'react'
import { ChevronRight, Settings as Gear, Download, Upload, Cloud, Volume2 } from 'lucide-react'
import { useStore } from '../store'
import { useNav } from '../router'
import { FIELDS, OPTIONAL_FIELDS, SECTIONS, isFieldFilled, isFieldVisible } from '../data/profile'
import { Screen, Section, List, Row, Ring, Btn, Chip, Toggle, Segmented, SpeakBtn } from '../ui/kit'
import { FieldEditor } from '../ui/fields'
import { useVoices, ttsSupported, speak, useCloud } from '../lib/tts'
import { cloudAvailable } from '../lib/telegram'
import { exportJson, importJson, syncNow, useSync } from '../sync'

function useSectionFill() {
  const profile = useStore((s) => s.profile)
  return useMemo(() => {
    const out: Record<string, [number, number]> = {}
    for (const sec of SECTIONS) {
      const fs = FIELDS.filter((f) => f.section === sec.id && isFieldVisible(f, profile) && !OPTIONAL_FIELDS.has(f.key))
      out[sec.id] = [fs.filter((f) => isFieldFilled(f, profile)).length, fs.length]
    }
    return out
  }, [profile])
}

export function ProfileHome() {
  const push = useNav((n) => n.push)
  const fill = useSectionFill()
  const total = Object.values(fill).reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0])
  const pct = total[1] ? total[0] / total[1] : 0

  return (
    <Screen title="Анкета" subtitle="Из неё собираются ваши ответы" back={false}
      right={<button onClick={() => push({ name: 'settings' })} className="flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-accent-soft" aria-label="Настройки"><Gear size={22} /></button>}>
      <div className="card mt-1 flex items-center gap-4 p-4">
        <Ring value={pct} size={56} stroke={5}><span className="text-[14px] font-bold">{Math.round(pct * 100)}%</span></Ring>
        <div className="flex-1 text-[14px] leading-snug text-muted">
          Заполните данные по-русски; имена и названия — греческими буквами. Ответы на греческом, английском и русском соберутся автоматически.
        </div>
      </div>

      <Section title="Разделы">
        <List>
          {SECTIONS.map((sec) => {
            const [a, b] = fill[sec.id]
            return (
              <Row key={sec.id} onClick={() => push({ name: 'section', id: sec.id })}>
                <span className="text-xl">{sec.emoji}</span>
                <span className="flex-1 text-[16px] font-medium">{sec.title}</span>
                <span className={a === b ? 'text-[14px] font-semibold text-ok' : 'text-[14px] text-muted'}>{a === b ? '✓' : `${a}/${b}`}</span>
                <ChevronRight size={18} className="text-muted" />
              </Row>
            )
          })}
        </List>
      </Section>

      <Section title="Приложение">
        <List>
          <Row onClick={() => push({ name: 'settings' })}><Gear size={20} className="text-muted" /><span className="flex-1">Настройки, голос, синхронизация</span><ChevronRight size={18} className="text-muted" /></Row>
        </List>
      </Section>
    </Screen>
  )
}

export function SectionForm({ id }: { id: string }) {
  const sec = SECTIONS.find((s) => s.id === id)!
  const profile = useStore((s) => s.profile)
  const fields = FIELDS.filter((f) => f.section === id && isFieldVisible(f, profile))
  const idx = SECTIONS.findIndex((s) => s.id === id)
  const nextSec = SECTIONS[idx + 1]
  const replace = useNav((n) => n.replace)
  const back = useNav((n) => n.back)
  return (
    <Screen title={`${sec.emoji} ${sec.title}`} subtitle="Сохраняется автоматически">
      <div className="card mt-1 divide-y divide-line px-4">
        {fields.map((f) => <FieldEditor key={f.key} f={f} />)}
      </div>
      <div className="mt-5">
        {nextSec
          ? <Btn big kind="soft" className="w-full" onClick={() => { replace({ name: 'section', id: nextSec.id }); window.scrollTo(0, 0) }}>Дальше: {nextSec.emoji} {nextSec.title}</Btn>
          : <Btn big className="w-full" onClick={back}>Готово</Btn>}
      </div>
    </Screen>
  )
}

/* ------------------------------------------------ настройки */

export function Settings() {
  const st = useStore((s) => s.settings)
  const set = useStore((s) => s.setSettings)
  const gender = useStore((s) => s.profile.gender)
  const setProfile = useStore((s) => s.setProfile)
  const resetProgress = useStore((s) => s.resetProgress)
  const voices = useVoices('el')
  const sync = useSync()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  return (
    <Screen title="Настройки">
      <Section title="Собеседование">
        <div className="card space-y-4 p-4">
          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold">Дата собеседования</span>
            <input type="date" value={st.interviewDate} onChange={(e) => set({ interviewDate: e.target.value })} />
            <span className="mt-1 block text-[12px] text-muted">Интервалы повторения подстроятся, чтобы к этой дате всё успело повториться.</span>
          </label>
          <div>
            <span className="mb-1.5 block text-[14px] font-semibold">Ваш род (формы в ответах)</span>
            <Segmented value={gender ?? 'm'} onChange={(g) => setProfile({ gender: g })} options={[{ value: 'm', label: 'Мужской' }, { value: 'f', label: 'Женский' }]} />
          </div>
        </div>
      </Section>

      <Section title="Занятия">
        <div className="card space-y-4 p-4">
          <div>
            <span className="mb-2 block text-[14px] font-semibold">Новых карточек в день</span>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 15, 20, 30, 50].map((n) => <Chip key={n} on={st.newPerDay === n} onClick={() => set({ newPerDay: n })}>{n}</Chip>)}
            </div>
          </div>
          <div className="space-y-3">
            <span className="block text-[14px] font-semibold">Направления для слов</span>
            <Toggle on={st.recognition} onChange={(v) => set({ recognition: v || !st.production })} label="Греческий → русский (узнавать)" />
            <Toggle on={st.production} onChange={(v) => set({ production: v || !st.recognition })} label="Русский → греческий (говорить)" />
          </div>
          <Toggle on={st.showEn} onChange={(v) => set({ showEn: v })} label="Сразу показывать EN в ответах" />
          <Toggle on={st.showRu} onChange={(v) => set({ showRu: v })} label="Сразу показывать перевод в ответах" />
        </div>
      </Section>

      <Section title="Озвучка">
        <CloudVoice />
        <div className="card mt-3 space-y-4 p-4">
          <div className="text-[14px] font-semibold">Голос браузера {useCloud.getState().available ? '(запасной, без интернета)' : ''}</div>
          {!ttsSupported && <div className="text-[14px] text-bad">Этот браузер не поддерживает синтез речи.</div>}
          {ttsSupported && voices.length === 0 && (
            <div className="rounded-xl bg-warn-soft p-3 text-[14px] text-warn">
              Греческий голос не найден. На iPhone: Настройки → Универсальный доступ → Устный контент → Голоса → Греческий. На Android: Настройки → Синтез речи → Google → установить греческий. В Telegram для Android озвучка может не работать — откройте приложение в браузере.
            </div>
          )}
          {voices.length > 0 && (
            <label className="block">
              <span className="mb-1.5 block text-[14px] font-semibold">Голос</span>
              <select value={st.voiceURI} onChange={(e) => set({ voiceURI: e.target.value })}>
                <option value="">Автоматически (лучший)</option>
                {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}{v.localService ? '' : ' (онлайн)'}</option>)}
              </select>
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 flex justify-between text-[14px] font-semibold"><span>Скорость</span><span className="text-muted">{st.rate.toFixed(2)}×</span></span>
            <input type="range" min={0.5} max={1.2} step={0.05} value={st.rate} onChange={(e) => set({ rate: Number(e.target.value) })} className="!border-0 !bg-transparent !p-0 accent-[var(--accent)]" />
          </label>
          <div className="flex items-center gap-2">
            <Btn kind="soft" onClick={() => speak('Καλημέρα σας! Πώς σας λένε; Από πού είστε;', { rate: st.rate, voiceURI: st.voiceURI })}><Volume2 size={17} /> Проверить голос</Btn>
            <SpeakBtn text="Μπορείτε να επαναλάβετε, παρακαλώ;" />
          </div>
          <Toggle on={st.autoplay} onChange={(v) => set({ autoplay: v })} label="Автоматически озвучивать карточки" />
        </div>
      </Section>

      <Section title="Данные">
        <div className="card space-y-3 p-4">
          {cloudAvailable() ? (
            <div className="flex items-center gap-3">
              <Cloud size={20} className={sync.status === 'error' ? 'text-bad' : 'text-ok'} />
              <div className="flex-1 text-[14px]">
                <div className="font-semibold">Синхронизация через Telegram</div>
                <div className="text-muted">
                  {sync.status === 'saving' ? 'Сохраняю…' : sync.status === 'error' ? `Ошибка: ${sync.error}` : sync.last ? `Сохранено в ${new Date(sync.last).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : 'Включена'}
                </div>
              </div>
              <Btn kind="soft" onClick={() => syncNow()}>Сейчас</Btn>
            </div>
          ) : (
            <div className="text-[14px] text-muted">Данные хранятся на этом устройстве. В Telegram включается облачная синхронизация между устройствами. Для переноса используйте файл.</div>
          )}
          <div className="flex flex-wrap gap-2">
            <Btn kind="soft" onClick={exportJson}><Download size={17} /> Экспорт в файл</Btn>
            <Btn kind="soft" onClick={() => fileRef.current?.click()}><Upload size={17} /> Импорт</Btn>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              try { await importJson(f, 'merge'); setMsg('Импортировано и объединено с текущими данными ✓') }
              catch (err) { setMsg(`Не получилось: ${(err as Error).message}`) }
              e.target.value = ''
            }} />
          </div>
          {msg && <div className="text-[14px] text-muted">{msg}</div>}
          <div className="text-[12px] text-muted">Анкета хранится на устройстве и (в Telegram) в вашем облаке Telegram. При включённой облачной озвучке озвучиваемый текст, включая ваши ответы, отправляется в Azure для синтеза речи.</div>
        </div>
      </Section>

      <Section title="Сброс">
        <Btn kind="bad" className="w-full" onClick={() => { if (confirm('Сбросить весь прогресс обучения? Анкета и ваши правки останутся.')) resetProgress() }}>Сбросить прогресс</Btn>
      </Section>
      <div className="mt-6 text-center text-[12px] text-muted">Καλή επιτυχία στη συνέντευξη! 🇨🇾</div>
    </Screen>
  )
}

function CloudVoice() {
  const cloud = useCloud()
  const st = useStore((s) => s.settings)
  const set = useStore((s) => s.setSettings)
  const [help, setHelp] = useState(false)
  const test = (role: 'examiner' | 'me', text: string) => speak(text, { rate: st.rate, role })

  if (cloud.available === null) return <div className="card p-4 text-[14px] text-muted">Проверяю облачную озвучку…</div>

  if (!cloud.available) {
    return (
      <div className="card space-y-2 p-4">
        <div className="text-[14px] font-semibold">Облачные голоса Azure — не подключены</div>
        <div className="text-[14px] text-muted">Естественные греческие нейроголоса: мужской (Nestoras) для экзаменатора, женский (Athina). Нужен бесплатный ключ Azure.</div>
        <button onClick={() => setHelp(!help)} className="text-[14px] font-semibold text-accent">{help ? 'Скрыть инструкцию' : 'Как подключить'}</button>
        {help && (
          <ol className="list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed">
            <li>Зайдите на <b>portal.azure.com</b> и создайте бесплатный аккаунт (карта нужна только для проверки).</li>
            <li>«Создать ресурс» → найдите <b>Speech</b> (Azure AI Speech) → «Создать».</li>
            <li>Регион: <b>West Europe</b>, тариф: <b>Free F0</b> (500 тыс. символов в месяц бесплатно).</li>
            <li>Откройте ресурс → «Ключи и конечная точка» → скопируйте <b>KEY 1</b> и <b>Location/Region</b>.</li>
            <li>В Vercel: Project → Settings → Environment Variables → добавьте <code>AZURE_SPEECH_KEY</code> и <code>AZURE_SPEECH_REGION</code> (например, <code>westeurope</code>) → Redeploy.</li>
          </ol>
        )}
      </div>
    )
  }

  return (
    <div className="card space-y-4 p-4">
      <Toggle on={st.cloudTts} onChange={(v) => set({ cloudTts: v })} label="Облачные нейроголоса (Azure)" />
      {st.cloudTts && (
        <>
          <div>
            <span className="mb-1.5 block text-[14px] font-semibold">Голос экзаменатора</span>
            <Segmented value={st.examinerVoice} onChange={(v) => set({ examinerVoice: v })} options={[{ value: 'm', label: 'Мужской' }, { value: 'f', label: 'Женский' }]} />
          </div>
          <div>
            <span className="mb-1.5 block text-[14px] font-semibold">Голос ваших ответов и слов</span>
            <Segmented value={st.myVoice} onChange={(v) => set({ myVoice: v })} options={[{ value: 'auto', label: 'Как мой род' }, { value: 'm', label: 'Мужской' }, { value: 'f', label: 'Женский' }]} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn kind="soft" onClick={() => test('examiner', 'Καλημέρα σας. Πώς σας λένε;')}><Volume2 size={17} /> Экзаменатор</Btn>
            <Btn kind="soft" onClick={() => test('me', 'Με λένε Άννα. Είμαι από τη Ρωσία.')}><Volume2 size={17} /> Мой голос</Btn>
          </div>
          <div className="text-[12px] text-muted">Прослушанные фразы кешируются. Без интернета включается голос браузера.</div>
        </>
      )}
    </div>
  )
}
