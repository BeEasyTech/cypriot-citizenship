import { Injectable, Logger, Optional } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { UsersService, DEFAULT_TZ, isValidTz } from '../users/users.service'
import { PushService } from '../push/push.service'
import { BotService } from '../bot/bot.service'
import { ActivityService } from '../activity/activity.service'
import type { User } from '../entities/user.entity'
import { daysUntil, localNow, minutes, reminderText, weekday, weeklyText, type ReminderKind } from './texts'

/** Вечернее «ещё не поздно» — в это локальное время. */
const EVENING_AT = '21:00'
/** Итоги недели — в воскресенье в это время. */
const WEEKLY_AT = '12:00'
/** Сколько минут после назначенного времени ещё можно догнать напоминание (если сервер перезапускался). */
const CATCH_UP_MIN = 180

export type DueKind = ReminderKind | 'weekly'

@Injectable()
export class RemindersService {
  private readonly log = new Logger(RemindersService.name)
  private running = false

  constructor(
    private readonly users: UsersService,
    private readonly push: PushService,
    private readonly activity: ActivityService,
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
        const mark: Record<DueKind, Partial<User>> = {
          main: { lastRemindedDate: date },
          evening: { lastEveningDate: date },
          snooze: { snoozeUntil: null },
          weekly: { lastWeeklyDate: date },
        }
        await this.users.update(u.id, mark[kind])
        if (kind === 'weekly') await this.deliverWeekly(u, date)
        else await this.deliver(u, kind, date)
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

  /** Нужно ли сейчас что-то отправить и что именно. */
  dueKind(u: User, now = new Date()): DueKind | null {
    if (!u.remindEnabled) return null
    const hasChannel = (!!u.tgId && !u.tgBlocked) || (u.pushSubscriptions?.length ?? 0) > 0
    if (!hasChannel) return null
    const { date, hm } = localNow(this.tzOf(u), now)
    const cur = minutes(hm)

    // Итоги недели — по воскресеньям, если человек вообще когда-то занимался.
    const wk = minutes(WEEKLY_AT)
    if (weekday(date) === 0 && u.lastWeeklyDate !== date && u.lastActiveDate && cur >= wk && cur - wk <= 360) return 'weekly'

    const activeToday = u.lastActiveDate === date
    // «Напомнить через час»
    if (u.snoozeUntil) {
      if (now.getTime() >= new Date(u.snoozeUntil).getTime()) return activeToday ? null : 'snooze'
      return null // ждём отложенное напоминание
    }
    if (activeToday) return null

    const at = minutes(u.remindTime)
    if (u.lastRemindedDate !== date && cur >= at && cur - at <= CATCH_UP_MIN) return 'main'

    const ev = minutes(EVENING_AT)
    if (
      u.eveningNudge && at < ev && u.lastRemindedDate === date && u.lastEveningDate !== date &&
      cur >= ev && cur - ev <= 120
    ) return 'evening'
    return null
  }

  /** Отправить напоминание по всем каналам пользователя. */
  async deliver(u: User, kind: ReminderKind, date: string) {
    const text = reminderText(kind, date, daysUntil(u.interviewDate, date))
    const [tg, push] = await Promise.all([
      this.bot ? this.bot.send(u, text.html, { reminderButtons: true }) : Promise.resolve(false),
      this.push.sendToUser(u, { title: text.title, body: text.body, url: '/', tag: 'daily-reminder' }, u.pushSubscriptions),
    ])
    this.log.log(`reminder ${kind} → user ${u.id}: tg=${tg} push=${push}`)
    return { telegram: tg, push }
  }

  /** Итоги недели, заканчивающейся датой `date` (обычно воскресенье). */
  async deliverWeekly(u: User, date: string) {
    const w = await this.activity.week(u.id, date)
    const text = weeklyText(w, daysUntil(u.interviewDate, date))
    const [tg, push] = await Promise.all([
      this.bot ? this.bot.send(u, text.html) : Promise.resolve(false),
      this.push.sendToUser(u, { title: text.title, body: text.body, url: '/', tag: 'weekly' }, u.pushSubscriptions),
    ])
    this.log.log(`weekly → user ${u.id}: tg=${tg} push=${push}`)
    return { telegram: tg, push }
  }

}
