import type { Context, MiddlewareFn } from 'telegraf'

/**
 * Telegram повторяет апдейт, если вебхук ответил ошибкой или не успел ответить.
 * Запоминаем последние update_id, чтобы не выполнить команду дважды (реплика одна — памяти процесса достаточно).
 */
const seen = new Set<number>()
const LIMIT = 5000

export const dedupeUpdates: MiddlewareFn<Context> = (ctx, next) => {
  const id = ctx.update.update_id
  if (seen.has(id)) return
  seen.add(id)
  if (seen.size > LIMIT) seen.delete(seen.values().next().value as number)
  return next()
}
