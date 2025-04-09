document.addEventListener("DOMContentLoaded", () => {
    const BASE_URL = "http://localhost:3000";
    const messageDiv = document.getElementById("message");
    const addItemButton = document.getElementById("add-item-btn");
    let activeSuggestionsContainer = null;
    let currentSuggestionIndex = -1;
    let activeProductInput = null;
    
    // Notification variables
    let notifications = [];
    const notificationBell = document.getElementById('notification-bell');
    const notificationDropdown = document.getElementById('notification-dropdown');
    const notificationCount = document.getElementById('notification-count');
    const notificationList = document.getElementById('notification-list');
    const markAllReadBtn = document.getElementById('mark-all-read');

    // Add suggestion modal elements to the DOM
    function setupSuggestionModal() {
        // Create backdrop and modal container if they don't exist
        if (!document.querySelector('.autocomplete-backdrop')) {
            const backdrop = document.createElement('div');
            backdrop.className = 'autocomplete-backdrop';
            document.body.appendChild(backdrop);
            
            const suggestionsModal = document.createElement('div');
            suggestionsModal.className = 'autocomplete-suggestions';
            suggestionsModal.innerHTML = `
                <div class="suggestions-header">
                    <div class="search-wrapper">
                        <i class="fas fa-search"></i>
                        <input type="text" placeholder="Search products..." id="suggestion-search">
                    </div>
                    <button class="close-suggestions">&times;</button>
                </div>
                <div class="suggestions-body"></div>
            `;
            document.body.appendChild(suggestionsModal);
            
            // Setup event listeners for the modal
            setupModalEvents();
        }
    }
    
    // Setup notification listeners
    function setupNotifications() {
        // Toggle notification dropdown
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
        markAllReadBtn.addEventListener('click', () => {
            notifications.forEach(notification => {
                notification.read = true;
            });
            
            updateNotifications();
            saveNotificationsToStorage();
        });
        
        // Load saved notifications
        loadNotificationsFromStorage();
        
        // Fetch alert-worthy inventory data
        fetchInventoryAlerts();
    }
    
    // Fetch inventory items that need alerts (low stock, near expiry)
    // Fetch inventory items that need alerts (low stock, near expiry)
async function fetchInventoryAlerts() {
    const token = localStorage.getItem("token");
    if (!token) return;
    
    try {
        // Fetch all inventory items instead of using a special alerts endpoint
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
            
            notificationItem.innerHTML = `
                <div class="notification-icon">
                    <i class="${icon}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${notification.title}</div>
                    <div class="notification-message">${notification.message}</div>
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
    
    function setupModalEvents() {
        const backdrop = document.querySelector('.autocomplete-backdrop');
        const suggestionsModal = document.querySelector('.autocomplete-suggestions');
        const closeBtn = document.querySelector('.close-suggestions');
        const searchInput = document.getElementById('suggestion-search');
        
        // Close modal when clicking backdrop or close button
        backdrop.addEventListener('click', closeSuggestionModal);
        closeBtn.addEventListener('click', closeSuggestionModal);
        
        // Filter suggestions when typing in search box
        searchInput.addEventListener('input', function() {
            const query = this.value.trim();
            if (query.length > 1) {
                fetchSuggestions(query).then(suggestions => {
                    renderSuggestions(suggestions);
                    // Also update the active product input
                    if (activeProductInput) {
                        activeProductInput.value = query;
                    }
                });
            } else {
                document.querySelector('.suggestions-body').innerHTML = `
                    <div class="no-suggestions">
                        <i class="fas fa-search"></i>
                        <p>Type at least 2 characters to search for products</p>
                    </div>
                `;
            }
        });
    }
    
    function closeSuggestionModal() {
        document.querySelector('.autocomplete-backdrop').classList.remove('active');
        document.querySelector('.autocomplete-suggestions').classList.remove('active');
        activeProductInput = null;
        currentSuggestionIndex = -1;
    }
    
    function openSuggestionModal(inputElement, initialQuery = '') {
        // Set the active input for later reference
        activeProductInput = inputElement;
        
        // Show backdrop and modal
        document.querySelector('.autocomplete-backdrop').classList.add('active');
        document.querySelector('.autocomplete-suggestions').classList.add('active');
        
        // Set search input value and focus it
        const searchInput = document.getElementById('suggestion-search');
        searchInput.value = initialQuery;
        searchInput.focus();
        
        // Fetch initial suggestions if query is provided
        if (initialQuery.length > 1) {
            fetchSuggestions(initialQuery).then(renderSuggestions);
        } else {
            // Show empty state
            document.querySelector('.suggestions-body').innerHTML = `
                <div class="no-suggestions">
                    <i class="fas fa-search"></i>
                    <p>Type at least 2 characters to search for products</p>
                </div>
            `;
        }
    }
    
    function renderSuggestions(suggestions) {
        const suggestionsBody = document.querySelector('.suggestions-body');
        suggestionsBody.innerHTML = '';
        
        if (suggestions.length === 0) {
            suggestionsBody.innerHTML = `
                <div class="no-suggestions">
                    <i class="fas fa-box-open"></i>
                    <p>No products found matching your search</p>
                </div>
            `;
            return;
        }
        
        suggestions.forEach((item, index) => {
            // Make sure stock is defined, even if just as 0
            const stock = item.stock !== undefined ? item.stock : 0;
            const stockStatus = getStockStatusClass(stock);
            
            const suggestionItem = document.createElement('div');
            suggestionItem.classList.add('suggestion-item');
            suggestionItem.dataset.index = index;
            
            // Add expiry badge if available
            let expiryBadge = '';
            if (item.expiry_date) {
                const expiryDate = new Date(item.expiry_date);
                const today = new Date();
                const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
                
                if (daysUntilExpiry <= 7) {
                    expiryBadge = `<div class="suggestion-badge expiry">Expires in ${daysUntilExpiry} days</div>`;
                }
            }
            
            suggestionItem.innerHTML = `
                ${expiryBadge}
                <div class="suggestion-content">
                    <div class="suggestion-main">
                        <div class="suggestion-name">${item.name}</div>
                        <div class="suggestion-details">
                            <span><i class="fas fa-tag"></i> <span class="suggestion-id">${item.id}</span></span>
                            <span><i class="fas fa-box"></i> <span class="suggestion-stock ${stockStatus.class}">${stockStatus.text}</span></span>
                            ${item.expiry_date ? `<span><i class="fas fa-calendar"></i> <span class="suggestion-expiry">Exp: ${new Date(item.expiry_date).toLocaleDateString()}</span></span>` : ''}
                        </div>
                    </div>
                    <div class="suggestion-price">
                        <i class="fas fa-rupee-sign"></i> ${item.price.toFixed(2)}
                    </div>
                </div>
            `;
            
            suggestionItem.addEventListener('click', () => {
                selectSuggestionFromModal(item);
            });
            
            suggestionsBody.appendChild(suggestionItem);
        });
    }
    
    
    function getStockStatusClass(stock) {
        // Check if stock value exists and is a number
        if (stock === undefined || stock === null) {
            return { class: 'out', text: 'Stock Unknown' };
        }
        
        // Convert to number if it's a string
        const stockNum = Number(stock);
        
        // Check if it's a valid number
        if (isNaN(stockNum)) {
            return { class: '', text: 'Stock Unknown' };
        }
        
        // Now check the stock level
        if (stockNum <= 0) {
            return { class: 'out', text: 'Out of Stock' };
        } else if (stockNum < 10) {
            return { class: 'low', text: `Low Stock (${stockNum})` };
        } else {
            return { class: '', text: `In Stock (${stockNum})` };
        }
    }
    
    function selectSuggestionFromModal(item) {
        if (!activeProductInput) return;
        
        // Update the input field
        activeProductInput.value = item.name;
        
        // Find the row and update other fields
        const row = activeProductInput.closest('tr');
        updateItemDetails(item, activeProductInput);
        
        // Close the modal
        closeSuggestionModal();
        
        // Add a new row if this was the last one
        const isLastRow = !row.nextElementSibling;
        if (isLastRow) {
            addNewRow();
        }
    }

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

   // Remove the first implementation of addNewRow (the one with the HTML string)
// REMOVE THIS FUNCTION:
// function addNewRow() {
//     const billItemsContainer = document.getElementById("bill-items");
//     const row = document.createElement("tr");
//     row.innerHTML = `...`;
//     billItemsContainer.appendChild(row);
//     row.querySelector(".product-name").focus();
//     updateTotals();
//     return row;
// }

// Keep only your improved DOM-based implementation:
function addNewRow() {
    const billItemsContainer = document.getElementById("bill-items");
    const row = document.createElement("tr");
    
    // Create cells individually for better control
    const nameCell = document.createElement("td");
    nameCell.innerHTML = `<div class="input-container"><input type="text" class="product-name" placeholder="Enter name" autocomplete="off" required></div>`;
    
    const idCell = document.createElement("td");
    idCell.innerHTML = `<input type="text" class="product-id" placeholder="Enter ID" required>`;
    
    const priceCell = document.createElement("td");
    priceCell.innerHTML = `<input type="number" class="item-price" value="0.00" step="0.01" readonly>`;
    
    const quantityCell = document.createElement("td");
    quantityCell.innerHTML = `<input type="number" class="item-quantity" value="1" min="1" required>`;
    
    const totalCell = document.createElement("td");
    totalCell.className = "item-total";
    totalCell.textContent = "₹0.00";
    
    const actionCell = document.createElement("td");
    // Create only the delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-row";
    deleteBtn.setAttribute("type", "button");
    deleteBtn.setAttribute("aria-label", "Delete row");
    deleteBtn.innerHTML = `<i class="fas fa-trash"></i>`;
    actionCell.appendChild(deleteBtn);
    
    // Append cells to row
    row.appendChild(nameCell);
    row.appendChild(idCell);
    row.appendChild(priceCell);
    row.appendChild(quantityCell);
    row.appendChild(totalCell);
    row.appendChild(actionCell);
    
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

    function updateItemDetails(item, inputElement) {
        const row = inputElement.closest('tr');
        row.querySelector(".product-id").value = item.id;
        row.querySelector(".item-price").value = item.price.toFixed(2);
        updateTotals();
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
            openSuggestionModal(event.target, query);
        }
    }, 300);

    // Keyboard events for suggestion navigation
    document.addEventListener('keydown', (event) => {
        const modal = document.querySelector('.autocomplete-suggestions');
        if (!modal || !modal.classList.contains('active')) return;
        
        const suggestions = document.querySelectorAll('.suggestions-body .suggestion-item');
        if (suggestions.length === 0) return;
        
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                currentSuggestionIndex = (currentSuggestionIndex + 1) % suggestions.length;
                highlightSuggestion(Array.from(suggestions));
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                currentSuggestionIndex = (currentSuggestionIndex - 1 + suggestions.length) % suggestions.length;
                highlightSuggestion(Array.from(suggestions));
                break;
                
            case 'Enter':
                if (currentSuggestionIndex >= 0 && currentSuggestionIndex < suggestions.length) {
                    event.preventDefault();
                    suggestions[currentSuggestionIndex].click();
                }
                break;
                
            case 'Escape':
                closeSuggestionModal();
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

    // Click event for product name inputs
    document.addEventListener("click", (event) => {
        if (event.target.classList.contains("product-name")) {
            const query = event.target.value.trim();
            if (query.length > 1) {
                openSuggestionModal(event.target, query);
            } else {
                openSuggestionModal(event.target, '');
            }
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

            if (!response.ok) throw new Error("Failed to save Data");

            displayMessage("Data Store successfully!", "success");
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (error) {
            displayMessage(error.message);
        }
    };
    function addNewRow() {
        const billItemsContainer = document.getElementById("bill-items");
        const row = document.createElement("tr");
        
        // Create cells individually for better control
        const nameCell = document.createElement("td");
        nameCell.innerHTML = `<input type="text" class="product-name" placeholder="Enter name" autocomplete="off" required>`;
        
        const idCell = document.createElement("td");
        idCell.innerHTML = `<input type="text" class="product-id" placeholder="Enter ID" required>`;
        
        const priceCell = document.createElement("td");
        priceCell.innerHTML = `<input type="number" class="item-price" value="0.00" step="0.01" readonly>`;
        
        const quantityCell = document.createElement("td");
        quantityCell.innerHTML = `<input type="number" class="item-quantity" value="1" min="1" required>`;
        
        const totalCell = document.createElement("td");
        totalCell.className = "item-total";
        totalCell.textContent = "₹0.00";
        
        const actionCell = document.createElement("td");
        // Create only the delete button
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-row";
        deleteBtn.setAttribute("type", "button");
        deleteBtn.setAttribute("aria-label", "Delete row");
        deleteBtn.innerHTML = `<i class="fas fa-trash"></i>`;
        actionCell.appendChild(deleteBtn);
        
        // Append cells to row
        row.appendChild(nameCell);
        row.appendChild(idCell);
        row.appendChild(priceCell);
        row.appendChild(quantityCell);
        row.appendChild(totalCell);
        row.appendChild(actionCell);
        
        billItemsContainer.appendChild(row);
        row.querySelector(".product-name").focus();
        updateTotals();
        return row;
    }
    
    document.querySelectorAll('.form-group input, .form-group select, .form-group textarea').forEach(element => {
        element.addEventListener('focus', function() {
            this.closest('.form-group').classList.add('focused', 'active');
        });
        
        element.addEventListener('blur', function() {
            this.closest('.form-group').classList.remove('active');
            if (!this.value) {
                this.closest('.form-group').classList.remove('focused');
            }
        });
        
        // Initialize with focused class if value exists
        if (element.value) {
            element.closest('.form-group').classList.add('focused');
        }
    });
    
    // For payment status
    const paymentStatus = document.getElementById('payment-status');
    if (paymentStatus) {
        paymentStatus.addEventListener('change', function() {
            this.setAttribute('data-status', this.value);
            
            // Update status pill
            const statusPill = document.getElementById('status-indicator');
            if (statusPill) {
                statusPill.className = 'status-pill ' + this.value;
                statusPill.textContent = this.options[this.selectedIndex].text;
            }
        });
    }
    
    // Add event listener for the submit button
    document.getElementById("next-button").addEventListener("click", submitBilling);
    
    // Initialize
    setupSuggestionModal();
    setupNotifications();
    fetchProfile();
    populateItemsTable([]);  // Initialize with empty table
});