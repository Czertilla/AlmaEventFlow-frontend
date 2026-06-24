self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch (e) {
    payload = { title: 'AlmaEventFlow', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'AlmaEventFlow'
  const options = {
    body: payload.body || '',
    icon: '/aef.svg',
    badge: '/aef.svg',
    data: { url: payload.url || '/', ...(payload.data || {}) },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ('focus' in client) {
            client.focus()
            if (url && 'navigate' in client) {
              client.navigate(url).catch(() => {})
            }
            return
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url)
        }
      }),
  )
})
