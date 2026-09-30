import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Patch, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { AuthGuard, CurrentUser } from '../auth/auth.guard'
import { UsersService, isValidTz } from '../users/users.service'
import { PushService } from '../push/push.service'
import { RemindersService } from '../reminders/reminders.service'
import type { User } from '../entities/user.entity'
import { ActivityDto, PushSubscribeDto, PushUnsubscribeDto, UpdateMeDto } from './dto'
import { localNow } from '../reminders/texts'

@Controller('api')
export class ApiController {
  constructor(
    private readonly users: UsersService,
    private readonly push: PushService,
    private readonly reminders: RemindersService,
  ) {}

  /** Публичный VAPID-ключ для подписки на push. */
  @Get('push/vapid')
  vapid() {
    return { publicKey: this.push.publicKey }
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async me(@CurrentUser() u: User, @Req() req: Request & { tgWriteAllowed?: boolean }) {
    return this.view(u, req.tgWriteAllowed)
  }

  @UseGuards(AuthGuard)
  @Patch('me')
  async update(@CurrentUser() u: User, @Body() dto: UpdateMeDto) {
    if (dto.tz !== undefined && !isValidTz(dto.tz)) throw new BadRequestException('Неизвестный часовой пояс')
    for (const [k, v] of Object.entries(dto)) if (v !== undefined) (u as unknown as Record<string, unknown>)[k] = v
    // Если время сменили на более позднее сегодня — напоминание снова «ждёт».
    if (dto.remindTime) u.lastRemindedDate = null
    await this.users.save(u)
    return this.view(u)
  }

  /** Отметка «сегодня занимался(ась)» — только дата, без прогресса. */
  @UseGuards(AuthGuard)
  @Post('activity')
  @HttpCode(204)
  async activity(@CurrentUser() u: User, @Body() dto: ActivityDto) {
    const patch: Partial<User> = { lastActiveDate: dto.date }
    if (dto.tz && isValidTz(dto.tz)) patch.tz = dto.tz
    await this.users.update(u.id, patch)
  }

  @UseGuards(AuthGuard)
  @Post('push/subscribe')
  @HttpCode(204)
  async subscribe(@CurrentUser() u: User, @Body() dto: PushSubscribeDto) {
    await this.push.subscribe(u, dto)
  }

  @UseGuards(AuthGuard)
  @Delete('push/subscribe')
  @HttpCode(204)
  async unsubscribe(@CurrentUser() u: User, @Body() dto: PushUnsubscribeDto) {
    await this.push.unsubscribe(u, dto.endpoint)
  }

  /** Прислать тестовое напоминание прямо сейчас. */
  @UseGuards(AuthGuard)
  @Post('reminders/test')
  async test(@CurrentUser() u: User) {
    const { date } = localNow(u.tz)
    return this.reminders.deliver(u, 'main', date)
  }

  private async view(u: User, tgWriteAllowed?: boolean) {
    return {
      telegram: !!u.tgId,
      tgBlocked: u.tgBlocked,
      tgWriteAllowed: tgWriteAllowed ?? null,
      tz: u.tz,
      remindEnabled: u.remindEnabled,
      remindTime: u.remindTime,
      eveningNudge: u.eveningNudge,
      lastActiveDate: u.lastActiveDate,
      pushDevices: await this.push.countFor(u),
    }
  }
}
