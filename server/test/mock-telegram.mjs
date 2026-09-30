// Мок Telegram Bot API: отвечает ok на любой метод и пишет вызовы в stdout.
import http from 'node:http'
http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const method = req.url.split('/').pop()
    let result = true
    if (method === 'getMe') result = { id: 1, is_bot: true, first_name: 'Test', username: 'test_bot' }
    if (method === 'sendMessage') result = { message_id: 1, date: 0, chat: { id: 1, type: 'private' }, text: '' }
    console.log(JSON.stringify({ method, body: body ? JSON.parse(body) : null }))
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ ok: true, result }))
  })
}).listen(8081)
