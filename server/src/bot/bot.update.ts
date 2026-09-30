import { Action, Command, Ctx, On, Start, Update } from 'nestjs-telegraf'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User as UserEntity } from '../entities/user.entity'
import { PushSubscription } from '../entities/push-subscription.entity'
import { DailyActivity } from '../entities/daily-activity.entity'
import { localNow } from '../reminders/texts'
import { Markup, type Context } from 'telegraf'
import { UsersService } from '../users/users.service'
import { BotService } from './bot.service'
import type { User } from '../entities/user.entity'

const HHMM = /^([01]?\d|2[0-3])(?::|\.)?([0-5]\d)?$/

const nameOf = (ctx: Context) =>
  [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ') || ctx.from?.username || null

function statusText(u: User) {
  return [
    `⏰ Напоминания: <b>${u.remindEnabled ? `включены, в ${u.remindTime}` : 'выключены'}</b>`,
    `🌙 Вечернее «ещё не поздно» (21:00): <b>${u.eveningNudge ? 'да' : 'нет'}</b>`,
    `🕰 Часовой пояс: ${u.tz}`,
    u.lastActiveDate ? `📅 Последнее занятие: ${u.lastActiveDate}` : '📅 Занятий пока не было',
  ].join('\n')
}

const HELP = [
  'Команды:',
  '/time 19:30 — изменить время напоминания',
  '/off — выключить напоминания, /on — включить',
  '/evening — вечернее напоминание вкл/выкл',
  '/status — текущие настройки',
].join('\n')

@Update()
export class BotUpdate {
  constructor(
    private readonly users: UsersService,
    private readonly botService: BotService,
    private readonly config: ConfigService,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(PushSubscription) private readonly subRepo: Repository<PushSubscription>,
    @InjectRepository(DailyActivity) private readonly dayRepo: Repository<DailyActivity>,
  ) {}

  private async me(ctx: Context) {
    const u = await this.users.findOrCreateByTg(ctx.from!.id, nameOf(ctx))
    if (u.tgBlocked) {
      u.tgBlocked = false
      await this.users.save(u)
    }
    return u
  }

  @Start()
  async start(@Ctx() ctx: Context) {
    const u = await this.me(ctx)
    const first = ctx.from?.first_name ?? ''
    await ctx.reply(
      [
        `Γεια σας${first ? `, ${first}` : ''}! 👋`,
        '',
        'Это тренажёр для подготовки к собеседованию на гражданство Кипра: ответы на вопросы, фразы-спасатели, слова и симуляция собеседования.',
        '',
        '📱 Откройте тренажёр кнопкой ниже или кнопкой «Тренажёр» слева от поля ввода.',
        `⏰ Я буду напоминать о занятии каждый день в <b>${u.remindTime}</b> (${u.tz}), если вы ещё не занимались.`,
        '',
        HELP,
      ].join('\n'),
      { parse_mode: 'HTML', ...this.botService.openAppKeyboard() },
    )
  }

  @Command('time')
  async time(@Ctx() ctx: Context) {
    const u = await this.me(ctx)
    const arg = ((ctx.message as { text?: string })?.text ?? '').split(/\s+/)[1] ?? ''
    const m = arg.match(HHMM)
    if (!m) {
      await ctx.reply(`Напишите время так: /time 19:30\nСейчас: ${u.remindTime}`)
      return
    }
    u.remindTime = `${m[1].padStart(2, '0')}:${m[2] ?? '00'}`
    u.remindEnabled = true
    await this.users.save(u)
    await ctx.reply(`Готово! Буду напоминать в <b>${u.remindTime}</b> (${u.tz}).`, { parse_mode: 'HTML' })
  }

  @Command('on')
  async on(@Ctx() ctx: Context) {
    const u = await this.me(ctx)
    u.remindEnabled = true
    await this.users.save(u)
    await ctx.reply(`🔔 Напоминания включены, время: ${u.remindTime}.`)
  }

  @Command('off')
  async off(@Ctx() ctx: Context) {
    const u = await this.me(ctx)
    u.remindEnabled = false
    await this.users.save(u)
    await ctx.reply('🔕 Напоминания выключены. Включить снова: /on')
  }

  @Command('evening')
  async evening(@Ctx() ctx: Context) {
    const u = await this.me(ctx)
    u.eveningNudge = !u.eveningNudge
    await this.users.save(u)
    await ctx.reply(u.eveningNudge ? '🌙 Вечернее напоминание включено (в 21:00, если не занимались).' : '🌙 Вечернее напоминание выключено.')
  }

  @Command('status')
  async status(@Ctx() ctx: Context) {
    const u = await this.me(ctx)
    await ctx.reply(statusText(u), { parse_mode: 'HTML', ...this.botService.openAppKeyboard() })
  }

  @Command('help')
  async help(@Ctx() ctx: Context) {
    await ctx.reply(HELP)
  }

  /** Кнопки под напоминанием. */
  @Action(/^r:(snooze|done|skip)$/)
  async reminderAction(@Ctx() ctx: Context) {
    const action = (ctx.callbackQuery as { data?: string }).data?.slice(2)
    const u = await this.me(ctx)
    const { date } = localNow(u.tz)
    let toast = ''
    let note = ''
    if (action === 'snooze') {
      u.snoozeUntil = new Date(Date.now() + 60 * 60_000)
      toast = 'Напомню через час ⏰'
      note = '⏰ Напомню через час'
    } else if (action === 'done') {
      u.lastActiveDate = date
      u.snoozeUntil = null
      toast = 'Μπράβο! Сегодня больше не напомню 💪'
      note = '✅ Сегодня уже позанимался(ась)'
    } else {
      u.lastRemindedDate = date
      u.lastEveningDate = date
      u.snoozeUntil = null
      toast = 'Хорошо, сегодня больше не беспокою'
      note = '🔕 Сегодня без напоминаний'
    }
    await this.users.save(u)
    await ctx.answerCbQuery(toast)
    // Вместо кнопок-действий показываем выбранный вариант; «Открыть тренажёр» остаётся.
    const kb = [...this.botService.keyboard(false), [Markup.button.callback(note, 'r:noop')]]
    await ctx.editMessageReplyMarkup({ inline_keyboard: kb }).catch(() => undefined)
  }

  @Action('r:noop')
  async noop(@Ctx() ctx: Context) {
    await ctx.answerCbQuery()
  }

  /** Статистика для владельца бота (ADMIN_TG_IDS). */
  @Command('stats')
  async stats(@Ctx() ctx: Context) {
    const admins = (this.config.get<string>('ADMIN_TG_IDS') ?? '').split(',').map((x) => x.trim()).filter(Boolean)
    if (!ctx.from || !admins.includes(String(ctx.from.id))) {
      await ctx.reply('Эта команда только для владельца бота.')
      return
    }
    const today = localNow('Europe/Nicosia').date
    const weekAgo = new Date(Date.parse(today + 'T00:00:00Z') - 6 * 86_400_000).toISOString().slice(0, 10)
    const [total, tg, pwa, blocked, reminders, subs, activeToday, active7, cards7] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.createQueryBuilder('u').where('u.tgId IS NOT NULL').getCount(),
      this.userRepo.createQueryBuilder('u').where('u.deviceId IS NOT NULL').getCount(),
      this.userRepo.count({ where: { tgBlocked: true } }),
      this.userRepo.count({ where: { remindEnabled: true } }),
      this.subRepo.count(),
      this.userRepo.count({ where: { lastActiveDate: today } }),
      this.dayRepo.createQueryBuilder('d').select('COUNT(DISTINCT d.userId)', 'n').where('d.date >= :weekAgo', { weekAgo }).getRawOne<{ n: string }>(),
      this.dayRepo.createQueryBuilder('d').select('COALESCE(SUM(d.cards), 0)', 'n').where('d.date >= :weekAgo', { weekAgo }).getRawOne<{ n: string }>(),
    ])
    await ctx.reply([
      '📈 <b>Статистика</b>',
      `Пользователей: ${total} (Telegram: ${tg}, PWA: ${pwa})`,
      `Заблокировали бота: ${blocked}`,
      `Напоминания включены: ${reminders}`,
      `Push-подписок: ${subs}`,
      `Занимались сегодня: ${activeToday}`,
      `Активных за 7 дней: ${active7?.n ?? 0}`,
      `Карточек за 7 дней: ${cards7?.n ?? 0}`,
    ].join('\n'), { parse_mode: 'HTML' })
  }

  /** Пользователь заблокировал / разблокировал бота. */
  @On('my_chat_member')
  async memberChange(@Ctx() ctx: Context) {
    const upd = (ctx.update as { my_chat_member?: { new_chat_member?: { status?: string } } }).my_chat_member
    const status = upd?.new_chat_member?.status
    if (!ctx.from || !status) return
    const u = await this.users.findByTg(ctx.from.id)
    if (!u) return
    u.tgBlocked = status === 'kicked' || status === 'left'
    await this.users.save(u)
  }
}
