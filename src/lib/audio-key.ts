/**
 * Общие правила для готового звука: одинаково используются скриптом генерации (Node) и приложением (браузер).
 * Никаких зависимостей от DOM — файл импортируется из scripts/generate-audio.ts.
 */

export type VoiceLetter = 'm' | 'f'

/** Нормализация текста перед озвучкой: без ⟨пропусков⟩, кавычек и лишних пробелов. */
export const cleanForSpeech = (s: string) =>
  s.replace(/⟨[^⟩]+⟩/g, ' … ').replace(/[«»"]/g, '').replace(/\s+/g, ' ').trim()

/** Строка, из которой считается ключ файла: голос + нормализованный текст. */
export const audioKeySource = (voice: VoiceLetter, text: string) => `${voice}|${cleanForSpeech(text)}`

/** Манифест готового звука в public/audio/manifest.json. */
export interface AudioManifest {
  version: 1
  provider: 'elevenlabs'
  model: string
  voices: Record<VoiceLetter, string>
  generatedAt: string
  /** Ключи (первые 16 hex-символов SHA-1 от audioKeySource) — файлы /audio/<ключ>.mp3 */
  keys: string[]
}

export const KEY_LENGTH = 16
