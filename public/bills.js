// Get token from localStorage
const token = localStorage.getItem("token");
const form = document.getElementById("bill-form");
const tableBody = document.querySelector("#bills-table tbody");
let currentEditId = null;
const notificationBtn = document.getElementById("notification-btn");

// Function to request notification permission
async function requestNotificationPermission() {
  try {
    if (!window.firebaseMessaging) {
      throw new Error("Firebase Messaging not available");
    }

    // First, register service worker if not already registered
    if ("serviceWorker" in navigator) {
      try {
        // Register the service worker
        const registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js"
        );
        console.log(
          "Service Worker registered with scope:",
          registration.scope
        );

        // Wait for the service worker to be ready and active
        if (registration.installing) {
          console.log("Service worker installing");

          // Wait for the service worker to be activated
          await new Promise((resolve) => {
            registration.installing.addEventListener("statechange", (e) => {
              if (e.target.state === "activated") {
                console.log("Service worker now activated");
                resolve();
              }
            });
          });
        } else if (registration.waiting) {
          console.log("Service worker waiting");
        } else if (registration.active) {
          console.log("Service worker already active");
        }

        // Force clients to update to the new service worker
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      } catch (error) {
        console.error("Service Worker registration failed:", error);
      }
    }

    const permission = await Notification.requestPermission();
    console.log("Notification permission status:", permission);

    if (permission === "granted") {
      console.log("Notification permission granted.");

      // Get the FCM token using the ES modules approach
      const vapidKey =
        "BAYlqm5DMJQkpHALPSueIx7IaHe44_RUrBilSJOrk62FpHWnW65PAHODlI3KfLEbv85At_NzkHS2Ep9kNuGDETY";
      console.log("Requesting FCM token with VAPID key:", vapidKey);

      const token = await window.firebaseGetToken(window.firebaseMessaging, {
        vapidKey: vapidKey,
        serviceWorkerRegistration:
          await navigator.serviceWorker.getRegistration(
            "/firebase-messaging-sw.js"
          ),
      });

      console.log("FCM token received:", token);

      // Send the token to your server
      await saveTokenToServer(token);

      // Update UI
      notificationBtn.textContent = "Notifications Enabled";
      notificationBtn.disabled = true;

      // Test notification to verify it's working
      const testNotification = new Notification("Notification Enabled", {
        body: "You will now receive bill payment reminders.",
        icon: "https://cdn-icons-png.freepik.com/256/3602/3602175.png?semt=ais_hybrid",
      });

      return true;
    } else {
      console.log("Notification permission denied.");
      alert("Please allow notifications to receive bill payment reminders.");
      return false;
    }
  } catch (err) {
    console.error("Error requesting notification permission:", err);
    alert("Error enabling notifications. Please try again.");
    return false;
  }
}

// Function to save the FCM token to your server
async function saveTokenToServer(fcmToken) {
  try {
    const response = await fetch("/api/auth/fcm-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fcmToken }),
    });

    if (!response.ok) {
      throw new Error("Failed to save FCM token");
    }

    console.log("FCM token saved to server");
  } catch (err) {
    console.error("Error saving FCM token:", err);
    // We don't want to block the user if this fails
  }
}

