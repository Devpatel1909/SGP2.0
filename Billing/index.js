// Global variables
const BASE_URL = "http://localhost:3000";
let billItems = []; // Array to hold items added to the bill

// Check if the user is logged in
function checkLogin() {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "../login/login.html"; // Redirect to login page if no token
    }
    return token;
}

// Display messages (e.g., errors, success)
function displayMessage(message, type = "error") {
    const messageDiv = document.getElementById("message");
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = "block";
    setTimeout(() => {
        messageDiv.style.display = "none";
    }, 3000);
}

// Fetch user profile
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

// Calculate totals for the bill
function calculateTotals() {
    let subtotal = 0;
    let totalDiscount = 0;

    if (billItems.length === 0) {
        // If no items, set all totals to 0
        document.getElementById('subtotal').innerText = '₹0.00';
        document.getElementById('tax').innerText = '₹0.00';
        document.getElementById('total-discount').innerText = '₹0.00';
        document.getElementById('grand-total').innerText = '₹0.00';
        return;
    }

    // Calculate totals for each item in the bill
    billItems.forEach(item => {
        const discountAmount = (item.discount / 100) * item.price * item.quantity;
        const totalAmount = (item.price * item.quantity) - discountAmount;
        subtotal += totalAmount;
        totalDiscount += discountAmount;
    });

    const tax = subtotal * 0.10; // Assuming a 10% tax rate
    const grandTotal = subtotal + tax;

    // Update the DOM with calculated values
    document.getElementById('subtotal').innerText = `₹${subtotal.toFixed(2)}`;
    document.getElementById('tax').innerText = `₹${tax.toFixed(2)}`;
    document.getElementById('total-discount').innerText = `₹${totalDiscount.toFixed(2)}`;
    document.getElementById('grand-total').innerText = `₹${grandTotal.toFixed(2)}`;
}

// Save draft invoice
function saveDraft() {
    console.log("Draft saved:", { billItems });
    displayMessage("Draft saved successfully!", "success");
}

// Generate invoice
function generateInvoice() {
    const customerName = document.getElementById("customer-name").value.trim();
    const customerEmail = document.getElementById("customer-email").value.trim();
    const customerPhone = document.getElementById("customer-phone").value.trim();
    const customerAddress = document.getElementById("customer-address").value.trim();

    // Validate customer details
    if (!customerName || !customerPhone) {
        displayMessage("Please fill in all required customer information.", "error");
        return;
    }

    const invoiceData = {
        customer: {
            name: customerName,
            email: customerEmail,
            phone: customerPhone,
            address: customerAddress
        },
        items: billItems,
        subtotal: parseFloat(document.getElementById("subtotal").innerText.replace('₹', '')),
        tax: parseFloat(document.getElementById("tax").innerText.replace('₹', '')),
        totalDiscount: parseFloat(document.getElementById("total-discount").innerText.replace('₹', '')),
        grandTotal: parseFloat(document.getElementById("grand-total").innerText.replace('₹', ''))
    };

    console.log("Invoice generated:", invoiceData);
    displayMessage("Invoice generated successfully!", "success");
}

// Process payment
function processPayment() {
    const grandTotal = parseFloat(document.getElementById("grand-total").innerText.replace('₹', ''));
    if (grandTotal <= 0) {
        displayMessage("No items in the bill to process payment.", "error");
        return;
    }
    console.log("Payment processed for total amount:", grandTotal);
    displayMessage("Payment processed successfully!", "success");
}

// Add item to the bill
function addItemToBill() {
    const productName = document.querySelector('.product-name').value.trim();
    const productId = document.querySelector('.product-id').value.trim();
    const itemPrice = parseFloat(document.querySelector('.item-price').value);
    const itemQuantity = parseInt(document.querySelector('.item-quantity').value);
    const itemDiscount = parseFloat(document.querySelector('.item-discount').value);

    // Validate item data
    if (!productName || !productId || isNaN(itemPrice) || isNaN(itemQuantity) || itemPrice <= 0 || itemQuantity <= 0) {
        displayMessage("Please fill in all item details correctly.", "error");
        return;
    }

    // Create item object
    const item = {
        name: productName,
        id: productId,
        price: itemPrice,
        quantity: itemQuantity,
        discount: itemDiscount || 0 // Default discount to 0 if not provided
    };

    // Add the item to the bill
    billItems.push(item);

    // Clear input fields
    document.querySelector('.product-name').value = '';
    document.querySelector('.product-id').value = '';
    document.querySelector('.item-price').value = '0.00';
    document.querySelector('.item-quantity').value = '1';
    document.querySelector('.item-discount').value = '0';

    // Calculate totals
    calculateTotals();

    // Update the bill items table
    renderBillItems();
}

// Render bill items in the table
function renderBillItems() {
    const billItemsTableBody = document.getElementById('bill-items');
    billItemsTableBody.innerHTML = ''; // Clear existing rows

    if (billItems.length === 0) {
        billItemsTableBody.innerHTML = `<tr><td colspan="7">No items added to the bill.</td></tr>`;
        return;
    }

    billItems.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.id}</td>
            <td>₹${item.price.toFixed(2)}</td>
            <td>${item.quantity}</td>
            <td>${item.discount}%</td>
            <td>₹${((item.price * item.quantity) - (item.discount / 100 * item.price * item.quantity)).toFixed(2)}</td>
            <td><button onclick="removeItemFromBill(${index})">Remove</button></td>
        `;
        billItemsTableBody.appendChild(row);
    });
}

// Remove an item from the bill
window.removeItemFromBill = function(index) {
    billItems.splice(index, 1); // Remove the item
    calculateTotals(); // Recalculate totals
    renderBillItems(); // Update the table
};

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
    checkLogin(); // Ensure user is logged in
    fetchProfile(); // Fetch user profile

    // Event listeners for buttons
    document.getElementById('add-item-button').addEventListener('click', addItemToBill);
    document.getElementById('save-draft-button').addEventListener('click', saveDraft);
    document.getElementById('generate-invoice-button').addEventListener('click', generateInvoice);
    document.getElementById('process-payment-button').addEventListener('click', processPayment);
});