document.addEventListener("DOMContentLoaded", () => {
    const inventoryForm = document.getElementById("inventory-form");
    const inventoryTable = document.getElementById("inventory-table");
    const messageDiv = document.getElementById("message");
    const searchInput = document.querySelector(".search-bar");

    // Check if user is logged in
    function checkLogin() {
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "../login/index.html";
        }
        return token;
    }

    // Display messages
    function displayMessage(message, type = "error") {
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        setTimeout(() => {
            messageDiv.textContent = "";
            messageDiv.className = "message";
        }, 3000);
    }

    // Fetch items from server
    async function fetchItems() {
        const token = checkLogin();
        try {
            const response = await fetch("http://localhost:3000/api/items", {
                headers: {
                    "Authorization": `Bearer ${token}`,
                },
            });
            if (!response.ok) throw new Error("Failed to fetch items.");
            const items = await response.json();
            renderInventory(items);
        } catch (error) {
            displayMessage(error.message, "error");
        }
    }

    // Render items in the table
    function renderInventory(items) {
        const tbody = inventoryTable.querySelector("tbody");
        tbody.innerHTML = "";

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7">No items found.</td></tr>`;
            return;
        }

        items.forEach((item) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${item.id}</td>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>${item.price}</td>
                <td>${item.profit}</td>
                <td>${item.expiry}</td>
                <td>
                    <button class="edit-btn" data-id="${item.id}"><i class="fa-solid fa-edit"></i></button>
                    <button class="delete-btn" data-id="${item.id}"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // Add new item
    inventoryForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const token = checkLogin();

        const newItem = {
            id: document.getElementById("item-id").value,
            name: document.getElementById("item-name").value,
            quantity: parseInt(document.getElementById("item-quantity").value),
            price: parseFloat(document.getElementById("item-price").value),
            profit: parseFloat(document.getElementById("item-profit").value),
            expiry: document.getElementById("item-expiry").value,
        };

        try {
            const response = await fetch("http://localhost:3000/api/items", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify(newItem),
            });

            if (!response.ok) throw new Error("Failed to add item.");
            fetchItems();
            inventoryForm.reset();
            displayMessage("Item added successfully!", "success");
        } catch (error) {
            displayMessage(error.message, "error");
        }
    });

    // Fetch items on page load
    fetchItems();

    // Search functionality
    searchInput.addEventListener("input", () => {
        const searchTerm = searchInput.value.toLowerCase();
        const rows = inventoryTable.querySelectorAll("tbody tr");
        rows.forEach((row) => {
            const name = row.cells[1].textContent.toLowerCase();
            row.style.display = name.includes(searchTerm) ? "" : "none";
        });
    });
});
