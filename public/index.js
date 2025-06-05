// Dashboard Page JavaScript
const recentExpensesContainer = document.getElementById(
  "recent-expenses-container"
);

let allExpenses = [];

// Get user from localStorage
const user = JSON.parse(localStorage.getItem("user"));
const token = localStorage.getItem("token");

// 🧍 Greet user
document.getElementById("greeting").textContent = `Welcome, ${user.name}`;

// 📥 Load expenses from API
async function loadExpenses() {
  try {
    // Get expenses from API
    const response = await fetch("/api/expenses", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load expenses");
    }

    // Get expenses from response
    allExpenses = await response.json();

    // Update remaining amount
    updateRemainingAmount();

    // Display recent expenses
    displayRecentExpenses();
  } catch (err) {
    console.error("Error loading expenses:", err);
  }
}

// Update remaining amount
function updateRemainingAmount() {
  const totalThisMonth = allExpenses
    .filter((e) => new Date(e.date).getMonth() === new Date().getMonth())
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const remaining = user.income - totalThisMonth;
  document.getElementById(
    "remaining"
  ).textContent = `Remaining this month: ₹${remaining.toFixed(2)}`;
}

// Display recent expenses
function displayRecentExpenses() {
  // Sort expenses by date (newest first)
  const sortedExpenses = [...allExpenses].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  // Take only the 5 most recent expenses
  const recentExpenses = sortedExpenses.slice(0, 5);

  // Clear container
  recentExpensesContainer.innerHTML = "";

  // If no expenses, show a message
  if (recentExpenses.length === 0) {
    recentExpensesContainer.innerHTML = `
      <div class="no-expenses-message">
        No expenses recorded yet. Add your first expense to see it here.
      </div>
    `;
    return;
  }

  // Add cards for each recent expense
  recentExpenses.forEach((exp) => {
    // Format the date
    const expDate = new Date(exp.date);
    const formattedDate = expDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    // Create a CSS-friendly category class name
    const categoryClass = `category-${exp.category.replace(/\s+/g, "-")}`;

    // Create the expense card
    const card = document.createElement("div");
    card.className = "expense-card";
    card.innerHTML = `
      <div class="expense-info">
        <div class="expense-title">${exp.title}</div>
        <div class="expense-details">
          <span class="expense-category ${categoryClass}">${exp.category}</span>
          <span class="expense-date">${formattedDate}</span>
        </div>
      </div>
      <div class="expense-amount">₹${exp.amount.toLocaleString()}</div>
    `;

    // Add click event to navigate to expenses list
    card.addEventListener("click", () => {
      window.location.href = "expenses-list.html";
    });

    recentExpensesContainer.appendChild(card);
  });
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
});

// Logout function
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

// 🚀 Load on page ready
loadExpenses();
