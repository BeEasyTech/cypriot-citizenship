import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectBot } from 'nestjs-telegraf'
import { Markup, Telegraf } from 'telegraf'
import { UsersService } from '../users/users.service'
import type { User } from '../entities/user.entity'

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
    const url = this.webAppUrl
    if (!url.startsWith('https://')) return undefined
    return Markup.inlineKeyboard([Markup.button.webApp('📱 Открыть тренажёр', url)])
  }

  /** Отправить сообщение; если пользователь заблокировал бота — пометить. */
  async send(user: User, html: string): Promise<boolean> {
    if (!user.tgId || user.tgBlocked) return false
    try {
      await this.bot.telegram.sendMessage(user.tgId, html, { parse_mode: 'HTML', ...this.openAppKeyboard() })
      return true
    } catch (e) {
      const code = (e as { response?: { error_code?: number } }).response?.error_code
      if (code === 403 || code === 400) {
        await this.users.update(user.id, { tgBlocked: true })
        this.log.log(`Пользователь ${user.tgId} недоступен (${code}) — напоминания в Telegram отключены`)
      } else {
        this.log.warn(`sendMessage ${user.tgId}: ${(e as Error).message}`)
      }
      return false
    }
  }

  /** Команды, кнопка меню и вебхук/поллинг — вызывается из main.ts. */
  async setup() {
    const t = this.bot.telegram
    await t.setMyCommands([
      { command: 'start', description: 'Начать и открыть тренажёр' },
      { command: 'time', description: 'Время напоминания, например /time 19:30' },
      { command: 'on', description: 'Включить напоминания' },
      { command: 'off', description: 'Выключить напоминания' },
      { command: 'evening', description: 'Вечернее «ещё не поздно»: вкл/выкл' },
      { command: 'status', description: 'Текущие настройки' },
    ])
    if (this.webAppUrl.startsWith('https://')) {
      await t.setChatMenuButton({ menuButton: { type: 'web_app', text: 'Тренажёр', web_app: { url: this.webAppUrl } } })
    }
  }
}
