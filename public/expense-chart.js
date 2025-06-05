// Expense Chart Page JavaScript
const chartCtx = document.getElementById("expense-chart").getContext("2d");
const summaryTableBody = document.querySelector(
  "#category-summary-table tbody"
);

let chart;
let allExpenses = [];

// Get user from localStorage
const user = JSON.parse(localStorage.getItem("user"));

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

    // Render chart
    renderChart(allExpenses);

    // Render category summary table
    renderCategorySummary(allExpenses);
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

// 📊 Render pie chart
function renderChart(expenses) {
  // Calculate totals by category
  const categoryTotals = {};
  let totalSpent = 0;

  expenses.forEach((exp) => {
    const amount = parseFloat(exp.amount);
    totalSpent += amount;
    categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + amount;
  });

  // Prepare data for chart
  const categories = Object.keys(categoryTotals);
  const amounts = Object.values(categoryTotals);

  // Define colors for chart
  const backgroundColors = [
    "#FF6384",
    "#36A2EB",
    "#FFCE56",
    "#4BC0C0",
    "#9966FF",
    "#FF9F40",
    "#8AC249",
    "#EA526F",
    "#23B5D3",
    "#279AF1",
    "#7E6B8F",
    "#96E072",
  ];

  // Destroy existing chart if it exists
  if (chart) {
    chart.destroy();
  }

  // Create new chart
  chart = new Chart(chartCtx, {
    type: "pie",
    data: {
      labels: categories,
      datasets: [
        {
          data: amounts,
          backgroundColor: backgroundColors.slice(0, categories.length),
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            padding: 20,
            boxWidth: 12,
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const value = context.raw;
              const percentage = ((value / totalSpent) * 100).toFixed(1);
              return `₹${value} (${percentage}%)`;
            },
          },
        },
      },
    },
  });
}

// Render category summary table
function renderCategorySummary(expenses) {
  // Calculate totals by category
  const categoryTotals = {};
  let totalSpent = 0;

  expenses.forEach((exp) => {
    const amount = parseFloat(exp.amount);
    totalSpent += amount;
    categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + amount;
  });

  // Clear table
  summaryTableBody.innerHTML = "";

  // Add rows for each category
  Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1]) // Sort by amount (descending)
    .forEach(([category, amount]) => {
      const percentage = ((amount / totalSpent) * 100).toFixed(1);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${category}</td>
        <td>₹${amount.toFixed(2)}</td>
        <td>${percentage}%</td>
      `;
      summaryTableBody.appendChild(row);
    });

  // Add total row
  const totalRow = document.createElement("tr");
  totalRow.style.fontWeight = "bold";
  totalRow.innerHTML = `
    <td>Total</td>
    <td>₹${totalSpent.toFixed(2)}</td>
    <td>100%</td>
  `;
  summaryTableBody.appendChild(totalRow);
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
