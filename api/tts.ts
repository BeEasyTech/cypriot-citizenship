/**
 * Озвучка через Azure Speech (нейроголоса el-GR).
 * GET /api/tts?t=<текст>&v=m|f&r=0.9  → audio/mpeg (кешируется CDN навсегда: один URL = один звук).
 * GET /api/tts?ping=1                → { configured: boolean }
 *
 * Переменные окружения: AZURE_SPEECH_KEY, AZURE_SPEECH_REGION (например, westeurope).
 */

const VOICES: Record<string, string> = {
  m: 'el-GR-NestorasNeural',
  f: 'el-GR-AthinaNeural',
}

const MAX_LEN = 500

const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

/** Защита от чужого использования: запросы только со своего сайта. */
function sameSite(req: Request) {
  const host = new URL(req.url).host
  const origin = req.headers.get('origin') || req.headers.get('referer')
  if (!origin) return req.headers.get('sec-fetch-site') !== 'cross-site'
  try { return new URL(origin).host === host } catch { return false }
}

export async function GET(req: Request) {
  const key = process.env.AZURE_SPEECH_KEY
  const region = process.env.AZURE_SPEECH_REGION || 'westeurope'
  const url = new URL(req.url)

  if (url.searchParams.has('ping')) return json({ configured: !!key })
  if (!key) return json({ error: 'AZURE_SPEECH_KEY не задан' }, 503)
  if (!sameSite(req)) return json({ error: 'forbidden' }, 403)

  const text = (url.searchParams.get('t') || '').trim()
  if (!text || text.length > MAX_LEN) return json({ error: 'bad text' }, 400)
  const voice = VOICES[url.searchParams.get('v') || 'f'] ?? VOICES.f
  const r = Math.min(1.3, Math.max(0.5, Number(url.searchParams.get('r')) || 1))
  const pct = Math.round((r - 1) * 100)

  const ssml = `<speak version="1.0" xml:lang="el-GR"><voice name="${voice}"><prosody rate="${pct >= 0 ? '+' : ''}${pct}%">${xml(text)}</prosody></voice></speak>`

  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'greek-interview',
    },
    body: ssml,
  })

  if (!res.ok) return json({ error: `azure ${res.status}` }, 502)

  return new Response(res.body, {
    headers: {
      'content-type': 'audio/mpeg',
      'cache-control': 'public, max-age=31536000, immutable',
      'cdn-cache-control': 'public, max-age=31536000, immutable',
    },
  })
}
