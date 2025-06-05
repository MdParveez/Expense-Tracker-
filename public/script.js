const form = document.getElementById("expense-form");
const tableBody = document.querySelector("#expense-table tbody");
const chartCtx = document.getElementById("expense-chart").getContext("2d");
const searchInput = document.getElementById("search");
const categorySelect = document.getElementById("category-filter");

let chart;
let allExpenses = [];

const user = JSON.parse(localStorage.getItem("user"));
const token = localStorage.getItem("token");

// 🧍 Greet user
document.getElementById(
  "greeting"
).textContent = `Welcome, ${user.name} — Income: ₹${user.income}`;

let currentEditId = null;

// 📥 Load expenses from API
async function loadExpenses() {
  const res = await fetch("/api/expenses", {
    headers: {
      Authorization: "Bearer " + token,
    },
  });
  allExpenses = await res.json();
  populateCategoryFilter();
  applyFilters();
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

  await fetch("/api/expenses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify(newExpense),
  });

  form.reset();
  loadExpenses();
});

// ❌ Delete expense
async function deleteExpense(id) {
  await fetch(`/api/expenses/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: "Bearer " + token,
    },
  });
  loadExpenses();
}

// 🧾 Render table
function renderTable(expenses) {
  tableBody.innerHTML = "";
  expenses.forEach((exp) => {
    const row = document.createElement("tr");
    row.innerHTML = `
            <td>${exp.title}</td>
            <td>${exp.amount}</td>
            <td>${exp.category}</td>
            <td>${exp.date}</td>
            <td>${exp.note || ""}</td>
            <td><button onclick="deleteExpense(${exp.id})">❌</button></td>
            <td><button onclick="openEditModal(${exp.id})">✏️</button></td>
        `;
    tableBody.appendChild(row);
  });
  function updateRemainingAmount() {
    const totalThisMonth = allExpenses
      .filter((e) => new Date(e.date).getMonth() === new Date().getMonth())
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    const remaining = user.income - totalThisMonth;
    document.getElementById(
      "remaining"
    ).textContent = `Remaining this month: ₹${remaining.toFixed(2)}`;
  }
}

// 📊 Render chart
function renderChart(expenses) {
  const categoryTotals = {};
  expenses.forEach((exp) => {
    if (!categoryTotals[exp.category]) {
      categoryTotals[exp.category] = 0;
    }
    categoryTotals[exp.category] += parseFloat(exp.amount);
  });

  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);

  if (chart) chart.destroy();

  chart = new Chart(chartCtx, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          label: "Spending by Category",
          data,
          backgroundColor: [
            "#ff6384",
            "#36a2eb",
            "#ffce56",
            "#4caf50",
            "#9966ff",
          ],
        },
      ],
    },
    options: { responsive: true },
  });
}

// 🔍 Filter logic
searchInput.addEventListener("input", applyFilters);
categorySelect.addEventListener("change", applyFilters);

function applyFilters() {
  const searchTerm = searchInput.value.toLowerCase();
  const selectedCategory = categorySelect.value;

  const filtered = allExpenses.filter((exp) => {
    const matchesTitle = exp.title.toLowerCase().includes(searchTerm);
    const matchesCategory = selectedCategory
      ? exp.category === selectedCategory
      : true;
    return matchesTitle && matchesCategory;
  });
  function updateRemainingAmount() {
    const totalThisMonth = allExpenses
      .filter((e) => new Date(e.date).getMonth() === new Date().getMonth())
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    const remaining = user.income - totalThisMonth;
    document.getElementById(
      "remaining"
    ).textContent = `Remaining this month: ₹${remaining.toFixed(2)}`;
  }
  renderTable(filtered);
  renderChart(filtered);
  updateRemainingAmount();
}

// ⬇️ Populate category filter
function populateCategoryFilter() {
  const categories = [...new Set(allExpenses.map((exp) => exp.category))];
  categorySelect.innerHTML = `<option value="">All Categories</option>`;
  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });
}

// 🚪 Logout
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

// ✏️ Toggle income modal
function toggleIncomeModal(show = true) {
  document.getElementById("edit-income-modal").style.display = show
    ? "block"
    : "none";
  if (show) document.getElementById("new-income").value = user.income;
}

document
  .getElementById("edit-income-btn")
  .addEventListener("click", () => toggleIncomeModal(true));

document
  .getElementById("save-income-btn")
  .addEventListener("click", async () => {
    const updatedIncome = parseFloat(
      document.getElementById("new-income").value
    );
    if (isNaN(updatedIncome) || updatedIncome < 0)
      return alert("Please enter a valid income");

    const res = await fetch("/api/users/update-income", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ income: updatedIncome }),
    });

    if (res.ok) {
      user.income = updatedIncome;
      localStorage.setItem("user", JSON.stringify(user));
      document.getElementById(
        "greeting"
      ).textContent = `Welcome, ${user.name} — Income: ₹${user.income}`;
      toggleIncomeModal(false);
    } else {
      alert("Error updating income");
    }
  });

function openEditModal(id) {
  const expense = allExpenses.find((e) => e.id === id);
  if (!expense) return;

  currentEditId = id;
  document.getElementById("edit-title").value = expense.title;
  document.getElementById("edit-amount").value = expense.amount;
  document.getElementById("edit-category").value = expense.category;
  document.getElementById("edit-date").value = new Date(expense.date)
    .toISOString()
    .split("T")[0];
  document.getElementById("edit-note").value = expense.note || "";
  toggleEditModal(true);
}

function toggleEditModal(show = true) {
  document.getElementById("edit-expense-modal").style.display = show
    ? "block"
    : "none";
}

document.getElementById("save-edit-btn").addEventListener("click", async () => {
  const updatedExpense = {
    title: document.getElementById("edit-title").value,
    amount: parseFloat(document.getElementById("edit-amount").value),
    category: document.getElementById("edit-category").value,
    date: document.getElementById("edit-date").value,
    note: document.getElementById("edit-note").value,
  };

  await fetch(`/api/expenses/${currentEditId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify(updatedExpense),
  });

  toggleEditModal(false);
  loadExpenses();
});

// 🍔 Hamburger Menu Functionality
document.addEventListener("DOMContentLoaded", function () {
  const menuBtn = document.getElementById("menu-btn");
  const sideMenu = document.getElementById("side-menu");
  const menuOverlay = document.getElementById("menu-overlay");

  // Toggle menu when hamburger button is clicked
  menuBtn.addEventListener("click", function () {
    sideMenu.classList.toggle("open");
    menuOverlay.classList.toggle("open");
  });

  // Close menu when clicking outside
  menuOverlay.addEventListener("click", function () {
    sideMenu.classList.remove("open");
    menuOverlay.classList.remove("open");
  });
});

// 🚀 Load on page ready
loadExpenses();
