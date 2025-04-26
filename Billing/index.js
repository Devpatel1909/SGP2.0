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
        console.log("Fetching last invoice number...");
        
        // First check localStorage for cached invoice number
        const cachedInvoiceNo = localStorage.getItem("lastInvoiceNumber");
        if (cachedInvoiceNo) {
            console.log("Using cached invoice number from localStorage:", cachedInvoiceNo);
            return cachedInvoiceNo;
        }

        const token = localStorage.getItem("token");
        if (!token) {
            console.warn("No auth token found, using default invoice number");
            return "INV-1000";
        }
        
        try {
            const response = await fetch(`${BASE_URL}/api/invoices/last`, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
            if (!response.ok) {
                console.warn(`API returned status ${response.status}`);
                throw new Error("Failed to fetch last invoice number");
            }

            const data = await response.json();
            const lastInvoiceNumber = data.lastInvoiceNumber;
            
            console.log("API returned last invoice number:", lastInvoiceNumber);
            
            // Cache the result in localStorage
            if (lastInvoiceNumber) {
                localStorage.setItem("lastInvoiceNumber", lastInvoiceNumber);
            }
            
            return lastInvoiceNumber;
        } catch (error) {
            console.error("Error fetching last invoice number:", error);
            return "INV-1000"; // Return a default starting number if all else fails
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

  // Improved updateTotals function with better calculation
function updateTotals() {
    const rows = document.querySelectorAll("#bill-items tr");
    let subtotal = 0;

    // Calculate row totals and sum them for subtotal
    rows.forEach(row => {
        const price = parseFloat(row.querySelector(".item-price").value) || 0;
        const quantity = parseInt(row.querySelector(".item-quantity").value) || 0;
        const itemTotal = price * quantity;

        // Update the row total display
        row.querySelector(".item-total").textContent = `₹${itemTotal.toFixed(2)}`;
        
        // Add to subtotal only if this is a valid item (has an ID)
        if (row.querySelector(".product-id").value.trim() !== "") {
            subtotal += itemTotal;
        }
    });

    // Calculate tax and grand total
    const tax = subtotal * 0.10; // 10% tax
    const grandTotal = subtotal + tax;

    // Update the displayed totals
    const subtotalElement = document.getElementById("subtotal");
    const taxElement = document.getElementById("tax");
    const grandTotalElement = document.getElementById("grand-total");
    
    if (subtotalElement) subtotalElement.textContent = `₹${subtotal.toFixed(2)}`;
    if (taxElement) taxElement.textContent = `₹${tax.toFixed(2)}`;
    if (grandTotalElement) grandTotalElement.textContent = `₹${grandTotal.toFixed(2)}`;
    
    console.log(`Totals updated: Subtotal=${subtotal.toFixed(2)}, Tax=${tax.toFixed(2)}, Total=${grandTotal.toFixed(2)}`);
}

// Improved collectInvoiceData function with better calculation
function collectInvoiceData() {
    console.log("Collecting invoice data from form...");
    
    // Calculate totals from displayed values
    const subtotalElement = document.getElementById("subtotal");
    const taxElement = document.getElementById("tax");
    const grandTotalElement = document.getElementById("grand-total");
    
    const subtotal = subtotalElement ? parseFloat(subtotalElement.textContent.replace('₹', '')) || 0 : 0;
    const tax = taxElement ? parseFloat(taxElement.textContent.replace('₹', '')) || 0 : 0;
    const grandTotal = grandTotalElement ? parseFloat(grandTotalElement.textContent.replace('₹', '')) || 0 : 0;
    
    // Get items with proper calculation
    const rows = document.querySelectorAll("#bill-items tr");
    const items = [];
    
    Array.from(rows).forEach(row => {
        const productId = row.querySelector(".product-id").value.trim();
        if (productId !== "") {
            const name = row.querySelector(".product-name").value;
            const price = parseFloat(row.querySelector(".item-price").value) || 0;
            const quantity = parseInt(row.querySelector(".item-quantity").value) || 0;
            
            // Calculate the item total directly to ensure accuracy
            const total = price * quantity;
            
            // Only add items with positive quantity
            if (quantity > 0) {
                items.push({
                    name: name,
                    id: productId,
                    price: price,
                    quantity: quantity,
                    total: total
                });
            } else {
                console.warn(`Skipping item ${name} with zero quantity`);
            }
        }
    });
    
    console.log(`Collected ${items.length} valid items for billing, Total: ₹${grandTotal.toFixed(2)}`);
    
    // Return the full invoice data object
    return {
        customerName: document.getElementById("customer-name").value,
        customerPhone: document.getElementById("customer-phone").value,
        customerEmail: document.getElementById("customer-email").value || "",
        customerAddress: document.getElementById("customer-address").value || "",
        invoiceDate: document.getElementById("invoice-date").value,
        invoiceNo: document.getElementById("invoice-no").value,
        cashier: document.getElementById("cashier-name").value,
        paymentMethod: document.getElementById("payment-method").value,
        paymentStatus: document.getElementById("payment-status").value,
        paymentNote: document.getElementById("payment-note").value || "",
        items: items,
        subtotal: subtotal,
        tax: tax,
        grandTotal: grandTotal
    };
}




// Helper function to save billing with specific data (used for retrying with new invoice number)
async function saveBillingWithData(invoiceData) {
    const token = localStorage.getItem("token");
    if (!token) {
        displayMessage("You must be logged in to create invoices", "error");
        return;
    }
    
    try {
        // Show a "saving" message
        displayMessage("Saving invoice with new number...", "info");
        
        // Save the invoice to the server
        const response = await fetch(`${BASE_URL}/api/billing`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(invoiceData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || "Failed to save invoice with new number");
        }
        
        // Invoice saved successfully - now update inventory
        console.log("Invoice saved successfully with new number, updating inventory...");
        displayMessage("Invoice saved, updating inventory...", "info");
        
        // Update inventory for this invoice
        await updateInventoryForInvoice(invoiceData);
        
        // Generate next invoice number
        const nextInvoiceNumber = generateNextInvoiceNumber(invoiceData.invoiceNo);
        localStorage.setItem("lastInvoiceNumber", nextInvoiceNumber);
        
        // Display success message
        displayMessage("Invoice saved and inventory updated successfully!", "success");
        
        // Ask user if they want to create a new invoice
        const resetForm = confirm("Invoice saved successfully! Clear the form for a new invoice?");
        if (resetForm) {
            resetBillingForm(nextInvoiceNumber);
        } else {
            // Reload the page after a short delay
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        }
        
    } catch (error) {
        console.error("Error saving invoice with new number:", error);
        displayMessage(`Error: ${error.message}`, "error");
    }
}

// Function to update inventory specifically for an invoice
async function updateInventoryForInvoice(invoiceData) {
    const token = localStorage.getItem("token");
    if (!token) return;
    
    try {
        // Get current inventory items
        const inventoryResponse = await fetch(`${BASE_URL}/api/items`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });
        
        if (!inventoryResponse.ok) {
            throw new Error("Failed to fetch current inventory data");
        }
        
        const inventoryItems = await inventoryResponse.json();
        console.log(`Fetched ${inventoryItems.length} inventory items for update`);
        
        // Process each item in the invoice to update inventory
        let updatedCount = 0;
        let errorCount = 0;
        
        for (const item of invoiceData.items) {
            try {
                // Find the matching inventory item
                const inventoryItem = inventoryItems.find(invItem => 
                    invItem.id.toString() === item.id.toString());
                
                if (!inventoryItem) {
                    console.error(`Item not found in inventory: ID=${item.id}, Name=${item.name}`);
                    errorCount++;
                    continue;
                }
                
                // Calculate new quantity
                const currentQuantity = inventoryItem.quantity || 0;
                const billQuantity = item.quantity || 0;
                const newQuantity = Math.max(0, currentQuantity - billQuantity);
                
                console.log(`Updating inventory for ${item.name} (ID: ${item.id})`);
                console.log(`Current stock: ${currentQuantity}, Bill quantity: ${billQuantity}, New stock: ${newQuantity}`);
                
                // Update the inventory via API
                const updateResponse = await fetch(`${BASE_URL}/api/items/${item.id}`, {
                    method: "PUT",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        name: inventoryItem.name,
                        quantity: newQuantity,
                        price: inventoryItem.price,
                        profit: inventoryItem.profit || 0,
                        expiry: inventoryItem.expiry || null
                    })
                });
                
                if (!updateResponse.ok) {
                    const errorData = await updateResponse.text();
                    console.error(`Failed to update inventory for item ${item.name}:`, errorData);
                    errorCount++;
                } else {
                    console.log(`Successfully updated inventory for ${item.name}`);
                    updatedCount++;
                }
            } catch (itemError) {
                console.error(`Error processing item ${item.name}:`, itemError);
                errorCount++;
            }
        }
        
        console.log(`Inventory update completed: ${updatedCount} items updated, ${errorCount} errors`);
        
        if (errorCount > 0) {
            displayMessage(`Inventory partially updated: ${updatedCount} items updated, ${errorCount} failed`, "warning");
        } else {
            displayMessage(`All ${updatedCount} items successfully updated in inventory`, "success");
        }
        
        return { updatedCount, errorCount };
    } catch (error) {
        console.error("Error updating inventory:", error);
        displayMessage("Warning: Invoice was saved but inventory update may be incomplete", "warning");
        throw error;
    }
}


