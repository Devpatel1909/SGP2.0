document.addEventListener("DOMContentLoaded", () => {
    const BASE_URL = "http://localhost:3000";
    const customersTable = document.getElementById("customers-table");
    const messageDiv = document.getElementById("message");
    const customerModal = document.getElementById("customer-modal");
    
    // Notification variables
    let notifications = [];
    const notificationBell = document.getElementById('notification-bell');
    const notificationDropdown = document.getElementById('notification-dropdown');
    const notificationCount = document.getElementById('notification-count');
    const notificationList = document.getElementById('notification-list');
    const markAllReadBtn = document.getElementById('mark-all-read');
    
    // Pagination variables
    let currentPage = 1;
    let totalPages = 1;
    let pageSize = 10;
    let customers = [];
    let filteredCustomers = [];
    
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
        }
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
            if (notification.type === 'customer') icon = 'fas fa-user';
            
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

    // Fetch all billing data to extract customers
    async function fetchBillingData() {
        const token = checkLogin();
        try {
            const response = await fetch(`${BASE_URL}/api/billing`, {
                headers: { 
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
            });
            if (!response.ok) throw new Error("Failed to fetch billing data");
            
            const billingData = await response.json();
            processCustomers(billingData);
            return billingData;
        } catch (error) {
            displayMessage(error.message);
            return [];
        }
    }
    
    // Process billing data to extract unique customers
    function processCustomers(billingData) {
        // Create a map to track unique customers and their orders
        const customerMap = new Map();
        
        billingData.forEach(bill => {
            // Use phone as unique identifier
            const customerId = bill.customerPhone;
            
            if (!customerMap.has(customerId)) {
                // Initialize new customer
                customerMap.set(customerId, {
                    id: customerId, // Using phone as ID
                    name: bill.customerName,
                    phone: bill.customerPhone,
                    email: bill.customerEmail || 'N/A',
                    address: bill.customerAddress || 'N/A',
                    orders: [],
                    totalSpent: 0,
                    lastOrderDate: new Date(bill.invoiceDate)
                });
            }
            
            // Get the customer object
            const customer = customerMap.get(customerId);
            
            // Add this bill to the customer's orders
            customer.orders.push({
                invoiceNo: bill.invoiceNo,
                date: new Date(bill.invoiceDate),
                items: bill.items,
                total: bill.items.reduce((sum, item) => sum + item.total, 0),
                status: bill.paymentStatus
            });
            
            // Update total spent
            customer.totalSpent += bill.items.reduce((sum, item) => sum + item.total, 0);
            
            // Update last order date if this order is more recent
            const billDate = new Date(bill.invoiceDate);
            if (billDate > customer.lastOrderDate) {
                customer.lastOrderDate = billDate;
            }
        });
        
        // Convert map to array
        customers = Array.from(customerMap.values());
        
        // Sort customers by last order date (most recent first)
        customers.sort((a, b) => b.lastOrderDate - a.lastOrderDate);
        
        // Initialize filtered customers
        filteredCustomers = [...customers];
        
        // Update total pages
        totalPages = Math.ceil(customers.length / pageSize);
        
        // Update pagination controls
        updatePaginationControls();
        
        // Update customer stats
        updateCustomerStats();
        
        // Render the current page
        renderCustomersPage();
    }
    
    // Update customer statistics
    function updateCustomerStats() {
        // Update total customers count
        document.getElementById('total-customers').textContent = customers.length;
        
        // Calculate total orders
        const totalOrders = customers.reduce((sum, customer) => sum + customer.orders.length, 0);
        document.getElementById('total-orders').textContent = totalOrders;
        
        // Calculate total revenue
        const totalRevenue = customers.reduce((sum, customer) => sum + customer.totalSpent, 0);
        document.getElementById('total-revenue').textContent = formatCurrency(totalRevenue);
        
        // Calculate average order value
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        document.getElementById('avg-order-value').textContent = formatCurrency(avgOrderValue);
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
    
    // Update pagination controls
    function updatePaginationControls() {
        document.getElementById('current-page').textContent = currentPage;
        document.getElementById('total-pages').textContent = totalPages;
        
        // Enable/disable previous button
        document.getElementById('prev-page').disabled = currentPage <= 1;
        
        // Enable/disable next button
        document.getElementById('next-page').disabled = currentPage >= totalPages;
    }
    
    // Render the current page of customers
    function renderCustomersPage() {
        const tbody = customersTable.querySelector("tbody");
        tbody.innerHTML = "";
        
        // Calculate start and end index for current page
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, filteredCustomers.length);
        
        // Get customers for the current page
        const pageCustomers = filteredCustomers.slice(startIndex, endIndex);
        
        if (pageCustomers.length === 0) {
            const emptyRow = document.createElement("tr");
            emptyRow.innerHTML = `
                <td colspan="8" class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>No customers found. Start creating invoices to add customers!</p>
                </td>
            `;
            tbody.appendChild(emptyRow);
            return;
        }
        
        pageCustomers.forEach(customer => {
            const row = document.createElement("tr");
            row.dataset.id = customer.id;  // Store customer ID as data attribute
            
            // Calculate total orders and last order date
            const totalOrders = customer.orders.length;
            const lastOrderDate = formatDate(customer.lastOrderDate);
            
            row.innerHTML = `
                <td data-label="Customer ID">${customer.id}</td>
                <td data-label="Name">${customer.name}</td>
                <td data-label="Phone">${customer.phone}</td>
                <td data-label="Email">${customer.email}</td>
                <td data-label="Orders">${totalOrders}</td>
                <td data-label="Total Spent">${formatCurrency(customer.totalSpent)}</td>
                <td data-label="Last Order">${lastOrderDate}</td>
                <td data-label="Actions">
                    <div class="action-buttons">
                        <button class="action-btn view-btn" data-id="${customer.id}" title="View Details"><i class="fas fa-eye"></i></button>
                        <button class="action-btn edit-btn" data-id="${customer.id}" title="Edit Customer"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete-btn" data-id="${customer.id}" title="Delete Customer"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }
    
    // Find customer by ID
    function findCustomerById(customerId) {
        return customers.find(customer => customer.id === customerId);
    }
    
    // Show customer details in modal
    function showCustomerDetails(customerId) {
        const customer = findCustomerById(customerId);
        if (!customer) {
            displayMessage("Customer not found", "error");
            return;
        }
        
        // Set customer details in modal
        document.getElementById('modal-customer-name').textContent = customer.name;
        document.getElementById('modal-customer-id').textContent = `ID: ${customer.id}`;
        document.getElementById('modal-customer-phone').textContent = customer.phone;
        document.getElementById('modal-customer-email').textContent = customer.email;
        document.getElementById('modal-customer-address').textContent = customer.address;
        
        // Set customer analytics
        document.getElementById('modal-total-orders').textContent = customer.orders.length;
        document.getElementById('modal-total-spent').textContent = formatCurrency(customer.totalSpent);
        
        const avgOrderValue = customer.orders.length > 0 
            ? customer.totalSpent / customer.orders.length 
            : 0;
        document.getElementById('modal-avg-order').textContent = formatCurrency(avgOrderValue);
        
        document.getElementById('modal-last-order').textContent = formatDate(customer.lastOrderDate);
        
        // Populate order history
        const orderHistoryBody = document.getElementById('order-history-body');
        orderHistoryBody.innerHTML = '';
        
        if (customer.orders.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `<td colspan="5" class="empty-state">No order history available</td>`;
            orderHistoryBody.appendChild(emptyRow);
        } else {
            // Sort orders by date (newest first)
            const sortedOrders = [...customer.orders].sort((a, b) => b.date - a.date);
            
            sortedOrders.forEach(order => {
                const row = document.createElement('tr');
                
                // Get status pill class
                let statusClass = '';
                if (order.status === 'paid') statusClass = 'paid';
                else if (order.status === 'pending') statusClass = 'pending';
                else if (order.status === 'partial') statusClass = 'partial';
                
                row.innerHTML = `
                    <td>${order.invoiceNo}</td>
                    <td>${formatDate(order.date)}</td>
                    <td>${order.items.length} item${order.items.length !== 1 ? 's' : ''}</td>
                    <td>${formatCurrency(order.total)}</td>
                    <td><span class="status-pill ${statusClass}">${order.status}</span></td>
                `;
                
                orderHistoryBody.appendChild(row);
            });
        }
        
        // Show the modal
        customerModal.style.display = 'block';
    }
    
    // Setup pagination events
    function setupPagination() {
        document.getElementById('prev-page').addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                updatePaginationControls();
                renderCustomersPage();
            }
        });
        
        document.getElementById('next-page').addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                updatePaginationControls();
                renderCustomersPage();
            }
        });
    }
    
    // Setup search functionality
    function setupSearch() {
        const searchInput = document.getElementById('customer-search');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(() => {
                const query = searchInput.value.trim().toLowerCase();
                
                if (query === '') {
                    // Reset to full list
                    filteredCustomers = [...customers];
                } else {
                    // Filter customers based on search query
                    filteredCustomers = customers.filter(customer => 
                        customer.name.toLowerCase().includes(query) ||
                        customer.phone.toLowerCase().includes(query) ||
                        (customer.email && customer.email.toLowerCase().includes(query))
                    );
                }
                
                // Reset to first page
                currentPage = 1;
                
                // Update total pages
                totalPages = Math.ceil(filteredCustomers.length / pageSize);
                
                // Update pagination controls
                updatePaginationControls();
                
                // Render the current page
                renderCustomersPage();
            }, 300));
        }
    }
    
    // Setup filter functionality
    function setupFilters() {
        const paymentFilter = document.getElementById('payment-filter');
        const applyFilterBtn = document.getElementById('apply-filter');
        const resetFilterBtn = document.getElementById('reset-filter');
        
        if (applyFilterBtn) {
            applyFilterBtn.addEventListener('click', () => {
                // Get selected payment status
                const paymentStatus = paymentFilter.value;
                
                if (paymentStatus === 'all') {
                    // Reset to full list
                    filteredCustomers = [...customers];
                } else {
                    // Filter customers based on their most recent order status
                    filteredCustomers = customers.filter(customer => {
                        // Check if customer has any orders
                        if (customer.orders.length === 0) return false;
                        
                        // Find the most recent order
                        const sortedOrders = [...customer.orders].sort((a, b) => b.date - a.date);
                        const mostRecentOrder = sortedOrders[0];
                        
                        // Check if the most recent order has the selected status
                        return mostRecentOrder.status === paymentStatus;
                    });
                }
                
                // Reset to first page
                currentPage = 1;
                
                // Update total pages
                totalPages = Math.ceil(filteredCustomers.length / pageSize);
                
                // Update pagination controls
                updatePaginationControls();
                
                // Render the current page
                renderCustomersPage();
            });
        }
        
        if (resetFilterBtn) {
            resetFilterBtn.addEventListener('click', () => {
                // Reset payment filter dropdown
                paymentFilter.value = 'all';
                
                // Reset search input
                document.getElementById('customer-search').value = '';
                
                // Reset to full list
                filteredCustomers = [...customers];
                // Reset to first page
                currentPage = 1;
                
                // Update total pages
                totalPages = Math.ceil(filteredCustomers.length / pageSize);
                
                // Update pagination controls
                updatePaginationControls();
                
                // Render the current page
                renderCustomersPage();
            });
        }
    }
    
    // Setup export functionality
    function setupExport() {
        const exportBtn = document.getElementById('export-customers');
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                if (customers.length === 0) {
                    displayMessage("No customers to export", "warning");
                    return;
                }
                
                // Create CSV content
                const headers = ['Customer ID', 'Name', 'Phone', 'Email', 'Orders', 'Total Spent', 'Last Order'];
                let csvContent = headers.join(',') + '\n';
                
                customers.forEach(customer => {
                    const row = [
                        customer.id,
                        `"${customer.name.replace(/"/g, '""')}"`, // Escape quotes in names
                        customer.phone,
                        `"${customer.email.replace(/"/g, '""')}"`,
                        customer.orders.length,
                        customer.totalSpent.toFixed(2),
                        formatDate(customer.lastOrderDate)
                    ];
                    csvContent += row.join(',') + '\n';
                });
                
                // Create and trigger download
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                
                link.setAttribute('href', url);
                link.setAttribute('download', `customers_export_${new Date().toISOString().split('T')[0]}.csv`);
                link.style.visibility = 'hidden';
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                displayMessage("Customers exported successfully!", "success");
            });
        }
    }
    
    // Setup print functionality
    function setupPrint() {
        const printBtn = document.getElementById('print-customers');
        
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                window.print();
            });
        }
    }
    
    // Setup event listeners for table actions
    function setupTableActions() {
        customersTable.addEventListener('click', event => {
            // Handle view button
            const viewBtn = event.target.closest('.view-btn');
            if (viewBtn) {
                const customerId = viewBtn.dataset.id;
                showCustomerDetails(customerId);
                return;
            }
            
            // Handle edit button (future functionality)
            const editBtn = event.target.closest('.edit-btn');
            if (editBtn) {
                const customerId = editBtn.dataset.id;
                // Placeholder for edit functionality
                displayMessage("Edit functionality coming soon!", "warning");
                return;
            }
            
            // Handle delete button (future functionality)
            const deleteBtn = event.target.closest('.delete-btn');
            if (deleteBtn) {
                const customerId = deleteBtn.dataset.id;
                
                if (confirm("Are you sure you want to delete this customer? This action cannot be undone.")) {
                    // Placeholder for delete functionality
                    displayMessage("Delete functionality coming soon!", "warning");
                }
                return;
            }
        });
    }
    
    // Setup modal event listeners
    function setupModal() {
        const closeModalBtn = document.querySelector('.close-modal');
        const closeModalFooterBtn = document.getElementById('close-modal-btn');
        
        // Close modal when clicking the X button
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                customerModal.style.display = 'none';
            });
        }
        
        // Close modal when clicking the Close button in footer
        if (closeModalFooterBtn) {
            closeModalFooterBtn.addEventListener('click', () => {
                customerModal.style.display = 'none';
            });
        }
        
        // Close modal when clicking outside the modal content
        window.addEventListener('click', event => {
            if (event.target === customerModal) {
                customerModal.style.display = 'none';
            }
        });
    }
    
    // Debounce function to prevent excessive function calls
    function debounce(func, delay = 300) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }
    
    // Function to setup sorting functionality
    function setupSorting() {
        const headers = customersTable.querySelectorAll('thead th');
        
        // Skip the actions column
        for (let i = 0; i < headers.length - 1; i++) {
            const header = headers[i];
            
            // Make header sortable
            header.classList.add('sortable');
            header.innerHTML += '<span class="sort-icon"><i class="fas fa-sort"></i></span>';
            header.dataset.sortDirection = 'none';
            
            header.addEventListener('click', () => {
                // Reset sort direction for all other headers
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
                
                // Perform the sort
                sortCustomers(i, direction);
            });
        }
    }
    // Replace this in your customer.js file
