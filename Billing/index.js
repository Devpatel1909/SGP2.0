document.addEventListener("DOMContentLoaded", () => {
  const BASE_URL = "http://localhost:3000";
  const messageDiv = document.getElementById("message");

  function checkLogin() {
      const token = localStorage.getItem("token");
      if (!token) {
          window.location.href = "../login/login.html";
      }
      return token;
  }

  function displayMessage(message, type = "error") {
      messageDiv.textContent = message;
      messageDiv.className = `message ${type}`;
      messageDiv.style.display = "block";
      setTimeout(() => {
          messageDiv.style.display = "none";
      }, 3000);
  }

  async function fetchProfile() {
      const authButton = document.getElementById("auth-btn");
      const usernameSpan = document.getElementById("username");
      const token = localStorage.getItem("token");

      if (!token) {
          usernameSpan.textContent = "Guest";
          authButton.textContent = "Login";
          authButton.classList.remove("logout");
          authButton.addEventListener("click", () => {
              window.location.href = "../login/index.html"; // Redirect to login page
          });
          return;
      }

      try {
          const response = await fetch(`${BASE_URL}/api/profile`, {
              headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) throw new Error("Failed to fetch profile");

          const { username } = await response.json();
          usernameSpan.textContent = username;

          authButton.textContent = "Logout";
          authButton.classList.add("logout");
          authButton.addEventListener("click", () => {
              localStorage.removeItem("token");
              window.location.href = "../login/login.html"; // Redirect to login page
          });
      } catch {
          usernameSpan.textContent = "Guest";
          authButton.textContent = "Login";
          authButton.classList.remove("logout");
          authButton.addEventListener("click", () => {
              window.location.href = "../login/login.html";
          });
      }
  }

  async function fetchItems() {
      const token = checkLogin();
      try {
          const response = await fetch(`${BASE_URL}/api/items`, {
              headers: { "Authorization": `Bearer ${token}` },
          });
          if (!response.ok) throw new Error("Failed to fetch items");
          const items = await response.json();
          // Populate the items table with an empty row for user input
          populateItemsTable([]);
      } catch (error) {
          displayMessage(error.message);
      }
  }

  function populateItemsTable(items) {
      const billItemsContainer = document.getElementById("bill-items");
      billItemsContainer.innerHTML = ""; // Clear existing items

      // Add an empty row for user input
      const row = document.createElement("tr");
      row.innerHTML = `
          <td>
              <input type="text" class="product-name" placeholder="Enter product name">
              <div class="autocomplete-suggestions" style="display: none;"></div>
          </td>
          <td><input type="text" class="product-id" readonly></td>
          <td><input type="number" class="item-price" readonly></td>
          <td><input type="number" class="item-quantity" value="1" min="1"></td>
          <td><input type="number" class="item-discount" value="0" min="0" max="100"></td>
          <td class="item-total">₹0.00</td>
          <td>
              <button class="delete-row" type="button">
                  <i class="fas fa-trash"></i>
              </button>
          </td>
      `;
      billItemsContainer.appendChild(row);
      updateTotals();
  }

  function updateTotals() {
      const rows = document.querySelectorAll("#bill-items tr");
      let subtotal = 0;
      let totalDiscount = 0;

      rows.forEach(row => {
          const price = parseFloat(row.querySelector(".item-price").value) || 0;
          const quantity = parseInt(row.querySelector(".item-quantity").value) || 0;
          const discount = parseFloat(row.querySelector(".item-discount").value) || 0;

          const total = (price * quantity) - ((price * quantity) * (discount / 100));
          row.querySelector(".item-total").textContent = `₹${total.toFixed(2)}`;
          subtotal += total;
          totalDiscount += (price * quantity) * (discount / 100);
      });

      const tax = subtotal * 0.10;
      const grandTotal = subtotal + tax - totalDiscount;

      document.getElementById("subtotal").textContent = `₹${subtotal.toFixed(2)}`;
      document.getElementById("tax").textContent = `₹${tax.toFixed(2)}`;
      document.getElementById("total-discount").textContent = `₹${totalDiscount.toFixed(2)}`;
      document.getElementById("grand-total").textContent = `₹${grandTotal.toFixed(2)}`;
  }

  document.getElementById("bill-items").addEventListener("input", updateTotals);

  document.getElementById("bill-items").addEventListener("click", (event) => {
      if (event.target.classList.contains("delete-row")) {
          event.target.closest("tr").remove();
          updateTotals();
      }
  });

  async function fetchSuggestions(query) {
      try {
          const token = localStorage.getItem("token");
          const response = await fetch(`${BASE_URL}/api/items/suggestions?query=${encodeURIComponent(query)}`, {
              headers: {
                  "Authorization": `Bearer ${token}`,
                  "Content-Type": "application/json"
              }
          });

          if (!response.ok) {
              throw new Error("Failed to fetch suggestions");
          }

          return await response.json();
      } catch (error) {
          console.error("Suggestion fetch error:", error);
          displayMessage(error.message);
          return [];
      }
  }

  function showSuggestions(suggestions, inputElement) {
      const suggestionsContainer = inputElement.nextElementSibling; // Get the suggestions container
      suggestionsContainer.innerHTML = '';

      if (suggestions.length === 0) {
          suggestionsContainer.style.display = 'none';
          return;
      }

      suggestions.forEach(item => {
          const suggestionItem = document.createElement('div');
          suggestionItem.textContent = item.name;
          suggestionItem.classList.add('suggestion-item');

          suggestionItem.addEventListener('click', () => {
              inputElement.value = item.name;
              suggestionsContainer.style.display = 'none';
              updateItemDetails(item);
          });

          suggestionsContainer.appendChild(suggestionItem);
      });

      suggestionsContainer.style.display = 'block';
  }

  function updateItemDetails(item) {
      const rows = document.querySelectorAll("#bill-items tr");
      const lastRow = rows[rows.length - 1]; // Get the last row for updating

      lastRow.querySelector(".product-id").value = item.id;
      lastRow.querySelector(".item-price").value = item.price;
      updateTotals();
  }

  function debounce(func, delay) {
      let timeoutId;
      return function (...args) {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => func.apply(this, args), delay);
      };
  }

  const debouncedSuggestions = debounce(async (event) => {
      const query = event.target.value.trim();

      if (query.length > 1) {
          const suggestions = await fetchSuggestions(query);
          showSuggestions(suggestions, event.target);
      } else {
          const suggestionsContainer = event.target.nextElementSibling;
          if (suggestionsContainer) {
              suggestionsContainer.style.display = 'none';
          }
      }
  }, 300);

  document.getElementById("bill-items").addEventListener("input", (event) => {
      if (event.target.classList.contains("product-name")) {
          debouncedSuggestions(event);
      }
  });

  document.getElementById("process-payment-btn").addEventListener("click", async () => {
      const paymentMethod = document.getElementById("payment-method").value;
      const paymentStatus = document.getElementById("payment-status").value;
      const paymentNote = document.getElementById("payment-note").value;

      if (!paymentMethod || !paymentStatus) {
          displayMessage("Please fill in all payment details.", "error");
          return;
      }

      const token = checkLogin();
      const invoiceData = {
          paymentMethod,
          paymentStatus,
          paymentNote,
          items: Array.from(document.querySelectorAll("#bill-items tr")).map(row => ({
              name: row.querySelector(".product-name").value,
              id: row.querySelector(".product-id").value,
              price: parseFloat(row.querySelector(".item-price").value) || 0,
              quantity: parseInt(row.querySelector(".item-quantity").value) || 0,
              discount: parseFloat(row.querySelector(".item-discount").value) || 0,
              total: parseFloat(row.querySelector(".item-total").textContent.replace('₹', '')) || 0
          }))
      };

      try {
          const response = await fetch(`${BASE_URL}/api/billing`, {
              method: "POST",
              headers: {
                  "Authorization": `Bearer ${token}`,
                  "Content-Type": "application/json"
              },
              body: JSON.stringify(invoiceData)
          });

          if (!response.ok) throw new Error("Failed to process payment");

          displayMessage("Payment processed successfully!", "success");
          // Optionally, redirect or reset the form
      } catch (error) {
          displayMessage(error.message);
      }
  });

  fetchProfile();
  fetchItems();
});