// Check if notifications are already enabled
async function checkNotificationStatus() {
  const permission = Notification.permission;
  console.log("Current notification permission status:", permission);

  if (permission === "granted") {
    if (notificationBtn) {
      notificationBtn.textContent = "Notifications Enabled";
      notificationBtn.disabled = true;
    }

    // Register service worker if not already registered
    if ("serviceWorker" in navigator) {
      try {
        // Get existing registration or register new one
        let registration = await navigator.serviceWorker.getRegistration(
          "/firebase-messaging-sw.js"
        );

        if (!registration) {
          console.log("No service worker found, registering new one");
          registration = await navigator.serviceWorker.register(
            "/firebase-messaging-sw.js"
          );
          console.log(
            "Service Worker registered with scope:",
            registration.scope
          );

          // Wait for the service worker to be activated
          if (registration.installing) {
            console.log("Service worker installing, waiting for activation");
            await new Promise((resolve) => {
              registration.installing.addEventListener("statechange", (e) => {
                if (e.target.state === "activated") {
                  console.log("Service worker now activated");
                  resolve();
                }
              });
            });
          }
        } else {
          console.log(
            "Service worker already registered with scope:",
            registration.scope
          );

          // If there's a waiting service worker, activate it
          if (registration.waiting) {
            console.log("Service worker waiting, activating it");
            registration.waiting.postMessage({ type: "SKIP_WAITING" });

            // Wait for the controller to change
            await new Promise((resolve) => {
              navigator.serviceWorker.addEventListener(
                "controllerchange",
                () => {
                  console.log("Service worker controller changed");
                  resolve();
                }
              );
            });
          }
        }

        // Ensure we have an active service worker
        if (!navigator.serviceWorker.controller) {
          console.log("No active service worker controller, reloading page");
          window.location.reload();
          return;
        }
      } catch (error) {
        console.error("Service Worker registration failed:", error);
      }
    }

    // Get and save the token if permission is already granted and messaging is available
    if (window.firebaseMessaging) {
      try {
        const vapidKey =
          "BAYlqm5DMJQkpHALPSueIx7IaHe44_RUrBilSJOrk62FpHWnW65PAHODlI3KfLEbv85At_NzkHS2Ep9kNuGDETY";
        console.log("Requesting FCM token with VAPID key:", vapidKey);

        const token = await window.firebaseGetToken(window.firebaseMessaging, {
          vapidKey: vapidKey,
          serviceWorkerRegistration:
            await navigator.serviceWorker.getRegistration(
              "/firebase-messaging-sw.js"
            ),
        });

        console.log("FCM token received:", token);
        await saveTokenToServer(token);
      } catch (err) {
        console.error("Error getting FCM token:", err);
      }
    }
  } else if (permission === "default") {
    console.log("Notification permission not requested yet");
  } else {
    console.log("Notification permission denied");
  }
}

// Check for upcoming bills and show local notification if needed
async function checkUpcomingBills() {
  const today = new Date();
  const todayDate = today.getDate();
  const bills = await loadBills();

  // Find upcoming bills based on either specific date or day of month
  const upcomingBills = bills.filter((bill) => {
    if (bill.specific_date) {
      // Check if specific date is today or tomorrow
      const specificDate = new Date(bill.specific_date);
      const timeDiff = specificDate.getTime() - today.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      return daysDiff >= 0 && daysDiff <= 1;
    } else {
      // Check if day of month is today or tomorrow
      return (
        bill.date_of_month === todayDate || bill.date_of_month === todayDate + 1
      );
    }
  });

  // If there are upcoming bills and the user has notifications permission
  if (upcomingBills.length > 0 && Notification.permission === "granted") {
    // Display a local notification (in addition to server-side notifications)
    const billNames = upcomingBills.map((bill) => bill.name).join(", ");
    new Notification("Upcoming Bill Payments", {
      body: `You have ${upcomingBills.length} bill(s) due soon: ${billNames}`,
      icon: "https://cdn-icons-png.freepik.com/256/3602/3602175.png?semt=ais_hybrid",
      requireInteraction: true,
    });
  }
}

