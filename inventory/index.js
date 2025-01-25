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
        messageDiv.style.display = "block"; // Show message
        setTimeout(() => {
            messageDiv.textContent = "";
            messageDiv.className = "message"; // Reset the message style
            messageDiv.style.display = "none"; // Hide message after 3 seconds
        }, 3000);
    }

    // Fetch and display the user profile
    async function fetchProfile() {
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "../login/index.html"; // Redirect if not logged in
            return;
        }

        try {
            const response = await fetch("http://localhost:3000/api/profile", {
                headers: {
                    "Authorization": `Bearer ${token}`,
                },
            });

            if (!response.ok) throw new Error("Failed to fetch profile");
            const { username } = await response.json();
            const profileNameSpan = document.querySelector(".profile span");
            profileNameSpan.textContent = username; // Update the profile name
        } catch (error) {
            console.error("Error fetching profile:", error);
            const profileNameSpan = document.querySelector(".profile span");
            profileNameSpan.textContent = "Guest"; // Fallback for errors
        }
    }

    // Fetch inventory items from the server
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

    // Render inventory items in the table
    function renderInventory(items) {
        const tbody = inventoryTable.querySelector("tbody");
        tbody.innerHTML = "";

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No items found.</td></tr>`;
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

    // Handle item actions (Edit or Delete)
    inventoryTable.addEventListener("click", async (e) => {
        const token = checkLogin();
        const id = e.target.closest("button")?.dataset.id;
        if (!id) return;

        if (e.target.closest(".edit-btn")) {
            const row = e.target.closest("tr");
            const updatedItem = {
                name: prompt("Enter new name:", row.cells[1].textContent),
                quantity: parseInt(prompt("Enter new quantity:", row.cells[2].textContent)),
                price: parseFloat(prompt("Enter new price:", row.cells[3].textContent)),
                profit: parseFloat(prompt("Enter new profit:", row.cells[4].textContent)),
                expiry: prompt("Enter new expiry date:", row.cells[5].textContent),
            };

            try {
                const response = await fetch(`http://localhost:3000/api/items/${id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                    },
                    body: JSON.stringify(updatedItem),
                });

                if (!response.ok) throw new Error("Failed to update item.");
                fetchItems(); // Refresh items
                displayMessage("Item updated successfully!", "success");
            } catch (error) {
                displayMessage(error.message, "error");
            }
        }

        if (e.target.closest(".delete-btn")) {
            if (!confirm("Are you sure you want to delete this item?")) return;

            try {
                const response = await fetch(`http://localhost:3000/api/items/${id}`, {
                    method: "DELETE",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                    },
                });

                if (!response.ok) throw new Error("Failed to delete item.");
                fetchItems(); // Refresh items
                displayMessage("Item deleted successfully!", "success");
            } catch (error) {
                displayMessage(error.message, "error");
            }
        }
    });

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

    // Fetch items and profile on page load
    fetchProfile();
    fetchItems();
});
