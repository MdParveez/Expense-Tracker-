// Expenses List Page JavaScript
const tableBody = document.querySelector("#expense-table tbody");
const searchInput = document.getElementById("search");
const categorySelect = document.getElementById("category-filter");
const editCategorySelect = document.getElementById("edit-category");

let allExpenses = [];
let allCategories = [];
let currentEditId = null;

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

    // Apply filters and render
    applyFilters();
  } catch (err) {
    console.error("Error loading expenses:", err);
  }
}

// 📥 Load categories from API
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
    allCategories = await response.json();

    // Filter only expense categories (assuming type field indicates category type)
    const expenseCategories = allCategories.filter(
      (category) => category.type === "expense"
    );

    // Populate category filter dropdown
    populateCategoryFilter(expenseCategories);

    // Populate edit modal category dropdown
    populateEditCategoryDropdown(expenseCategories);
  } catch (err) {
    console.error("Error loading categories:", err);
  }
}

// Populate category filter dropdown
function populateCategoryFilter(categories) {
  categorySelect.innerHTML = '<option value="">All Categories</option>';
  categories.forEach((cat) => {
    categorySelect.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
  });
}

// Populate edit modal category dropdown
function populateEditCategoryDropdown(categories) {
  // Clear existing options except the first one
  while (editCategorySelect.options.length > 1) {
    editCategorySelect.remove(1);
  }

  // Add categories to select dropdown
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.name;
    option.textContent = category.name;
    editCategorySelect.appendChild(option);
  });
}

// Apply search and category filters
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

  renderTable(filtered);
}

// 🧾 Render table
function renderTable(expenses) {
  tableBody.innerHTML = "";
  expenses.forEach((exp) => {
    const row = document.createElement("tr");

    // Create cells for data
    const titleCell = document.createElement("td");
    titleCell.textContent = exp.title;

    const amountCell = document.createElement("td");
    amountCell.textContent = `₹${exp.amount}`;

    const categoryCell = document.createElement("td");
    categoryCell.textContent = exp.category;

    const dateCell = document.createElement("td");
    dateCell.textContent = exp.date;

    const noteCell = document.createElement("td");
    noteCell.textContent = exp.note || "";

    // Create delete button cell
    const deleteCell = document.createElement("td");
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "❌";
    deleteButton.setAttribute("data-id", exp.id);
    deleteButton.addEventListener("click", function () {
      const expenseId = this.getAttribute("data-id");
      console.log("Delete button clicked for ID:", expenseId);
      deleteExpense(parseInt(expenseId, 10));
    });
    deleteCell.appendChild(deleteButton);

    // Create edit button cell
    const editCell = document.createElement("td");
    const editButton = document.createElement("button");
    editButton.textContent = "✏️";
    editButton.setAttribute("data-id", exp.id);
    editButton.addEventListener("click", function () {
      const expenseId = this.getAttribute("data-id");
      console.log("Edit button clicked for ID:", expenseId);
      openEditModal(parseInt(expenseId, 10));
    });
    editCell.appendChild(editButton);

    // Create predict button cell
    const predictCell = document.createElement("td");
    const predictButton = document.createElement("button");
    predictButton.textContent = "📊";
    predictButton.addEventListener("click", () => predictExpense(exp.category));
    predictCell.appendChild(predictButton);

    // Append all cells to the row
    row.appendChild(titleCell);
    row.appendChild(amountCell);
    row.appendChild(categoryCell);
    row.appendChild(dateCell);
    row.appendChild(noteCell);
    row.appendChild(deleteCell);
    row.appendChild(editCell);
    //row.appendChild(predictCell);

    // Append the row to the table body
    tableBody.appendChild(row);
  });
}