// Helper function to update a single row's total with proper calculation
function updateRowTotal(row) {
    if (!row) return;
    
    // Get the price and quantity inputs
    const priceInput = row.querySelector(".item-price");
    const quantityInput = row.querySelector(".item-quantity");
    const totalCell = row.querySelector(".item-total");
    
    if (!priceInput || !quantityInput || !totalCell) return;
    
    // Parse values with fallbacks to zero
    const price = parseFloat(priceInput.value) || 0;
    const quantity = parseInt(quantityInput.value) || 0;
    
    // Calculate the item total
    const itemTotal = price * quantity;
    
    // Update the total display
    totalCell.textContent = `₹${itemTotal.toFixed(2)}`;
    
    // Log for debugging
    console.log(`Row updated: Price=${price.toFixed(2)}, Quantity=${quantity}, Total=${itemTotal.toFixed(2)}`);
}

// Make sure we register an event listener for changes to quantity inputs
document.addEventListener("input", (event) => {
    // Update row totals when quantity or price changes
    if (event.target.classList.contains("item-quantity") || event.target.classList.contains("item-price")) {
        const row = event.target.closest('tr');
        if (row) {
            updateRowTotal(row);
            updateTotals();
        }
    }
});


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
        
        // New function to ensure invoice number is visible
        function ensureInvoiceNumberIsVisible() {
            console.log("Ensuring invoice number is visible...");
            
            // Check if the invoice number element exists
            const invoiceNoElement = document.getElementById("invoice-no");
            if (!invoiceNoElement) {
                console.error("Invoice number element not found in the DOM!");
                return;
            }
            
            // If the invoice number is empty, initialize it
            if (!invoiceNoElement.value || invoiceNoElement.value.trim() === "") {
                console.log("Invoice number is empty, initializing...");
                
                // Try to initialize it
                initializeInvoiceNumber()
                    .then(() => {
                        console.log("Invoice number initialized:", invoiceNoElement.value);
                    })
                    .catch(error => {
                        console.error("Error initializing invoice number:", error);
                        
                        // Set a default if initialization fails
                        invoiceNoElement.value = "INV-" + Math.floor(1000 + Math.random() * 9000);
                        console.log("Set default invoice number:", invoiceNoElement.value);
                    });
            } else {
                console.log("Invoice number already set:", invoiceNoElement.value);
            }
        }
        
        // Improved initializeInvoiceNumber function
