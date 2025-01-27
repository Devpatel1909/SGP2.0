document.addEventListener("DOMContentLoaded", () => {
    const BASE_URL = "http://localhost:3000";
    const totalProductsElement = document.getElementById("total-products");
    const totalSalesElement = document.getElementById("total-sales");
    const totalRevenueElement = document.getElementById("total-revenue");
    const messageDiv = document.getElementById("message");

    function displayMessage(message, type = "error") {
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = "block";
        setTimeout(() => {
            messageDiv.style.display = "none";
        }, 3000);
    }

    async function fetchDashboardData() {
        try {
            const response = await fetch(`${BASE_URL}/api/dashboard`);
            if (!response.ok) throw new Error("Failed to fetch dashboard data");
            const data = await response.json();
            totalProductsElement.textContent = data.totalProducts;
            totalSalesElement.textContent = data.totalSales;
            totalRevenueElement.textContent = new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
            }).format(data.totalRevenue);
        } catch (error) {
            displayMessage(error.message);
        }
    }

    fetchDashboardData();
});