import { Action, Command, Ctx, On, Start, Update } from 'nestjs-telegraf'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Markup, type Context } from 'telegraf'
import tzlookup from '@photostructure/tz-lookup'
import { User as UserEntity } from '../entities/user.entity'
import { PushSubscription } from '../entities/push-subscription.entity'
import { DailyActivity } from '../entities/daily-activity.entity'
import { isQuiet, localNow } from '../reminders/texts'
import { UsersService, isValidTz } from '../users/users.service'
import { BotService } from './bot.service'
import { escapeHtml } from './html'
import { settingsKeyboard, settingsText, timeKeyboard, tzKeyboard, tzLabel } from './settings-view'
import type { User } from '../entities/user.entity'

const HHMM = /^([01]?\d|2[0-3])(?::|\.)?([0-5]\d)?$/

const nameOf = (ctx: Context) =>
  [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ') || ctx.from?.username || null

const HELP = [
  'Команды:',
  '/settings — настройки напоминаний кнопками',
  '/time 19:30 — изменить время напоминания',
  '/off — выключить напоминания, /on — включить',
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

  /** Новое время: как в приложении — «уже напомнили сегодня» сбрасывается. */
  private async setTime(u: User, time: string) {
    u.remindTime = time
    u.remindEnabled = true
    u.lastRemindedDate = null
    await this.users.save(u)
  }

  @Start()
  async start(@Ctx() ctx: Context) {
    const u = await this.me(ctx)
    const first = escapeHtml(ctx.from?.first_name ?? '')
    await ctx.reply(
      [
        `Γεια σας${first ? `, ${first}` : ''}! 👋`,
        '',
        'Это тренажёр для подготовки к собеседованию на гражданство Кипра: ответы на вопросы, фразы-спасатели, слова и симуляция собеседования.',
        '',
        '📱 Откройте тренажёр кнопкой ниже или кнопкой «Тренажёр» слева от поля ввода.',
        `⏰ Я буду напоминать о занятии каждый день в <b>${u.remindTime}</b> (${escapeHtml(tzLabel(u.tz))}), если вы ещё не занимались. Изменить — /settings`,
        '',
        HELP,
      ].join('\n'),
      { parse_mode: 'HTML', ...this.botService.openAppKeyboard() },
    )
  }

  /* ------------------------------------------------ команды */

  @Command('time')
  async time(@Ctx() ctx: Context) {
    const u = await this.me(ctx)
    const arg = ((ctx.message as { text?: string })?.text ?? '').split(/\s+/)[1] ?? ''
    const m = arg.match(HHMM)
    if (!m) {
      await ctx.reply(`Напишите время так: /time 19:30 — или выберите в /settings\nСейчас: ${u.remindTime}`)
      return
    }
    const t = `${m[1].padStart(2, '0')}:${m[2] ?? '00'}`
    await this.setTime(u, t)
    const quiet = isQuiet(t) ? '\n🤫 Это время попадает в тихие часы — напомню, раз вы так выбрали.' : ''
    await ctx.reply(`Готово! Буду напоминать в <b>${t}</b> (${escapeHtml(tzLabel(u.tz))}).${quiet}`, { parse_mode: 'HTML' })
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

  @Command(['settings', 'status'])
  async settings(@Ctx() ctx: Context) {
    const u = await this.me(ctx)
    const last = u.lastActiveDate ? `\n📅 Последнее занятие: ${u.lastActiveDate}` : '\n📅 Занятий пока не было'
    await ctx.reply(settingsText(u) + last, { parse_mode: 'HTML', ...Markup.inlineKeyboard(settingsKeyboard(u)) })
  }

  @Command('help')
  async help(@Ctx() ctx: Context) {
    await ctx.reply(HELP)
  }

  /* ------------------------------------------------ меню настроек (редактируется на месте) */

  @Action(/^s:/)
  async settingsAction(@Ctx() ctx: Context) {
    const data = (ctx.callbackQuery as { data?: string }).data ?? ''
    const u = await this.me(ctx)
    const show = async (kb: ReturnType<typeof settingsKeyboard>, toast?: string) => {
      await ctx.answerCbQuery(toast).catch(() => undefined)
      await ctx.editMessageText(settingsText(u), { parse_mode: 'HTML', ...Markup.inlineKeyboard(kb) }).catch(() => undefined)
    }

    if (data === 's:menu') return show(settingsKeyboard(u))
    if (data === 's:time') return show(timeKeyboard(u))
    if (data === 's:tz') return show(tzKeyboard(u))
    if (data === 's:close') {
      await ctx.answerCbQuery()
      await ctx.editMessageReplyMarkup(undefined).catch(() => undefined)
      return
    }
    if (data.startsWith('s:t:')) {
      const t = data.slice(4)
      if (!HHMM.test(t)) return ctx.answerCbQuery()
      await this.setTime(u, t)
      return show(settingsKeyboard(u), `Буду напоминать в ${t}`)
    }
    if (data.startsWith('s:z:')) {
      const tz = data.slice(4)
      if (!isValidTz(tz)) return ctx.answerCbQuery('Неизвестный часовой пояс')
      u.tz = tz
      await this.users.save(u)
      return show(settingsKeyboard(u), `Часовой пояс: ${tzLabel(tz)}`)
    }
    if (data === 's:toggle:on') {
      u.remindEnabled = !u.remindEnabled
      await this.users.save(u)
      return show(settingsKeyboard(u), u.remindEnabled ? 'Напоминания включены' : 'Напоминания выключены')
    }
    if (data === 's:toggle:evening') {
      u.eveningNudge = !u.eveningNudge
      await this.users.save(u)
      return show(settingsKeyboard(u), u.eveningNudge ? 'Вечернее включено' : 'Вечернее выключено')
    }
    if (data === 's:loc') {
      await ctx.answerCbQuery()
      await ctx.reply('Нажмите кнопку ниже — по геолокации я определю только часовой пояс, координаты не сохраняются.',
        Markup.keyboard([[Markup.button.locationRequest('📍 Отправить геолокацию')], ['Отмена']]).oneTime().resize())
      return
    }
    await ctx.answerCbQuery()
  }

  /** Геолокация → часовой пояс (сами координаты не сохраняем). */
  @On('location')
  async location(@Ctx() ctx: Context) {
    const loc = (ctx.message as { location?: { latitude: number; longitude: number } }).location
    if (!loc) return
    const u = await this.me(ctx)
    let tz = ''
    try { tz = tzlookup(loc.latitude, loc.longitude) } catch { /* вне карты */ }
    if (!tz || !isValidTz(tz)) {
      await ctx.reply('Не получилось определить часовой пояс — выберите его в /settings.', Markup.removeKeyboard())
      return
    }
    u.tz = tz
    await this.users.save(u)
    await ctx.reply(`🕰 Часовой пояс: <b>${escapeHtml(tzLabel(tz))}</b>. Напоминания будут приходить по местному времени.`, { parse_mode: 'HTML', ...Markup.removeKeyboard() })
  }

  /* ------------------------------------------------ кнопки под напоминанием */

  @Action(/^r:(snooze|done|skip)$/)
  async reminderAction(@Ctx() ctx: Context) {
    const action = (ctx.callbackQuery as { data?: string }).data?.slice(2)
    const u = await this.me(ctx)
    const now = new Date()
    const { date } = localNow(u.tz, now)
    const keep = this.botService.keyboard(false)

    // Кнопки вчерашнего напоминания уже не действуют.
    const msgDate = (ctx.callbackQuery?.message as { date?: number } | undefined)?.date
    if (msgDate && localNow(u.tz, new Date(msgDate * 1000)).date !== date) {
      await ctx.answerCbQuery('Это напоминание за прошлый день')
      await ctx.editMessageReplyMarkup(keep.length ? { inline_keyboard: keep } : undefined).catch(() => undefined)
      return
    }

    let toast: string
    let note: string
    if (action === 'snooze') {
      const later = new Date(now.getTime() + 60 * 60_000)
      const l = localNow(u.tz, later)
      if (l.date !== date || isQuiet(l.hm)) {
        // Через час уже ночь — не будим, просто до завтра.
        u.lastRemindedDate = date
        u.lastEveningDate = date
        u.snoozeUntil = null
        toast = `Уже поздно — напомню завтра в ${u.remindTime} 🌙`
        note = `🌙 Напомню завтра в ${u.remindTime}`
      } else {
        u.snoozeUntil = later
        toast = 'Напомню через час ⏰'
        note = `⏰ Напомню в ${l.hm}`
      }
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
    await ctx.editMessageReplyMarkup({ inline_keyboard: [...keep, [Markup.button.callback(note, 'r:noop')]] }).catch(() => undefined)
  }

  @Action('r:noop')
  async noop(@Ctx() ctx: Context) {
    await ctx.answerCbQuery()
  }

  /* ------------------------------------------------ владелец */

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

  /** Любой другой текст. Должен быть последним: обработчики срабатывают в порядке объявления. */
  @On('text')
  async text(@Ctx() ctx: Context) {
    const t = (ctx.message as { text?: string }).text ?? ''
    if (t === 'Отмена') {
      await ctx.reply('Хорошо.', Markup.removeKeyboard())
      return
    }
    await ctx.reply(`Я бот-напоминалка 🙂 Заниматься удобнее в приложении.\n\n${HELP}`, this.botService.openAppKeyboard())
  }
}
