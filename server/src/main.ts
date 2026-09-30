import 'reflect-metadata'
import { createHash } from 'node:crypto'
import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { getBotToken } from 'nestjs-telegraf'
import type { Telegraf } from 'telegraf'
import { AppModule } from './app.module'
import { BotService } from './bot/bot.service'

const WEBHOOK_PATH = '/tg/webhook'

function allowedOrigins() {
  const list = new Set<string>()
  const add = (u?: string) => {
    if (!u) return
    try { list.add(new URL(u.trim()).origin) } catch { /* пропускаем мусор */ }
  }
  add(process.env.WEBAPP_URL)
  for (const o of (process.env.ALLOWED_ORIGINS ?? '').split(',')) add(o)
  return [...list]
}

function publicUrl() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '')
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  return ''
}

async function bootstrap() {
  const log = new Logger('Bootstrap')
  const app = await NestFactory.create(AppModule)
  app.enableCors({ origin: allowedOrigins(), allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id'], methods: ['GET', 'POST', 'PATCH', 'DELETE'] })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.enableShutdownHooks()

  const token = process.env.TELEGRAM_BOT_TOKEN
  let bot: Telegraf | undefined
  if (token) {
    bot = app.get<Telegraf>(getBotToken())
    // Секрет вебхука выводим из токена: не нужно хранить отдельно, Telegram пришлёт его в заголовке.
    const secretToken = createHash('sha256').update(`webhook:${token}`).digest('hex').slice(0, 48)
    app.use(bot.webhookCallback(WEBHOOK_PATH, { secretToken }))

    const base = publicUrl()
    if (base) {
      await bot.telegram.setWebhook(`${base}${WEBHOOK_PATH}`, {
        secret_token: secretToken,
        allowed_updates: ['message', 'my_chat_member', 'callback_query'],
      })
      log.log(`Telegram webhook: ${base}${WEBHOOK_PATH}`)
    } else {
      await bot.telegram.deleteWebhook()
      void bot.launch({ allowedUpdates: ['message', 'my_chat_member', 'callback_query'] })
      log.log('Telegram: режим polling (PUBLIC_URL не задан)')
    }
    await app.get(BotService).setup().catch((e) => log.warn(`setup бота: ${(e as Error).message}`))
  } else {
    log.warn('TELEGRAM_BOT_TOKEN не задан — бот выключен, работают только API и Web Push')
  }

  const port = Number(process.env.PORT) || 3000
  await app.listen(port, '0.0.0.0')
  log.log(`Сервер слушает :${port}, CORS: ${allowedOrigins().join(', ') || '—'}`)

  const stop = () => bot?.stop()
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}

bootstrap()
