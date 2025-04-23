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
    // Update item quantities and validate against stock levels
    function setupQuantityValidation() {
        document.addEventListener("input", function(event) {
            if (event.target.classList.contains("item-quantity")) {
                const quantityInput = event.target;
                const row = quantityInput.closest('tr');
                const maxStock = parseInt(quantityInput.dataset.stock) || 0;
                let requestedQty = parseInt(quantityInput.value) || 0;
                
                // If entered quantity exceeds stock, limit it to available stock
                if (maxStock > 0 && requestedQty > maxStock) {
                    // Prevent entering more than available stock
                    quantityInput.value = maxStock;
                    requestedQty = maxStock;
                    
                    // Show warning message
                    displayMessage(`Maximum available stock is ${maxStock}. Quantity has been adjusted.`, "warning");
                    
                    // Highlight the field
                    quantityInput.classList.add('out-of-stock-input');
                    setTimeout(() => {
                        quantityInput.classList.remove('out-of-stock-input');
                        quantityInput.classList.add('adjusted-quantity');
                    }, 800);
                } else {
                    // Remove highlighting if quantity is valid
                    quantityInput.classList.remove('out-of-stock-input', 'adjusted-quantity');
                }
                
                // Update total for this row
                updateRowTotal(row);
                updateTotals();
            }
        });
    }
    

// Update total for a specific row
function updateRowTotal(row) {
    const price = parseFloat(row.querySelector(".item-price").value) || 0;
    const quantity = parseInt(row.querySelector(".item-quantity").value) || 0;
    const itemTotal = price * quantity;

    row.querySelector(".item-total").textContent = `₹${itemTotal.toFixed(2)}`;
}