// ❌ Delete expense
async function deleteExpense(id) {
  console.log("deleteExpense called with ID:", id, "Type:", typeof id);

  if (confirm("Are you sure you want to delete this expense?")) {
    try {
      // Get token from localStorage
      const token = localStorage.getItem("token");

      // Send delete request to API
      const response = await fetch(`/api/expenses/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete expense");
      }

      // Reload expenses
      loadExpenses();
    } catch (err) {
      console.error("Error deleting expense:", err);
      alert("Error deleting expense. Please try again.");
    }
  }
}

// ✏️ Edit expense modal
function openEditModal(id) {
  console.log("openEditModal called with ID:", id, "Type:", typeof id);

  currentEditId = id;
  // Convert id to number if it's a string
  const numericId = typeof id === "string" ? parseInt(id, 10) : id;
  console.log("Converted ID:", numericId, "Type:", typeof numericId);

  // Debug: Log all expenses IDs to check what we're looking for
  console.log(
    "All expense IDs:",
    allExpenses.map((e) => ({ id: e.id, type: typeof e.id }))
  );

  // Find the expense with the matching ID
  const expense = allExpenses.find((e) => {
    console.log(
      "Comparing:",
      e.id,
      typeof e.id,
      "with",
      numericId,
      typeof numericId,
      "Result:",
      e.id === numericId
    );
    return e.id === numericId;
  });

  if (!expense) {
    console.error(`Expense with ID ${id} not found`);
    alert("Error: Expense not found");
    return;
  }

  console.log("Found expense:", expense);

  document.getElementById("edit-title").value = expense.title;
  document.getElementById("edit-amount").value = expense.amount;
  document.getElementById("edit-category").value = expense.category;
  document.getElementById("edit-date").value = expense.date;
  document.getElementById("edit-note").value = expense.note || "";

  toggleEditModal(true);
}

function toggleEditModal(show = true) {
  console.log("toggleEditModal called with show:", show);
  const modal = document.getElementById("edit-expense-modal");
  const overlay = document.getElementById("modal-overlay");

  if (!modal) {
    console.error("Modal element not found!");
    return;
  }

  console.log("Modal before:", modal.className);

  if (show) {
    modal.classList.remove("modal-hidden");
    if (overlay) overlay.classList.remove("modal-hidden");
  } else {
    modal.classList.add("modal-hidden");
    if (overlay) overlay.classList.add("modal-hidden");
  }

  console.log("Modal after:", modal.className);

  // Add click event to overlay to close modal when clicking outside
  if (overlay && show) {
    overlay.onclick = function () {
      toggleEditModal(false);
    };
  }
}

// Save edited expense
document.getElementById("save-edit-btn").addEventListener("click", async () => {
  // Validate form fields
  const titleField = document.getElementById("edit-title");
  const amountField = document.getElementById("edit-amount");
  const categoryField = document.getElementById("edit-category");
  const dateField = document.getElementById("edit-date");

  if (!titleField.value.trim()) {
    alert("Please enter a title");
    titleField.focus();
    return;
  }

  if (!amountField.value || isNaN(parseFloat(amountField.value))) {
    alert("Please enter a valid amount");
    amountField.focus();
    return;
  }

  if (!categoryField.value) {
    alert("Please select a category");
    categoryField.focus();
    return;
  }

  if (!dateField.value) {
    alert("Please select a date");
    dateField.focus();
    return;
  }

  const updatedExpense = {
    title: titleField.value.trim(),
    amount: parseFloat(amountField.value),
    category: categoryField.value,
    date: dateField.value,
    note: document.getElementById("edit-note").value.trim(),
  };

  try {
    // Get token from localStorage
    const token = localStorage.getItem("token");

    // Ensure currentEditId is valid
    if (!currentEditId) {
      throw new Error("Invalid expense ID");
    }

    // Send update request to API
    const response = await fetch(`/api/expenses/${currentEditId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updatedExpense),
    });

    if (!response.ok) {
      throw new Error("Failed to update expense");
    }

    toggleEditModal(false);
    loadExpenses();
  } catch (err) {
    console.error("Error updating expense:", err);
    alert("Error updating expense. Please try again.");
  }
});

// Add event listeners for search and filter
searchInput.addEventListener("input", applyFilters);
categorySelect.addEventListener("change", applyFilters);

// 🍔 Hamburger Menu Functionality
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOMContentLoaded event fired");

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

  // Load data when DOM is ready
  loadCategories();
  loadExpenses();
});

// Predict expense for a category
function predictExpense(category) {
  // Redirect to prediction page with the category
  window.location.href = `prediction.html?category=${encodeURIComponent(
    category
  )}`;
}

// Logout function
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}
