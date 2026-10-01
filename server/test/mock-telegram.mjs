// Мок Telegram Bot API для ручных проверок: отвечает ok на любой метод и пишет вызовы в stdout.
// chat_id 999 → ошибка разметки (400), chat_id 998 → бот заблокирован (403).
import http from 'node:http'
let msgId = 100
http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const method = req.url.split('/').pop()
    const b = body ? JSON.parse(body) : null
    console.log(JSON.stringify({ method, body: b }))
    res.setHeader('content-type', 'application/json')
    const fail = (code, description) => { res.statusCode = code; res.end(JSON.stringify({ ok: false, error_code: code, description })) }
    if (method === 'sendMessage' && String(b?.chat_id) === '999') return fail(400, "Bad Request: can't parse entities")
    if (method === 'sendMessage' && String(b?.chat_id) === '998') return fail(403, 'Forbidden: bot was blocked by the user')
    let result = true
    if (method === 'getMe') result = { id: 1, is_bot: true, first_name: 'Test', username: 'test_bot' }
    if (method === 'sendMessage') result = { message_id: ++msgId, date: Math.floor(Date.now() / 1000), chat: { id: b.chat_id, type: 'private' }, text: '' }
    res.end(JSON.stringify({ ok: true, result }))
  })
}).listen(8081)
