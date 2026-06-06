// ── Tahsin.ai Portal Service Worker ──────────────────────────────────────────

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('push', function (event) {
  if (!event.data) return

  let data = {}
  try { data = event.data.json() } catch { data = { title: 'Tahsin.ai', body: event.data.text() } }

  const title   = data.title || 'Tahsin.ai'
  const options = {
    body:    data.body    || 'You have a new notification.',
    icon:    data.icon    || '/favicon.ico',
    badge:   data.badge   || '/favicon.ico',
    tag:     data.tag     || 'tahsin-notification',
    data:    { url: data.url || '/conversations' },
    vibrate: [200, 100, 200],
    requireInteraction: data.urgent || false,
    actions: data.actions || [],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const url = event.notification.data?.url || '/conversations'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing portal tab if open
      const portalTab = clients.find(c => c.url.includes(self.location.origin))
      if (portalTab) {
        portalTab.focus()
        portalTab.navigate(self.location.origin + url)
      } else {
        self.clients.openWindow(self.location.origin + url)
      }
    })
  )
})
