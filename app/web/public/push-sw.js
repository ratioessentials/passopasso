// Gestione delle notifiche push, importata nel service worker generato da vite-plugin-pwa.
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data && event.data.text() } }
  const title = data.title || 'PassoPasso'
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || 'Un piccolo passo, quando vuoi.',
    icon: '/pwa/icon-192.png',
    badge: '/pwa/icon-192.png',
    tag: data.tag || 'passopasso',
    data: { url: data.url || '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if ('focus' in c) { await c.focus(); if ('navigate' in c) c.navigate(url).catch(() => {}); return }
    }
    await self.clients.openWindow(url)
  })())
})
