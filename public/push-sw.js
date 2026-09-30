/* Обработчик Web Push (подключается в сгенерированный service worker через importScripts). */
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data && event.data.text() } }
  const title = data.title || 'Συνέντευξη'
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || 'Пора позаниматься греческим!',
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    tag: data.tag || 'reminder',
    renotify: true,
    data: { url: data.url || '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if (c.url.startsWith(self.location.origin) && 'focus' in c) return c.focus()
    }
    return self.clients.openWindow(url)
  })())
})
