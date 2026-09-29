import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Screen, Section } from '../ui/kit'

export default function TelegramHelp() {
  const url = window.location.origin + '/'
  const [copied, setCopied] = useState(false)
  return (
    <Screen title="Telegram и телефон">
      <Section title="Адрес приложения">
        <button onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
          className="card flex w-full items-center gap-3 p-4 text-left active:opacity-80">
          <code className="flex-1 break-all text-[15px]">{url}</code>
          {copied ? <Check size={18} className="text-ok" /> : <Copy size={18} className="text-muted" />}
        </button>
      </Section>

      <Section title="Mini App в Telegram">
        <ol className="card list-decimal space-y-2.5 p-4 pl-9 text-[15px] leading-relaxed">
          <li>Откройте <b>@BotFather</b> в Telegram и отправьте <code>/newbot</code>. Придумайте имя (например, «Греческий — собеседование») и username, оканчивающийся на <code>bot</code>.</li>
          <li>Отправьте <code>/mybots</code> → выберите бота → <b>Bot Settings</b> → <b>Configure Mini App</b> → <b>Enable Mini App</b> и пришлите адрес выше.</li>
          <li>Там же: <b>Bot Settings</b> → <b>Menu Button</b> → пришлите тот же адрес и название кнопки, например «Тренажёр».</li>
          <li>Откройте своего бота и нажмите кнопку меню слева от поля ввода. Прогресс будет синхронизироваться между телефоном и компьютером через облако Telegram.</li>
        </ol>
      </Section>

      <Section title="Установить как приложение (PWA)">
        <div className="card space-y-3 p-4 text-[15px] leading-relaxed">
          <p><b>iPhone (Safari):</b> кнопка «Поделиться» → «На экран „Домой“». Работает и без интернета.</p>
          <p><b>Android (Chrome):</b> меню ⋮ → «Установить приложение» / «Добавить на главный экран».</p>
          <p className="text-muted">Совет: на iPhone лучший греческий голос — «Melina (улучшенный)». Скачайте его: Настройки → Универсальный доступ → Устный контент → Голоса → Греческий.</p>
        </div>
      </Section>
    </Screen>
  )
}
