/* Firebase Cloud Messaging service worker: background notifications */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDmJ4mrcgpWx0KeFsNalc0bFIT3bmOmF_c",
  authDomain: "sstmy-627dc.firebaseapp.com",
  databaseURL: "https://sstmy-627dc-default-rtdb.firebaseio.com",
  projectId: "sstmy-627dc",
  storageBucket: "sstmy-627dc.firebasestorage.app",
  messagingSenderId: "711278472895",
  appId: "1:711278472895:web:3f8ecd2eb8946bbbcae00a",
  measurementId: "G-B38ZQ6N0GL"
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
