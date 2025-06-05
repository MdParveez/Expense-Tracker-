const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });}

/**
 * Send a push notification using Firebase Cloud Messaging
 * @param {string} token - The FCM token of the recipient
 * @param {string} title - The notification title
 * @param {string} body - The notification body
 * @param {object} data - Additional data to send with the notification
 * @returns {Promise<void>}
 */
async function sendPushNotification(token, title, body, data = {}) {
  try {
    const message = {
      token,
      notification: {
        title,
        body
      },
      data: Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, String(value)])
      ),
      webpush: {
        fcm_options: {
          link: '/bills.html'
        },
        notification: {
          icon: 'https://cdn-icons-png.freepik.com/256/3602/3602175.png?semt=ais_hybrid',
          badge: 'https://cdn-icons-png.freepik.com/256/3602/3602175.png?semt=ais_hybrid',
          vibrate: [100, 50, 100],
          actions: [
            {
              action: 'view',
              title: 'View Bills'
            }
          ]
        }
      }
    };
    
    const response = await admin.messaging().send(message);
    console.log('Push notification sent successfully:', response);
    return response;
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
}

module.exports = sendPushNotification;