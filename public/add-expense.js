const form = document.getElementById("expense-form");
const categorySelect = document.getElementById("category");

// Get user from localStorage
const user = JSON.parse(localStorage.getItem("user"));
let allExpenses = [];

// 🧍 Greet user
document.getElementById("greeting").textContent = `Welcome, ${user.name}`;

// 📥 Load expenses from API
async function loadExpenses() {
  try {
    // Get token from localStorage
    const token = localStorage.getItem("token");

    // Fetch expenses from API
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
  } catch (err) {
    console.error("Error loading expenses:", err);
  }
}

// Load categories from API
async function loadCategories() {
  try {
    // Get token from localStorage
    const token = localStorage.getItem("token");

    // Fetch categories from API
    const response = await fetch("/api/categories", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load categories");
    }

    // Get categories from response
    const categories = await response.json();

    // Filter only expense categories (assuming type field indicates category type)
    const expenseCategories = categories.filter(
      (category) => category.type === "expense"
    );

    // Clear existing options except the first one
    while (categorySelect.options.length > 1) {
      categorySelect.remove(1);
    }

    // Add categories to select dropdown
    expenseCategories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.name;
      option.textContent = category.name;
      categorySelect.appendChild(option);
    });
  } catch (err) {
    console.error("Error loading categories:", err);
  }
}

// 📤 Add new expense
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const newExpense = {
    title: document.getElementById("title").value,
    amount: parseFloat(document.getElementById("amount").value),
    category: document.getElementById("category").value,
    date: document.getElementById("date").value,
    note: document.getElementById("note").value,
  };

  try {
    // Get token from localStorage
    const token = localStorage.getItem("token");

    // Send expense to API
    const response = await fetch("/api/expenses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newExpense),
    });

    if (!response.ok) {
      throw new Error("Failed to add expense");
    }

    // Reset form
    form.reset();

    // Reload expenses to update remaining amount
    loadExpenses();

    // Show success message
    alert("Expense added successfully!");
  } catch (err) {
    console.error("Error adding expense:", err);
    alert("Error adding expense. Please try again.");
  }
});

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

  // Load categories when DOM is ready
  loadCategories();
});

// Logout function
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

// 🚀 Load on page ready
loadExpenses();
