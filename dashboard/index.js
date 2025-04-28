
document.addEventListener("DOMContentLoaded", () => {
    const BASE_URL = "http://localhost:3000";
    const messageDiv = document.getElementById("message");
    let notifications = [];
    
    // Notification bell and dropdown elements
    const notificationBell = document.getElementById('notification-bell');
    const notificationDropdown = document.getElementById('notification-dropdown');

    // Initialize dashboard
    fetchProfile();
    setupNotifications();
    fetchDashboardMetrics();
    fetchSalesChartData();
    fetchTopProductsData();
    fetchInventoryItems();
    fetchRecentCustomers();
    fetchLowStockAlerts();
    
    // Setup event listeners
    document.getElementById("refresh-inventory").addEventListener("click", fetchInventoryItems);
    document.getElementById("refresh-customers").addEventListener("click", fetchRecentCustomers);
    
    // Chart period buttons
    document.querySelectorAll(".chart-controls button").forEach(button => {
        button.addEventListener("click", (e) => {
            document.querySelectorAll(".chart-controls button").forEach(btn => btn.classList.remove("active"));
            e.target.classList.add("active");
            updateSalesChart(e.target.dataset.period);
        });
    });
    
    // Notification bell click event
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
    const markAllReadBtn = document.getElementById('mark-all-read');
    markAllReadBtn.addEventListener('click', () => {
        notifications.forEach(notification => {
            notification.read = true;
        });
        updateNotifications();
        saveNotificationsToStorage();
    });
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
    
    // Format currency in INR
    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount);
    }
    
    // Format date
    function formatDate(date) {
        return new Date(date).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    // Get user profile
    async function fetchProfile() {
        const authButton = document.getElementById("auth-btn");
        const usernameSpan = document.getElementById("username");
        const token = localStorage.getItem("token");
        
        if (!token) {
            usernameSpan.textContent = "Guest";
            authButton.textContent = "Login";
            authButton.classList.remove("logout");
            authButton.addEventListener("click", () => {
                window.location.href = "../login/login.html";
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
        } catch (error) {
            console.error("Error fetching profile:", error);
            usernameSpan.textContent = "Guest";
            authButton.textContent = "Login";
            authButton.classList.remove("logout");
            authButton.addEventListener("click", () => {
                window.location.href = "../login/login.html";
            });
        }
    }
    
    // Setup notifications
    function setupNotifications() {
        // Load saved notifications
        loadNotificationsFromStorage();
    }
    
    // Update notifications UI
    function updateNotifications() {
        const notificationCount = document.getElementById('notification-count');
        const notificationList = document.getElementById('notification-list');
        
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
    
    // Fetch dashboard metrics
    async function fetchDashboardMetrics() {
        const token = checkLogin();
        try {
            const response = await fetch(`${BASE_URL}/api/dashboard/metrics`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error("Failed to fetch dashboard metrics");
            
            const data = await response.json();
            
            // Update metrics display
            document.getElementById("total-sales").textContent = formatCurrency(data.totalSales);
            document.getElementById("total-orders").textContent = data.totalOrders;
            document.getElementById("total-products").textContent = data.totalProducts;
            document.getElementById("total-customers").textContent = data.totalCustomers;
            
            // Update change percentages with proper icons
            updateChangeDisplay("sales-change", data.changes.sales);
            updateChangeDisplay("orders-change", data.changes.orders);
            updateChangeDisplay("products-change", data.changes.products);
            updateChangeDisplay("customers-change", data.changes.customers);
            
        } catch (error) {
            console.error("Error fetching dashboard metrics:", error);
            displayMessage("Failed to load dashboard metrics", "error");
        }
    }
    
    // Update change display with correct icon and color
    function updateChangeDisplay(elementId, changePercentage) {
        const element = document.getElementById(elementId);
        let icon, className;
        
        if (changePercentage > 0) {
            icon = "fa-arrow-up";
            className = "positive";
        } else if (changePercentage < 0) {
            icon = "fa-arrow-down";
            className = "negative";
            // Make percentage positive for display
            changePercentage = Math.abs(changePercentage);
        } else {
            icon = "fa-minus";
            className = "neutral";
        }
        
        element.innerHTML = `<i class="fas ${icon}"></i> ${changePercentage}%`;
        element.className = `stat-change ${className}`;
    }
    
    // Fetch sales chart data
    let salesChartInstance = null;
    let monthlySalesData = null;
    
    async function fetchSalesChartData() {
        const token = checkLogin();
        try {
            const response = await fetch(`${BASE_URL}/api/dashboard/sales-chart`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error("Failed to fetch sales chart data");
            
            monthlySalesData = await response.json();
            
            // Initialize the chart with monthly data by default
            initializeSalesChart(monthlySalesData);
            
        } catch (error) {
            console.error("Error fetching sales chart data:", error);
            displayMessage("Failed to load sales chart", "error");
        }
    }
    
    // Initialize the monthly sales chart
    function initializeSalesChart(data) {
        const ctx = document.getElementById('monthlySalesChart').getContext('2d');
        
        if (salesChartInstance) {
            salesChartInstance.destroy();
        }
        
        salesChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Sales',
                    data: data.data,
                    backgroundColor: 'rgba(90, 74, 209, 0.3)',
                    borderColor: 'rgba(90, 74, 209, 1)',
                    borderWidth: 1,
                    borderRadius: 5,
                    hoverBackgroundColor: 'rgba(90, 74, 209, 0.5)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return formatCurrency(context.raw);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Update sales chart based on selected period
    function updateSalesChart(period) {
        if (!monthlySalesData) return;
        
        let labels = [...monthlySalesData.labels];
        let data = [...monthlySalesData.data];
        
        // Transform data based on selected period
        if (period === 'quarter') {
            // Group monthly data into quarters
            labels = ['Q1', 'Q2', 'Q3', 'Q4'];
            data = [
                data.slice(0, 3).reduce((sum, val) => sum + val, 0),
                data.slice(3, 6).reduce((sum, val) => sum + val, 0),
                data.slice(6, 9).reduce((sum, val) => sum + val, 0),
                data.slice(9, 12).reduce((sum, val) => sum + val, 0)
            ];
        } else if (period === 'year') {
            // Show yearly total
            labels = [new Date().getFullYear().toString()];
            data = [data.reduce((sum, val) => sum + val, 0)];
        }
        
        // Update chart
        salesChartInstance.data.labels = labels;
        salesChartInstance.data.datasets[0].data = data;
        salesChartInstance.update();
    }
    
    // Fetch top products data for chart
    async function fetchTopProductsData() {
        const token = checkLogin();
        try {
            const response = await fetch(`${BASE_URL}/api/dashboard/top-products`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error("Failed to fetch top products data");
            
            const data = await response.json();
            
            initializeTopProductsChart(data);
            
        } catch (error) {
            console.error("Error fetching top products data:", error);
            displayMessage("Failed to load top products chart", "error");
        }
    }
    
    // Initialize the top products chart
    function initializeTopProductsChart(data) {
        const ctx = document.getElementById('topProductsChart').getContext('2d');
        
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.data,
                    backgroundColor: [
                        'rgba(90, 74, 209, 0.7)',
                        'rgba(245, 158, 11, 0.7)',
                        'rgba(59, 130, 246, 0.7)',
                        'rgba(56, 193, 114, 0.7)',
                        'rgba(239, 68, 68, 0.7)'
                    ],
                    borderColor: [
                        'rgba(90, 74, 209, 1)',
                        'rgba(245, 158, 11, 1)',
                        'rgba(59, 130, 246, 1)',
                        'rgba(56, 193, 114, 1)',
                        'rgba(239, 68, 68, 1)'
                    ],
                    borderWidth: 1,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            font: {
                                size: 12
                            },
                            padding: 15,
                            usePointStyle: true,
                            boxWidth: 8
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const percentage = Math.round((value / data.data.reduce((a, b) => a + b, 0)) * 100);
                                return `${label}: ${value} units (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }
    
    // Fetch inventory items
    async function fetchInventoryItems() {
        const token = checkLogin();
        
        // Show loading state
        const tableBody = document.getElementById("inventory-table-body");
        tableBody.innerHTML = '';
        tableBody.className = 'loading';
        
        try {
            const response = await fetch(`${BASE_URL}/api/items`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error("Failed to fetch inventory data");
            
            const items = await response.json();
            
            // Remove loading state
            tableBody.className = '';
            
            // Sort items by profit margin (descending)
            const sortedItems = items.sort((a, b) => {
                const marginA = (a.profit / a.price) * 100;
                const marginB = (b.profit / b.price) * 100;
                return marginB - marginA;
            });
            
            // Render top items (limit to 5)
            const topItems = sortedItems.slice(0, 5);
            renderInventoryItems(topItems);
            
        } catch (error) {
            console.error("Error fetching inventory:", error);
            displayMessage("Failed to load inventory data", "error");
            
            // Remove loading state
            tableBody.className = '';
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center">Failed to load data. Please try again.</td></tr>`;
        }
    }
    
    // Render inventory items with profit analysis
    function renderInventoryItems(items) {
        const tableBody = document.getElementById("inventory-table-body");
        tableBody.innerHTML = '';
        
        if (items.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center">No inventory items found.</td></tr>`;
            return;
        }
        
        items.forEach(item => {
            // Calculate profit margin
            const profitMargin = item.profit && item.price ? (item.profit / item.price) * 100 : 0;
            
            // Determine profit margin category
            let marginCategory;
            if (profitMargin >= 30) {
                marginCategory = 'profit-high';
            } else if (profitMargin >= 15) {
                marginCategory = 'profit-medium';
            } else {
                marginCategory = 'profit-low';
            }
            
            // Calculate potential profit (profit * quantity)
            const potentialProfit = item.profit * item.quantity;
            
            // Determine stock level category
            let stockCategory;
            if (item.quantity <= 5) {
                stockCategory = 'stock-low';
            } else if (item.quantity <= 20) {
                stockCategory = 'stock-medium';
            } else {
                stockCategory = 'stock-high';
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.name}</td>
                <td>${formatCurrency(item.price)}</td>
                <td>${formatCurrency(item.profit)}</td>
                <td><span class="profit-indicator ${marginCategory}">${profitMargin.toFixed(1)}%</span></td>
                <td><span class="stock-indicator ${stockCategory}"></span>${item.quantity}</td>
                <td>${formatCurrency(potentialProfit)}</td>
            `;
            
            tableBody.appendChild(row);
        });
    }
    
   async function fetchRecentCustomers() {
    const token = checkLogin();
    
    // Show loading state
    const tableBody = document.getElementById("customers-table-body");
    tableBody.innerHTML = '';
    tableBody.className = 'loading';
    
    try {
        const response = await fetch(`${BASE_URL}/api/billing?limit=50`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error("Failed to fetch billing data");
        
        const data = await response.json();
        const billingRecords = data.records || []; // Ensure this is correctly referenced

        // Remove loading state
        tableBody.className = '';
        
        if (billingRecords.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center">No customer data found.</td></tr>`;
            return;
        }
        
        // Process billing records to get customer data
        const customerMap = new Map();
        
        billingRecords.forEach(record => {
            const { customerPhone, customerName, invoiceDate, items, grandTotal } = record;
            
            if (!customerPhone) return; // Skip if no phone number
            
            if (!customerMap.has(customerPhone)) {
                customerMap.set(customerPhone, {
                    name: customerName || 'Unknown',
                    phone: customerPhone,
                    orderCount: 0,
                    totalSpent: 0,
                    lastOrderDate: null
                });
            }
            
            const customer = customerMap.get(customerPhone);
            customer.orderCount++;
            customer.totalSpent += parseFloat(grandTotal) || 0;
            
            // Update last order date if this order is more recent
            const orderDate = new Date(invoiceDate);
            if (!customer.lastOrderDate || orderDate > customer.lastOrderDate) {
                customer.lastOrderDate = orderDate;
            }
        });
        
        // Convert map to array and sort by total spent (descending)
        const customers = Array.from(customerMap.values())
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, 5); // Show top 5 customers
        
        renderRecentCustomers(customers);
        
    } catch (error) {
        console.error("Error fetching customer data:", error);
        displayMessage("Failed to load customer data", "error");
        
        // Remove loading state
        tableBody.className = '';
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center">Failed to load data. Please try again.</td></tr>`;
    }
}
    // Render recent customers table
    function renderRecentCustomers(customers) {
        const tableBody = document.getElementById("customers-table-body");
        tableBody.innerHTML = '';
        
        customers.forEach(customer => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${customer.name}</td>
                <td>${customer.phone}</td>
                <td>${customer.orderCount}</td>
                <td>${formatCurrency(customer.totalSpent)}</td>
                <td>${customer.lastOrderDate ? formatDate(customer.lastOrderDate) : 'N/A'}</td>
            `;
            
            tableBody.appendChild(row);
        });
    }
    
    // Fetch low stock alerts
    async function fetchLowStockAlerts() {
        const token = checkLogin();
        try {
            const response = await fetch(`${BASE_URL}/api/inventory/low-stock`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error("Failed to fetch low stock alerts");
            
            const items = await response.json();
            
            // Update low stock count
            const lowStockCount = document.getElementById("low-stock-count");
            lowStockCount.textContent = items.length;
            
            // Render low stock items
            renderLowStockAlerts(items);
            
            // Create notifications for critical items
            const criticalItems = items.filter(item => item.status === 'critical');
            if (criticalItems.length > 0) {
                criticalItems.forEach(item => {
                    addStockNotification(item);
                });
                updateNotifications();
                saveNotificationsToStorage();
            }
            
        } catch (error) {
            console.error("Error fetching low stock alerts:", error);
            displayMessage("Failed to load low stock alerts", "error");
        }
    }
    
    // Render low stock alerts
    function renderLowStockAlerts(items) {
        const alertsContainer = document.getElementById("low-stock-alerts");
        alertsContainer.innerHTML = '';
        
        if (items.length === 0) {
            alertsContainer.innerHTML = `
                <div class="empty-alerts">
                    <i class="fas fa-check-circle"></i>
                    <p>No low stock items. Inventory levels are healthy!</p>
                </div>
            `;
            return;
        }
        
        items.forEach(item => {
            const alertItem = document.createElement('div');
            alertItem.className = `alert-item ${item.status}`;
            
            // Calculate percentage of current stock compared to reorder level
            const stockPercentage = Math.min(100, Math.round((item.currentStock / item.reorderLevel) * 100));
            
            alertItem.innerHTML = `
                <div class="alert-item-title">
                    ${item.name}
                    <span class="status ${item.status}">${item.status}</span>
                </div>
                <div class="alert-item-details">
                    <span>Stock: ${item.currentStock} / ${item.reorderLevel}</span>
                    <span>${stockPercentage}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress ${item.status}" style="width: ${stockPercentage}%"></div>
                </div>
                <a href="../inventory/index.html" class="alert-item-action">Manage Stock</a>
            `;
            
            alertsContainer.appendChild(alertItem);
        });
    }
    
    // Add a notification for critical stock
    function addStockNotification(item) {
        // Check if notification already exists
        const existingNotification = notifications.find(
            n => n.type === 'low-stock' && n.itemName === item.name
        );
        
        if (existingNotification) return; // Skip if already notified
        
        notifications.push({
            type: 'low-stock',
            title: 'Critical Low Stock Alert',
            message: `${item.name} is critically low with only ${item.currentStock} units left`,
            timestamp: new Date(),
            itemName: item.name,
            read: false,
            priority: 'high'
        });
    }
});