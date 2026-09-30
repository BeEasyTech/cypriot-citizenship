import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import { UsersService } from '../users/users.service'
import { validateInitData } from './telegram-init-data'
import type { User } from '../entities/user.entity'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type AuthedRequest = Request & { user?: User; tgWriteAllowed?: boolean }

/**
 * Два способа входа:
 *  - Telegram Mini App: заголовок `Authorization: tma <initData>` (подпись проверяется токеном бота);
 *  - PWA: заголовок `X-Device-Id: <uuid>` — случайный идентификатор, созданный на устройстве.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly users: UsersService, private readonly config: ConfigService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>()
    const auth = req.header('authorization') ?? ''

    if (auth.startsWith('tma ')) {
      const token = this.config.get<string>('TELEGRAM_BOT_TOKEN')
      if (!token) throw new UnauthorizedException('Бот не настроен на сервере')
      const tgUser = validateInitData(auth.slice(4), token)
      if (!tgUser) throw new UnauthorizedException('Неверная подпись Telegram')
      const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || null
      req.user = await this.users.findOrCreateByTg(tgUser.id, name)
      req.tgWriteAllowed = tgUser.allows_write_to_pm
      return true
    }

    const deviceId = req.header('x-device-id')
    if (deviceId && UUID_RE.test(deviceId)) {
      req.user = await this.users.findOrCreateByDevice(deviceId.toLowerCase())
      return true
    }

    throw new UnauthorizedException()
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().user!)