async function initializeInvoiceNumber() {
    console.log("Initializing invoice number...");
    try {
        // Try to get a new invoice number from the server first
        const response = await fetch(`${BASE_URL}/api/invoices/new`, {
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
                "Content-Type": "application/json"
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log("Got new invoice number from server:", data.invoiceNo);
            
            const invoiceNoElement = document.getElementById("invoice-no");
            if (invoiceNoElement) {
                invoiceNoElement.value = data.invoiceNo;
                return;
            }
        } else {
            console.warn("Could not get new invoice from server, falling back to last invoice number");
        }
        
        // Fall back to the previous approach if the server request fails
        const lastInvoiceNumber = await fetchLastInvoiceNumber();
        console.log("Got last invoice number:", lastInvoiceNumber);
        
        const invoiceNoElement = document.getElementById("invoice-no");
        if (!invoiceNoElement) {
            console.error("Invoice number element not found!");
            return;
        }
        
        if (lastInvoiceNumber) {
            // Parse the number portion and increment it
            let numericPart = 0;
            let prefix = "";
            
            // Extract the numeric part from the invoice number
            const matches = lastInvoiceNumber.match(/^([A-Za-z-]*)(\d+)$/);
            if (matches && matches.length >= 3) {
                prefix = matches[1];
                numericPart = parseInt(matches[2]) + 1;
            } else {
                // If format is different, just increment the whole number if possible
                numericPart = parseInt(lastInvoiceNumber) + 1;
                if (isNaN(numericPart)) {
                    numericPart = 1000; // Default starting number
                    prefix = "INV-";
                }
            }
            
            // Set the new invoice number
            const invoiceNo = `${prefix}${numericPart}`;
            invoiceNoElement.value = invoiceNo;
            console.log("Set new invoice number:", invoiceNo);
        } else {
            // Set a default invoice number if none was found
            invoiceNoElement.value = "INV-1000";
            console.log("Set default invoice number: INV-1000");
        }
    } catch (error) {
        console.error("Error initializing invoice number:", error);
        
        // Set a default invoice number in case of error
        const invoiceNoElement = document.getElementById("invoice-no");
        if (invoiceNoElement) {
            invoiceNoElement.value = "INV-1000";
            console.log("Set default invoice number due to error: INV-1000");
        }
    }
}


// Helper function to generate the next invoice number
function generateNextInvoiceNumber(currentInvoiceNo) {
    // Parse the current invoice number
    let prefix = "";
    let numericPart = 0;
    
    // Extract the numeric part from the invoice number
    const matches = currentInvoiceNo.match(/^([A-Za-z-]*)(\d+)$/);
    if (matches && matches.length >= 3) {
        prefix = matches[1];
        numericPart = parseInt(matches[2]);
    } else {
        // If format is different, just use defaults
        prefix = "INV-";
        numericPart = 1000;
    }
    
    // Increment the numeric part
    numericPart++;
    
    // Create the new invoice number
    return `${prefix}${numericPart}`;
}

// Helper function to reset the billing form with a new invoice number
function resetBillingForm(newInvoiceNumber) {
    // Clear customer information
    document.getElementById("customer-name").value = "";
    document.getElementById("customer-phone").value = "";
    document.getElementById("customer-email").value = "";
    document.getElementById("customer-address").value = "";
    
    // Clear existing items
    const billItemsContainer = document.getElementById("bill-items");
    billItemsContainer.innerHTML = "";
    
    // Add an empty row
    addNewRow();
    
    // Reset payment information
    document.getElementById("payment-method").value = "";
    document.getElementById("payment-status").value = "pending";
    document.getElementById("payment-note").value = "";
    
    // Set the invoice date to today
    const today = new Date();
    document.getElementById("invoice-date").value = today.toISOString().split('T')[0];
    
    // Set the new invoice number
    document.getElementById("invoice-no").value = newInvoiceNumber;
    
    // Reset totals
    updateTotals();
    
    // Focus on the customer name field
    document.getElementById("customer-name").focus();
}

// Function to update inventory after successful billing save
async function updateInventoryAfterSave(invoiceData) {
    const token = localStorage.getItem("token");
    if (!token) return;
    
    try {
        // Get current inventory items
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
        
        // Update each item's quantity
        const updatePromises = invoiceData.items.map(async (item) => {
            try {
                const currentItem = allItems.find(i => i.id == item.id);
                
                if (!currentItem) {
                    console.warn(`Item with ID ${item.id} not found in inventory, skipping update`);
                    return null;
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
                    console.warn(`Failed to update inventory for item ${item.id}, continuing with others`);
                }
                
                return updateResponse.ok;
            } catch (error) {
                console.error(`Error updating inventory for item ${item.id}:`, error);
                return false;
            }
        });
        
        // Wait for all inventory updates to complete
        await Promise.all(updatePromises);
        console.log("Inventory updated successfully");
        
    } catch (error) {
        console.error("Error updating inventory:", error);
        displayMessage("Invoice was saved but inventory update failed", "warning");
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
async function saveBilling() {
    // STEP 1: Validate the form
    if (!validateBillingForm()) {
        displayMessage("Please fill in all required fields", "error");
        return;
    }
    
    // STEP 2: Stock validation with override option
    if (!validateStockLevels()) {
        const confirmOverride = confirm("Some items exceed available stock! Do you want to continue anyway?");
        if (!confirmOverride) {
            return;
        }
    }
    
    // STEP 3: Collect the invoice data
    const invoiceData = collectInvoiceData();
    console.log("Preparing to save invoice:", invoiceData.invoiceNo);
    
    // STEP 4: Get authentication token
    const token = localStorage.getItem("token");
    if (!token) {
        displayMessage("You must be logged in to create invoices", "error");
        window.location.href = "../login/login.html";
        return;
    }
    
    try {
        // STEP 5: Show saving message
        displayMessage("Saving invoice...", "info");
        
        // STEP 6: Save the invoice to the server
        const response = await fetch(`${BASE_URL}/api/billing`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(invoiceData)
        });
        
        // STEP 7: Handle different response types
        if (!response.ok) {
            // Try to parse response as JSON
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                // If not JSON, get as text
                const errorText = await response.text();
                throw new Error(errorText || "Failed to save invoice");
            }
            
            // Handle duplicate invoice number
            if (response.status === 409) {
                console.log("Duplicate invoice number detected:", invoiceData.invoiceNo);
                
                if (errorData.suggestedInvoiceNo) {
                    // Update the invoice number in the form
                    document.getElementById("invoice-no").value = errorData.suggestedInvoiceNo;
                    
                    // Ask user if they want to retry with the new number
                    const confirmRetry = confirm(`Invoice number ${invoiceData.invoiceNo} already exists. Would you like to try again with the new number ${errorData.suggestedInvoiceNo}?`);
                    
                    if (confirmRetry) {
                        // Update the invoice data with the new number
                        invoiceData.invoiceNo = errorData.suggestedInvoiceNo;
                        
                        // Retry with the new invoice number (recursive call)
                        saveBillingWithData(invoiceData);
                    }
                    
                    return;
                }
            }
            
            throw new Error(errorData.message || "Failed to save invoice");
        }
        
        // STEP 8: Success - invoice saved
        const savedData = await response.json();
        console.log("Invoice saved successfully:", savedData);
        
        // STEP 9: Update inventory
        displayMessage("Invoice saved, updating inventory...", "info");
        
        // STEP 10: Get current inventory data
        const inventoryResponse = await fetch(`${BASE_URL}/api/items`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });
        
        if (!inventoryResponse.ok) {
            throw new Error("Failed to fetch inventory for update");
        }
        
        const inventoryItems = await inventoryResponse.json();
        console.log(`Fetched ${inventoryItems.length} inventory items for update`);
        
        // STEP 11: Update each item in inventory
        let updatedCount = 0;
        let errorCount = 0;
        
        for (const item of invoiceData.items) {
            try {
                // Find corresponding inventory item
                const inventoryItem = inventoryItems.find(invItem => 
                    invItem.id.toString() === item.id.toString());
                
                if (!inventoryItem) {
                    console.error(`Item not found in inventory: ID=${item.id}, Name=${item.name}`);
                    errorCount++;
                    continue;
                }
                
                // Calculate new quantity
                const currentQuantity = parseInt(inventoryItem.quantity) || 0;
                const billQuantity = parseInt(item.quantity) || 0;
                const newQuantity = Math.max(0, currentQuantity - billQuantity);
                
                console.log(`Updating inventory for ${item.name} (ID: ${item.id})`);
                console.log(`Current stock: ${currentQuantity}, Bill quantity: ${billQuantity}, New stock: ${newQuantity}`);
                
                // Update the inventory via API
                const updateResponse = await fetch(`${BASE_URL}/api/items/${item.id}`, {
                    method: "PUT",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        name: inventoryItem.name,
                        quantity: newQuantity,
                        price: parseFloat(inventoryItem.price),
                        profit: parseFloat(inventoryItem.profit || 0),
                        expiry: inventoryItem.expiry || null
                    })
                });
                
                if (!updateResponse.ok) {
                    const errorInfo = await updateResponse.text();
                    console.error(`Failed to update inventory for item ${item.name}:`, errorInfo);
                    errorCount++;
                } else {
                    console.log(`Successfully updated inventory for ${item.name}`);
                    updatedCount++;
                }
            } catch (itemError) {
                console.error(`Error processing item ${item.name}:`, itemError);
                errorCount++;
            }
        }
        
        // STEP 12: Report inventory update results
        console.log(`Inventory update completed: ${updatedCount} items updated, ${errorCount} errors`);
        
        if (errorCount > 0) {
            displayMessage(`Inventory partially updated: ${updatedCount} items updated, ${errorCount} failed`, "warning");
        } else {
            displayMessage(`Invoice saved and all ${updatedCount} items successfully updated in inventory`, "success");
        }
        
        // STEP 13: Generate next invoice number for future use
        const nextInvoiceNumber = generateNextInvoiceNumber(invoiceData.invoiceNo);
        document.getElementById("invoice-no").value = nextInvoiceNumber;
        localStorage.setItem("lastInvoiceNumber", nextInvoiceNumber);
        
        // STEP 14: Ask user if they want to reset form
        if (confirm("Invoice saved successfully! Clear the form for a new invoice?")) {
            resetBillingForm(nextInvoiceNumber);
        } else {
            // Reload the page after a short delay
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        }
        
    } catch (error) {
        console.error("Error saving invoice:", error);
        displayMessage(`Error: ${error.message}`, "error");
    }
}

