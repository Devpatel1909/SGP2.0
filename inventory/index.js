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

    // Function to convert DD-MM-YYYY to YYYY-MM-DD format
    function convertDateForServer(dateString) {
        if (!dateString || !dateString.includes('-')) return dateString;
        
        const parts = dateString.split('-');
        if (parts.length !== 3) return dateString;
        
        // Convert from DD-MM-YYYY to YYYY-MM-DD
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
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
    
    // Function to format date to DD-MM-YYYY
    function formatDate(dateString) {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return "Invalid Date";
            }
            
            // Format to DD-MM-YYYY
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0'); // +1 because months are 0-indexed
            const year = date.getFullYear();
            
            return `${day}-${month}-${year}`;
        } catch (error) {
            console.error("Error formatting date:", error);
            return "Invalid Date";
        }
    }
    
    // Function to initialize sortable headers
    function initSortableHeaders() {
        document.querySelectorAll('.inventory-table th.sortable').forEach(headerCell => {
            // Remove old handlers to avoid duplicates
            const newHeader = headerCell.cloneNode(true);
            headerCell.parentNode.replaceChild(newHeader, headerCell);
            
            newHeader.addEventListener('click', () => {
                const tableElement = newHeader.closest('table');
                const headerIndex = Array.prototype.indexOf.call(newHeader.parentElement.children, newHeader);
                const currentIsAscending = newHeader.classList.contains('sort-asc');
                
                // Remove all sort classes
                tableElement.querySelectorAll('th').forEach(th => {
                    th.classList.remove('sort-asc');
                    th.classList.remove('sort-desc');
                });
                
                // Add appropriate sort class
                newHeader.classList.toggle('sort-asc', !currentIsAscending);
                newHeader.classList.toggle('sort-desc', currentIsAscending);
                
                // Get table rows and sort
                const rows = Array.from(tableElement.querySelectorAll('tbody tr'));
                const sortedRows = rows.sort((a, b) => {
                    const aColText = a.querySelector(`td:nth-child(${headerIndex + 1})`).textContent.trim();
                    const bColText = b.querySelector(`td:nth-child(${headerIndex + 1})`).textContent.trim();
                    
                    // Handle numeric vs. string sorting
                    if (!isNaN(parseFloat(aColText)) && !isNaN(parseFloat(bColText))) {
                        return currentIsAscending ? 
                            parseFloat(bColText) - parseFloat(aColText) : 
                            parseFloat(aColText) - parseFloat(bColText);
                    } else {
                        return currentIsAscending ? 
                            bColText.localeCompare(aColText) : 
                            aColText.localeCompare(bColText);
                    }
                });
                
                // Rearrange table rows based on sort
                const tbody = tableElement.querySelector('tbody');
                while (tbody.firstChild) {
                    tbody.removeChild(tbody.firstChild);
                }
                
                tbody.append(...sortedRows);
            });
        });
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
            
            // Initialize sortable headers after rendering
            setTimeout(initSortableHeaders, 100);
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
                <td>${formatDate(item.expiry)}</td> <!-- Format date as DD-MM-YYYY -->
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
                price: parseFloat(prompt("Enter new price:", row.cells[3].textContent.replace(/[₹,]/g, ''))),
                profit: parseFloat(prompt("Enter new profit:", row.cells[4].textContent.replace(/[₹,]/g, ''))),
                expiry: prompt("Enter new expiry date (DD-MM-YYYY):", row.cells[5].textContent),
            };

            if (!isValidItem(updatedItem)) {
                return displayMessage("Invalid input data", "error");
            }

            // Convert date format before sending to server
            updatedItem.expiry = convertDateForServer(updatedItem.expiry);

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
            expiry: document.getElementById("new-expiry").value, // This should be in DD-MM-YYYY format
        };

        if (!isValidItem(newItem)) {
            return displayMessage("Invalid input data", "error");
        }

        // Convert date format before sending to server
        newItem.expiry = convertDateForServer(newItem.expiry);

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

    // Modified to handle DD-MM-YYYY format
    function isValidItem(item) {
        // Parse the date from DD-MM-YYYY format
        let isValidDate = false;
        
        if (item.expiry) {
            // Check if it's already a valid date
            let expiryDate = new Date(item.expiry);
            
            // If not, try to parse as DD-MM-YYYY
            if (isNaN(expiryDate.getTime()) && item.expiry.includes('-')) {
                const parts = item.expiry.split('-');
                if (parts.length === 3) {
                    // Try to parse as DD-MM-YYYY
                    expiryDate = new Date(
                        parseInt(parts[2]), // Year
                        parseInt(parts[1]) - 1, // Month (0-based)
                        parseInt(parts[0]) // Day
                    );
                }
            }
            
            isValidDate = !isNaN(expiryDate.getTime());
        }
        
        return item.name && 
               item.quantity >= 0 && 
               item.price >= 0 && 
               item.profit >= 0 && 
               isValidDate;
    }

    fetchProfile();
    fetchItems();
});