// Load all bills and render UI
async function loadBills() {
  try {
    const res = await fetch("/api/bills", {
      headers: {
        Authorization: "Bearer " + token,
      },
    });

    if (!res.ok) {
      throw new Error("Failed to load bills");
    }

    const bills = await res.json();
    tableBody.innerHTML = "";
    let total = 0;
    const today = new Date().getDate();

    bills.forEach((bill) => {
      const row = document.createElement("tr");

      // Format specific date if it exists
      let specificDateDisplay = "N/A";
      let isUpcoming = false;

      if (bill.specific_date) {
        const specificDate = new Date(bill.specific_date);
        specificDateDisplay = specificDate.toLocaleDateString();

        // Check if the specific date is within the next 3 days
        const currentDate = new Date();
        const timeDiff = specificDate.getTime() - currentDate.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

        if (daysDiff >= 0 && daysDiff <= 3) {
          isUpcoming = true;
        }
      } else {
        // Check if the day of month is upcoming
        if (bill.date_of_month >= today && bill.date_of_month <= today + 3) {
          isUpcoming = true;
        }
      }

      // Format notification info
      const notificationInfo = bill.notification_hours_before
        ? `${bill.notification_hours_before} hours before`
        : "3 hours before";

      // Create notification status/action button
      const notificationStatus = bill.notification_sent
      ? '<span">✓ Sent</span>'
      : '';

      row.innerHTML = `
        <td>${bill.name}</td>
        <td>₹${bill.amount}</td>
        <td>${bill.date_of_month}</td>
        <td>${specificDateDisplay}</td>
        <td>${notificationInfo} ${notificationStatus}</td>
        <td><button onclick="deleteBill(${bill.id})">❌</button></td>
        <td><button onclick="openEditModal(${bill.id})">✏️</button></td>
      `;

      // Highlight upcoming bills
      if (isUpcoming) {
        row.style.backgroundColor = "#fff3cd";
      }

      tableBody.appendChild(row);
      total += parseFloat(bill.amount);
    });

    document.getElementById(
      "total-recurring"
    ).textContent = `💰 Total Monthly Recurring: ₹${total.toFixed(2)}`;

    return bills;
  } catch (err) {
    console.error("Error loading bills:", err);
    alert("Error loading bills. Please try again.");
    return [];
  }
}

// Add new bill
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Get values from form
  const name = document.getElementById("bill-name").value;
  const amount = parseFloat(document.getElementById("bill-amount").value);
  const date_of_month = parseInt(document.getElementById("bill-date").value);
  const specificDateInput = document.getElementById("bill-specific-date").value;
  const notificationHours =
    parseInt(document.getElementById("bill-notification-hours").value) || 3;

  // Create bill object
  const bill = {
    name,
    amount,
    date_of_month,
    notification_hours_before: notificationHours,
  };

  // Add specific date if provided
  if (specificDateInput) {
    bill.specific_date = specificDateInput;
  }

  try {
    const response = await fetch("/api/bills", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(bill),
    });

    if (!response.ok) {
      throw new Error("Failed to add bill");
    }

    form.reset();
    await loadBills();
    await sendBillReminder(); // check again after new bill is added
  } catch (err) {
    console.error("Error adding bill:", err);
    alert("Error adding bill. Please try again.");
  }
});

