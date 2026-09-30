// Sentry подключается до всего остального и только если задан SENTRY_DSN.
import * as Sentry from '@sentry/nestjs'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0,
    // Не отправляем тела запросов и заголовки авторизации.
    beforeSend(event) {
      if (event.request) {
        delete event.request.data
        delete event.request.headers
        delete event.request.cookies
      }
      return event
    },
  })
}
