import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash } from 'node:crypto'

export type VoiceLetter = 'm' | 'f'

/** Готовые голоса ElevenLabs по умолчанию (есть в любом аккаунте). Лучше заменить на греческие из Voice Library. */
const DEFAULT_VOICES: Record<VoiceLetter, string> = {
  m: 'JBFqnCBsd6RMkjVDRZzb', // George
  f: 'EXAVITQu4vr4xnSDxMaL', // Sarah
}

/** Сколько фраз в сутки может озвучить один пользователь на лету. */
const DAILY_LIMIT = 300
/** Кеш в памяти процесса (на диск и в БД звук не сохраняется). */
const CACHE_MAX = 300

/**
 * Озвучка через ElevenLabs для личных фраз (ответы из анкеты).
 * Слова, фразы и вопросы озвучены заранее скриптом и лежат во фронтенде в /audio.
 */
@Injectable()
export class TtsService {
  private readonly log = new Logger(TtsService.name)
  private readonly cache = new Map<string, Buffer>()
  private readonly usage = new Map<string, number>()

  constructor(private readonly config: ConfigService) {}

  get configured() {
    return !!this.config.get<string>('ELEVENLABS_API_KEY')
  }

  get model() {
    return this.config.get<string>('ELEVENLABS_MODEL') || 'eleven_multilingual_v2'
  }

  voiceId(v: VoiceLetter) {
    return this.config.get<string>(v === 'm' ? 'ELEVENLABS_VOICE_MALE' : 'ELEVENLABS_VOICE_FEMALE') || DEFAULT_VOICES[v]
  }

  /** Учёт лимита: не больше DAILY_LIMIT новых озвучек на пользователя в сутки. */
  private charge(userId: number) {
    const day = new Date().toISOString().slice(0, 10)
    const k = `${userId}:${day}`
    const n = (this.usage.get(k) ?? 0) + 1
    if (n > DAILY_LIMIT) throw new HttpException('Дневной лимит озвучки исчерпан', HttpStatus.TOO_MANY_REQUESTS)
    this.usage.set(k, n)
    if (this.usage.size > 10_000) this.usage.clear()
  }

  async synthesize(userId: number, text: string, voice: VoiceLetter): Promise<Buffer> {
    const key = createHash('sha1').update(`${this.model}|${voice}|${text}`).digest('hex')
    const hit = this.cache.get(key)
    if (hit) return hit
    this.charge(userId)

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId(voice)}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.config.getOrThrow<string>('ELEVENLABS_API_KEY'),
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: this.model,
        // У multilingual_v2 язык определяется сам; у остальных моделей подсказываем греческий.
        ...(this.model.startsWith('eleven_multilingual_v2') ? {} : { language_code: 'el' }),
        voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 1 },
      }),
    })
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300)
      this.log.error(`ElevenLabs ${res.status}: ${detail}`)
      throw new HttpException('Сервис озвучки недоступен', HttpStatus.BAD_GATEWAY)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    this.cache.set(key, buf)
    if (this.cache.size > CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string)
    return buf
  }
}
