import { Controller, Get, Module, type DynamicModule } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { TypeOrmModule } from '@nestjs/typeorm'
import { TelegrafModule } from 'nestjs-telegraf'
import { dataSourceOptions } from './data-source'
import { User } from './entities/user.entity'
import { PushSubscription } from './entities/push-subscription.entity'
import { AppSetting } from './entities/app-setting.entity'
import { DailyActivity } from './entities/daily-activity.entity'
import { ActivityService } from './activity/activity.service'
import { UsersService } from './users/users.service'
import { AuthGuard } from './auth/auth.guard'
import { PushService } from './push/push.service'
import { RemindersService } from './reminders/reminders.service'
import { ApiController } from './api/api.controller'
import { BotService } from './bot/bot.service'
import { BotUpdate } from './bot/bot.update'
import { dedupeUpdates } from './bot/dedupe'

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { ok: true, time: new Date().toISOString() }
  }
}

/** Бот подключается, только если задан TELEGRAM_BOT_TOKEN — без него API и push работают. */
const botEnabled = !!process.env.TELEGRAM_BOT_TOKEN

const botImports: DynamicModule[] = botEnabled
  ? [TelegrafModule.forRootAsync({
      inject: [ConfigService],
      // Запуск (вебхук/поллинг) делаем сами в main.ts.
      useFactory: (cfg: ConfigService) => ({
        token: cfg.getOrThrow<string>('TELEGRAM_BOT_TOKEN'),
        launchOptions: false,
        middlewares: [dedupeUpdates],
        // Для тестов можно направить бота на мок Bot API.
        ...(cfg.get('TELEGRAM_API_ROOT') ? { options: { telegram: { apiRoot: cfg.get<string>('TELEGRAM_API_ROOT') } } } : {}),
      }),
    })]
  : []

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({ useFactory: () => dataSourceOptions() }),
    TypeOrmModule.forFeature([User, PushSubscription, AppSetting, DailyActivity]),
    ...botImports,
  ],
  controllers: [HealthController, ApiController],
  providers: [
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    UsersService,
    AuthGuard,
    PushService,
    RemindersService,
    ActivityService,
    ...(botEnabled ? [BotService, BotUpdate] : []),
  ],
})
export class AppModule {}
