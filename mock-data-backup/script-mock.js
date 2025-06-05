// Mock implementation of script.js using mockData.js
const form = document.getElementById("expense-form");
const tableBody = document.querySelector("#expense-table tbody");
const chartCtx = document.getElementById("expense-chart").getContext("2d");
const searchInput = document.getElementById("search");
const categorySelect = document.getElementById("category-filter");

let chart;
let allExpenses = [];

// Get user from mock data
const user = mockData.user;

// 🧍 Greet user
document.getElementById(
  "greeting"
).textContent = `Welcome, ${user.name} — Income: ₹${user.income}`;

let currentEditId = null;

// 📋 Load expenses from mock data
async function loadExpenses() {
  try {
    // Get expenses directly from mockData
    allExpenses = mockData.expenses;

    // Populate category filter
    const categories = [...new Set(allExpenses.map((exp) => exp.category))];
    categorySelect.innerHTML = '<option value="">All Categories</option>';
    categories.forEach((cat) => {
      categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
    });

    // Apply filters and render
    applyFilters();

    // Update remaining amount
    updateRemainingAmount();

    // Render chart
    renderChart(allExpenses);
  } catch (err) {
    console.error("Error loading expenses:", err);
  }
}