// When selecting an item from suggestion modal
function selectSuggestionFromModal(item) {
    if (!activeProductInput) return;

    activeProductInput.value = item.name;
    const row = activeProductInput.closest('tr');
    row.querySelector(".product-id").value = item.id;
    row.querySelector(".item-price").value = item.price.toFixed(2);

    const quantityInput = row.querySelector(".item-quantity");
    const stock = item.quantity || 0; // Ensure this is correctly set

    quantityInput.dataset.stock = stock;
    quantityInput.setAttribute('max', stock);

    if (stock <= 0) {
        quantityInput.value = 0;
        quantityInput.classList.add('out-of-stock-input');
        quantityInput.setAttribute('disabled', 'disabled');
        displayMessage(`${item.name} is out of stock!`, "error");
    } else {
        quantityInput.value = Math.min(quantityInput.value, stock); // Adjust if necessary
        quantityInput.removeAttribute('disabled');
        quantityInput.classList.remove('out-of-stock-input');
    }

    updateRowTotal(row);
    updateTotals();
    closeSuggestionModal();
}
// Add CSS for the adjusted quantity highlight
function addQuantityStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .out-of-stock-input {
            background-color: #ffebee !important;
            border-color: #f44336 !important;
            color: #d32f2f !important;
            animation: shake 0.5s ease-in-out;
        }
        
        .low-stock-input {
            background-color: #fff8e1 !important;
            border-color: #ffc107 !important;
        }
        
        .adjusted-quantity {
            background-color: #e8f5e9 !important;
            border-color: #4caf50 !important;
            transition: background-color 0.5s ease;
        }
        
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        
        input[type="number"]:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
    `;
    document.head.appendChild(style);
}

// Initialize quantity validation when page loads
document.addEventListener("DOMContentLoaded", function() {
    // Add this to your main initialization
    setupQuantityValidation();
    addQuantityStyles();
    
    // Rest of your initialization code...
});

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
            if (query.length > 0) { // Changed from 1 to 0 to search immediately
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
                        <p>Type at least 1 character to search for products</p>
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
        if (initialQuery.length > 0) {
            fetchSuggestions(initialQuery).then(renderSuggestions);
        } else {
            // Show empty state
            document.querySelector('.suggestions-body').innerHTML = `
                <div class="no-suggestions">
                    <i class="fas fa-search"></i>
                    <p>Type at least 1 character to search for products</p>
                </div>
            `;
        }
    }
    
    
  
    // Modified fetchSuggestions function to correctly retrieve and map inventory data
async function fetchSuggestions(query) {
    try {
        const token = localStorage.getItem("token");
        
        // First, fetch all inventory items to get complete stock information
        const allItemsResponse = await fetch(`${BASE_URL}/api/items`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });
        
        if (!allItemsResponse.ok) {
            throw new Error("Failed to fetch inventory data");
        }
        
        const allItems = await allItemsResponse.json();
        
        // Then fetch suggestions matching the query
        const suggestionsResponse = await fetch(`${BASE_URL}/api/items/suggestions?query=${encodeURIComponent(query)}`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!suggestionsResponse.ok) {
            throw new Error("Failed to fetch suggestions");
        }

        const suggestions = await suggestionsResponse.json();
        
        // Now map the full item data to each suggestion
        const enhancedSuggestions = suggestions.map(suggestion => {
            // Find the matching inventory item by ID
            const inventoryItem = allItems.find(item => item.id == suggestion.id);
            
            if (inventoryItem) {
                console.log(`Found match for ${suggestion.name}: Quantity = ${inventoryItem.quantity}`);
                
                // Return the suggestion with inventory data merged in
                return {
                    ...suggestion,
                    quantity: inventoryItem.quantity,
                    expiry: inventoryItem.expiry,
                    // Keep the original price if it exists, otherwise use inventory price
                    price: suggestion.price || inventoryItem.price
                };
            } else {
                console.warn(`No inventory data found for item: ${suggestion.name} (ID: ${suggestion.id})`);
                return suggestion;
            }
        });
        
        console.log('Enhanced suggestions with inventory data:', enhancedSuggestions);
        return enhancedSuggestions;
    } catch (error) {
        console.error("Suggestion fetch error:", error);
        displayMessage(error.message);
        return [];
    }
}

// Updated renderSuggestions function to properly display stock status
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
        // Get stock quantity, checking multiple possible property names
        const quantity = 
            typeof item.quantity === 'number' ? item.quantity : 
            typeof item.stock === 'number' ? item.stock : 0;
        
        // Determine stock status based on quantity
        const stockStatus = getStockStatusClass(quantity);
        
        const suggestionItem = document.createElement('div');
        suggestionItem.classList.add('suggestion-item');
        suggestionItem.dataset.index = index;
        
        // Add "Out of Stock" badge if quantity is 0 or less
        let stockBadge = '';
        if (quantity <= 0) {
            stockBadge = `<div class="suggestion-badge out-of-stock">Out of Stock</div>`;
        }
        
        // Add expiry badge if available
        let expiryBadge = '';
        if (item.expiry) {
            const expiryDate = new Date(item.expiry);
            const today = new Date();
            const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
            
            if (daysUntilExpiry <= 7 && daysUntilExpiry >= 0) {
                expiryBadge = `<div class="suggestion-badge expiry">Expires in ${daysUntilExpiry} days</div>`;
            }
        }
        
        suggestionItem.innerHTML = `
            ${stockBadge}
            ${expiryBadge}
            <div class="suggestion-content">
                <div class="suggestion-main">
                    <div class="suggestion-name">
                        ${item.name} 
                        <span style="font-size: 12px; color: #666;">(Stock: ${quantity})</span>
                    </div>
                    <div class="suggestion-details">
                        <span><i class="fas fa-tag"></i> <span class="suggestion-id">${item.id}</span></span>
                        <span><i class="fas fa-box"></i> <span class="suggestion-stock ${stockStatus.class}">${stockStatus.text}</span></span>
                        ${item.expiry ? `<span><i class="fas fa-calendar"></i> <span class="suggestion-expiry">Exp: ${new Date(item.expiry).toLocaleDateString()}</span></span>` : ''}
                    </div>
                </div>
                <div class="suggestion-price">
                    <i class="fas fa-rupee-sign"></i> ${parseFloat(item.price).toFixed(2)}
                </div>
            </div>
        `;
        
        // Add item to the invoice even if out of stock, but display warning
        suggestionItem.addEventListener('click', () => {
            selectSuggestionFromModal(item);
        });
        
        suggestionsBody.appendChild(suggestionItem);
    });
}

// Updated getStockStatusClass function for better stock status display
function getStockStatusClass(quantity) {
    // Ensure we're working with a number
    const stockNum = parseInt(quantity);
    
    // Check if it's a valid number
    if (isNaN(stockNum)) {
        return { class: 'unknown', text: 'Stock Unknown' };
    }
    
    // Now check the stock level with more detailed status
    if (stockNum <= 0) {
        return { class: 'out', text: 'Out of Stock' };
    } else if (stockNum < 10) {
        return { class: 'low', text: `Low Stock (${stockNum})` };
    } else if (stockNum < 50) {
        return { class: 'medium', text: `In Stock (${stockNum})` };
    } else {
        return { class: 'high', text: `In Stock (${stockNum})` };
    }
}

// Updated selectSuggestionFromModal function to properly handle quantity
function selectSuggestionFromModal(item) {
    if (!activeProductInput) return;
    
    // Update the input field
    activeProductInput.value = item.name;
    
    // Find the row and update other fields
    const row = activeProductInput.closest('tr');
    
    // Get the quantity properly
    const quantity = 
        typeof item.quantity === 'number' ? item.quantity : 
        typeof item.stock === 'number' ? item.stock : 0;
    
    // Update ID and price fields
    row.querySelector(".product-id").value = item.id;
    row.querySelector(".item-price").value = parseFloat(item.price).toFixed(2);
    
    // Get quantity input element
    const quantityInput = row.querySelector(".item-quantity");
    
    // Store stock info as data attribute
    quantityInput.dataset.stock = quantity;
    
    // Set max attribute to prevent entering more than stock in number input
    if (quantity > 0) {
        quantityInput.setAttribute('max', quantity);
    }
    
    // Update styling based on stock level
    if (quantity <= 0) {
        quantityInput.value = 0;
        quantityInput.classList.add('out-of-stock-input');
        quantityInput.setAttribute('disabled', 'disabled');
        displayMessage(`${item.name} is out of stock!`, "error");
    } else {
        // Make sure quantity is at least 1
        if (parseInt(quantityInput.value) < 1) {
            quantityInput.value = 1;
        }
        
        // If current value is more than available stock, adjust it
        if (parseInt(quantityInput.value) > quantity) {
            quantityInput.value = quantity;
            displayMessage(`Quantity adjusted to maximum available stock (${quantity})`, "warning");
        }
        
        // Enable the input
        quantityInput.removeAttribute('disabled');
        
        // Style based on stock levels
        if (quantity < 10) {
            quantityInput.classList.add('low-stock-input');
            quantityInput.classList.remove('out-of-stock-input');
            if (quantity < 5) {
                displayMessage(`Low stock alert: Only ${quantity} units of ${item.name} left!`, "warning");
            }
        } else {
            quantityInput.classList.remove('low-stock-input', 'out-of-stock-input');
        }
    }
    
    // Update totals
    updateRowTotal(row);
    updateTotals();
    
    // Close the modal
    closeSuggestionModal();
    
    // Add a new row if this was the last one and we have stock
    const isLastRow = !row.nextElementSibling;
    if (isLastRow && quantity > 0) {
        addNewRow();
    }
}

// Helper function to update a single row's total
function updateRowTotal(row) {
    const price = parseFloat(row.querySelector(".item-price").value) || 0;
    const quantity = parseInt(row.querySelector(".item-quantity").value) || 0;
    const itemTotal = price * quantity;

    row.querySelector(".item-total").textContent = `₹${itemTotal.toFixed(2)}`;
}


    function checkLogin() {
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "../login/login.html";
        }
        return token;
    }

    function displayMessage(message, type = "error") {
        // Create message if it doesn't exist, or get existing one
        let messageDiv = document.getElementById("message");
        
        if (!messageDiv) {
            messageDiv = document.createElement("div");
            messageDiv.id = "message";
            document.body.appendChild(messageDiv);
        }
        
        // Set message style and content
        messageDiv.textContent = message;
        messageDiv.className = `message ${type} message-visible`;
        
        // Make the message sticky at the top of the viewport
        messageDiv.style.position = "fixed";
        messageDiv.style.top = "20px";
        messageDiv.style.left = "50%";
        messageDiv.style.transform = "translateX(-50%)";
        messageDiv.style.zIndex = "10000";
        messageDiv.style.padding = "12px 24px";
        messageDiv.style.borderRadius = "6px";
        messageDiv.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
        messageDiv.style.maxWidth = "90%";
        messageDiv.style.display = "block";
        
        // Set colors based on type
        switch (type) {
            case "success":
                messageDiv.style.backgroundColor = "#4CAF50";
                messageDiv.style.color = "white";
                break;
            case "warning":
                messageDiv.style.backgroundColor = "#FF9800";
                messageDiv.style.color = "white";
                break;
            case "error":
            default:
                messageDiv.style.backgroundColor = "#F44336";
                messageDiv.style.color = "white";
                break;
        }
        
        // Add close button
        const closeButton = document.createElement("span");
        closeButton.innerHTML = "&times;";
        closeButton.style.marginLeft = "10px";
        closeButton.style.cursor = "pointer";
        closeButton.style.fontWeight = "bold";
        closeButton.style.float = "right";
        closeButton.onclick = function() {
            messageDiv.style.display = "none";
        };
        messageDiv.appendChild(closeButton);
        
        // Auto-hide after delay
        setTimeout(() => {
            messageDiv.style.display = "none";
        }, 5000);
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

            const suggestions = await response.json();
            
            // Fetch complete item details for each suggestion to get stock levels
            const detailedSuggestions = [];
            for (const suggestion of suggestions) {
                try {
                    // Fetch complete item details to get stock quantity
                    const itemResponse = await fetch(`${BASE_URL}/api/items/${suggestion.id}`, {
                        headers: {
                            "Authorization": `Bearer ${token}`,
                            "Content-Type": "application/json"
                        }
                    });
                    
                    if (itemResponse.ok) {
                        const itemDetail = await itemResponse.json();
                        // Merge suggestion with detailed item info
                        detailedSuggestions.push({
                            ...suggestion,
                            quantity: itemDetail.quantity,
                            expiry_date: itemDetail.expiry
                        });
                    } else {
                        // If we can't get item details, use the basic suggestion
                        detailedSuggestions.push(suggestion);
                    }
                } catch (itemError) {
                    console.error("Error fetching item details:", itemError);
                    detailedSuggestions.push(suggestion);
                }
            }
            
            return detailedSuggestions;
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
        
        // Store the item's stock in a data attribute for validation
        const quantityInput = row.querySelector(".item-quantity");
        if (item.quantity !== undefined) {
            quantityInput.dataset.stock = item.quantity;
            
            // Set max attribute to prevent exceeding stock
            quantityInput.setAttribute('max', item.quantity);
            
            // Add visual indicator if stock is low or out
            if (item.quantity <= 0) {
                quantityInput.classList.add('out-of-stock-input');
            } else if (item.quantity < 10) {
                quantityInput.classList.add('low-stock-input');
            }
        }
        
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

        if (query.length > 0) { // Changed from 1 to 0 to trigger search with just 1 character
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
                   // If changing quantity, check against available stock
                   if (event.target.classList.contains("item-quantity")) {
                    const stock = parseInt(event.target.dataset.stock) || 0;
                    const requestedQty = parseInt(event.target.value) || 0;
                    
                    if (stock > 0 && requestedQty > stock) {
                        displayMessage(`Warning: Only ${stock} units available in stock!`, "warning");
                        event.target.classList.add('out-of-stock-input');
                    } else if (stock > 0) {
                        event.target.classList.remove('out-of-stock-input');
                    }
                }
                
                updateTotals();
            }
        });
    
        // Click event for product name inputs
        document.addEventListener("click", (event) => {
            if (event.target.classList.contains("product-name")) {
                const query = event.target.value.trim();
                if (query.length > 0) { // Changed from 1 to 0 to show suggestions with just 1 character
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
    
        // Generate PDF and print
        function printInvoice() {
            // Make sure form is valid before printing
            if (!validateBillingForm()) {
                displayMessage("Please fill in all required fields before printing", "error");
                return;
            }
    
            // Check for stock issues before printing
            if (!validateStockLevels()) {
                displayMessage("Some items exceed available stock! Please adjust quantities.", "error");
                return;
            }
    
            // Get all data needed for the invoice
            const invoiceData = collectInvoiceData();
            
            // Create a new window for printing
            const printWindow = window.open('', '_blank');
              // Generate print-friendly HTML
              printWindow.document.write(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Invoice #${invoiceData.invoiceNo}</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            margin: 0;
                            padding: 20px;
                            color: #333;
                        }
                        .invoice-container {
                            max-width: 800px;
                            margin: 0 auto;
                            padding: 20px;
                            border: 1px solid #ddd;
                        }
                        .invoice-header {
                            display: flex;
                            justify-content: space-between;
                            border-bottom: 2px solid #333;
                            padding-bottom: 20px;
                            margin-bottom: 20px;
                        }
                        .company-info h1 {
                            margin: 0;
                            color: #2a5885;
                        }
                        .invoice-info {
                            text-align: right;
                        }
                        .customer-details {
                            margin-bottom: 30px;
                        }
                        .customer-details h3, .item-table h3 {
                            border-bottom: 1px solid #ddd;
                            padding-bottom: 5px;
                            margin-bottom: 15px;
                        }
                        .item-table table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 20px;
                        }
                        .item-table th, .item-table td {
                            border: 1px solid #ddd;
                            padding: 10px;
                            text-align: left;
                        }
                        .item-table th {
                            background-color: #f5f5f5;
                        }
                        .totals {
                            width: 300px;
                            margin-left: auto;
                        }
                        .totals table {
                            width: 100%;
                        }
                        .totals td {
                            padding: 5px 0;
                        }
                        .totals .grand-total {
                            font-weight: bold;
                            font-size: 1.2em;
                            border-top: 1px solid #ddd;
                        }
                        .payment-info {
                            margin-top: 30px;
                            padding-top: 20px;
                            border-top: 1px solid #ddd;
                        }
                        .footer {
                            margin-top: 40px;
                            text-align: center;
                            color: #777;
                            font-size: 0.9em;
                        }
                        @media print {
                            body {
                                padding: 0;
                                -webkit-print-color-adjust: exact;
                            }
                            .invoice-container {
                                border: none;
                                max-width: 100%;
                            }
                            .no-print {
                                display: none;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="invoice-container">
                        <div class="invoice-header">
                            <div class="company-info">
                                <h1>eMart</h1>
                                <p>123 Commerce St.<br>Business District, City</p>
                            </div>
                            <div class="invoice-info">
                                <h2>INVOICE</h2>
                                <p><strong>Invoice No:</strong> ${invoiceData.invoiceNo}</p>
                                <p><strong>Date:</strong> ${new Date(invoiceData.invoiceDate).toLocaleDateString()}</p>
                                <p><strong>Cashier:</strong> ${invoiceData.cashier}</p>
                            </div>
                        </div>
                        
                        <div class="customer-details">
                            <h3>Customer Information</h3>
                            <p><strong>Name:</strong> ${invoiceData.customerName}</p>
                            <p><strong>Phone:</strong> ${invoiceData.customerPhone}</p>
                            ${invoiceData.customerEmail ? `<p><strong>Email:</strong> ${invoiceData.customerEmail}</p>` : ''}
                            ${invoiceData.customerAddress ? `<p><strong>Address:</strong> ${invoiceData.customerAddress}</p>` : ''}
                        </div>
                        
                        <div class="item-table">
                            <h3>Items</h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>ID</th>
                                        <th>Price</th>
                                        <th>Quantity</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${invoiceData.items.map(item => `
                                        <tr>
                                            <td>${item.name}</td>
                                            <td>${item.id}</td>
                                            <td>₹${item.price.toFixed(2)}</td>
                                            <td>${item.quantity}</td>
                                            <td>₹${item.total.toFixed(2)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        
                        <div class="totals">
                            <table>
                                <tr>
                                    <td><strong>Subtotal:</strong></td>
                                    <td>₹${invoiceData.subtotal.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td><strong>Tax (10%):</strong></td>
                                    <td>₹${invoiceData.tax.toFixed(2)}</td>
                                </tr>
                                <tr class="grand-total">
                                    <td><strong>Total:</strong></td>
                                    <td>₹${invoiceData.grandTotal.toFixed(2)}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <div class="payment-info">
                            <h3>Payment Information</h3>
                            <p><strong>Method:</strong> ${invoiceData.paymentMethod}</p>
                            <p><strong>Status:</strong> ${invoiceData.paymentStatus}</p>
                            ${invoiceData.paymentNote ? `<p><strong>Note:</strong> ${invoiceData.paymentNote}</p>` : ''}
                        </div>
                        
                        <div class="footer">
                            <p>Thank you for your business!</p>
                            <p>For any inquiries, please contact us at support@emart.com</p>
                        </div>
                        
                        <div class="no-print" style="margin-top: 30px; text-align: center;">
                            <button onclick="window.print();" style="padding: 10px 20px; background: #2a5885; color: white; border: none; cursor: pointer; font-size: 16px;">
                                Print Invoice
                            </button>
                        </div>
                    </div>
                    <script>
                        // Auto-print on load
                        window.onload = function() {
                            // Uncomment next line for auto-print
                            // window.print();
                        }
                    </script>
                </body>
                </html>
            `);
            
            // Finish setting up the new window
            printWindow.document.close();
        }
    
        // Collect all invoice data from the form
        function collectInvoiceData() {
            // Calculate totals
            const subtotal = parseFloat(document.getElementById("subtotal").textContent.replace('₹', '')) || 0;
            const tax = parseFloat(document.getElementById("tax").textContent.replace('₹', '')) || 0;
            const grandTotal = parseFloat(document.getElementById("grand-total").textContent.replace('₹', '')) || 0;
            
            // Get items
            const rows = document.querySelectorAll("#bill-items tr");
            const items = Array.from(rows).filter(row => {
                return row.querySelector(".product-id").value.trim() !== "";
            }).map(row => ({
                name: row.querySelector(".product-name").value,
                id: row.querySelector(".product-id").value,
                price: parseFloat(row.querySelector(".item-price").value) || 0,
                quantity: parseInt(row.querySelector(".item-quantity").value) || 0,
                total: parseFloat(row.querySelector(".item-total").textContent.replace('₹', '')) || 0,
                stock: parseInt(row.querySelector(".item-quantity").dataset.stock) || 0
            }));
            
            // Build the full invoice data object
            return {
                customerName: document.getElementById("customer-name").value,
                customerPhone: document.getElementById("customer-phone").value,
                customerEmail: document.getElementById("customer-email").value,
                customerAddress: document.getElementById("customer-address").value,
                invoiceDate: document.getElementById("invoice-date").value,
                invoiceNo: document.getElementById("invoice-no").value,
                cashier: document.getElementById("cashier-name").value,
                paymentMethod: document.getElementById("payment-method").value,
                paymentStatus: document.getElementById("payment-status").value,
                paymentNote: document.getElementById("payment-note").value,
                items: items,
                subtotal: subtotal,
                tax: tax,
                grandTotal: grandTotal
            };
        }
    
        // Validate the billing form
        function validateBillingForm() {
            // Check customer info
            const customerName = document.getElementById("customer-name").value;
            const customerPhone = document.getElementById("customer-phone").value;
            if (!customerName || !customerPhone) {
                return false;
            }
            
            // Check payment info
            const paymentMethod = document.getElementById("payment-method").value;
            const paymentStatus = document.getElementById("payment-status").value;
            if (!paymentMethod || !paymentStatus) {
                return false;
            }
            
            // Check items
            const items = Array.from(document.querySelectorAll("#bill-items tr")).filter(row => {
                return row.querySelector(".product-id").value.trim() !== "";
            });
            
            if (items.length === 0) {
                return false;
            }
            
            return true;
        }
    
        // Validate stock levels for all items
        function validateStockLevels() {
            let valid = true;
            const rows = document.querySelectorAll("#bill-items tr");
            
            rows.forEach(row => {
                const productId = row.querySelector(".product-id").value.trim();
                if (!productId) return; // Skip empty rows
                
                const quantityInput = row.querySelector(".item-quantity");
                const stock = parseInt(quantityInput.dataset.stock) || 0;
                const requestedQty = parseInt(quantityInput.value) || 0;
                
                // Allow saving even if stock is insufficient, but highlight the issue
                if (stock > 0 && requestedQty > stock) {
                    quantityInput.classList.add('out-of-stock-input');
                    valid = false; // Mark as invalid but still allow saving
                }
            });
            
            return valid;
        }
    
        // Save billing data and update inventory
       // Save billing data and update inventory
async function saveBilling() {
    // Validate form
    if (!validateBillingForm()) {
        displayMessage("Please fill in all required fields", "error");
        return;
    }
    
    // Check for stock issues but allow save with warning
    if (!validateStockLevels()) {
        const confirmOverride = confirm("Some items exceed available stock! Do you want to continue anyway?");
        if (!confirmOverride) {
            return;
        }
    }
    
    const customerName = document.getElementById("customer-name").value;
    const customerPhone = document.getElementById("customer-phone").value;
    const paymentMethod = document.getElementById("payment-method").value;
    const paymentStatus = document.getElementById("payment-status").value;

    const items = Array.from(document.querySelectorAll("#bill-items tr")).filter(row => {
        return row.querySelector(".product-id").value.trim() !== "";
    });

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
        })),
        updateInventory: true // Flag to tell the server to update inventory quantities
    };

    try {
        // First save the billing
        const response = await fetch(`${BASE_URL}/api/billing`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(invoiceData)
        });

        if (!response.ok) throw new Error("Failed to save invoice data");
        
        // Fetch all items first (since we don't have a single item endpoint)
        const allItemsResponse = await fetch(`${BASE_URL}/api/items`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });
        
        if (!allItemsResponse.ok) {
            throw new Error("Failed to fetch items for inventory update");
        }
        
        const allItems = await allItemsResponse.json();
        
        // Now update inventory quantities for each item
        const updatePromises = invoiceData.items.map(async (item) => {
            try {
                // Find the item in our full items list
                const currentItem = allItems.find(i => i.id == item.id);
                
                if (!currentItem) {
                    throw new Error(`Item with ID ${item.id} not found in inventory`);
                }
                
                const newQuantity = Math.max(0, currentItem.quantity - item.quantity);
                
                // Then update with the new quantity
                const updateResponse = await fetch(`${BASE_URL}/api/items/${item.id}`, {
                    method: "PUT",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        quantity: newQuantity,
                        name: currentItem.name,
                        price: currentItem.price,
                        profit: currentItem.profit,
                        expiry: currentItem.expiry
                    })
                });
                
                if (!updateResponse.ok) {
                    throw new Error(`Failed to update inventory for item ${item.id}`);
                }
                
                return updateResponse.json();
            } catch (error) {
                console.error(`Error updating inventory for item ${item.id}:`, error);
                throw error;
            }
        });
        
        // Wait for all inventory updates to complete
        await Promise.all(updatePromises);

        displayMessage("Invoice saved and inventory updated successfully!", "success");
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    } catch (error) {
        displayMessage(error.message);
    }
}

    
        // Replace the "Next" button with "Print" and "Save" buttons
        function updateActionButtons() {
            const billingFooter = document.querySelector('.billing-footer');
            if (!billingFooter) return;
            
            // Clear existing content
            billingFooter.innerHTML = '';
            
            // Create Print button
            const printButton = document.createElement('button');
            printButton.className = 'btn-secondary';
            printButton.type = 'button';
            printButton.id = 'print-button';
            printButton.innerHTML = '<i class="fas fa-print"></i> Print';
            printButton.addEventListener('click', printInvoice);
            
            // Create Save button
            const saveButton = document.createElement('button');
            saveButton.className = 'btn-success';
            saveButton.type = 'button';
            saveButton.id = 'save-button';
            saveButton.innerHTML = '<i class="fas fa-save"></i> Save';
            saveButton.addEventListener('click', saveBilling);
            
            // Add buttons to the footer
            billingFooter.appendChild(printButton);
            billingFooter.appendChild(saveButton);
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
        // Save billing data as a draft without inventory updates
async function saveDraft() {
    // Collect the current form data even if incomplete
    const customerName = document.getElementById("customer-name").value || "Draft Customer";
    const customerPhone = document.getElementById("customer-phone").value || "";

    // Get all items that have at least a product name
    const items = Array.from(document.querySelectorAll("#bill-items tr"))
        .filter(row => row.querySelector(".product-name").value.trim() !== "")
        .map(row => ({
            name: row.querySelector(".product-name").value,
            id: row.querySelector(".product-id").value || "",
            price: parseFloat(row.querySelector(".item-price").value) || 0,
            quantity: parseInt(row.querySelector(".item-quantity").value) || 1,
            total: parseFloat(row.querySelector(".item-total").textContent.replace('₹', '')) || 0
        }));

    if (items.length === 0) {
        displayMessage("Please add at least one item to save as draft", "warning");
        return;
    }

    const token = checkLogin();
    
    // Create draft data with a special draft flag
    const draftData = {
        isDraft: true,
        customerName,
        customerPhone,
        customerEmail: document.getElementById("customer-email").value || "",
        customerAddress: document.getElementById("customer-address").value || "",
        invoiceDate: document.getElementById("invoice-date").value,
        invoiceNo: document.getElementById("invoice-no").value + "-DRAFT",
        paymentMethod: document.getElementById("payment-method").value || "",
        paymentStatus: "draft",
        paymentNote: document.getElementById("payment-note").value || "Draft invoice - not finalized",
        items: items,
        updateInventory: false, // Don't update inventory for drafts
        draftSavedDate: new Date().toISOString()
    };

    try {
        // Save draft to local storage for offline use
        const draftKey = `invoice-draft-${draftData.invoiceNo}`;
        localStorage.setItem(draftKey, JSON.stringify(draftData));
        
        // If online, also save to server if API supports it
        try {
            const response = await fetch(`${BASE_URL}/api/billing/drafts`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(draftData)
            });
            
            if (response.ok) {
                displayMessage("Draft saved both locally and to server", "success");
            } else {
                // If server API fails, still have local copy
                displayMessage("Draft saved locally (server sync failed)", "warning");
            }
        } catch (serverError) {
            // Server error but local save succeeded
            console.error("Error saving draft to server:", serverError);
            displayMessage("Draft saved locally", "success");
        }
        
        // Add to drafts list for easy access
        addToDraftsList(draftData);
        
    } catch (error) {
        displayMessage("Error saving draft: " + error.message, "error");
    }
}

// Add to the drafts management list
function addToDraftsList(draft) {
    // Get existing drafts or initialize empty array
    let drafts = JSON.parse(localStorage.getItem('invoice-drafts') || '[]');
    
    // Add this draft to the list (with timestamp for sorting)
    drafts.push({
        id: draft.invoiceNo,
        customerName: draft.customerName,
        date: draft.draftSavedDate,
        items: draft.items.length
    });
    
    // Keep only the most recent 20 drafts
    if (drafts.length > 20) {
        drafts = drafts.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);
    }
    
    // Save updated drafts list
    localStorage.setItem('invoice-drafts', JSON.stringify(drafts));
}

// Load an existing draft
function loadDraft(draftId) {
    const draftKey = `invoice-draft-${draftId}`;
    const draftData = JSON.parse(localStorage.getItem(draftKey));
    
    if (!draftData) {
        displayMessage("Draft not found", "error");
        return;
    }
    
    // Populate the form with draft data
    document.getElementById("customer-name").value = draftData.customerName || "";
    document.getElementById("customer-phone").value = draftData.customerPhone || "";
    document.getElementById("customer-email").value = draftData.customerEmail || "";
    document.getElementById("customer-address").value = draftData.customerAddress || "";
    document.getElementById("invoice-date").value = draftData.invoiceDate || "";
    
    // Remove "-DRAFT" suffix for display
    document.getElementById("invoice-no").value = draftData.invoiceNo.replace("-DRAFT", "");
    
    document.getElementById("payment-method").value = draftData.paymentMethod || "";
    document.getElementById("payment-status").value = draftData.paymentStatus === "draft" ? "pending" : draftData.paymentStatus;
    document.getElementById("payment-note").value = draftData.paymentNote || "";
    
    // Clear existing items
    const billItemsContainer = document.getElementById("bill-items");
    billItemsContainer.innerHTML = "";
    
    // Add items from draft
    draftData.items.forEach(item => {
        const row = addNewRow();
        row.querySelector(".product-name").value = item.name || "";
        row.querySelector(".product-id").value = item.id || "";
        row.querySelector(".item-price").value = item.price?.toFixed(2) || "0.00";
        row.querySelector(".item-quantity").value = item.quantity || 1;
    });
    
    // Add an empty row at the end if needed
    if (draftData.items.length === 0) {
        addNewRow();
    }
    
    // Update calculations
    updateTotals();
    
    displayMessage("Draft loaded successfully", "success");
    
    // Add "Draft loaded" indicator to the form
    const billingHeader = document.querySelector('.billing-header .header-left');
    const draftIndicator = document.createElement('div');
    draftIndicator.className = 'draft-indicator';
    draftIndicator.textContent = 'Draft Loaded';
    draftIndicator.style.backgroundColor = '#FF9800';
    draftIndicator.style.color = 'white';
    draftIndicator.style.padding = '4px 8px';
    draftIndicator.style.borderRadius = '4px';
    draftIndicator.style.fontSize = '12px';
    draftIndicator.style.marginLeft = '10px';
    draftIndicator.style.display = 'inline-block';
    billingHeader.appendChild(draftIndicator);
}

// Show drafts management modal
function showDraftsModal() {
    // Get saved drafts
    const drafts = JSON.parse(localStorage.getItem('invoice-drafts') || '[]');
    
    // Create modal if it doesn't exist
    if (!document.getElementById('drafts-modal')) {
        const modal = document.createElement('div');
        modal.id = 'drafts-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Saved Drafts</h2>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">
                    <div id="drafts-list" class="drafts-list">
                        <p>No drafts found</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="close-drafts-modal" class="btn-secondary">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners
        modal.querySelector('.close').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        document.getElementById('close-drafts-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        // Close when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        // Add modal styles
        const style = document.createElement('style');
        style.textContent = `
            .modal {
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.4);
            }
            .modal-content {
                background-color: #fefefe;
                margin: 10% auto;
                padding: 0;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                width: 80%;
                max-width: 700px;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
            }
            .modal-header {
                padding: 15px 20px;
                background: #f8f8f8;
                border-bottom: 1px solid #ddd;
                border-radius: 8px 8px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .modal-header h2 {
                margin: 0;
                font-size: 20px;
            }
            .close {
                color: #aaa;
                font-size: 28px;
                font-weight: bold;
                cursor: pointer;
            }
            .close:hover {
                color: #333;
            }
            .modal-body {
                padding: 20px;
                overflow-y: auto;
                max-height: calc(80vh - 130px);
            }
            .modal-footer {
                padding: 15px 20px;
                background: #f8f8f8;
                border-top: 1px solid #ddd;
                border-radius: 0 0 8px 8px;
                text-align: right;
            }
            .drafts-list {
                width: 100%;
            }
            .draft-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px;
                border: 1px solid #eee;
                margin-bottom: 10px;
                border-radius: 4px;
                transition: background-color 0.2s;
            }
            .draft-item:hover {
                background-color: #f5f5f5;
            }
            .draft-info {
                flex: 1;
            }
            .draft-actions {
                display: flex;
                gap: 8px;
            }
            .draft-actions button {
                padding: 6px 12px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            .load-draft {
                background-color: #2a5885;
                color: white;
            }
            .delete-draft {
                background-color: #F44336;
                color: white;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Show modal
    const modal = document.getElementById('drafts-modal');
    modal.style.display = 'block';
    
    // Populate drafts list
    const draftsList = document.getElementById('drafts-list');
    if (drafts.length === 0) {
        draftsList.innerHTML = '<p>No saved drafts found</p>';
        return;
    }
    
    // Sort drafts by date (newest first)
    const sortedDrafts = drafts.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Create list items
    draftsList.innerHTML = '';
    sortedDrafts.forEach(draft => {
        const draftDate = new Date(draft.date);
        const formattedDate = draftDate.toLocaleDateString() + ' ' + draftDate.toLocaleTimeString();
        
        const draftItem = document.createElement('div');
        draftItem.className = 'draft-item';
        draftItem.innerHTML = `
            <div class="draft-info">
                <strong>${draft.customerName || 'Unnamed Draft'}</strong>
                <div>Invoice: ${draft.id}</div>
                <div>Date: ${formattedDate}</div>
                <div>Items: ${draft.items}</div>
            </div>
            <div class="draft-actions">
                <button class="load-draft" data-draft-id="${draft.id}">Load</button>
                <button class="delete-draft" data-draft-id="${draft.id}">Delete</button>
            </div>
        `;
        
        draftsList.appendChild(draftItem);
    });
    
    // Add event listeners for load and delete buttons
    draftsList.querySelectorAll('.load-draft').forEach(button => {
        button.addEventListener('click', (e) => {
            const draftId = e.target.dataset.draftId;
            loadDraft(draftId);
            modal.style.display = 'none';
        });
    });
    
    draftsList.querySelectorAll('.delete-draft').forEach(button => {
        button.addEventListener('click', (e) => {
            const draftId = e.target.dataset.draftId;
            deleteDraft(draftId);
            e.target.closest('.draft-item').remove();
            
            // Show "no drafts" message if all drafts are deleted
            if (draftsList.querySelectorAll('.draft-item').length === 0) {
                draftsList.innerHTML = '<p>No saved drafts found</p>';
            }
        });
    });
}

// Delete a draft
function deleteDraft(draftId) {
    // Remove from localStorage
    localStorage.removeItem(`invoice-draft-${draftId}`);
    
    // Update drafts list
    let drafts = JSON.parse(localStorage.getItem('invoice-drafts') || '[]');
    drafts = drafts.filter(draft => draft.id !== draftId);
    localStorage.setItem('invoice-drafts', JSON.stringify(drafts));
    
    displayMessage("Draft deleted", "success");
}

// Replace the action buttons to include Save Draft
function updateActionButtons() {
    const billingFooter = document.querySelector('.billing-footer');
    if (!billingFooter) return;
    
    // Clear existing content
    billingFooter.innerHTML = '';
    
    // Create Print button
    const printButton = document.createElement('button');
    printButton.className = 'btn-secondary';
    printButton.type = 'button';
    printButton.id = 'print-button';
    printButton.innerHTML = '<i class="fas fa-print"></i> Print';
    printButton.addEventListener('click', printInvoice);
    
    // Create Save Draft button
    const saveDraftButton = document.createElement('button');
    saveDraftButton.className = 'btn-secondary';
    saveDraftButton.type = 'button';
    saveDraftButton.id = 'save-draft-button';
    saveDraftButton.innerHTML = '<i class="fas fa-save"></i> Save Draft';
    saveDraftButton.addEventListener('click', saveDraft);
    
    // Create Drafts button
    const draftsButton = document.createElement('button');
    draftsButton.className = 'btn-secondary';
    draftsButton.type = 'button';
    draftsButton.id = 'drafts-button';
    draftsButton.innerHTML = '<i class="fas fa-list"></i> Drafts';
    draftsButton.addEventListener('click', showDraftsModal);
    
    // Create Save button
    const saveButton = document.createElement('button');
    saveButton.className = 'btn-success';
    saveButton.type = 'button';
    saveButton.id = 'save-button';
    saveButton.innerHTML = '<i class="fas fa-check-circle"></i> Save';
    saveButton.addEventListener('click', saveBilling);
    
    // Add buttons to the footer
    billingFooter.appendChild(printButton);
    billingFooter.appendChild(saveDraftButton);
    billingFooter.appendChild(draftsButton);
    billingFooter.appendChild(saveButton);
}
// Save billing data and update inventory with invoice number update
async function saveBilling() {
    // Existing validation code
    if (!validateBillingForm()) {
        displayMessage("Please fill in all required fields", "error");
        return;
    }
    
    // Stock validation code remains unchanged
    if (!validateStockLevels()) {
        const confirmOverride = confirm("Some items exceed available stock! Do you want to continue anyway?");
        if (!confirmOverride) {
            return;
        }
    }
    
    // Collect form data (unchanged)
    const customerName = document.getElementById("customer-name").value;
    const customerPhone = document.getElementById("customer-phone").value;
    const paymentMethod = document.getElementById("payment-method").value;
    const paymentStatus = document.getElementById("payment-status").value;
    const invoiceNo = document.getElementById("invoice-no").value;

    const items = Array.from(document.querySelectorAll("#bill-items tr"))
        .filter(row => row.querySelector(".product-id").value.trim() !== "");

    const token = checkLogin();
    const invoiceData = {
        customerName,
        customerPhone,
        customerEmail: document.getElementById("customer-email").value,
        customerAddress: document.getElementById("customer-address").value,
        invoiceDate: document.getElementById("invoice-date").value,
        invoiceNo: invoiceNo,
        paymentMethod,
        paymentStatus,
        paymentNote: document.getElementById("payment-note").value,
        items: items.map(row => ({
            name: row.querySelector(".product-name").value,
            id: row.querySelector(".product-id").value,
            price: parseFloat(row.querySelector(".item-price").value) || 0,
            quantity: parseInt(row.querySelector(".item-quantity").value) || 0,
            total: parseFloat(row.querySelector(".item-total").textContent.replace('₹', '')) || 0
        })),
        updateInventory: true
    };

    try {
        // First save the billing (unchanged)
        const response = await fetch(`${BASE_URL}/api/billing`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(invoiceData)
        });

        if (!response.ok) throw new Error("Failed to save invoice data");
        
        // Inventory update code remains unchanged
        const allItemsResponse = await fetch(`${BASE_URL}/api/items`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });
        
        if (!allItemsResponse.ok) {
            throw new Error("Failed to fetch items for inventory update");
        }
        
        const allItems = await allItemsResponse.json();
        
        // Inventory update for each item (unchanged)
        const updatePromises = invoiceData.items.map(async (item) => {
            try {
                const currentItem = allItems.find(i => i.id == item.id);
                
                if (!currentItem) {
                    throw new Error(`Item with ID ${item.id} not found in inventory`);
                }
                
                const newQuantity = Math.max(0, currentItem.quantity - item.quantity);
                
                const updateResponse = await fetch(`${BASE_URL}/api/items/${item.id}`, {
                    method: "PUT",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        quantity: newQuantity,
                        name: currentItem.name,
                        price: currentItem.price,
                        profit: currentItem.profit,
                        expiry: currentItem.expiry
                    })
                });
                
                if (!updateResponse.ok) {
                    throw new Error(`Failed to update inventory for item ${item.id}`);
                }
                
                return updateResponse.json();
            } catch (error) {
                console.error(`Error updating inventory for item ${item.id}:`, error);
                throw error;
            }
        });
        
        // Wait for all inventory updates to complete
        await Promise.all(updatePromises);

        // NEW CODE: Update the invoice number for next invoice
        await updateNextInvoiceNumber(invoiceNo);

        displayMessage("Invoice saved and inventory updated successfully!", "success");
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    } catch (error) {
        displayMessage(error.message);
    }
}

