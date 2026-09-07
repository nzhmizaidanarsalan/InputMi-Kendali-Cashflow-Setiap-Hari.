// InputMi Service Worker for Web Push Notifications
self.addEventListener('install', (event) => {
  // Activate immediately without waiting
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push notification event
self.addEventListener('push', (event) => {
  let data = {
    title: 'Pengingat InputMi',
    body: 'Ada tagihan yang jatuh tempo. Buka InputMi untuk detail.',
    url: '/#balance',
    tag: 'inputmi-liability-reminder',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (err) {
      try {
        const text = event.data.text();
        if (text) data.body = text;
      } catch (e) {
        // use fallback
      }
    }
  }

  // Safe notification options complying with privacy rules
  const options = {
    body: data.body || 'Ada tagihan yang jatuh tempo. Buka InputMi untuk detail.',
    icon: '/favicon-48x48.png',
    badge: '/favicon.svg',
    tag: data.tag || 'inputmi-liability-reminder',
    renotify: true,
    data: {
      url: data.url || '/#balance',
      timestamp: Date.now(),
    },
    actions: [
      {
        action: 'open_app',
        title: 'Buka InputMi',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Pengingat InputMi', options)
  );
});

// Handle notification click: focus existing window or open new one
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl =
    (event.notification.data && event.notification.data.url) || '/#balance';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If there is an existing tab, focus it and navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open a new tab/window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle push subscription rotation/change event
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription ? event.oldSubscription.options : { userVisibleOnly: true })
      .then((newSubscription) => {
        // Can post to server
        return fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: newSubscription }),
        });
      })
      .catch((err) => {
        console.error('Failed to rotate push subscription:', err);
      })
  );
});