// Delete a bill
async function deleteBill(id) {
  if (confirm("Are you sure you want to delete this bill?")) {
    try {
      const response = await fetch(`/api/bills/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + token,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete bill");
      }

      await loadBills();
    } catch (err) {
      console.error("Error deleting bill:", err);
      alert("Error deleting bill. Please try again.");
    }
  }
}

// Force a notification for a specific bill
async function forceNotification(id) {
  try {
    console.log(`Sending force notification request for bill ID: ${id}`);

    const response = await fetch(`/api/bills/force-notification/${id}`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
      },
    });

    console.log("Response status:", response.status);

    // Try to parse the response as text first
    const responseText = await response.text();
    console.log("Response text:", responseText);

    // Then try to parse as JSON if possible
    let result;
    try {
      result = JSON.parse(responseText);
      console.log("Parsed JSON result:", result);
    } catch (jsonError) {
      console.error("Failed to parse response as JSON:", jsonError);
      alert(
        "Server returned an invalid response. Please check the console for details."
      );
      return;
    }

    if (result.success) {
      alert(result.message || "Notification sent successfully!");
    } else {
      alert(result.message || result.error || "Failed to send notification");
    }

    await loadBills(); // Refresh to update notification status
  } catch (err) {
    console.error("Error forcing notification:", err);
    alert("Error sending notification: " + err.message);
  }
}

// Open modal with bill data
async function openEditModal(id) {
  currentEditId = id;

  try {
    // Fetch the bill data directly from the server to get all fields
    const response = await fetch(`/api/bills/${id}`, {
      headers: {
        Authorization: "Bearer " + token,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch bill details");
    }

    const bill = await response.json();

    // Populate the form fields
    document.getElementById("edit-bill-name").value = bill.name;
    document.getElementById("edit-bill-amount").value = bill.amount;
    document.getElementById("edit-bill-date").value = bill.date_of_month;

    // Set specific date if it exists
    if (bill.specific_date) {
      document.getElementById("edit-bill-specific-date").value =
        bill.specific_date.split("T")[0];
    } else {
      document.getElementById("edit-bill-specific-date").value = "";
    }

    // Set notification hours
    document.getElementById("edit-bill-notification-hours").value =
      bill.notification_hours_before || 3;

    toggleBillModal(true);
  } catch (err) {
    console.error("Error fetching bill details:", err);
    alert("Error loading bill details. Please try again.");
  }
}

function toggleBillModal(show = true) {
  document.getElementById("edit-bill-modal").style.display = show
    ? "block"
    : "none";
}

// Save updated bill
document.getElementById("save-bill-btn").addEventListener("click", async () => {
  // Get values from form
  const name = document.getElementById("edit-bill-name").value;
  const amount = parseFloat(document.getElementById("edit-bill-amount").value);
  const date_of_month = parseInt(
    document.getElementById("edit-bill-date").value
  );
  const specificDateInput = document.getElementById(
    "edit-bill-specific-date"
  ).value;
  const notificationHours =
    parseInt(document.getElementById("edit-bill-notification-hours").value) ||
    3;

  // Create updated bill object
  const updated = {
    name,
    amount,
    date_of_month,
    notification_hours_before: notificationHours,
    notification_sent: false, // Reset notification status when bill is updated
  };

  // Add specific date if provided
  if (specificDateInput) {
    updated.specific_date = specificDateInput;
  } else {
    // If specific date was removed, set it to null
    updated.specific_date = null;
  }

  try {
    const response = await fetch(`/api/bills/${currentEditId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(updated),
    });

    if (!response.ok) {
      throw new Error("Failed to update bill");
    }

    toggleBillModal(false);
    await loadBills();
    await sendBillReminder(); // refresh check
  } catch (err) {
    console.error("Error updating bill:", err);
    alert("Error updating bill. Please try again.");
  }
});

// 🔔 Trigger SMS Reminder on page load
async function sendBillReminder() {
  try {
    await fetch("/api/bills/remind", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
      },
    });
  } catch (err) {
    console.error("Error sending bill reminder:", err);
    // Don't alert for this error as it's not critical
  }
}

// 🍔 Hamburger Menu Functionality
document.addEventListener("DOMContentLoaded", function () {
  const menuBtn = document.getElementById("menu-btn");
  const sideMenu = document.getElementById("side-menu");
  const menuOverlay = document.getElementById("menu-overlay");

  // Toggle menu when hamburger button is clicked
  menuBtn.addEventListener("click", function () {
    sideMenu.classList.toggle("open");
    menuOverlay.classList.toggle("open");

    // Toggle active class on hamburger button
    menuBtn.classList.toggle("active");

    // Change hamburger icon to X when open
    if (sideMenu.classList.contains("open")) {
      menuBtn.innerHTML = "✕"; // X symbol
    } else {
      menuBtn.innerHTML = "☰"; // Hamburger symbol
    }
  });

  // Close menu when clicking outside
  menuOverlay.addEventListener("click", function () {
    sideMenu.classList.remove("open");
    menuOverlay.classList.remove("open");
    menuBtn.classList.remove("active");
    menuBtn.innerHTML = "☰"; // Reset to hamburger symbol
  });

  // Add click event listener to notification permission button
  if (notificationBtn) {
    notificationBtn.addEventListener("click", requestNotificationPermission);
  }

  // Check notification status
  checkNotificationStatus();

  // Register service worker for notifications
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/firebase-messaging-sw.js")
      .then((registration) => {
        console.log(
          "Service Worker registered with scope:",
          registration.scope
        );
      })
      .catch((error) => {
        console.error("Service Worker registration failed:", error);
      });
  }

  // Handle incoming messages when the app is in foreground
  if (window.firebaseMessaging && window.firebaseOnMessage) {
    window.firebaseOnMessage(window.firebaseMessaging, (payload) => {
      console.log("Message received in foreground:", payload);

      // Display a notification using the Notification API
      const { title, body } = payload.notification;

      const options = {
        body,
        icon: "https://cdn-icons-png.freepik.com/256/3602/3602175.png?semt=ais_hybrid",
        badge:
          "https://cdn-icons-png.freepik.com/256/3602/3602175.png?semt=ais_hybrid",
        data: payload.data,
      };

      // Force a notification even in foreground
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "SHOW_NOTIFICATION",
          payload: {
            title,
            options,
          },
        });
      } else {
        // Fallback to regular notification
        new Notification(title, options);
      }
    });
  }
});

