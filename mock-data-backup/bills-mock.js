// Mock implementation of bills.js using mockData.js
const form = document.getElementById("bill-form");
const tableBody = document.querySelector("#bills-table tbody");
let currentEditId = null;

// Load all bills and render UI
async function loadBills() {
  try {
    const bills = await mockData.api.getBills();
    tableBody.innerHTML = "";
    let total = 0;
    const today = new Date().getDate();

    bills.forEach((bill) => {
      const row = document.createElement("tr");
      row.innerHTML = `
                <td>${bill.name}</td>
                <td>₹${bill.amount}</td>
                <td>${bill.date_of_month}</td>
                <td><button onclick="deleteBill(${bill.id})">❌</button></td>
                <td><button onclick="openEditModal(${bill.id})">✏️</button></td>
            `;

      // Highlight upcoming bills
      if (bill.date_of_month >= today && bill.date_of_month <= today + 3) {
        row.style.backgroundColor = "#fff3cd";
      }

      tableBody.appendChild(row);
      total += parseFloat(bill.amount);
    });

    document.getElementById(
      "total-recurring"
    ).textContent = `💰 Total Monthly Recurring: ₹${total.toFixed(2)}`;
  } catch (err) {
    console.error("Error loading bills:", err);
  }
}

// Add new bill
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const bill = {
    name: document.getElementById("bill-name").value,
    amount: parseFloat(document.getElementById("bill-amount").value),
    date_of_month: parseInt(document.getElementById("bill-date").value),
  };

  try {
    await mockData.api.addBill(bill);
    form.reset();
    loadBills();
  } catch (err) {
    console.error("Error adding bill:", err);
  }
});

// Delete a bill
async function deleteBill(id) {
  try {
    await mockData.api.deleteBill(id);
    loadBills();
  } catch (err) {
    console.error("Error deleting bill:", err);
  }
}

// Open modal with bill data
function openEditModal(id) {
  currentEditId = id;
  const bill = mockData.bills.find((b) => b.id === id);

  document.getElementById("edit-bill-name").value = bill.name;
  document.getElementById("edit-bill-amount").value = bill.amount;
  document.getElementById("edit-bill-date").value = bill.date_of_month;

  toggleBillModal(true);
}

function toggleBillModal(show = true) {
  document.getElementById("edit-bill-modal").style.display = show
    ? "block"
    : "none";
}

// Save updated bill
document.getElementById("save-bill-btn").addEventListener("click", async () => {
  const updated = {
    name: document.getElementById("edit-bill-name").value,
    amount: parseFloat(document.getElementById("edit-bill-amount").value),
    date_of_month: parseInt(document.getElementById("edit-bill-date").value),
  };

  try {
    await mockData.api.updateBill(currentEditId, updated);
    toggleBillModal(false);
    loadBills();
  } catch (err) {
    console.error("Error updating bill:", err);
  }
});

// Hamburger Menu Functionality
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

// Logout function
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

// Load bills on page load
loadBills();