// NEW FUNCTION: Update and save the next invoice number
async function updateNextInvoiceNumber(currentInvoiceNo) {
    try {
        // Parse the current invoice number
        let numericPart = 0;
        let prefix = "";
        
        // Extract the numeric part from the invoice number
        const matches = currentInvoiceNo.match(/^([A-Za-z-]*)(\d+)$/);
        if (matches && matches.length >= 3) {
            prefix = matches[1];
            numericPart = parseInt(matches[2]);
        } else {
            // If the format is different, just increment the whole number if possible
            numericPart = parseInt(currentInvoiceNo);
            if (isNaN(numericPart)) {
                numericPart = 0;
            }
        }
        
        // Increment the numeric part
        numericPart++;
        
        // Create the new invoice number
        const nextInvoiceNo = `${prefix}${numericPart}`;
        
        // Save to localStorage for persistence
        localStorage.setItem("lastInvoiceNumber", nextInvoiceNo);
        
        // Also update the server if there's an API for it
        const token = localStorage.getItem("token");
        if (token) {
            try {
                await fetch(`${BASE_URL}/api/invoices/update-counter`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ lastInvoiceNumber: nextInvoiceNo })
                });
                console.log("Invoice counter updated on server");
            } catch (serverError) {
                console.warn("Could not update invoice counter on server, but saved locally", serverError);
            }
        }
        
        console.log(`Invoice number updated for next invoice: ${nextInvoiceNo}`);
        return nextInvoiceNo;
    } catch (error) {
        console.error("Error updating invoice number:", error);
        return null;
    }
}

