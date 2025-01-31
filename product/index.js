document.addEventListener("DOMContentLoaded", () => {
    const BASE_URL = "http://localhost:3000"; // Update if hosted differently
    const inventoryTable = document.getElementById("inventory-table");
    const messageDiv = document.getElementById("message");
    const authButton = document.getElementById("auth-btn");
    const usernameSpan = document.getElementById("username");

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
        const token = localStorage.getItem("token");

        if (!token) {
            usernameSpan.textContent = "Guest";
            authButton.textContent = "Login";
            authButton.classList.remove("logout");
            authButton.onclick = () => window.location.href = "../login/index.html";
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
            authButton.onclick = () => {
                localStorage.removeItem("token");
                window.location.href = "../login/login.html";
            };
        } catch {
            usernameSpan.textContent = "Guest";
            authButton.textContent = "Login";
            authButton.classList.remove("logout");
            authButton.onclick = () => window.location.href = "../login/login.html";
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
               `;
            tbody.appendChild(row);
        });
    }

    inventoryTable.addEventListener("click", async (e) => {
        const token = checkLogin();
        const button = e.target.closest(".delete-btn");
        if (!button) return;

        const id = button.dataset.id;

        if (confirm("Delete this product?")) {
            try {
                const response = await fetch(`${BASE_URL}/api/items/${id}`, {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || "Delete failed");
                }

                fetchItems();
                displayMessage("Product deleted!", "success");
            } catch (error) {
                displayMessage(error.message);
            }
        }
    });

    // Initial load
    fetchProfile();
    fetchItems();
});