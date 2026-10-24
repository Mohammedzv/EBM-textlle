// تمهيد فقط. الإشعارات الحقيقية بعد إغلاق الموقع تتطلب إعداد Firebase Messaging
// وخدمة إرسال موثوقة مثل Cloud Functions. لا تضع مفاتيح Service Account السرية هنا.
self.addEventListener("install",()=>self.skipWaiting());self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
