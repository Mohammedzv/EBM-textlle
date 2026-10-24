/* Firebase Cloud Messaging service worker: background notifications */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA6GHkYt-BpjqoA51CZrJb3TjWXS-ux1LE",
  authDomain: "emtr-10091.firebaseapp.com",
  databaseURL: "PASTE_REALTIME_DATABASE_URL_HERE",
  projectId: "emtr-10091",
  storageBucket: "emtr-10091.firebasestorage.app",
  messagingSenderId: "640106990620",
  appId: "1:640106990620:web:4f79728bf100dc898b63d9",
  measurementId: "G-YS4KQT50PK"
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'EBM System — بلاغ صيانة جديد';
  const options = {
    body: payload.notification?.body || 'تم تسجيل بلاغ توقف ماكينة.',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: payload.data?.incidentId || ('ebm-' + Date.now()),
    renotify: true,
    data: { url: './index.html' }
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || './index.html';
  event.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then((windows) => {
    for (const client of windows) {
      if ('focus' in client) { client.navigate(url); return client.focus(); }
    }
    return clients.openWindow(url);
  }));
});