async function fetchBillingData() {
    const token = checkLogin();
    try {
        const response = await fetch(`${BASE_URL}/api/billing`, {
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
        });
        if (!response.ok) throw new Error("Failed to fetch billing data");
        
        const data = await response.json();
        
        // Fix: Use data.records instead of data directly
        const billingData = data.records || [];
        
        processCustomers(billingData);
        return billingData;
    } catch (error) {
        displayMessage(error.message);
        return [];
    }
}

    // Sort customers by column and direction
    function sortCustomers(columnIndex, direction) {
        const headers = ['id', 'name', 'phone', 'email', 'orders', 'totalSpent', 'lastOrderDate'];
        const field = headers[columnIndex];
        
        filteredCustomers.sort((a, b) => {
            let valueA, valueB;
            
            // Handle special cases based on the column
            switch (field) {
                case 'orders':
                    valueA = a.orders.length;
                    valueB = b.orders.length;
                    break;
                    
                case 'lastOrderDate':
                    valueA = new Date(a.lastOrderDate).getTime();
                    valueB = new Date(b.lastOrderDate).getTime();
                    break;
                    
                default:
                    valueA = a[field];
                    valueB = b[field];
                    
                    // Handle string comparison
                    if (typeof valueA === 'string' && typeof valueB === 'string') {
                        return direction === 'asc' 
                            ? valueA.localeCompare(valueB) 
                            : valueB.localeCompare(valueA);
                    }
            }
            
            // Handle numeric comparison
            return direction === 'asc' ? valueA - valueB : valueB - valueA;
        });
        
        // Reset to first page
        currentPage = 1;
        
        // Update pagination controls
        updatePaginationControls();
        
        // Render the sorted page
        renderCustomersPage();
    }
    
    // Initialize the page
    async function init() {
        fetchProfile();
        setupNotifications();
        
        // Fetch and process billing data
        await fetchBillingData();
        
        // Setup UI interactions
        setupPagination();
        setupSearch();
        setupFilters();
        setupExport();
        setupPrint();
        setupTableActions();
        setupModal();
        setupSorting();
    }
    
    // Start initialization
    init();
});