// Logout function
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

// Initialize with everything needed
document.addEventListener("DOMContentLoaded", async () => {
  await loadBills();
  await sendBillReminder();
  checkUpcomingBills();

  // Create test local notification button
  //const testNotificationBtn = document.createElement("button");
  //testNotificationBtn.textContent = "Test Local Notification";
  //testNotificationBtn.style.marginLeft = "10px";
  testNotificationBtn.onclick = function () {
    if (Notification.permission === "granted") {
      console.log("Showing local test notification");

      // Show a local notification
      const notification = new Notification("Test Bill Payment Reminder", {
        body: "This is a test notification. Your bill reminder system is working!",
        icon: "https://cdn-icons-png.freepik.com/256/3602/3602175.png?semt=ais_hybrid",
        requireInteraction: true,
      });

      notification.onclick = function () {
        console.log("Notification clicked");
        window.focus();
        notification.close();
      };

      alert(
        "Test notification sent! If you didn't see it, please check your browser notification settings."
      );
    } else {
      alert(
        "Notification permission not granted. Please enable notifications first."
      );
      requestNotificationPermission();
    }
  };

  // Create test server notification button
  const testServerNotificationBtn = document.createElement("button");
  testServerNotificationBtn.textContent = "Test Server Push";
  testServerNotificationBtn.style.marginLeft = "10px";
  testServerNotificationBtn.onclick = async function () {
    try {
      // First check if service worker is registered and active
      if ("serviceWorker" in navigator) {
        let registration = await navigator.serviceWorker.getRegistration(
          "/firebase-messaging-sw.js"
        );

        if (!registration) {
          console.log("Service worker not registered, registering now...");
          registration = await navigator.serviceWorker.register(
            "/firebase-messaging-sw.js"
          );
          console.log(
            "Service Worker registered with scope:",
            registration.scope
          );

          // Wait for the service worker to be activated
          if (registration.installing) {
            console.log("Service worker installing, waiting for activation");
            await new Promise((resolve) => {
              registration.installing.addEventListener("statechange", (e) => {
                if (e.target.state === "activated") {
                  console.log("Service worker now activated");
                  resolve();
                }
              });
            });
          }
        } else {
          console.log("Service worker already registered:", registration);

          // If there's a waiting service worker, activate it
          if (registration.waiting) {
            console.log("Service worker waiting, activating it");
            registration.waiting.postMessage({ type: "SKIP_WAITING" });

            // Wait for the controller to change
            await new Promise((resolve) => {
              navigator.serviceWorker.addEventListener(
                "controllerchange",
                () => {
                  console.log("Service worker controller changed");
                  resolve();
                }
              );
            });
          }
        }

        // Ensure we have an active service worker
        if (!navigator.serviceWorker.controller) {
          console.log(
            "No active service worker controller, waiting briefly and trying again"
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));

          if (!navigator.serviceWorker.controller) {
            alert(
              "Service worker not active. Please refresh the page and try again."
            );
            return;
          }
        }
      }

      console.log("Sending test notification request to server...");
      const response = await fetch("/api/bills/test-notification", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to send test notification");
      }

      const result = await response.json();
      console.log("Server response:", result);

      if (result.sent) {
        alert(
          "Server test notification sent successfully! Check your notifications. If you don't see them, check the browser console for errors."
        );
      } else {
        alert(
          "Server could not send notification: " +
            (result.error || "Check your FCM token")
        );
      }
    } catch (err) {
      console.error("Error sending test notification:", err);
      alert("Error sending test notification: " + err.message);
    }
  };

  // Create direct service worker notification button
  const directSwNotificationBtn = document.createElement("button");
  directSwNotificationBtn.textContent = "Direct SW Notification";
  directSwNotificationBtn.style.marginLeft = "10px";
  directSwNotificationBtn.onclick = async function () {
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration(
          "/firebase-messaging-sw.js"
        );

        if (!registration) {
          alert("Service worker not registered. Please refresh the page.");
          return;
        }

        console.log("Showing direct notification through service worker");

        // Try to show a notification directly through the service worker
        await registration.showNotification("Direct Test Notification", {
          body: "This is a direct test notification from the service worker.",
          icon: "https://cdn-icons-png.freepik.com/256/3602/3602175.png?semt=ais_hybrid",
          badge:
            "https://cdn-icons-png.freepik.com/256/3602/3602175.png?semt=ais_hybrid",
          vibrate: [100, 50, 100],
          requireInteraction: true,
          tag: "direct-test-" + Date.now(),
          renotify: true,
          actions: [
            {
              action: "view",
              title: "View Bills",
            },
          ],
        });

        console.log("Direct notification sent successfully");
        alert(
          "Direct notification sent. If you don't see it, check your notification settings."
        );
      } else {
        alert("Service workers not supported in this browser.");
      }
    } catch (err) {
      console.error("Error sending direct notification:", err);
      alert("Error sending direct notification: " + err.message);
    }
  };

  // Create reset notifications button
  const resetNotificationsBtn = document.createElement("button");
  resetNotificationsBtn.textContent = "Reset Notifications";
  resetNotificationsBtn.style.marginLeft = "10px";
  resetNotificationsBtn.onclick = async function () {
    try {
      const response = await fetch("/api/bills/reset-notifications", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to reset notifications");
      }

      const result = await response.json();
      alert(result.message);
      await loadBills(); // Refresh the bills list
    } catch (err) {
      console.error("Error resetting notifications:", err);
      alert("Error resetting notifications: " + err.message);
    }
  };

  // Create a button container for better organization
  const buttonContainer = document.createElement("div");
  buttonContainer.className = "header-buttons-container";
  buttonContainer.style.display = "flex";
  buttonContainer.style.flexWrap = "wrap";
  buttonContainer.style.justifyContent = "center";
  buttonContainer.style.gap = "5px";
  buttonContainer.style.margin = "5px 0";

  // Add buttons to the container
  buttonContainer.appendChild(testNotificationBtn);
  buttonContainer.appendChild(testServerNotificationBtn);
  buttonContainer.appendChild(directSwNotificationBtn);
  buttonContainer.appendChild(resetNotificationsBtn);

  // Add the button container to the header
  const headerContainer = document.querySelector(".header-container");
  headerContainer.appendChild(buttonContainer);
});

//new

document.addEventListener("DOMContentLoaded", function () {
  // Force notification column to be visible
  const notificationCells = document.querySelectorAll(
    "#bills-table td:nth-child(5)"
  );
  notificationCells.forEach((cell) => {
    cell.style.minWidth = "150px";
    cell.style.whiteSpace = "nowrap";

    // If cell is empty, add a test button
    if (cell.textContent.trim() === "") {
      cell.innerHTML = '3 hours before';
    }
  });
});
