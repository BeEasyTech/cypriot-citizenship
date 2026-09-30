import { Controller, Get, Module, type DynamicModule } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { TypeOrmModule } from '@nestjs/typeorm'
import { TelegrafModule } from 'nestjs-telegraf'
import { dataSourceOptions } from './data-source'
import { User } from './entities/user.entity'
import { PushSubscription } from './entities/push-subscription.entity'
import { AppSetting } from './entities/app-setting.entity'
import { UsersService } from './users/users.service'
import { AuthGuard } from './auth/auth.guard'
import { PushService } from './push/push.service'
import { RemindersService } from './reminders/reminders.service'
import { ApiController } from './api/api.controller'
import { BotService } from './bot/bot.service'
import { BotUpdate } from './bot/bot.update'

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
        // Для тестов можно направить бота на мок Bot API.
        ...(cfg.get('TELEGRAM_API_ROOT') ? { options: { telegram: { apiRoot: cfg.get<string>('TELEGRAM_API_ROOT') } } } : {}),
      }),
    })]
  : []

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({ useFactory: () => dataSourceOptions() }),
    TypeOrmModule.forFeature([User, PushSubscription, AppSetting]),
    ...botImports,
  ],
  controllers: [HealthController, ApiController],
  providers: [
    UsersService,
    AuthGuard,
    PushService,
    RemindersService,
    ...(botEnabled ? [BotService, BotUpdate] : []),
  ],
})
export class AppModule {}
