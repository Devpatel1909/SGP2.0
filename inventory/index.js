document.addEventListener("DOMContentLoaded", () => {
    const BASE_URL = "http://localhost:3000";
    const inventoryTable = document.getElementById("inventory-table");
    const messageDiv = document.getElementById("message");
    const addItemBtn = document.getElementById("add-item-btn");
    const searchInput = document.getElementById("search-items") || document.createElement("input");
    const searchBtn = document.getElementById("search-btn") || document.createElement("button");
    const sortBy = document.getElementById("sort-by") || document.createElement("select");
    const exportCsvBtn = document.getElementById("export-csv") || document.createElement("button");
    const exportPdfBtn = document.getElementById("export-pdf") || document.createElement("button");
    const printBtn = document.getElementById("print-inventory") || document.createElement("button");
    const batchDeleteBtn = document.getElementById("batch-delete") || document.createElement("button");
    const selectAllCheckbox = document.getElementById("select-all") || document.createElement("input");
    
    // Set low stock threshold
    const LOW_STOCK_THRESHOLD = 5;
    const EXPIRY_WARNING_DAYS = 30;
    const EXPIRY_CRITICAL_DAYS = 7;
    
    // Inventory data storage
    let inventoryItems = [];
    let filteredItems = [];
    
    // Initialize datepickers if flatpickr is available
    if (typeof flatpickr === 'function') {
        // Initialize flatpickr for date inputs
        const expiryInput = document.getElementById("new-expiry");
        if (expiryInput) {
            flatpickr(expiryInput, {
                dateFormat: "d-m-Y",
                altInput: true,
                altFormat: "d-m-Y",
                allowInput: true
            });
        }
    } else {
        console.warn("Flatpickr library not loaded. Date picker functionality will be limited.");
    }
    
    // Initialize datepickers
    flatpickr("#new-expiry", {
        dateFormat: "d-m-Y",
        altInput: true,
        altFormat: "d-m-Y",
        allowInput: true
    });
    
    function checkLogin() {
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "../login/login.html";
        }
        return token;
    }

    // Date utilities
    function formatDate(dateString) {
        if (!dateString) return "N/A";
        
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                // Try parsing DD-MM-YYYY format
                const parts = dateString.split('-');
                if (parts.length === 3) {
                    // Parse as DD-MM-YYYY
                    const newDate = new Date(
                        parseInt(parts[2]), // Year
                        parseInt(parts[1]) - 1, // Month (0-based)
                        parseInt(parts[0]) // Day
                    );
                    
                    if (!isNaN(newDate.getTime())) {
                        // Format to DD-MM-YYYY
                        return `${String(newDate.getDate()).padStart(2, '0')}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${newDate.getFullYear()}`;
                    }
                }
                return "Invalid Date";
            }
            
            // Format to DD-MM-YYYY
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            
            return `${day}-${month}-${year}`;
        } catch (error) {
            console.error("Error formatting date:", error);
            return "Invalid Date";
        }
    }
    
    // Function to convert DD-MM-YYYY to ISO format for server
    function convertDateForServer(dateString) {
        if (!dateString || !dateString.includes('-')) return dateString;
        
        const parts = dateString.split('-');
        if (parts.length !== 3) return dateString;
        
        // Convert from DD-MM-YYYY to YYYY-MM-DD
        const formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        
        // Log the conversion for debugging
        console.log(`Converting date: ${dateString} → ${formattedDate}`);
        
        return formattedDate;
    }

    function getDaysUntilExpiry(expiryDateString) {
        if (!expiryDateString || expiryDateString === "N/A" || expiryDateString === "Invalid Date") 
            return Infinity;
        
        let expiryDate;
        
        if (expiryDateString.includes('-')) {
            // Parse DD-MM-YYYY format
            const parts = expiryDateString.split('-');
            if (parts.length === 3) {
                expiryDate = new Date(
                    parseInt(parts[2]), // Year
                    parseInt(parts[1]) - 1, // Month (0-based)
                    parseInt(parts[0]) // Day
                );
            } else {
                return Infinity;
            }
        } else {
            // Try standard date parsing
            expiryDate = new Date(expiryDateString);
        }
        
        if (isNaN(expiryDate.getTime())) return Infinity;
        
        const today = new Date();
        // Set time to 00:00:00 for both dates to compare only dates
        today.setHours(0, 0, 0, 0);
        expiryDate.setHours(0, 0, 0, 0);
        
        const diffTime = expiryDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    }
    
    // Updated function to categorize expiry status
    function getExpiryStatus(expiryDateString) {
        const daysUntilExpiry = getDaysUntilExpiry(expiryDateString);
        
        console.log(`Expiry date: ${expiryDateString}, Days until expiry: ${daysUntilExpiry}`);
        
        if (daysUntilExpiry <= 0) {
            return 'expired'; // New category for expired items
        } else if (daysUntilExpiry <= EXPIRY_CRITICAL_DAYS) {
            return 'critical'; // Within 7 days (using your constant)
        } else if (daysUntilExpiry <= EXPIRY_WARNING_DAYS) {
            return 'warning'; // Within 30 days (using your constant)
        } else {
            return 'normal';
        }
    }
    
    function displayMessage(message, type = "error") {
        messageDiv.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-times-circle'}"></i> ${message}`;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = "block";
        
        // Scroll to message
        messageDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
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
                window.location.href = "../login/login.html"; // Redirect to login page
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
            
            if (!response.ok) {
                if (response.status === 403) {
                    localStorage.removeItem("token");
                    window.location.href = "../login/login.html";
                }
                throw new Error("Failed to fetch items");
            }
            
            inventoryItems = await response.json();
            filteredItems = [...inventoryItems];
            renderInventory(filteredItems);
            
        } catch (error) {
            console.error("Error fetching items:", error);
            displayMessage(`Error: ${error.message}`);
        }
    }

    // Fixed and updated renderInventory function
    function renderInventory(items) {
        const tbody = inventoryTable.querySelector("tbody");
        tbody.innerHTML = "";

        // Use Intl.NumberFormat for formatting currency
        const formatter = new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
        });

        items.forEach(item => {
            const daysUntilExpiry = getDaysUntilExpiry(item.expiry);
            const expiryStatus = getExpiryStatus(item.expiry);
            const stockStatus = item.quantity <= 0 ? 'out' : 
                              item.quantity <= LOW_STOCK_THRESHOLD ? 'low' : 
                              item.quantity <= LOW_STOCK_THRESHOLD * 2 ? 'medium' : 'high';
            
            // Format expiry date display with appropriate icon
            let expiryDisplay = formatDate(item.expiry);
            let expiryIcon = '';
            
            if (expiryStatus === 'critical') {
                expiryIcon = '<i class="fas fa-exclamation-circle text-danger"></i>';
            } else if (expiryStatus === 'warning') {
                expiryIcon = '<i class="fas fa-exclamation-triangle text-warning"></i>';
            }
            
            const row = document.createElement("tr");
            row.dataset.id = item.id;
            row.innerHTML = `
                <td><input type="checkbox" class="item-select" data-id="${item.id}"></td>
                <td>${item.id}</td>
                <td>${item.name}</td>
                <td class="quantity-cell ${stockStatus === 'low' ? 'text-danger' : stockStatus === 'out' ? 'text-danger fw-bold' : ''}">
                    <span class="stock-indicator stock-${stockStatus}"></span>
                    ${item.quantity}
                </td>
                <td>${formatter.format(item.price)}</td>
                <td>${formatter.format(item.profit)}</td>
                <td class="expiry-${expiryStatus}">
                    ${expiryDisplay}
                    ${expiryIcon}
                </td>
                <td class="action-buttons">
                    <button class="edit-btn" data-id="${item.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-btn" data-id="${item.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>`;
            tbody.appendChild(row);
        });
        
        // Update the batch delete button state
        updateBatchDeleteButton();
    }
    
    function updateBatchDeleteButton() {
        const selectedItems = document.querySelectorAll('.item-select:checked').length;
        batchDeleteBtn.disabled = selectedItems === 0;
        batchDeleteBtn.textContent = `Delete Selected (${selectedItems})`;
    }
    
    function filterItems() {
        const searchTerm = searchInput.value.toLowerCase();
        
        // Filter items based on search term
        if (searchTerm) {
            filteredItems = inventoryItems.filter(item => 
                item.name.toLowerCase().includes(searchTerm) || 
                item.id.toString().includes(searchTerm)
            );
        } else {
            filteredItems = [...inventoryItems];
        }
        
        // Get sort value
        const sortValue = sortBy.value;
        
        // Sort items
        filteredItems.sort((a, b) => {
            switch (sortValue) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'price':
                    return a.price - b.price;
                case 'quantity':
                    return a.quantity - b.quantity;
                case 'expiry':
                    return getDaysUntilExpiry(a.expiry) - getDaysUntilExpiry(b.expiry);
                default: // id
                    return a.id - b.id;
            }
        });
        
        renderInventory(filteredItems);
    }
    
    function exportToCsv() {
        const headers = ['ID', 'Name','Quantity', 'Price', 'Profit', 'Expiry Date'];
        
        // Create CSV content
        let csvContent = headers.join(',') + '\n';
        
        filteredItems.forEach(item => {
            const row = [
                item.id,
                `"${item.name}"`, // Quotes to handle commas in names
                item.quantity,
                item.price,
                item.profit,
                formatDate(item.expiry)
            ];
            
            csvContent += row.join(',') + '\n';
        });
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `inventory_export_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    function exportToPdf() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Add title and date
        doc.setFontSize(18);
        doc.text('Inventory Report', 14, 22);
        
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
        
        // Define columns
        const columns = [
            {header: 'ID', dataKey: 'id'},
            {header: 'Name', dataKey: 'name'},
            {header: 'Quantity', dataKey: 'quantity'},
            {header: 'Price (₹)', dataKey: 'price'},
            {header: 'Profit (₹)', dataKey: 'profit'},
            {header: 'Expiry', dataKey: 'expiry'}
        ];
        
        // Format data for PDF
        const data = filteredItems.map(item => {
            return {
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price.toFixed(2),
                profit: item.profit.toFixed(2),
                expiry: formatDate(item.expiry)
            };
        });
        
        // Generate the table
        doc.autoTable({
            startY: 40,
            head: [columns.map(col => col.header)],
            body: data.map(item => columns.map(col => item[col.dataKey])),
            theme: 'grid',
            styles: {
                fontSize: 8,
                cellPadding: 3
            },
            headerStyles: {
                fillColor: [90, 74, 209],
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            columnStyles: {
                id: {cellWidth: 15},
                name: {cellWidth: 40},
                quantity: {cellWidth: 25},
                price: {cellWidth: 25},
                profit: {cellWidth: 25},
                expiry: {cellWidth: 30}
            }
        });
        
        // Save the PDF
        doc.save(`inventory_report_${new Date().toISOString().slice(0,10)}.pdf`);
    }
    
    function printInventory() {
        const printWindow = window.open('', '_blank');
        
        printWindow.document.write(`
            <html>
            <head>
                <title>Inventory Print</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                    }
                    h1 {
                        text-align: center;
                        color: #5a4ad1;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                    }
                    th {
                        background-color: #5a4ad1;
                        color: white;
                    }
                    tr:nth-child(even) {
                        background-color: #f8f9ff;
                    }
                    .low-stock {
                        color: #ef4444;
                        font-weight: bold;
                    }
                    .expiry-warning {
                        color: #f59e0b;
                        font-weight: bold;
                    }
                    .expiry-critical {
                        color: #ef4444;
                        font-weight: bold;
                    }
                    .expiry-expired {
                        color: #ef4444;
                        font-weight: bold;
                        text-decoration: line-through;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 30px;
                        font-size: 12px;
                        color: #767676;
                    }
                    @media print {
                        table { page-break-inside: auto; }
                        tr { page-break-inside: avoid; page-break-after: auto; }
                        thead { display: table-header-group; }
                    }
                </style>
            </head>
            <body>
                <h1>Inventory Report</h1>
                <p>Generated on: ${new Date().toLocaleString()}</p>
                
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Quantity</th>
                            <th>Price (₹)</th>
                            <th>Profit (₹)</th>
                            <th>Expiry Date</th>
                        </tr>
                    </thead>
                    <tbody>
        `);
        
        filteredItems.forEach(item => {
            const daysUntilExpiry = getDaysUntilExpiry(item.expiry);
            const expiryStatus = getExpiryStatus(item.expiry);
            const stockStatus = item.quantity <= 0 ? 'out' : 
                              item.quantity <= LOW_STOCK_THRESHOLD ? 'low' : 
                              item.quantity <= LOW_STOCK_THRESHOLD * 2 ? 'medium' : 'high';
            
            printWindow.document.write(`
                <tr>
                    <td>${item.id}</td>
                    <td>${item.name}</td>
                    <td class="${stockStatus === 'low' || stockStatus === 'out' ? 'low-stock' : ''}">${item.quantity}</td>
                    <td>${item.price.toFixed(2)}</td>
                    <td>${item.profit.toFixed(2)}</td>
                    <td class="${expiryStatus === 'critical' ? 'expiry-critical' : 
                                 expiryStatus === 'warning' ? 'expiry-warning' : 
                                 expiryStatus === 'expired' ? 'expiry-expired' : ''}">${formatDate(item.expiry)}</td>
                </tr>
            `);
        });
        
        printWindow.document.write(`
                    </tbody>
                </table>
                
                <div class="footer">
                    <p>eMart Inventory Management System</p>
                </div>
                
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() {
                            window.close();
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `);
        
        printWindow.document.close();
    }
    
    function isValidItem(item) {
        // Check if all required fields are present and valid
        if (!item.name || item.name.trim() === '') {
            displayMessage("Item name is required", "error");
            return false;
        }
        
        if (item.quantity === undefined || isNaN(item.quantity) || item.quantity < 0) {
            displayMessage("Quantity must be a valid number (0 or greater)", "error");
            return false;
        }
        
        if (item.price === undefined || isNaN(item.price) || item.price < 0) {
            displayMessage("Price must be a valid number (0 or greater)", "error");
            return false;
        }        
        
        if (item.profit === undefined || isNaN(item.profit) || item.profit < 0) {
            displayMessage("Profit must be a valid number (0 or greater)", "error");
            return false;
        }
        
        // Validate expiry date - it should be a valid date
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
            
            if (isNaN(expiryDate.getTime())) {
                displayMessage("Please enter a valid expiry date (DD-MM-YYYY)", "error");
                return false;
            }
        }
        
        return true;
    }
    
    // Event Listeners
    
    // Handle Add Item
    addItemBtn.addEventListener("click", async () => {
        const token = checkLogin();
        
        const newItem = {
            name: document.getElementById("new-name").value.trim(),
            quantity: parseInt(document.getElementById("new-quantity").value) || 0,
            price: parseFloat(document.getElementById("new-price").value) || 0,
            profit: parseFloat(document.getElementById("new-profit").value) || 0,
            expiry: document.getElementById("new-expiry").value,
        };

        if (!isValidItem(newItem)) {
            return;
        }

        // Convert date format before sending to server
        if (newItem.expiry && newItem.expiry.includes('-')) {
            newItem.expiry = convertDateForServer(newItem.expiry);
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
                throw new Error(errorData.message || "Failed to add item");
            }

            const addedItem = await response.json();
            inventoryItems.push(addedItem);
            
            fetchItems(); // Refresh the inventory list
            displayMessage("Item added successfully!", "success");
            
            // Clear form fields
            document.getElementById("new-name").value = "";
            document.getElementById("new-quantity").value = "";
            document.getElementById("new-price").value = "";
            document.getElementById("new-profit").value = "";
            document.getElementById("new-expiry").value = "";
            
        } catch (error) {
            console.error("Error adding item:", error);
            displayMessage(`Error: ${error.message}`, "error");
        }
    })
      // Table row actions (edit, delete)
      inventoryTable.addEventListener("click", async (e) => {
        const token = checkLogin();
        
        // Handle edit button click
        if (e.target.closest(".edit-btn")) {
            const button = e.target.closest(".edit-btn");
            const id = button.dataset.id;
            const item = inventoryItems.find(item => item.id.toString() === id);
            
            if (!item) return;
            
            // Open edit modal or use prompt-based editing
            const row = button.closest("tr");
            
            const updatedItem = {
                name: prompt("Enter new name:", item.name),
                quantity: parseInt(prompt("Enter new quantity:", item.quantity)),
                price: parseFloat(prompt("Enter new price:", item.price)),
                profit: parseFloat(prompt("Enter new profit:", item.profit)),
                expiry: prompt("Enter new expiry date (DD-MM-YYYY):", formatDate(item.expiry)),
            };

            if (!isValidItem(updatedItem)) {
                return;
            }

            // Convert date format before sending to server
            if (updatedItem.expiry && updatedItem.expiry.includes('-')) {
                updatedItem.expiry = convertDateForServer(updatedItem.expiry);
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

                displayMessage("Item updated successfully!", "success");
                fetchItems(); // Refresh the list
            } catch (error) {
                console.error("Error updating item:", error);
                displayMessage(`Error: ${error.message}`, "error");
            }
        }
        
        // Handle delete button click
        if (e.target.closest(".delete-btn")) {
            const button = e.target.closest(".delete-btn");
            const id = button.dataset.id;
            
            if (!confirm("Are you sure you want to delete this item?")) return;
            
            try {
                const response = await fetch(`${BASE_URL}/api/items/${id}`, {
                    method: "DELETE",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || "Delete failed");
                }

                displayMessage("Item deleted successfully!", "success");
                fetchItems(); // Refresh the list
            } catch (error) {
                console.error("Error deleting item:", error);
                displayMessage(`Error: ${error.message}`, "error");
            }
        }
        
        // Handle item selection checkboxes
        if (e.target.classList.contains('item-select')) {
            updateBatchDeleteButton();
        }
    });
    
    // Search functionality
    searchBtn.addEventListener("click", filterItems);
    searchInput.addEventListener("keyup", (e) => {
        if (e.key === "Enter") {
            filterItems();
        }
    });
    
    // Filtering and sorting
    sortBy.addEventListener("change", filterItems);
    
    // Select all checkbox
    selectAllCheckbox.addEventListener("change", () => {
        const checkboxes = document.querySelectorAll('.item-select');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
        });
        updateBatchDeleteButton();
    });
    
    // Batch delete
    batchDeleteBtn.addEventListener("click", async () => {
        const token = checkLogin();
        const selectedIds = Array.from(document.querySelectorAll('.item-select:checked'))
                               .map(checkbox => checkbox.dataset.id);
        
        if (selectedIds.length === 0) return;
        
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected items?`)) return;
        
        try {
            let successCount = 0;
            let errorCount = 0;
            
            // Process deletions one by one
            for (const id of selectedIds) {
                try {
                    const response = await fetch(`${BASE_URL}/api/items/${id}`, {
                        method: "DELETE",
                        headers: {
                            "Authorization": `Bearer ${token}`,
                        }
                    });

                    if (response.ok) {
                        successCount++;
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    console.error(`Error deleting item ${id}:`, error);
                    errorCount++;
                }
            }
            
            if (successCount > 0) {
                displayMessage(`Successfully deleted ${successCount} items${errorCount > 0 ? ` (${errorCount} failed)` : ''}`, "success");
                fetchItems(); // Refresh the list
            } else {
                displayMessage(`Failed to delete items. Please try again.`, "error");
            }
        } catch (error) {
            console.error("Error in batch delete:", error);
            displayMessage(`Error: ${error.message}`, "error");
        }
    });
    
    // Export buttons
    exportCsvBtn.addEventListener("click", exportToCsv);
    exportPdfBtn.addEventListener("click", exportToPdf);
    printBtn.addEventListener("click", printInventory);
    
    // Initialize datepicker for quick add
    flatpickr("#new-expiry", {
        dateFormat: "d-m-Y",
        altInput: true,
        altFormat: "d-m-Y",
        allowInput: true
    });
    
    // Additional features for better UX
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+F for search
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            searchInput.focus();
        }
        
        // Escape to clear search
        if (e.key === 'Escape' && document.activeElement === searchInput) {
            searchInput.value = '';
            filterItems();
        }
    });
    
    // Low stock alerts
    function checkLowStockAlerts() {
        const lowStockItems = inventoryItems.filter(item => 
            item.quantity > 0 && item.quantity <= LOW_STOCK_THRESHOLD
        );
        
        if (lowStockItems.length > 0) {
            const message = `${lowStockItems.length} item${lowStockItems.length > 1 ? 's' : ''} with low stock!`;
            displayMessage(message, "warning");
        }
    }
    
    
    
    // Keep track of edited cells to save changes
    let editedCells = {};
    
    // Enable inline editing for certain cells
    function setupInlineEditing() {
        const tbody = inventoryTable.querySelector("tbody");
        
        tbody.addEventListener('dblclick', (e) => {
            const cell = e.target.closest('td');
            if (!cell) return;
            
            const row = cell.closest('tr');
            const itemId = row.dataset.id;
            
            // Don't allow editing of certain columns
            const columnIndex = Array.from(row.cells).indexOf(cell);
            if (columnIndex === 0 || columnIndex === 1 || columnIndex === 7) {
                return;
            }
            
            const currentValue = cell.textContent.trim();
            
            // Create input element
            const input = document.createElement('input');
            input.value = currentValue.replace(/[₹,]/g, ''); // Remove currency symbols
            
            // Set appropriate input type
            if (columnIndex === 3) { // Quantity
                input.type = 'number';
                input.min = '0';
                input.step = '1';
            } else if (columnIndex === 4 || columnIndex === 5) { // Price, Profit
                input.type = 'number';
                input.min = '0';
                input.step = '0.01';
            } else if (columnIndex === 6) { // Expiry
                input.type = 'text';
                input.placeholder = 'DD-MM-YYYY';
                
                // Initialize datepicker
                setTimeout(() => {
                    flatpickr(input, {
                        dateFormat: "d-m-Y",
                        defaultDate: currentValue,
                        allowInput: true,
                        onClose: () => input.blur()
                    });
                }, 100);
            } else {
                input.type = 'text';
            }
            
            // Style the input
            input.style.width = '100%';
            input.style.boxSizing = 'border-box';
            input.style.padding = '5px';
            
            // Save original content to restore if needed
            const originalContent = cell.innerHTML;
            
            // Replace cell content with input
            cell.innerHTML = '';
            cell.appendChild(input);
            input.focus();
            input.select();
            
            // Handle input blur (save changes)
            input.addEventListener('blur', () => {
                let newValue = input.value.trim();
                
                // Store the field name based on column index
                let fieldName;
                switch (columnIndex) {
                    case 2: fieldName = 'name'; break;
                    case 3: fieldName = 'quantity'; break;
                    case 4: fieldName = 'price'; break;
                    case 5: fieldName = 'profit'; break;
                    case 6: fieldName = 'expiry'; break;
                    default: fieldName = 'unknown';
                }
                
                // Convert to appropriate types
                if (columnIndex === 3) { // Quantity
                    newValue = parseInt(newValue) || 0;
                } else if (columnIndex === 4 || columnIndex === 5) { // Price, Profit
                    newValue = parseFloat(newValue) || 0;
                } else if (columnIndex === 6) { // Expiry
                    // Format date properly before storing
                    // Keep as string for display formatting
                    if (newValue) {
                        // Make sure it's in DD-MM-YYYY format
                        const dateParts = newValue.split('-');
                        if (dateParts.length === 3) {
                            // Ensure leading zeros
                            const day = dateParts[0].padStart(2, '0');
                            const month = dateParts[1].padStart(2, '0');
                            const year = dateParts[2];
                            newValue = `${day}-${month}-${year}`;
                        }
                    }
                }
                
                // Track changes
                if (!editedCells[itemId]) {
                    editedCells[itemId] = {};
                }
                editedCells[itemId][fieldName] = newValue;
                
                // Format the display value
                let displayValue;
                if (columnIndex === 4 || columnIndex === 5) { // Price, Profit
                    displayValue = new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: "INR",
                    }).format(newValue);
                } else if (columnIndex === 6) { // Expiry
                    displayValue = newValue; // Keep date format as is
                } else {
                    displayValue = newValue;
                }
                
                // Update cell content
                cell.innerHTML = displayValue;
                
                // Add visual cue for edited cells
                cell.classList.add('edited-cell');
                
                // Show save button if not already visible
                const saveBtn = row.querySelector('.save-btn');
                if (!saveBtn) {
                    const actionsCell = row.querySelector('td:last-child');
                    const editBtn = actionsCell.querySelector('.edit-btn');
                    
                    if (editBtn) {
                        // Hide edit button
                        editBtn.style.display = 'none';
                        
                        // Create save button
                        const saveButton = document.createElement('button');
                        saveButton.className = 'save-btn';
                        saveButton.innerHTML = '<i class="fas fa-save"></i>';
                        saveButton.dataset.id = itemId;
                        
                        // Insert before delete button
                        actionsCell.insertBefore(saveButton, editBtn.nextSibling);
                        
                        // Add save handler
                        saveButton.addEventListener('click', () => saveInlineChanges(itemId));
                    }
                }
            });
            
            // Handle key presses
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    input.blur(); // Save changes
                } else if (e.key === 'Escape') {
                    cell.innerHTML = originalContent; // Restore original content
                }
            });
        });
    }
    
    // Save changes made with inline editing
    async function saveInlineChanges(itemId) {
        if (!editedCells[itemId]) return;
        
        const token = checkLogin();
        const updatedFields = editedCells[itemId];
        
        // Find the original item
        const originalItem = inventoryItems.find(item => item.id.toString() === itemId.toString());
        if (!originalItem) return;
        
        // Create updated item object with all fields
        const updatedItem = {
            name: updatedFields.name !== undefined ? updatedFields.name : originalItem.name,
            quantity: updatedFields.quantity !== undefined ? updatedFields.quantity : originalItem.quantity,
            price: updatedFields.price !== undefined ? updatedFields.price : originalItem.price,
            profit: updatedFields.profit !== undefined ? updatedFields.profit : originalItem.profit,
            expiry: updatedFields.expiry !== undefined ? updatedFields.expiry : originalItem.expiry
        };
        
        // Convert date format if needed
        if (updatedItem.expiry && updatedItem.expiry.includes('-')) {
            updatedItem.expiry = convertDateForServer(updatedItem.expiry);
        }
        
        try {
            const response = await fetch(`${BASE_URL}/api/items/${itemId}`, {
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

            // Clear edited cells for this item
            delete editedCells[itemId];
            
            displayMessage("Item updated successfully!", "success");
            fetchItems(); // Refresh the list
        } catch (error) {
            console.error("Error updating item:", error);
            displayMessage(`Error: ${error.message}`, "error");
        }
    }
    
    // Initialize the page
    function init() {
        fetchProfile();
        fetchItems();
        setTimeout(() => {
            checkLowStockAlerts();
            checkExpiryAlerts();
            setupInlineEditing();
        }, 1000);
    }
    
    init();
});