// MODIFY the fetchLastInvoiceNumber function to check localStorage first
async function fetchLastInvoiceNumber() {
    // First check localStorage for cached invoice number
    const cachedInvoiceNo = localStorage.getItem("lastInvoiceNumber");
    if (cachedInvoiceNo) {
        // If we have a locally stored number, use that
        return cachedInvoiceNo;
    }

    // Otherwise, fetch from server
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
        
        // Cache the result in localStorage
        if (lastInvoiceNumber) {
            localStorage.setItem("lastInvoiceNumber", lastInvoiceNumber);
        }
        
        return lastInvoiceNumber;
    } catch (error) {
        console.error("Error fetching last invoice number:", error);
        displayMessage(error.message);
        return "INV-1000"; // Return a default starting number if all else fails
    }
}

// MODIFY: Initialize invoice number on page load
async function initializeInvoiceNumber() {
    // Fetch the last invoice number
    const lastInvoiceNo = await fetchLastInvoiceNumber();
    
    // Set it in the form field
    if (lastInvoiceNo) {
        document.getElementById("invoice-no").value = lastInvoiceNo;
    } else {
        // Default starting invoice number if none found
        document.getElementById("invoice-no").value = "INV-1000"; 
    }
}

// MODIFY: Add call to initialize invoice number during page load
document.addEventListener("DOMContentLoaded", function() {
    // Existing initialization code
    setupQuantityValidation();
    addQuantityStyles();
    setupSuggestionModal();
    setupNotifications();
    fetchProfile();
    populateItemsTable([]);
    updateActionButtons();
    
    // Add invoice number initialization
    initializeInvoiceNumber();
});

        // Initialize
        setupSuggestionModal();
        setupNotifications();
        fetchProfile();
        populateItemsTable([]);  // Initialize with empty table
        updateActionButtons();   // Replace the next button with print and save buttons
    });
    