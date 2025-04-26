document.addEventListener("DOMContentLoaded", () => {
    const BASE_URL = "http://localhost:3000";
    const inventoryTable = document.getElementById("inventory-table");
    const messageDiv = document.getElementById("message");
    
    // Notification variables
    let notifications = [];
    const notificationBell = document.getElementById('notification-bell');
    const notificationDropdown = document.getElementById('notification-dropdown');
    const notificationCount = document.getElementById('notification-count');
    const notificationList = document.getElementById('notification-list');
    const markAllReadBtn = document.getElementById('mark-all-read');
    
    // Check login status
    function checkLogin() {
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "../login/login.html";
        }
        return token;
    }

    // Display feedback messages
    function displayMessage(message, type = "error") {
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = "block";
        setTimeout(() => {
            messageDiv.style.display = "none";
        }, 3000);
    }

    // Setup notification listeners
    function setupNotifications() {
        // Toggle notification dropdown
        if (notificationBell) {
            notificationBell.addEventListener('click', (e) => {
                e.stopPropagation();
                notificationDropdown.classList.toggle('active');
            });
            
            // Close notification dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.notification-container')) {
                    notificationDropdown.classList.remove('active');
                }
            });
            
            // Mark all notifications as read
            if (markAllReadBtn) {
                markAllReadBtn.addEventListener('click', () => {
                    notifications.forEach(notification => {
                        notification.read = true;
                    });
                    
                    updateNotifications();
                    saveNotificationsToStorage();
                });
            }
            
            // Load saved notifications
            loadNotificationsFromStorage();
            
            // Fetch alert-worthy inventory data
            fetchInventoryAlerts();
        }
    }
    
    // Fetch inventory alert data
    async function fetchInventoryAlerts() {
        const token = localStorage.getItem("token");
        if (!token) return;
        
        try {
            const response = await fetch(`${BASE_URL}/api/items`, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
            
            if (!response.ok) throw new Error("Failed to fetch inventory items");
            
            const items = await response.json();
            
            // Process items to find those that need alerts
            const currentDate = new Date();
            const alerts = {
                lowStock: [],
                nearExpiry: []
            };
            
            items.forEach(item => {
                // Check for low stock (less than 10)
                if (item.quantity < 10) {
                    alerts.lowStock.push(item);
                }
                
                // Check for expiry within 7 days
                const expiryDate = new Date(item.expiry);
                const daysUntilExpiry = Math.floor((expiryDate - currentDate) / (1000 * 60 * 60 * 24));
                
                if (daysUntilExpiry <= 7 && daysUntilExpiry >= 0) {
                    alerts.nearExpiry.push(item);
                }
            });
            
            // Process the alerts
            processInventoryAlerts(alerts);
            
        } catch (error) {
            console.error("Error fetching inventory alerts:", error);
        }
    }
    
    // Process inventory alerts and create notifications
    function processInventoryAlerts(alerts) {
        const currentDate = new Date();
        
        // Process low stock alerts
        if (alerts.lowStock && alerts.lowStock.length > 0) {
            alerts.lowStock.forEach(item => {
                // Check if notification already exists
                if (!notifications.some(n => n.type === 'low-stock' && n.itemId === item.id)) {
                    addNotification({
                        type: 'low-stock',
                        title: 'Low Stock Alert',
                        message: `${item.name} is running low (${item.quantity} left)`,
                        timestamp: new Date(),
                        itemId: item.id,
                        read: false,
                        priority: 'high'
                    });
                }
            });
        }
        
        // Process expiry alerts
        if (alerts.nearExpiry && alerts.nearExpiry.length > 0) {
            alerts.nearExpiry.forEach(item => {
                const expiryDate = new Date(item.expiry);
                const daysUntilExpiry = Math.floor((expiryDate - currentDate) / (1000 * 60 * 60 * 24));
                
                // Check if notification already exists
                if (!notifications.some(n => n.type === 'expiry' && n.itemId === item.id)) {
                    addNotification({
                        type: 'expiry',
                        title: 'Expiry Alert',
                        message: `${item.name} expires in ${daysUntilExpiry} days`,
                        timestamp: new Date(),
                        itemId: item.id,
                        expiryDate: item.expiry,
                        read: false,
                        priority: daysUntilExpiry <= 3 ? 'high' : 'medium'
                    });
                }
            });
        }
        
        updateNotifications();
        saveNotificationsToStorage();
    }
    
    // Add a new notification
    function addNotification(notification) {
        notifications.unshift(notification);
        updateNotifications();
    }
    
    // Update the notification UI
    function updateNotifications() {
        if (!notificationCount || !notificationBell || !notificationList) return;
        
        // Count unread notifications
        const unreadCount = notifications.filter(n => !n.read).length;
        
        // Update badge count
        notificationCount.textContent = unreadCount;
        notificationCount.style.display = unreadCount > 0 ? 'flex' : 'none';
        
        // Update bell icon appearance
        if (unreadCount > 0) {
            notificationBell.classList.add('has-notifications');
        } else {
            notificationBell.classList.remove('has-notifications');
        }
        
        // Update notification list
        notificationList.innerHTML = '';
        
        if (notifications.length === 0) {
            notificationList.innerHTML = `
                <div class="no-notifications">
                    <i class="fas fa-check-circle"></i>
                    <p>No notifications</p>
                </div>
            `;
            return;
        }
        
        // Sort notifications by priority and timestamp
        const sortedNotifications = [...notifications].sort((a, b) => {
            // First by read status
            if (a.read !== b.read) return a.read ? 1 : -1;
            
            // Then by priority
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) 
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            
            // Then by timestamp (newest first)
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        // Create notification items
        sortedNotifications.forEach((notification, index) => {
            const notificationItem = document.createElement('div');
            notificationItem.className = `notification-item ${notification.read ? 'read' : 'unread'} priority-${notification.priority}`;
            
            const timeAgo = getTimeAgo(new Date(notification.timestamp));
            
            let icon = 'fas fa-info-circle';
            if (notification.type === 'low-stock') icon = 'fas fa-cubes';
            if (notification.type === 'expiry') icon = 'fas fa-calendar-times';
            
            // Format message with enhanced styling for expiry dates
            let message = notification.message;
            if (notification.type === 'expiry') {
                // Extract the item name and days number from the message
                const match = notification.message.match(/(.+) expires in (\d+) days/);
                if (match) {
                    const itemName = match[1];
                    const days = parseInt(match[2]);
                    
                    // Create a highlighted version with different classes based on urgency
                    let expiryClass = 'expiry-date-highlight';
                    if (days <= 3) expiryClass += ' expiry-critical';
                    else if (days <= 5) expiryClass += ' expiry-soon';
                    
                    message = `${itemName} expires in <span class="${expiryClass}">${days} days</span>`;
                    
                    // Add expiry date if we had it
                    if (notification.expiryDate) {
                        const expiryDate = new Date(notification.expiryDate);
                        message += ` on <span class="expiry-date-highlight">${expiryDate.toLocaleDateString()}</span>`;
                    }
                }
            }
            
            notificationItem.innerHTML = `
                <div class="notification-icon">
                    <i class="${icon}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${notification.title}</div>
                    <div class="notification-message">${message}</div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
                <div class="notification-actions">
                    <button class="mark-read" data-index="${index}">
                        <i class="fas ${notification.read ? 'fa-envelope-open' : 'fa-envelope'}"></i>
                    </button>
                    <button class="delete-notification" data-index="${index}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            
            notificationList.appendChild(notificationItem);
            
            // Add event listeners for mark as read and delete
            const markReadBtn = notificationItem.querySelector('.mark-read');
            const deleteBtn = notificationItem.querySelector('.delete-notification');
            
            markReadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(e.currentTarget.dataset.index);
                notifications[index].read = !notifications[index].read;
                updateNotifications();
                saveNotificationsToStorage();
            });
            
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(e.currentTarget.dataset.index);
                notifications.splice(index, 1);
                updateNotifications();
                saveNotificationsToStorage();
            });
        });
    }
    
    // Get relative time string
    function getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        
        return Math.floor(seconds) + " seconds ago";
    }
    
    // Save notifications to localStorage
    function saveNotificationsToStorage() {
        localStorage.setItem('notifications', JSON.stringify(notifications));
    }
    
    // Load notifications from localStorage
    function loadNotificationsFromStorage() {
        const saved = localStorage.getItem('notifications');
        if (saved) {
            notifications = JSON.parse(saved);
            updateNotifications();
        }
    }

    // Fetch user profile information
    async function fetchProfile() {
        const authButton = document.getElementById("auth-btn");
        const usernameSpan = document.getElementById("username");
    
        const token = localStorage.getItem("token");
    
        if (!token) {
            usernameSpan.textContent = "Guest";
            authButton.textContent = "Login";
            authButton.classList.remove("logout");
            authButton.addEventListener("click", () => {
                window.location.href = "../login/index.html";
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
                window.location.href = "../login/login.html";
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

    // Fetch all product items
    async function fetchItems() {
        const token = checkLogin();
        try {
            const response = await fetch(`${BASE_URL}/api/items`, {
                headers: { 
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
            });
            if (!response.ok) throw new Error("Failed to fetch items");
            const items = await response.json();
            renderInventory(items);
            return items;
        } catch (error) {
            displayMessage(error.message);
            return [];
        }
    }

    // Render inventory items in the table
    function renderInventory(items) {
        const tbody = inventoryTable.querySelector("tbody");
        tbody.innerHTML = "";
    
        // Use Intl.NumberFormat for formatting currency in INR
        const formatter = new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            minimumFractionDigits: 2
        });
    
        if (items.length === 0) {
            const emptyRow = document.createElement("tr");
            emptyRow.innerHTML = `
                <td colspan="7" class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <p>No products found. Add your first product to get started!</p>
                </td>
            `;
            tbody.appendChild(emptyRow);
            return;
        }
    
        items.forEach(item => {
            // Convert expiry date to display format (and check if exists)
            const expiryDate = item.expiry ? new Date(item.expiry) : null;
            const expiryFormatted = expiryDate ? expiryDate.toISOString().split('T')[0] : 'N/A';
            
            // Calculate days until expiry
            let expiryClass = '';
            let daysUntilExpiry = '';
            
            if (expiryDate) {
                const today = new Date();
                const daysDiff = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
                
                if (daysDiff <= 0) {
                    expiryClass = 'expiry-critical';
                    daysUntilExpiry = '(Expired)';
                } else if (daysDiff <= 7) {
                    expiryClass = 'expiry-critical';
                    daysUntilExpiry = `(${daysDiff} days left)`;
                } else if (daysDiff <= 30) {
                    expiryClass = 'expiry-soon';
                    daysUntilExpiry = `(${daysDiff} days left)`;
                }
            }
            
            // Format quantity with indicator
            let quantityClass = '';
            if (item.quantity <= 0) {
                quantityClass = 'quantity-indicator low';
            } else if (item.quantity < 10) {
                quantityClass = 'quantity-indicator low';
            } else if (item.quantity < 20) {
                quantityClass = 'quantity-indicator medium';
            } else {
                quantityClass = 'quantity-indicator high';
            }
            
            const row = document.createElement("tr");
            row.dataset.id = item.id;  // Store item ID as data attribute
            
            row.innerHTML = `
                <td>${item.id}</td>
                <td>${item.name}</td>
                <td><span class="${quantityClass}">${item.quantity}</span></td>
                <td>${formatter.format(item.price)}</td>
                <td>${formatter.format(item.profit || 0)}</td>
                <td><span class="${expiryClass}">${expiryFormatted} ${daysUntilExpiry}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn edit-btn" data-id="${item.id}" title="Edit Item"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete-btn" data-id="${item.id}" title="Delete Item"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    // Add sorting functionality to the table
    function enableTableSorting() {
        const headers = inventoryTable.querySelectorAll('thead th');
        
        // Skip the actions column
        for (let i = 0; i < headers.length - 1; i++) {
            const header = headers[i];
            
            // Make header sortable
            header.classList.add('sortable');
            header.innerHTML += '<span class="sort-icon"><i class="fas fa-sort"></i></span>';
            header.dataset.sortDirection = 'none';
            
            header.addEventListener('click', () => {
                // First reset all headers
                headers.forEach(h => {
                    if (h !== header) {
                        h.dataset.sortDirection = 'none';
                        const icon = h.querySelector('.sort-icon');
                        if (icon) icon.innerHTML = '<i class="fas fa-sort"></i>';
                    }
                });
                
                // Get the current sort direction and toggle it
                let direction = header.dataset.sortDirection;
                direction = direction === 'asc' ? 'desc' : 'asc';
                header.dataset.sortDirection = direction;
                
                // Update the sort icon
                const icon = header.querySelector('.sort-icon');
                icon.innerHTML = direction === 'asc' 
                    ? '<i class="fas fa-sort-up"></i>' 
                    : '<i class="fas fa-sort-down"></i>';
                
                // Sort the table
                sortTable(i, direction);
            });
        }
    }
    
    // Sort table by column index and direction
    function sortTable(columnIndex, direction) {
        const tbody = inventoryTable.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        
        // Skip sorting if there's no data or only one row
        if (rows.length <= 1) return;
        
        const multiplier = direction === 'asc' ? 1 : -1;
        
        // Sort rows based on cell content
        rows.sort((rowA, rowB) => {
            const cellA = rowA.cells[columnIndex].textContent.trim();
            const cellB = rowB.cells[columnIndex].textContent.trim();
            
            // Check if we're sorting numbers (including formatted currency)
            if (!isNaN(parseFloat(cellA)) && !isNaN(parseFloat(cellB))) {
                // Extract just the numbers
                const numA = parseFloat(cellA.replace(/[^\d.-]/g, ''));
                const numB = parseFloat(cellB.replace(/[^\d.-]/g, ''));
                return (numA - numB) * multiplier;
            }
            
            // Check if we're sorting dates
            if (columnIndex === 5) { // Expiry date column
                // Extract the date part before any parentheses
                const dateA = new Date(cellA.split('(')[0].trim());
                const dateB = new Date(cellB.split('(')[0].trim());
                
                // Handle invalid dates
                if (isNaN(dateA) && isNaN(dateB)) return 0;
                if (isNaN(dateA)) return 1 * multiplier;
                if (isNaN(dateB)) return -1 * multiplier;
                
                return (dateA - dateB) * multiplier;
            }
            
            // Default string comparison
            return cellA.localeCompare(cellB) * multiplier;
        });
        
        // Reappend rows in the new order
        rows.forEach(row => tbody.appendChild(row));
    }

    // Add event listener for creating a new product
    document.getElementById("add-item-btn")?.addEventListener("click", () => {
        const name = document.getElementById("new-name").value.trim();
        const quantity = parseInt(document.getElementById("new-quantity").value);
        const price = parseFloat(document.getElementById("new-price").value);
        const profit = parseFloat(document.getElementById("new-profit").value);
        const expiry = document.getElementById("new-expiry").value;
        
        if (!name) {
            displayMessage("Please enter a product name", "error");
            return;
        }
        
        if (isNaN(quantity) || quantity < 0) {
            displayMessage("Please enter a valid quantity", "error");
            return;
        }
        
        if (isNaN(price) || price <= 0) {
            displayMessage("Please enter a valid price", "error");
            return;
        }
        
        // Profit can be 0 but not negative
        if (isNaN(profit) || profit < 0) {
            displayMessage("Please enter a valid profit", "error");
            return;
        }
        
        createItem({
            name,
            quantity,
            price,
            profit,
            expiry
        });
    });

    // Create a new product
    async function createItem(item) {
        const token = checkLogin();
        try {
            const response = await fetch(`${BASE_URL}/api/items`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(item)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to create item");
            }
            
            // Clear form inputs after successful creation
            document.getElementById("new-name").value = "";
            document.getElementById("new-quantity").value = "";
            document.getElementById("new-price").value = "";
            document.getElementById("new-profit").value = "";
            document.getElementById("new-expiry").value = "";
            
            // Refresh the inventory table
            fetchItems();
            displayMessage("Product added successfully!", "success");
        } catch (error) {
            displayMessage(error.message);
        }
    }

    // Handle edit and delete buttons
 // The part of the code that needs to be fixed - replace the edit and save button handlers

// Handle edit and delete buttons
inventoryTable.addEventListener("click", async (e) => {
    const token = checkLogin();
    
    // Handle delete button
    const deleteButton = e.target.closest(".delete-btn");
    if (deleteButton) {
        const id = deleteButton.dataset.id;
        
        if (confirm("Are you sure you want to delete this product?")) {
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
                    throw new Error(errorData.message || "Failed to delete item");
                }
                
                fetchItems();
                displayMessage("Product deleted successfully!", "success");
            } catch (error) {
                displayMessage(error.message);
            }
        }
        return;
    }
    
    // Handle edit button - fixed this part to work correctly
    const editButton = e.target.closest(".edit-btn");
    if (editButton) {
        const id = editButton.dataset.id;
        const row = editButton.closest("tr");
        
        // Toggle to edit mode
        if (!row.classList.contains("editing")) {
            // First fetch the current item details
            try {
                const response = await fetch(`${BASE_URL}/api/items/${id}`, {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || "Failed to fetch item details");
                }
                
                const item = await response.json();
                
                // Store original values for potential reset
                row.dataset.original = JSON.stringify(item);
                
                // Replace cells with input fields
                const cells = row.querySelectorAll("td");
                
                // Skip ID column (cells[0])
                cells[1].innerHTML = `<input type="text" class="edit-name" value="${item.name}">`;
                cells[2].innerHTML = `<input type="number" class="edit-quantity" value="${item.quantity}" min="0">`;
                cells[3].innerHTML = `<input type="number" class="edit-price" value="${item.price}" min="0" step="0.01">`;
                cells[4].innerHTML = `<input type="number" class="edit-profit" value="${item.profit || 0}" min="0" step="0.01">`;
                
                // Format the date for the input
                const expiryDate = item.expiry ? new Date(item.expiry).toISOString().split('T')[0] : '';
                cells[5].innerHTML = `<input type="date" class="edit-expiry" value="${expiryDate}">`;
                
                // Change action buttons
                cells[6].innerHTML = `
                    <div class="action-buttons">
                        <button class="action-btn save-btn" data-id="${id}" title="Save Changes"><i class="fas fa-save"></i></button>
                        <button class="action-btn cancel-btn" data-id="${id}" title="Cancel"><i class="fas fa-times"></i></button>
                    </div>
                `;
                
                row.classList.add("editing");
            } catch (error) {
                displayMessage(error.message);
            }
        }
        return;
    }
    
    // Handle save button - fixed this part to work correctly
    const saveButton = e.target.closest(".save-btn");
    if (saveButton) {
        const id = saveButton.dataset.id;
        const row = saveButton.closest("tr");
        
        // Get values from input fields
        const nameInput = row.querySelector(".edit-name");
        const quantityInput = row.querySelector(".edit-quantity");
        const priceInput = row.querySelector(".edit-price");
        const profitInput = row.querySelector(".edit-profit");
        const expiryInput = row.querySelector(".edit-expiry");
        
        if (!nameInput || !quantityInput || !priceInput || !profitInput) {
            displayMessage("Could not find all input fields", "error");
            return;
        }
        
        const name = nameInput.value.trim();
        const quantity = parseInt(quantityInput.value);
        const price = parseFloat(priceInput.value);
        const profit = parseFloat(profitInput.value);
        const expiry = expiryInput ? expiryInput.value : '';
        
        // Validate inputs
        if (!name) {
            displayMessage("Please enter a product name", "error");
            return;
        }
        
        if (isNaN(quantity) || quantity < 0) {
            displayMessage("Please enter a valid quantity", "error");
            return;
        }
        
        if (isNaN(price) || price <= 0) {
            displayMessage("Please enter a valid price", "error");
            return;
        }
        
        if (isNaN(profit) || profit < 0) {
            displayMessage("Please enter a valid profit", "error");
            return;
        }
        
        // Update item
        try {
            const response = await fetch(`${BASE_URL}/api/items/${id}`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    quantity,
                    price,
                    profit,
                    expiry
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to update item");
            }
            
            // Refresh table to show updated values
            fetchItems();
            displayMessage("Product updated successfully!", "success");
            
            // Remove editing class
            row.classList.remove("editing");
        } catch (error) {
            displayMessage(error.message);
        }
        return;
    }
    
    // Handle cancel button
    const cancelButton = e.target.closest(".cancel-btn");
    if (cancelButton) {
        // Just refresh the table to restore original state
        fetchItems();
        return;
    }
});


    // Filter products by search
    const setupSearch = () => {
        const searchInput = document.getElementById("product-search");
        if (searchInput) {
            searchInput.addEventListener("input", debounce(async (event) => {
                const query = event.target.value.trim();
                try {
                    const allItems = await fetchItems();
                    
                    if (query === "") {
                        renderInventory(allItems);
                        return;
                    }
                    
                    // Filter items by name or ID that match the query
                    const filteredItems = allItems.filter(item => 
                        item.name.toLowerCase().includes(query.toLowerCase()) || 
                        item.id.toString().includes(query)
                    );
                    
                    renderInventory(filteredItems);
                } catch (error) {
                    displayMessage("Error filtering products", "error");
                }
            }, 300));
        }
    };

    // Debounce function to prevent too many API calls
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Add a new column to the header
    function fixTableHeader() {
        // Check if the Actions column already exists
        const headers = inventoryTable.querySelectorAll('thead th');
        const hasActionsHeader = Array.from(headers).some(th => th.textContent.trim() === 'Actions');
        
        if (!hasActionsHeader) {
            const headerRow = inventoryTable.querySelector('thead tr');
            const actionsHeader = document.createElement('th');
            actionsHeader.textContent = 'Actions';
            headerRow.appendChild(actionsHeader);
        }
    }

    // Initialize the page
    function init() {
        fetchProfile();
        fixTableHeader();
        fetchItems();
        setupNotifications();
        enableTableSorting();
        setupSearch();
        
        // Add event listener for Add Item button
        const addItemBtn = document.getElementById("add-item-btn");
        if (addItemBtn) {
            addItemBtn.addEventListener("click", () => {
                const name = document.getElementById("new-name").value.trim();
                const quantity = parseInt(document.getElementById("new-quantity").value);
                const price = parseFloat(document.getElementById("new-price").value);
                const profit = parseFloat(document.getElementById("new-profit").value);
                const expiry = document.getElementById("new-expiry").value;
                
                if (!name) {
                    displayMessage("Please enter a product name", "error");
                    return;
                }
                
                if (isNaN(quantity) || quantity < 0) {
                    displayMessage("Please enter a valid quantity", "error");
                    return;
                }
                
                if (isNaN(price) || price <= 0) {
                    displayMessage("Please enter a valid price", "error");
                    return;
                }
                
                if (isNaN(profit) || profit < 0) {
                    displayMessage("Please enter a valid profit", "error");
                    return;
                }
                
                createItem({
                    name,
                    quantity,
                    price,
                    profit,
                    expiry
                });
            });
        }
        
        // Add event listener for mobile menu toggle if it exists
        const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', () => {
                document.querySelector('.sidebar').classList.toggle('active');
            });
        }
    }
    
    // Print inventory report
    function setupPrintButton() {
        const printButton = document.getElementById('print-inventory');
        if (printButton) {
            printButton.addEventListener('click', () => {
                window.print();
            });
        }
    }
    
    // Export inventory data to CSV
    function setupExportButton() {
        const exportButton = document.getElementById('export-inventory');
        if (exportButton) {
            exportButton.addEventListener('click', async () => {
                try {
                    const items = await fetchItems();
                    if (items.length === 0) {
                        displayMessage("No items to export", "warning");
                        return;
                    }
                    
                    // Create CSV content
                    const headers = ['ID', 'Name', 'Quantity', 'Price', 'Profit', 'Expiry Date'];
                    let csvContent = headers.join(',') + '\n';
                    
                    items.forEach(item => {
                        const expiryDate = item.expiry ? new Date(item.expiry).toLocaleDateString() : 'N/A';
                        const row = [
                            item.id,
                            `"${item.name.replace(/"/g, '""')}"`, // Escape quotes in names
                            item.quantity,
                            item.price.toFixed(2),
                            (item.profit || 0).toFixed(2),
                            expiryDate
                        ];
                        csvContent += row.join(',') + '\n';
                    });
                    
                    // Create and trigger download
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    const url = URL.createObjectURL(blob);
                    
                    link.setAttribute('href', url);
                    link.setAttribute('download', `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
                    link.style.visibility = 'hidden';
                    
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    displayMessage("Inventory exported successfully!", "success");
                } catch (error) {
                    displayMessage("Failed to export inventory: " + error.message, "error");
                }
            });
        }
    }
    
    // Apply filters to inventory items
    function setupFilters() {
        const applyFilterBtn = document.getElementById('apply-filter');
        const resetFilterBtn = document.getElementById('reset-filter');
        
        if (applyFilterBtn) {
            applyFilterBtn.addEventListener('click', async () => {
                const stockFilter = document.getElementById('stock-filter').value;
                const expiryFilter = document.getElementById('expiry-filter').value;
                
                try {
                    const allItems = await fetchItems();
                    let filteredItems = [...allItems];
                    
                    // Apply stock filter
                    if (stockFilter !== 'all') {
                        if (stockFilter === 'low') {
                            filteredItems = filteredItems.filter(item => item.quantity > 0 && item.quantity < 10);
                        } else if (stockFilter === 'out') {
                            filteredItems = filteredItems.filter(item => item.quantity <= 0);
                        } else if (stockFilter === 'normal') {
                            filteredItems = filteredItems.filter(item => item.quantity >= 10);
                        }
                    }
                    
                    // Apply expiry filter
                    if (expiryFilter !== 'all') {
                        const today = new Date();
                        if (expiryFilter === 'expired') {
                            filteredItems = filteredItems.filter(item => {
                                if (!item.expiry) return false;
                                const expiryDate = new Date(item.expiry);
                                return expiryDate <= today;
                            });
                        } else if (expiryFilter === 'soon') {
                            filteredItems = filteredItems.filter(item => {
                                if (!item.expiry) return false;
                                const expiryDate = new Date(item.expiry);
                                const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
                                return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
                            });
                        } else if (expiryFilter === 'critical') {
                            filteredItems = filteredItems.filter(item => {
                                if (!item.expiry) return false;
                                const expiryDate = new Date(item.expiry);
                                const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
                                return daysUntilExpiry > 0 && daysUntilExpiry <= 7;
                            });
                        }
                    }
                    
                    renderInventory(filteredItems);
                    
                    if (filteredItems.length === 0) {
                        displayMessage("No items match the selected filters", "warning");
                    } else {
                        displayMessage(`Showing ${filteredItems.length} filtered items`, "success");
                    }
                } catch (error) {
                    displayMessage("Error applying filters: " + error.message, "error");
                }
            });
        }
        
        if (resetFilterBtn) {
            resetFilterBtn.addEventListener('click', () => {
                // Reset filter dropdowns to default values
                if (document.getElementById('stock-filter')) {
                    document.getElementById('stock-filter').value = 'all';
                }
                if (document.getElementById('expiry-filter')) {
                    document.getElementById('expiry-filter').value = 'all';
                }
                
                // Reload all items
                fetchItems();
                displayMessage("Filters reset", "success");
            });
        }
    }
    
    // Create product modal functionality
    function setupProductModal() {
        const openModalBtn = document.getElementById('add-product-btn');
        const modal = document.getElementById('product-modal');
        const closeModalBtn = document.querySelector('.close-modal');
        const productForm = document.getElementById('product-form');
        
        if (openModalBtn && modal) {
            openModalBtn.addEventListener('click', () => {
                modal.style.display = 'block';
                // Reset form if needed
                if (productForm) productForm.reset();
            });
            
            closeModalBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
            
            // Close when clicking outside the modal
            window.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
            
            // Handle form submission
            if (productForm) {
                productForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    
                    const formData = new FormData(productForm);
                    const productData = {
                        name: formData.get('name'),
                        quantity: parseInt(formData.get('quantity')),
                        price: parseFloat(formData.get('price')),
                        profit: parseFloat(formData.get('profit') || 0),
                        expiry: formData.get('expiry')
                    };
                    
                    createItem(productData);
                    modal.style.display = 'none';
                });
            }
        }
    }
    
    // Update inventory statistics
    async function updateInventoryStats() {
        const statsContainer = document.getElementById('inventory-stats');
        if (!statsContainer) return;
        
        try {
            const items = await fetchItems();
            
            // Total items
            const totalItems = items.length;
            
            // Total stock value
            const totalValue = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            // Low stock items
            const lowStockItems = items.filter(item => item.quantity > 0 && item.quantity < 10).length;
            
            // Out of stock items
            const outOfStockItems = items.filter(item => item.quantity <= 0).length;
            
            // Items expiring within 30 days
            const today = new Date();
            const expiringItems = items.filter(item => {
                if (!item.expiry) return false;
                const expiryDate = new Date(item.expiry);
                const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
                return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
            }).length;
            
            // Format currency
            const formatter = new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
                minimumFractionDigits: 2
            });
            
            // Update stats
            statsContainer.innerHTML = `
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-box"></i></div>
                    <div class="stat-info">
                        <h3>${totalItems}</h3>
                        <p>Total Products</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-rupee-sign"></i></div>
                    <div class="stat-info">
                        <h3>${formatter.format(totalValue)}</h3>
                        <p>Inventory Value</p>
                    </div>
                </div>
                <div class="stat-card ${lowStockItems > 0 ? 'warning' : ''}">
                    <div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
                    <div class="stat-info">
                        <h3>${lowStockItems}</h3>
                        <p>Low Stock Items</p>
                    </div>
                </div>
                <div class="stat-card ${outOfStockItems > 0 ? 'danger' : ''}">
                    <div class="stat-icon"><i class="fas fa-times-circle"></i></div>
                    <div class="stat-info">
                        <h3>${outOfStockItems}</h3>
                        <p>Out of Stock</p>
                    </div>
                </div>
                <div class="stat-card ${expiringItems > 0 ? 'warning' : ''}">
                    <div class="stat-icon"><i class="fas fa-calendar-times"></i></div>
                    <div class="stat-info">
                        <h3>${expiringItems}</h3>
                        <p>Expiring Soon</p>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error("Error updating stats:", error);
        }
    }
    
    // Call initialization functions
    init();
    setupPrintButton();
    setupExportButton();
    setupFilters();
    setupProductModal();
    updateInventoryStats();
});