// Helper function to save billing with specific data (used for retrying with new invoice number)
async function saveBillingWithData(invoiceData) {
    const token = localStorage.getItem("token");
    if (!token) {
        displayMessage("You must be logged in to create invoices", "error");
        return;
    }
    
    try {
        // Show a "saving" message
        displayMessage("Saving invoice with new number...", "info");
        
        // Save the invoice to the server
        const response = await fetch(`${BASE_URL}/api/billing`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(invoiceData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || "Failed to save invoice with new number");
        }
        
        // Invoice saved successfully - now update inventory
        console.log("Invoice saved successfully with new number, updating inventory...");
        displayMessage("Invoice saved, updating inventory...", "info");
        
        // Update inventory for this invoice
        await updateInventoryForInvoice(invoiceData);
        
        // Generate next invoice number
        const nextInvoiceNumber = generateNextInvoiceNumber(invoiceData.invoiceNo);
        localStorage.setItem("lastInvoiceNumber", nextInvoiceNumber);
        
        // Display success message
        displayMessage("Invoice saved and inventory updated successfully!", "success");
        
        // Ask user if they want to create a new invoice
        const resetForm = confirm("Invoice saved successfully! Clear the form for a new invoice?");
        if (resetForm) {
            resetBillingForm(nextInvoiceNumber);
        } else {
            // Reload the page after a short delay
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        }
        
    } catch (error) {
        console.error("Error saving invoice with new number:", error);
        displayMessage(`Error: ${error.message}`, "error");
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



// Initialize the invoice number when the page loads
async function initializeInvoicePage() {
    try {
        // Fetch a new invoice number from the server
        const token = localStorage.getItem("token");
        if (!token) return;
        
        const response = await fetch(`${BASE_URL}/api/invoices/new`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });
        
        if (!response.ok) throw new Error("Failed to get new invoice number");
        
        const { invoiceNo } = await response.json();
        
        // Set the invoice number in the form
        document.getElementById("invoice-no").value = invoiceNo;
    } catch (error) {
        console.error("Error initializing invoice:", error);
        displayMessage(error.message, "error");
    }
}

// Set current date
document.getElementById("invoice-date").value = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

// Initialize
setupSuggestionModal();
setupNotifications();
fetchProfile();
populateItemsTable([]);  // Initialize with empty table
updateActionButtons();   // Replace the next button with print and save buttons
console.log("DOM loaded, initializing invoice number...");
setTimeout(ensureInvoiceNumberIsVisible, 500); // Added to fix invoice number visibility
});