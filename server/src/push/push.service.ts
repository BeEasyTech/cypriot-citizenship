import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import webpush from 'web-push'
import { AppSetting } from '../entities/app-setting.entity'
import { PushSubscription } from '../entities/push-subscription.entity'
import type { User } from '../entities/user.entity'

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly log = new Logger(PushService.name)
  publicKey = ''

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(AppSetting) private readonly settings: Repository<AppSetting>,
    @InjectRepository(PushSubscription) private readonly subs: Repository<PushSubscription>,
  ) {}

  /** VAPID-ключи: из окружения, иначе из БД, иначе генерируем и сохраняем. */
  async onModuleInit() {
    let pub = this.config.get<string>('VAPID_PUBLIC_KEY')
    let priv = this.config.get<string>('VAPID_PRIVATE_KEY')
    if (!pub || !priv) {
      const stored = await this.settings.findOne({ where: { key: 'vapid' } })
      if (stored) {
        ;({ publicKey: pub, privateKey: priv } = JSON.parse(stored.value))
      } else {
        const keys = webpush.generateVAPIDKeys()
        pub = keys.publicKey
        priv = keys.privateKey
        await this.settings.save({ key: 'vapid', value: JSON.stringify(keys) })
        this.log.log('Сгенерированы новые VAPID-ключи')
      }
    }
    const subject = this.config.get<string>('VAPID_SUBJECT') || 'mailto:admin@example.com'
    webpush.setVapidDetails(subject, pub!, priv!)
    this.publicKey = pub!
  }

  async subscribe(user: User, s: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    // endpoint уникален: если устройство сменило владельца — переназначаем
    await this.subs.upsert({ endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, userId: user.id }, ['endpoint'])
  }

  async unsubscribe(user: User, endpoint: string) {
    await this.subs.delete({ endpoint, userId: user.id })
  }

  countFor(user: User) {
    return this.subs.count({ where: { userId: user.id } })
  }

  /** Отправить на все устройства пользователя. Возвращает число успешных доставок. */
  async sendToUser(user: User, payload: PushPayload, subs?: PushSubscription[]): Promise<number> {
    const list = subs ?? (await this.subs.find({ where: { userId: user.id } }))
    let ok = 0
    for (const s of list) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 6 * 3600 })
        ok++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await this.subs.delete({ id: s.id }) // подписка больше не действует
        } else {
          this.log.warn(`push ${s.id}: ${status ?? (e as Error).message}`)
        }
      }
    }
    return ok
  }
}
