/* Kebbi Clinic service worker — receives Web Push messages from the backend and
 * shows an OS notification (with sound) even when the tab is closed. Clicking it
 * focuses an open app window or opens a new one.
 *
 * It deliberately does NOT cache or intercept fetches. An earlier version cached
 * the app shell, so after a deploy the browser kept serving the previous
 * index.html — whose <script> pointed at a JS bundle that no longer existed.
 * That 404 left #root empty: a completely blank page. Push notifications need
 * no caching, so keeping this worker fetch-free makes that failure impossible. */

self.addEventListener('install', () => {
  /* Take over straight away so a new deploy activates without waiting for every
     old tab to close. */
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    /* Drop anything an older caching version of this worker left behind. */
    if (self.caches) {
      const keys = await self.caches.keys()
      await Promise.all(keys.map((k) => self.caches.delete(k)))
    }
    await self.clients.claim()
  })())
})

self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch (err) { /* payload not JSON */ }
  const title = d.title || 'Kebbi Clinic'
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || 'You have a new notification',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: 'kebbi-clinic',
    data: { url: d.url || '/' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil((async () => {
    const url = (e.notification.data && e.notification.data.url) || '/'
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of all) {
      if ('focus' in client) return client.focus()
    }
    if (self.clients.openWindow) return self.clients.openWindow(url)
  })())
})
