// Import and configure the Firebase SDK
importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-messaging-compat.js');

// Log when service worker is loaded
console.log('Firebase messaging service worker loaded!');

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDyJ6axUfgY43ChacbGFTKp3BhLUFKqUsE",
  authDomain: "expensify-401ce.firebaseapp.com",
  projectId: "expensify-401ce",
  storageBucket: "expensify-401ce.firebasestorage.app",
  messagingSenderId: "668626190094",
  appId: "1:668626190094:web:5995bde4ca4983872b615f",
  measurementId: "G-9BVWQT70Q6"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
console.log('Firebase initialized in service worker');

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();
console.log('Firebase messaging initialized in service worker');

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received in service worker:', payload);

  try {
    const { title, body } = payload.notification;

    // Customize notification based on payload with enhanced options
    const options = {
      body,
      icon: 'https://cdn-icons-png.freepik.com/256/3602/3602175.png?semt=ais_hybrid',
      badge: 'https://cdn-icons-png.freepik.com/256/3602/3602175.png?semt=ais_hybrid',
      data: payload.data,
      vibrate: [100, 50, 100],
      requireInteraction: true,
      silent: false,
      renotify: true,
      tag: 'bill-notification-' + Date.now(),
      actions: [
        {
          action: 'view',
          title: 'View Bills'
        }
      ]
    };

    console.log('Showing background notification:', { title, options });

    // Use promise-based approach for better error handling
    return self.registration.showNotification(title, options)
      .then(() => {
        console.log('Background notification shown successfully');
      })
      .catch(error => {
        console.error('Error showing background notification:', error);

        // Try a simpler notification as fallback
        return self.registration.showNotification('Expense Tracker Alert', {
          body: 'You have a new notification from your expense tracker',
          icon: 'https://cdn-icons-png.freepik.com/256/3602/3602175.png?semt=ais_hybrid'
        });
      });
  } catch (error) {
    console.error('Exception in background notification handler:', error);
  }
});

// Listen for messages from the client
self.addEventListener('message', (event) => {
  console.log('Message received in service worker:', event.data);

  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data.payload;
    console.log('Showing notification from client message:', { title, options });

    // Add more aggressive notification options
    const enhancedOptions = {
      ...options,
      requireInteraction: true,  // Keep notification until user interacts with it
      silent: false,             // Allow sound
      vibrate: [100, 50, 100],   // Vibration pattern
      renotify: true,            // Notify even if there's already a notification with same tag
      tag: 'bill-notification-' + Date.now(),  // Unique tag to ensure it shows
      actions: [                 // Add action buttons
        {
          action: 'view',
          title: 'View Bills'
        }
      ]
    };

    console.log('Enhanced notification options:', enhancedOptions);

    // Try to show the notification
    try {
      self.registration.showNotification(title, enhancedOptions)
        .then(() => console.log('Notification shown successfully'))
        .catch(error => console.error('Error showing notification:', error));
    } catch (error) {
      console.error('Exception showing notification:', error);

      // Fallback to basic notification
      self.registration.showNotification(title, {
        body: options.body || 'Notification from your expense tracker',
        icon: options.icon
      }).catch(err => console.error('Even basic notification failed:', err));
    }
  }

  // Handle skip waiting message to activate the service worker immediately
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Skip waiting message received, activating service worker immediately');
    self.skipWaiting();
  }
});

// Activate the service worker as soon as possible
self.addEventListener('activate', (event) => {
  console.log('Service worker activated');
  // Take control of all clients immediately
  event.waitUntil(clients.claim());
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Get data from the notification
  const data = event.notification.data;

  // This will open the app and navigate to the bills page
  const urlToOpen = new URL('/bills.html', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }

      // If no window/tab is open with the target URL, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});