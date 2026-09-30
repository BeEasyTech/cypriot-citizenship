import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Between, Repository } from 'typeorm'
import { DailyActivity } from '../entities/daily-activity.entity'

export interface DayNumbers {
  cards: number
  sims: number
  listen: number
  minutes: number
}

export interface WeekSummary extends DayNumbers {
  from: string
  to: string
  activeDays: number
  streak: number
}

/** Сдвиг даты YYYY-MM-DD на n дней. */
export function addDays(date: string, n: number) {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const isActive = (d: DayNumbers) => d.cards + d.sims + d.listen > 0

@Injectable()
export class ActivityService {
  constructor(@InjectRepository(DailyActivity) private readonly repo: Repository<DailyActivity>) {}

  /** Приложение присылает накопительные числа за день — берём максимум (запросы могут прийти не по порядку). */
  async record(userId: number, date: string, n: Partial<DayNumbers>) {
    const clamp = (v?: number) => Math.max(0, Math.min(100_000, Math.round(v ?? 0)))
    await this.repo.query(
      `INSERT INTO daily_activity (user_id, date, cards, sims, listen, minutes) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, date) DO UPDATE SET
         cards = GREATEST(daily_activity.cards, EXCLUDED.cards),
         sims = GREATEST(daily_activity.sims, EXCLUDED.sims),
         listen = GREATEST(daily_activity.listen, EXCLUDED.listen),
         minutes = GREATEST(daily_activity.minutes, EXCLUDED.minutes)`,
      [userId, date, clamp(n.cards), clamp(n.sims), clamp(n.listen), clamp(n.minutes)],
    )
  }

  /** Серия дней подряд с занятиями, заканчивающаяся сегодня или вчера. */
  async streak(userId: number, today: string): Promise<number> {
    const rows = await this.repo.find({
      where: { userId, date: Between(addDays(today, -400), today) },
      order: { date: 'DESC' },
    })
    const active = new Set(rows.filter(isActive).map((r) => r.date))
    let d = active.has(today) ? today : addDays(today, -1)
    let n = 0
    while (active.has(d)) { n++; d = addDays(d, -1) }
    return n
  }

  /** Итоги 7 дней, заканчивающихся датой `to` включительно. */
  async week(userId: number, to: string): Promise<WeekSummary> {
    const from = addDays(to, -6)
    const rows = await this.repo.find({ where: { userId, date: Between(from, to) } })
    const sum = rows.reduce((a, r) => ({ cards: a.cards + r.cards, sims: a.sims + r.sims, listen: a.listen + r.listen, minutes: a.minutes + r.minutes }), { cards: 0, sims: 0, listen: 0, minutes: 0 })
    return { ...sum, from, to, activeDays: rows.filter(isActive).length, streak: await this.streak(userId, to) }
  }

  hasAny(userId: number) {
    return this.repo.exist({ where: { userId } })
  }
}
