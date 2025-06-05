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

// Get messaging object
const messaging = firebase.messaging();

// Get notification permission button
const notificationBtn = document.getElementById('notification-btn');

// Function to request notification permission
async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      
      // Get the FCM token
      const token = await messaging.getToken({
        vapidKey: 'BAYlqm5DMJQkpHALPSueIx7IaHe44_RUrBilSJOrk62FpHWnW65PAHODlI3KfLEbv85At_NzkHS2Ep9kNuGDETY' 
      });
      
      // Send the token to your server
      await saveTokenToServer(token);
      
      // Update UI
      notificationBtn.textContent = 'Notifications Enabled';
      notificationBtn.disabled = true;
    } else {
      console.log('Notification permission denied.');
    }
  } catch (err) {
    console.error('Error requesting notification permission:', err);
  }
}

// Function to save the FCM token to your server
async function saveTokenToServer(token) {
  const userToken = localStorage.getItem('token');
  
  try {
    const response = await fetch('/api/auth/fcm-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({ fcmToken: token })
    });
    
    if (!response.ok) {
      throw new Error('Failed to save FCM token');
    }
    
    console.log('FCM token saved to server');
  } catch (err) {
    console.error('Error saving FCM token:', err);
  }
}

// Add click event listener to notification permission button
notificationBtn.addEventListener('click', requestNotificationPermission);

// Handle incoming messages when the app is in foreground
messaging.onMessage((payload) => {
  console.log('Message received:', payload);
  
  // Display a notification using the Notification API
  const { title, body } = payload.notification;
  
  const options = {
    body,
    icon: 'https://cdn-icons-png.freepik.com/256/3602/3602175.png?semt=ais_hybrid', // Update with your icon path
    badge: 'https://cdn-icons-png.freepik.com/256/3602/3602175.png?semt=ais_hybrid', // Update with your badge icon path
  };
  
  new Notification(title, options);
});

// Check if notifications are already enabled
async function checkNotificationStatus() {
  const permission = Notification.permission;
  
  if (permission === 'granted') {
    notificationBtn.textContent = 'Notifications Enabled';
    notificationBtn.disabled = true;
    
    // Get and save the token if permission is already granted
    try {
      const token = await messaging.getToken({
        vapidKey: 'BMtJ9vMCofWbeoOh9CbPWKyRy8cQ2IbdA4RxTZSFdXYtxXiP6bE8_7g2UHsYl4g9KTZkZcqKIfG7NgQGGbWIKK8' // Replace with your VAPID key
      });
      
      await saveTokenToServer(token);
    } catch (err) {
      console.error('Error getting FCM token:', err);
    }
  }
}

// Call the function when the page loads
document.addEventListener('DOMContentLoaded', checkNotificationStatus);