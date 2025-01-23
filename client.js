document.addEventListener("DOMContentLoaded", () => {
    const inventoryForm = document.getElementById("inventory-form");
    const inventoryTable = document.getElementById("inventory-table");

    // Fetch items from the database and render them in the table
    async function fetchItems() {
        try {
            const response = await fetch("http://localhost:3000/api/items", {
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("token")}` // Include the token for authentication
                }
            });
            if (!response.ok) {
                throw new Error("Failed to fetch items");
            }
            const items = await response.json();
            renderInventory(items);
        } catch (error) {
            console.error("Error fetching items:", error);
        }
    }

    // Render items in the table
    function renderInventory(items) {
        inventoryTable.innerHTML = "";
        items.forEach((item) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${item.id}</td>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>${item.price}</td>
            `;
            inventoryTable.appendChild(row);
        });
    }

    // Handle form submission to add a new item
    inventoryForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const itemId = document.getElementById("item-id").value;
        const itemName = document.getElementById("item-name").value;
        const itemQuantity = parseInt(document.getElementById("item-quantity").value);
        const itemPrice = parseFloat(document.getElementById("item-price").value);

        if (itemId && itemName && !isNaN(itemQuantity) && !isNaN(itemPrice)) {
            try {
                const response = await fetch("http://localhost:3000/api/items", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${localStorage.getItem("token")}` // Include the token for authentication
                    },
                    body: JSON.stringify({
                        id: itemId,
                        name: itemName,
                        quantity: itemQuantity,
                        price: itemPrice,
                    }),
                });

                if (response.ok) {
                    fetchItems(); // Refresh the item list
                    inventoryForm.reset(); // Reset the form
                } else {
                    const errorData = await response.json();
                    console.error("Error adding item:", errorData.message);
                }
            } catch (error) {
                console.error("Error adding item:", error);
            }
        } else {
            console.error("Please fill all fields correctly.");
        }
    });

    // Fetch and render items on page load
    fetchItems();
});