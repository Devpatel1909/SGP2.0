document.addEventListener("DOMContentLoaded", () => {
    const BASE_URL = "http://localhost:3000";
    const messageDiv = document.getElementById("message");
    const addItemButton = document.getElementById("add-item-btn");
    let activeSuggestionsContainer = null;
    let currentSuggestionIndex = -1;

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
async function fetchLastInvoiceNumber() {
    const token = localStorage.getItem("token");
    try {
        const response = await fetch(`${BASE_URL}/api/invoices/last`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) throw new Error("Failed to fetch last invoice number");

        const { lastInvoiceNumber } = await response.json();
        return lastInvoiceNumber;
    } catch (error) {
        console.error("Error fetching last invoice number:", error);
        displayMessage(error.message);
        return null; // Return null if there's an error
    }
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
            setCashierName("Cashier"); // Set default cashier name
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
    
            // Set the cashier's name to the logged-in user's name
            setCashierName(username);
        } catch {
            usernameSpan.textContent = "Guest";
            authButton.textContent = "Login";
            authButton.classList.remove("logout");
            authButton.addEventListener("click", () => {
                window.location.href = "../login/login.html";
            });
            setCashierName("Cashier"); // Set default cashier name
        }
    
        // Set the current date in the invoice date input field
        const setCurrentDate = () => {
            const dateInput = document.getElementById("invoice-date");
            const today = new Date();
            const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
            dateInput.value = formattedDate;
        };
        setCurrentDate();
    }
    
    const setCashierName = (name) => {
        const cashierInput = document.getElementById("cashier-name");
        cashierInput.value = name; // Set the cashier's name to the provided name
    };

    function highlightSuggestion(suggestions) {
        suggestions.forEach((item) => item.classList.remove("selected"));

        if (currentSuggestionIndex >= 0 && currentSuggestionIndex < suggestions.length) {
            const selectedItem = suggestions[currentSuggestionIndex];
            selectedItem.classList.add("selected");
            selectedItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    }

    function populateItemsTable(items) {
        const billItemsContainer = document.getElementById("bill-items");
        billItemsContainer.innerHTML = ""; // Clear existing items
        addNewRow(); // Add an empty row for user input
    }

    function addNewRow() {
        const billItemsContainer = document.getElementById("bill-items");
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>
                <input type="text" class="product-name" placeholder="Enter product name" autocomplete="off">
                <div class="autocomplete-suggestions" style="display: none;"></div>
            </td>
            <td><input type="text" class="product-id" readonly></td>
            <td><input type="number" class="item-price" value="0.00" step="0.01" readonly></td>
            <td><input type="number" class="item-quantity" value="1" min="1"></td>
            <td class="item-total">₹0.00</td>
            <td>
                <button class="delete-row" type="button">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        billItemsContainer.appendChild(row);
        row.querySelector(".product-name").focus();
        updateTotals();
        return row;
    }

    function updateTotals() {
        const rows = document.querySelectorAll("#bill-items tr");
        let subtotal = 0;

        rows.forEach(row => {
            const price = parseFloat(row.querySelector(".item-price").value) || 0;
            const quantity = parseInt(row.querySelector(".item-quantity").value) || 0;
            const itemTotal = price * quantity;

            row.querySelector(".item-total").textContent = `₹${itemTotal.toFixed(2)}`;
            subtotal += itemTotal;
        });

        const tax = subtotal * 0.10;
        const grandTotal = subtotal + tax;

        document.getElementById("subtotal").textContent = `₹${subtotal.toFixed(2)}`;
        document.getElementById("tax").textContent = `₹${tax.toFixed(2)}`;
        document.getElementById("grand-total").textContent = `₹${grandTotal.toFixed(2)}`;
    }

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
        const suggestionsContainer = inputElement.nextElementSibling;
        suggestionsContainer.innerHTML = '';
        activeSuggestionsContainer = suggestionsContainer;
        currentSuggestionIndex = -1;

        if (suggestions.length === 0) {
            suggestionsContainer.style.display = 'none';
            return;
        }

        suggestions.forEach((item, index) => {
            const suggestionItem = document.createElement('div');
            suggestionItem.classList.add('suggestion-item');
            suggestionItem.innerHTML = `
                <div class="suggestion-name">${item.name}</div>
                <div class="suggestion-details">
                    <span class="suggestion-id">ID: ${item.id}</span>
                    <span class="suggestion-price">₹${item.price.toFixed(2)}</span>
                    ${item.stock ? `<span class="suggestion-stock">Stock: ${item.stock}</span>` : ''}
                </div>
            `;

            suggestionItem.dataset.index = index;
            suggestionItem.addEventListener('click', () => {
                selectSuggestion(item, inputElement);
            });

            suggestionsContainer.appendChild(suggestionItem);
        });

        suggestionsContainer.style.display = 'block';
    }

    function selectSuggestion(item, inputElement) {
        const row = inputElement.closest('tr');
        inputElement.value = item.name;
        const suggestionsContainer = inputElement.nextElementSibling;
        suggestionsContainer.style.display = 'none';
        updateItemDetails(item, inputElement);
        addNewRow(); // Add a new row after selecting a suggestion
        currentSuggestionIndex = -1;
        activeSuggestionsContainer = null;
    }

    function updateItemDetails(item, inputElement) {
        const row = inputElement.closest('tr');
        row.querySelector(".product-id").value = item.id;
        row.querySelector(".item-price").value = item.price.toFixed(2);
        updateTotals();
    }

    function navigateSuggestions(direction) {
        if (!activeSuggestionsContainer || activeSuggestionsContainer.style.display === 'none') {
            return;
        }
        
        const suggestions = activeSuggestionsContainer.querySelectorAll('.suggestion-item');
        if (suggestions.length === 0) return;
        
        if (currentSuggestionIndex >= 0 && currentSuggestionIndex < suggestions.length) {
            suggestions[currentSuggestionIndex].classList.remove('selected');
        }
        
        if (direction === 'down') {
            currentSuggestionIndex = (currentSuggestionIndex + 1) % suggestions.length;
        } else if (direction === 'up') {
            currentSuggestionIndex = (currentSuggestionIndex - 1 + suggestions.length) % suggestions.length;
        }
        
        suggestions[currentSuggestionIndex].classList.add('selected');
        suggestions[currentSuggestionIndex].scrollIntoView({ block: 'nearest' });
    }

    function selectCurrentSuggestion() {
        if (!activeSuggestionsContainer || currentSuggestionIndex === -1) {
            return false;
        }
        
        const suggestions = activeSuggestionsContainer.querySelectorAll('.suggestion-item');
        if (currentSuggestionIndex >= 0 && currentSuggestionIndex < suggestions.length) {
            suggestions[currentSuggestionIndex].click();
            return true;
        }
        
        return false;
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
                activeSuggestionsContainer = null;
                currentSuggestionIndex = -1;
            }
        }
    }, 300);

    // Keyboard events for suggestion navigation
    document.addEventListener('keydown', (event) => {
        if (!activeSuggestionsContainer) return;
        
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                navigateSuggestions('down');
                break;
            case 'ArrowUp':
                event.preventDefault();
                navigateSuggestions('up');
                break;
            case 'Enter':
                if (selectCurrentSuggestion()) {
                    event.preventDefault();
                }
                break;
            case 'Escape':
                activeSuggestionsContainer.style.display = 'none';
                activeSuggestionsContainer = null;
                currentSuggestionIndex = -1;
                break;
        }
    });

    // Handle input events on the billing items table
    document.addEventListener("input", (event) => {
        if (event.target.classList.contains("product-name")) {
            debouncedSuggestions(event);
        }
        
        if (event.target.closest("#bill-items")) {
            updateTotals();
        }
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.product-name') && !event.target.closest('.autocomplete-suggestions')) {
            const allSuggestions = document.querySelectorAll('.autocomplete-suggestions');
            allSuggestions.forEach(container => {
                container.style.display = 'none';
            });
            activeSuggestionsContainer = null;
            currentSuggestionIndex = -1;
        }
    });

    // Event delegation for the delete buttons
    document.addEventListener("click", (event) => {
        if (event.target.closest(".delete-row")) {
            const row = event.target.closest("tr");
            const rows = document.querySelectorAll("#bill-items tr");
            if (rows.length > 1) {
                row.remove();
                updateTotals();
            } else {
                const inputs = row.querySelectorAll("input");
                inputs.forEach(input => {
                    if (input.type === "number" && input.classList.contains("item-quantity")) {
                        input.value = "1";
                    } else {
                        input.value = "";
                    }
                });
                row.querySelector(".item-total").textContent = "₹0.00";
                updateTotals();
            }
        }
    });

    // Submit billing data
    const submitBilling = async () => {
        const customerName = document.getElementById("customer-name").value;
        const customerPhone = document.getElementById("customer-phone").value;
        const paymentMethod = document.getElementById("payment-method").value;
        const paymentStatus = document.getElementById("payment-status").value;

        // Basic validation
        if (!customerName || !customerPhone || !paymentMethod || !paymentStatus) {
            displayMessage("Please fill in all required fields", "error");
            return;
        }

        const items = Array.from(document.querySelectorAll("#bill-items tr")).filter(row => {
            return row.querySelector(".product-id").value.trim() !== "";
        });

        if (items.length === 0) {
            displayMessage("Please add at least one product", "error");
            return;
        }

        const token = checkLogin();
        const invoiceData = {
            customerName,
            customerPhone,
            customerEmail: document.getElementById("customer-email").value,
            customerAddress: document.getElementById("customer-address").value,
            invoiceDate: document.getElementById("invoice-date").value,
            invoiceNo: document.getElementById("invoice-no").value,
            paymentMethod,
            paymentStatus,
            paymentNote: document.getElementById("payment-note").value,
            items: items.map(row => ({
                name: row.querySelector(".product-name").value,
                id: row.querySelector(".product-id").value,
                price: parseFloat(row.querySelector(".item-price").value) || 0,
                quantity: parseInt(row.querySelector(".item-quantity").value) || 0,
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
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (error) {
            displayMessage(error.message);
        }
    };

    // Add event listener for the submit button
    document.getElementById("next-button").addEventListener("click", submitBilling);
    
    fetchProfile();
    // Assuming fetchItems is defined elsewhere in your code
    // fetchItems();
});