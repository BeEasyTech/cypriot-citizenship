import { useEffect, useState } from 'react'
import { Bell, BellOff, Send, Smartphone } from 'lucide-react'
import {
  api, apiEnabled, currentPushSubscription, disablePush, enablePush, isIos, isStandalone, localTz, pushSupported, type Me,
} from '../lib/api'
import { tg } from '../lib/telegram'
import { Btn, Toggle } from '../ui/kit'

/** Настройки ежедневных напоминаний: бот в Telegram или push в PWA. */
export default function Reminders() {
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [pushOn, setPushOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const inTg = !!tg()

  useEffect(() => {
    if (!apiEnabled) return
    let alive = true
    ;(async () => {
      try {
        let m = await api.me()
        // Часовой пояс берём с устройства.
        if (m.tz !== localTz()) m = await api.update({ tz: localTz() }).catch(() => m)
        if (alive) setMe(m)
      } catch (e) {
        if (alive) setError((e as Error).message)
      }
      const sub = await currentPushSubscription().catch(() => null)
      if (alive) setPushOn(!!sub)
    })()
    return () => { alive = false }
  }, [])

  if (!apiEnabled) {
    return <div className="card p-4 text-[14px] text-muted">Сервер напоминаний не подключён (не задан адрес API).</div>
  }
  if (error && !me) return <div className="card p-4 text-[14px] text-bad">Не удалось связаться с сервером: {error}</div>
  if (!me) return <div className="card p-4 text-[14px] text-muted">Загружаю настройки напоминаний…</div>

  const save = async (patch: Parameters<typeof api.update>[0]) => {
    setError('')
    const prev = me
    setMe({ ...me, ...patch })
    try { setMe(await api.update(patch)) } catch (e) { setMe(prev); setError((e as Error).message) }
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(''); setInfo('')
    try { await fn() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const togglePush = () => run(async () => {
    if (pushOn) { await disablePush(); setPushOn(false) } else { await enablePush(); setPushOn(true) }
    setMe(await api.me())
  })

  const allowBot = () => {
    const w = tg()
    if (!w?.requestWriteAccess) return setInfo('Откройте бота и нажмите «Старт».')
    w.requestWriteAccess((ok) => {
      if (ok) run(async () => { setMe(await api.me()); setInfo('Бот сможет присылать напоминания ✓') })
    })
  }

  const test = () => run(async () => {
    const r = await api.test()
    setInfo(r.telegram || r.push ? `Отправлено: ${[r.telegram && 'Telegram', r.push && `push (${r.push})`].filter(Boolean).join(', ')}` : 'Некуда отправить: включите уведомления или разрешите боту писать.')
  })

  const needsIosInstall = !inTg && isIos() && !isStandalone()
  const noChannel = inTg ? me.tgBlocked || me.tgWriteAllowed === false : me.pushDevices === 0

  return (
    <div className="card space-y-4 p-4">
      <Toggle on={me.remindEnabled} onChange={(v) => save({ remindEnabled: v })} label="Напоминать заниматься каждый день" />

      {me.remindEnabled && (
        <>
          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold">Время напоминания</span>
            <input type="time" value={me.remindTime} onChange={(e) => e.target.value && save({ remindTime: e.target.value })} />
            <span className="mt-1 block text-[12px] text-muted">Часовой пояс: {me.tz}. Если вы уже занимались сегодня, напоминание не придёт.</span>
          </label>
          <Toggle on={me.eveningNudge} onChange={(v) => save({ eveningNudge: v })} label="Вечером в 21:00 — «ещё не поздно», если не занимались" />
        </>
      )}

      {inTg ? (
        <div className="space-y-2 rounded-xl bg-bg p-3 text-[14px]">
          <div className="flex items-center gap-2 font-semibold"><Send size={16} className="text-accent" /> Напоминания придут сообщением от бота</div>
          {me.tgBlocked && <div className="text-bad">Бот не может вам писать: откройте чат с ботом и нажмите «Старт» / разблокируйте его.</div>}
          {!me.tgBlocked && me.tgWriteAllowed === false && (
            <Btn kind="soft" onClick={allowBot} disabled={busy}>Разрешить боту присылать сообщения</Btn>
          )}
        </div>
      ) : (
        <div className="space-y-2 rounded-xl bg-bg p-3 text-[14px]">
          <div className="flex items-center gap-2 font-semibold"><Smartphone size={16} className="text-accent" /> Push-уведомления на этом устройстве</div>
          {needsIosInstall ? (
            <div className="text-muted">На iPhone уведомления работают только у установленного приложения: «Поделиться» → «На экран „Домой“», затем откройте его оттуда.</div>
          ) : !pushSupported() ? (
            <div className="text-muted">Этот браузер не поддерживает push-уведомления.</div>
          ) : (
            <Btn kind={pushOn ? 'soft' : 'primary'} onClick={togglePush} disabled={busy}>
              {pushOn ? <><BellOff size={17} /> Выключить уведомления</> : <><Bell size={17} /> Включить уведомления</>}
            </Btn>
          )}
          {me.pushDevices > 0 && <div className="text-[12px] text-muted">Подключено устройств: {me.pushDevices}</div>}
        </div>
      )}

      {me.remindEnabled && !noChannel && (
        <Btn kind="ghost" onClick={test} disabled={busy}>Прислать тестовое напоминание</Btn>
      )}
      {info && <div className="text-[14px] text-ok">{info}</div>}
      {error && <div className="text-[14px] text-bad">{error}</div>}
    </div>
  )
}
