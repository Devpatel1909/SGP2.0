document.addEventListener("DOMContentLoaded", () => {
    const BASE_URL = "http://localhost:3000";
    const messageDiv = document.getElementById("message");
    
    // Initialize dashboard
    async function initDashboard() {
        fetchProfile();
        loadMetrics();
        loadCharts();
        loadRecentOrders();
        loadLowStockItems();
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
    
    // Load metrics data
    async function loadMetrics() {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;
            
            // Fetch dashboard metrics
            const response = await fetch(`${BASE_URL}/api/dashboard/metrics`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            
            if (!response.ok) {
                // For demo purposes, use placeholder data if API fails
                updateMetricsWithDemoData();
                return;
            }
            
            const metrics = await response.json();
            
            // Update metric values
            document.getElementById("total-sales").textContent = metrics.totalSales.toLocaleString('en-IN');
            document.getElementById("total-orders").textContent = metrics.totalOrders.toLocaleString();
            document.getElementById("total-products").textContent = metrics.totalProducts.toLocaleString();
            document.getElementById("total-customers").textContent = metrics.totalCustomers.toLocaleString();
            
        } catch (error) {
            console.error("Error loading metrics:", error);
            // For demo purposes, use placeholder data if API fails
            updateMetricsWithDemoData();
        }
    }
    
    // Fallback function to populate metrics with demo data
    function updateMetricsWithDemoData() {
        document.getElementById("total-sales").textContent = "125,430";
        document.getElementById("total-orders").textContent = "843";
        document.getElementById("total-products").textContent = "152";
        document.getElementById("total-customers").textContent = "386";
    }
    
    // Load and initialize charts
    function loadCharts() {
        initSalesChart();
        initProductsChart();
    }
    
    // Initialize sales chart
    function initSalesChart() {
        const ctx = document.getElementById('sales-chart-canvas').getContext('2d');
        
        // Demo data for sales chart
        const salesData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{
                label: 'Monthly Sales (₹)',
                data: [12500, 15000, 18000, 16000, 20000, 22000, 25000, 23000, 27000, 29000, 32000, 35000],
                backgroundColor: 'rgba(90, 74, 209, 0.2)',
                borderColor: 'rgba(90, 74, 209, 1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        };
        
        new Chart(ctx, {
            type: 'line',
            data: salesData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₹' + value.toLocaleString();
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Sales: ₹' + context.parsed.y.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Initialize products chart - FIXED VERSION
    function initProductsChart() {
        const ctx = document.getElementById('products-chart-canvas').getContext('2d');
        
        // Demo data for top products chart
        const productsData = {
            labels: ['Smart Phone', 'Laptop', 'Headphones', 'Smart Watch', 'Camera'],
            datasets: [{
                label: 'Units Sold',
                data: [150, 90, 120, 60, 40],
                backgroundColor: [
                    'rgba(90, 74, 209, 0.7)',
                    'rgba(56, 193, 114, 0.7)',
                    'rgba(245, 158, 11, 0.7)',
                    'rgba(239, 68, 68, 0.7)',
                    'rgba(16, 185, 129, 0.7)'
                ],
                borderWidth: 1
            }]
        };
        
        new Chart(ctx, {
            type: 'bar',
            data: productsData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
    
    // Load recent orders
    function loadRecentOrders() {
        const recentOrdersBody = document.getElementById('recent-orders-body');
        
        // Demo data for recent orders
        const recentOrders = [
            { id: 'ORD-1234', customer: 'John Doe', date: '2023-10-15', amount: 5600, status: 'completed' },
            { id: 'ORD-1235', customer: 'Jane Smith', date: '2023-10-14', amount: 3200, status: 'pending' },
            { id: 'ORD-1236', customer: 'Mike Johnson', date: '2023-10-13', amount: 8900, status: 'completed' },
            { id: 'ORD-1237', customer: 'Sarah Williams', date: '2023-10-12', amount: 1200, status: 'cancelled' },
            { id: 'ORD-1238', customer: 'David Brown', date: '2023-10-11', amount: 4500, status: 'completed' }
        ];
        
        // Format date function
        function formatDate(dateString) {
            const date = new Date(dateString);
            return `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
        }
        
        // Create formatter for Indian Rupees
        const formatter = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        });
        
        // Generate table rows
        recentOrdersBody.innerHTML = '';
        recentOrders.forEach(order => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${order.id}</td>
                <td>${order.customer}</td>
                <td>${formatDate(order.date)}</td>
                <td>${formatter.format(order.amount)}</td>
                <td><span class="status-badge ${order.status}">${order.status}</span></td>
            `;
            recentOrdersBody.appendChild(row);
        });
    }
    
    // Load low stock items
    function loadLowStockItems() {
        const lowStockBody = document.getElementById('low-stock-body');
        
        // Demo data for low stock items
        const lowStockItems = [
            { name: 'Smart Phone', currentStock: 5, reorderLevel: 10, status: 'critical' },
            { name: 'Headphones', currentStock: 8, reorderLevel: 15, status: 'warning' },
            { name: 'Power Bank', currentStock: 12, reorderLevel: 20, status: 'warning' },
            { name: 'Bluetooth Speaker', currentStock: 3, reorderLevel: 10, status: 'critical' },
            { name: 'USB Cable', currentStock: 18, reorderLevel: 25, status: 'warning' }
        ];
        
        // Generate table rows
        lowStockBody.innerHTML = '';
        lowStockItems.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.name}</td>
                <td>${item.currentStock}</td>
                <td>${item.reorderLevel}</td>
                <td><span class="status-badge ${item.status}">${item.status}</span></td>
            `;
            lowStockBody.appendChild(row);
        });
    }
    
    // Add activity timeline functionality
    function setupActivityTimeline() {
        // This could fetch real activity data from the server
        // For now, we'll just make the timeline items interactive
        
        const timelineItems = document.querySelectorAll('.timeline-item');
        
        timelineItems.forEach(item => {
            item.addEventListener('click', () => {
                // Highlight clicked item
                timelineItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                // You could show more details or navigate to relevant page
                const actionType = item.querySelector('h4').textContent;
                console.log(`Timeline item clicked: ${actionType}`);
            });
        });
    }
    
    // Set up quick action cards with hover effects
    function setupQuickActions() {
        const quickActionCards = document.querySelectorAll('.quick-action-card');
        
        quickActionCards.forEach(card => {
            // Add pulse animation on hover
            card.addEventListener('mouseenter', () => {
                const icon = card.querySelector('.action-icon i');
                icon.classList.add('fa-pulse');
            });
            
            card.addEventListener('mouseleave', () => {
                const icon = card.querySelector('.action-icon i');
                icon.classList.remove('fa-pulse');
            });
        });
    }
    
    // Provide realtime updates demo
    function setupRealtimeUpdates() {
        // Simulate real-time updates with a timer
        setInterval(() => {
            // Randomly update one of the metrics for demo purposes
            const metrics = ['total-sales', 'total-orders', 'total-products', 'total-customers'];
            const randomMetric = metrics[Math.floor(Math.random() * metrics.length)];
            
            const element = document.getElementById(randomMetric);
            const currentValue = parseInt(element.textContent.replace(/,/g, ''));
            
            // Update with a small random increment
            const increment = Math.floor(Math.random() * 5) + 1;
            const newValue = currentValue + increment;
            
            // Animate the change
            element.textContent = newValue.toLocaleString();
            element.style.transition = 'all 0.5s ease';
            element.style.color = '#5a4ad1'; // Fixed: use hex value instead of var()
            
            setTimeout(() => {
                element.style.color = '';
            }, 1000);
            
        }, 30000); // Update every 30 seconds
    }
    
    // Call additional initialization functions
    initDashboard();
    
    // These should only be called after DOM is fully loaded and all elements exist
    setTimeout(() => {
        if (document.querySelector('.timeline-item')) {
            setupActivityTimeline();
        }
        
        if (document.querySelector('.quick-action-card')) {
            setupQuickActions();
        }
        
        setupRealtimeUpdates();
    }, 500);
});