document.addEventListener("DOMContentLoaded", () => {
    const BASE_URL = "http://localhost:3000";
    const productContainer = document.getElementById("product-container");
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

    async function fetchProducts() {
        const token = checkLogin();
        try {
            const response = await fetch(`${BASE_URL}/api/products`, {
                headers: { "Authorization": `Bearer ${token}` },
            });
            if (!response.ok) throw new Error("Failed to fetch products");
            const products = await response.json();
            renderProducts(products);
        } catch (error) {
            displayMessage(error.message);
        }
    }

    function renderProducts(products) {
        productContainer.innerHTML = "";

        products.forEach(product => {
            const card = document.createElement("div");
            card.className = "product-card";
            card.innerHTML = `
                <h3>${product.name}</h3>
                <p>${product.description}</p>
                <p><strong>Category:</strong> ${product.category}</p>
                <p><strong>Stock:</strong> ${product.stock}</p>
                <button class="delete-btn" data-id="${product.id}">
                    <i class="fa-solid fa-trash"></i> Delete
                </button>`;
            productContainer.appendChild(card);
        });
    }

    productContainer.addEventListener("click", async (e) => {
        const token = checkLogin();
        const button = e.target.closest(".delete-btn");
        if (!button) return;

        const id = button.dataset.id;

        if (confirm("Delete this product?")) {
            try {
                const response = await fetch(`${BASE_URL}/api/products/${id}`, {
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

                fetchProducts();
                displayMessage("Product deleted!", "success");
            } catch (error) {
                displayMessage(error.message);
            }
        }
    });

    fetchProducts();
});
