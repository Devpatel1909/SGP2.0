    document.addEventListener("DOMContentLoaded", () => {
        const BASE_URL = "http://localhost:3000";
        const inventoryTable = document.getElementById("inventory-table");
        const messageDiv = document.getElementById("message");
        const addItemButton = document.getElementById("add-item-btn");

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
                // No token - show Login button and default username
                usernameSpan.textContent = "Guest";
                authButton.textContent = "Login";
                authButton.classList.remove("logout");
                authButton.addEventListener("click", () => {
                    window.location.href = "../login/index.html"; // Redirect to login page
                });
                return;
            }
        
            try {
                // Fetch user profile with token
                const response = await fetch(`${BASE_URL}/api/profile`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!response.ok) throw new Error("Failed to fetch profile");
        
                const { username } = await response.json();
                usernameSpan.textContent = username;
        
                // Show Logout button
                authButton.textContent = "Logout";
                authButton.classList.add("logout");
                authButton.addEventListener("click", () => {
                    localStorage.removeItem("token");
                    window.location.href = "../login/login.html"; // Redirect to login page
                });
            } catch {
                // Handle failed profile fetch
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
                renderInventory(items);
            } catch (error) {
                displayMessage(error.message);
            }
        }

        function renderInventory(items) {
            const tbody = inventoryTable.querySelector("tbody");
            tbody.innerHTML = "";
        
            // Use Intl.NumberFormat for formatting currency in INR
            const formatter = new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
            });
        
            items.forEach(item => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${item.id}</td>
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>${formatter.format(item.price)}</td> <!-- Format price in INR -->
                    <td>${formatter.format(item.profit)}</td> <!-- Format profit in INR -->
                    <td>${new Date(item.expiry).toISOString().split('T')[0]}</td>
                    <td>
                        <button class="edit-btn" data-id="${item.id}">
                            <i class="fa-solid fa-edit"></i>
                        </button>
                        <button class="delete-btn" data-id="${item.id}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>`;
                tbody.appendChild(row);
            });
        }
        

        inventoryTable.addEventListener("click", async (e) => {
            const token = checkLogin();
            const button = e.target.closest("button");
            if (!button) return;

            const id = button.dataset.id;

            if (button.classList.contains("edit-btn")) {
                const row = button.closest("tr");
                const updatedItem = {
                    name: prompt("Enter new name:", row.cells[1].textContent),
                    quantity: parseInt(prompt("Enter new quantity:", row.cells[2].textContent)),
                    price: parseFloat(prompt("Enter new price:", row.cells[3].textContent)),
                    profit: parseFloat(prompt("Enter new profit:", row.cells[4].textContent)),
                    expiry: prompt("Enter new expiry date:", row.cells[5].textContent),
                };

                if (!isValidItem(updatedItem)) {
                    return displayMessage("Invalid input data", "error");
                }

                try {
                    const response = await fetch(`${BASE_URL}/api/items/${id}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify(updatedItem)
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || "Update failed");
                    }

                    fetchItems();
                    displayMessage("Item updated!", "success");
                } catch (error) {
                    displayMessage(error.message);
                }
            }

            if (button.classList.contains("delete-btn")) {
                if (!confirm("Delete this item?")) return;

                try {
                    const response = await fetch(`${BASE_URL}/api/items/${id}`, {
                        method: "DELETE",
                        headers: { 
                            "Authorization": `Bearer ${token}`,
                            "Content-Type": "application/json"
                        }
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || "Delete failed");
                    }

                    fetchItems();
                    displayMessage("Item deleted!", "success");
                } catch (error) {
                    displayMessage(error.message);
                }
            }
        });

        addItemButton.addEventListener("click", async () => {
            const token = checkLogin();
            const newItem = {
                name: document.getElementById("new-name").value,
                quantity: parseInt(document.getElementById("new-quantity").value),
                price: parseFloat(document.getElementById("new-price").value),
                profit: parseFloat(document.getElementById("new-profit").value),
                expiry: document.getElementById("new-expiry").value,
            };

            if (!isValidItem(newItem)) {
                return displayMessage("Invalid input data", "error");
            }

            try {
                const response = await fetch(`${BASE_URL}/api/items`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify(newItem)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || "Add failed");
                }

                fetchItems();
                displayMessage("Item added!", "success");
                ["new-name", "new-quantity", "new-price", "new-profit", "new-expiry"]
                    .forEach(id => document.getElementById(id).value = "");
            } catch (error) {
                displayMessage(error.message);
            }
        });

        function isValidItem(item) {
            return item.name && 
                item.quantity >= 0 && 
                item.price >= 0 && 
                item.profit >= 0 && 
                !isNaN(new Date(item.expiry).getTime());
        }

        fetchProfile();
        fetchItems();
    });
