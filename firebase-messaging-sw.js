// Import and configure the Firebase SDK
importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-messaging-compat.js');

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

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);
  
  const { title, body } = payload.notification;
  
  // Customize notification based on payload
  const options = {
    body,
    icon: 'https://cdn-icons-png.freepik.com/256/3602/3602175.png?semt=ais_hybrid',
    badge: 'https://cdn-icons-png.freepik.com/256/3602/3602175.png?semt=ais_hybrid',
    data: payload.data
  };
  
  return self.registration.showNotification(title, options);
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