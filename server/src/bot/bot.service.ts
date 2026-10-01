import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Sentry from '@sentry/nestjs'
import { InjectBot } from 'nestjs-telegraf'
import { Markup, Telegraf } from 'telegraf'
import type { InlineKeyboardButton } from 'telegraf/types'
import { UsersService } from '../users/users.service'
import type { User } from '../entities/user.entity'

/** Ошибки, после которых писать пользователю бессмысленно (бот заблокирован, аккаунт удалён, чата нет). */
const UNREACHABLE = /bot was blocked|user is deactivated|chat not found|bot can't initiate|have no rights to send/i

@Injectable()
export class BotService {
  private readonly log = new Logger(BotService.name)

  constructor(
    @InjectBot() readonly bot: Telegraf,
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {}

  get webAppUrl() {
    return this.config.get<string>('WEBAPP_URL') ?? ''
  }

  /** Кнопка «Открыть тренажёр»: web_app работает только с https-адресом. */
  openAppKeyboard() {
    const kb = this.keyboard(false)
    return kb.length ? Markup.inlineKeyboard(kb) : undefined
  }

  /** Кнопки: открыть приложение и (для напоминаний) «через час / уже / не сегодня». */
  keyboard(reminderButtons: boolean) {
    const url = this.webAppUrl
    const out: InlineKeyboardButton[][] = []
    if (url.startsWith('https://')) out.push([Markup.button.webApp('📱 Открыть тренажёр', url)])
    if (reminderButtons) {
      out.push([Markup.button.callback('⏰ Через час', 'r:snooze'), Markup.button.callback('✅ Уже позанимался(ась)', 'r:done')])
      out.push([Markup.button.callback('🔕 Сегодня не надо', 'r:skip')])
    }
    return out
  }

  /** Отправить сообщение. Возвращает message_id или null. */
  async send(user: User, html: string, opts: { reminderButtons?: boolean } = {}): Promise<number | null> {
    if (!user.tgId || user.tgBlocked) return null
    const kb = this.keyboard(!!opts.reminderButtons)
    try {
      const msg = await this.bot.telegram.sendMessage(user.tgId, html, { parse_mode: 'HTML', ...(kb.length ? Markup.inlineKeyboard(kb) : {}) })
      return msg.message_id
    } catch (e) {
      await this.handleSendError(user, e)
      return null
    }
  }

  /** Напоминание с кнопками; у предыдущего напоминания кнопки-действия убираются. */
  async sendReminder(user: User, html: string): Promise<boolean> {
    if (user.tgReminderMsgId && user.tgId) {
      const kb = this.keyboard(false)
      await this.bot.telegram
        .editMessageReplyMarkup(user.tgId, user.tgReminderMsgId, undefined, kb.length ? { inline_keyboard: kb } : undefined)
        .catch(() => undefined) // сообщение могли удалить — не важно
    }
    const id = await this.send(user, html, { reminderButtons: true })
    if (id) await this.users.update(user.id, { tgReminderMsgId: id })
    return !!id
  }

  private async handleSendError(user: User, e: unknown) {
    const resp = (e as { response?: { error_code?: number; description?: string } }).response
    const desc = resp?.description ?? (e as Error).message
    if (resp?.error_code === 403 || UNREACHABLE.test(desc)) {
      await this.users.update(user.id, { tgBlocked: true })
      this.log.log(`Пользователь ${user.tgId} недоступен (${desc}) — сообщения в Telegram отключены`)
      return
    }
    // Остальное (например, ошибка разметки) — наша ошибка, пользователя не трогаем.
    this.log.error(`sendMessage ${user.tgId}: ${desc}`)
    Sentry.captureException(e, { extra: { userId: user.id, description: desc } })
  }

  /** Команды и кнопка меню — вызывается из main.ts. */
  async setup() {
    const t = this.bot.telegram
    await t.setMyCommands([
      { command: 'start', description: 'Начать и открыть тренажёр' },
      { command: 'settings', description: 'Настройки напоминаний' },
      { command: 'time', description: 'Время напоминания, например /time 19:30' },
      { command: 'on', description: 'Включить напоминания' },
      { command: 'off', description: 'Выключить напоминания' },
      { command: 'status', description: 'Текущие настройки' },
    ])
    if (this.webAppUrl.startsWith('https://')) {
      await t.setChatMenuButton({ menuButton: { type: 'web_app', text: 'Тренажёр', web_app: { url: this.webAppUrl } } })
    }
  }
}
