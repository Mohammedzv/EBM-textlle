const { onValueWritten } = require('firebase-functions/v2/database');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { getMessaging } = require('firebase-admin/messaging');
const logger = require('firebase-functions/logger');

initializeApp();

// Sends a push to every browser/device that has enabled notifications.
exports.notifyOnNewIncident = onValueWritten(
  { ref: '/ebmSystem/state/incidents/{incidentKey}', region: 'us-central1' },
  async (event) => {
    const before = event.data.before.exists() ? event.data.before.val() : null;
    const after = event.data.after.exists() ? event.data.after.val() : null;
    // Only send when a new incident is reported, not when an existing one is edited.
    if (!after || after.status !== 'reported' || (before && before.status === 'reported')) return;

    const db = getDatabase();
    const snap = await db.ref('ebmSystem/pushTokens').get();
    if (!snap.exists()) {
      logger.info('No registered push devices yet.');
      return;
    }
    const tokens = [];
    snap.forEach(child => {
      const token = child.child('token').val();
      if (typeof token === 'string' && token) tokens.push({token, key:child.key});
    });
    if (!tokens.length) return;

    const machineSnap = await db.ref('ebmSystem/state/machines').get();
    const machines = machineSnap.val() || [];
    const machineList = Array.isArray(machines) ? machines : Object.values(machines);
    const machine = machineList.find(m => m && m.id === after.machineId);
    const machineLabel = machine ? (machine.serial || machine.id) : 'ماكينة';
    const title = after.priority === 'urgent' ? '🔴 بلاغ عطل عاجل' : '🔔 بلاغ توقف ماكينة';
    const body = `${machineLabel}: ${after.problem || 'تم الإبلاغ عن عطل'}`;

    // FCM multicast accepts up to 500 tokens per request.
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      const result = await getMessaging().sendEachForMulticast({
        tokens: batch.map(x => x.token),
        notification: { title, body },
        data: { incidentId: String(after.id || event.params.incidentKey), machineId: String(after.machineId || '') },
        webpush: { notification: { title, body, requireInteraction: true } }
      });
      result.responses.forEach((response, index) => {
        if (!response.success && ['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(response.error?.code)) {
          db.ref('ebmSystem/pushTokens/' + batch[index].key).remove().catch(() => {});
        }
      });
      logger.info(`Push batch: ${result.successCount} success, ${result.failureCount} failed.`);
    }
  }
);
