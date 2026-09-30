import { Injectable, Logger, Optional } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { UsersService, DEFAULT_TZ, isValidTz } from '../users/users.service'
import { PushService } from '../push/push.service'
import { BotService } from '../bot/bot.service'
import type { User } from '../entities/user.entity'
import { localNow, minutes, reminderText } from './texts'

/** Вечернее «ещё не поздно» — в это локальное время. */
const EVENING_AT = '21:00'
/** Сколько минут после назначенного времени ещё можно догнать напоминание (если сервер перезапускался). */
const CATCH_UP_MIN = 180

@Injectable()
export class RemindersService {
  private readonly log = new Logger(RemindersService.name)
  private running = false

  constructor(
    private readonly users: UsersService,
    private readonly push: PushService,
    @Optional() private readonly bot?: BotService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(now = new Date()) {
    if (this.running) return
    this.running = true
    try {
      const list = await this.users.findRemindable()
      for (const u of list) {
        const kind = this.dueKind(u, now)
        if (!kind) continue
        const { date } = localNow(this.tzOf(u), now)
        // Сначала помечаем, потом шлём — чтобы при сбое не заспамить повторами.
        await this.users.update(u.id, kind === 'main' ? { lastRemindedDate: date } : { lastEveningDate: date })
        await this.deliver(u, kind, date)
      }
    } catch (e) {
      this.log.error(`tick: ${(e as Error).message}`)
    } finally {
      this.running = false
    }
  }

  private tzOf(u: User) {
    return isValidTz(u.tz) ? u.tz : DEFAULT_TZ
  }

  /** Нужно ли сейчас напоминание и какое. */
  dueKind(u: User, now = new Date()): 'main' | 'evening' | null {
    if (!u.remindEnabled) return null
    const hasChannel = (!!u.tgId && !u.tgBlocked) || (u.pushSubscriptions?.length ?? 0) > 0
    if (!hasChannel) return null
    const { date, hm } = localNow(this.tzOf(u), now)
    if (u.lastActiveDate === date) return null // сегодня уже занимались

    const cur = minutes(hm)
    const at = minutes(u.remindTime)
    if (u.lastRemindedDate !== date && cur >= at && cur - at <= CATCH_UP_MIN) return 'main'

    const ev = minutes(EVENING_AT)
    if (
      u.eveningNudge && at < ev && u.lastRemindedDate === date && u.lastEveningDate !== date &&
      cur >= ev && cur - ev <= 120
    ) return 'evening'
    return null
  }

  /** Отправить по всем каналам пользователя. */
  async deliver(u: User, kind: 'main' | 'evening', date: string) {
    const text = reminderText(kind, date)
    const [tg, push] = await Promise.all([
      this.bot ? this.bot.send(u, text.html) : Promise.resolve(false),
      this.push.sendToUser(u, { title: text.title, body: text.body, url: '/', tag: 'daily-reminder' }, u.pushSubscriptions),
    ])
    this.log.log(`reminder ${kind} → user ${u.id}: tg=${tg} push=${push}`)
    return { telegram: tg, push }
  }
}
