    document.addEventListener("DOMContentLoaded", () => {
        const BASE_URL = "http://localhost:3000";
        const messageDiv = document.getElementById("message");
        const billItemsTable = document.getElementById("bill-items");
        let products = []; // Store fetched products
        let nextInvoiceNumber = "INV-2024-001"; // This should ideally come from the server

        // Check login status and return token
        function checkLogin() {
            const token = localStorage.getItem("token");
            if (!token) {
                window.location.href = "../login/login.html";
                return null;
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

        async function fetchProfile() {
            const authButton = document.getElementById("auth-btn");
            const usernameSpan = document.getElementById("username");
            const cashierInput = document.getElementById("cashier");

            const token = checkLogin();
            if (!token) return;

            try {
                const response = await fetch(`${BASE_URL}/api/profile`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!response.ok) throw new Error("Failed to fetch profile");

                const { username } = await response.json();
                usernameSpan.textContent = username;
                cashierInput.value = username;

                authButton.textContent = "Logout";
                authButton.classList.add("logout");
                authButton.onclick = handleLogout;
            } catch (error) {
                handleGuest();
            }
        }

        function handleGuest() {
            const usernameSpan = document.getElementById("username");
            const authButton = document.getElementById("auth-btn");
            const cashierInput = document.getElementById("cashier");

            usernameSpan.textContent = "Guest";
            cashierInput.value = "Guest";
            authButton.textContent = "Login";
            authButton.classList.remove("logout");
            authButton.onclick = () => window.location.href = "../login/login.html";
        }

        function handleLogout() {
            localStorage.removeItem("token");
            window.location.href = "../login/login.html";
        }

        // Fetch products for autocomplete
        async function fetchProducts() {
            const token = checkLogin();
            if (!token) return;

            try {
                const response = await fetch(`${BASE_URL}/api/items`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!response.ok) throw new Error("Failed to fetch products");
                products = await response.json();
                setupProductAutocomplete();
            } catch (error) {
                displayMessage(error.message);
            }
        }

        function setupProductAutocomplete() {
            document.querySelectorAll('.product-name').forEach(input => {
                input.addEventListener('input', handleProductSearch);
                setupKeyboardNavigation(input);
            });
        }

        function handleProductSearch(event) {
            const input = event.target;
            const row = input.closest('tr');
            const productId = row.querySelector('.product-id');
            const price = row.querySelector('.item-price');
            const suggestionsContainer = row.querySelector('.autocomplete-suggestions');
            const searchValue = input.value.toLowerCase();
            
            // Clear previous suggestions
            suggestionsContainer.innerHTML = '';
            suggestionsContainer.style.display = 'none';
            
            if (searchValue.length === 0) return; // Exit if input is empty
            
            // Filter products based on input (only products that start with the search term)
            const filteredProducts = products.filter(p => 
                p.name.toLowerCase().startsWith(searchValue) // Check if product name starts with searchValue
            );
            
            if (filteredProducts.length > 0) {
                // Display suggestions
                filteredProducts.forEach((product) => {
                    const suggestionDiv = document.createElement('div');
                    suggestionDiv.className = 'autocomplete-suggestion';
                    
                    // Highlight matching text
                    const regex = new RegExp(`(${searchValue})`, 'gi');
                    const highlightedName = product.name.replace(regex, '<strong>$1</strong>');
                    
                    suggestionDiv.innerHTML = `
                        <div>${highlightedName}</div>
                        <div style="font-size: 0.8em; color: #666;">
                            ID: ${product.id} - Price: ₹${product.price.toFixed(2)}
                        </div>
                    `;
                    
                    suggestionDiv.addEventListener('mouseover', () => {
                        suggestionsContainer.querySelectorAll('.autocomplete-suggestion').forEach(el => {
                            el.classList.remove('selected');
                        });
                        suggestionDiv.classList.add('selected');
                    });
                    
                    suggestionDiv.addEventListener('click', () => {
                        input.value = product.name;
                        productId.value = product.id;
                        price.value = product.price.toFixed(2);
                        suggestionsContainer.style.display = 'none';
                        calculateRowTotal(row);
                    });
                    
                    suggestionsContainer.appendChild(suggestionDiv);
                });
                
                suggestionsContainer.style.display = 'block'; // Show suggestions
            }
        }

        function setupKeyboardNavigation(input) {
            let selectedIndex = -1;
            
            input.addEventListener('keydown', (e) => {
                const row = input.closest('tr');
                const suggestionsContainer = row.querySelector('.autocomplete-suggestions');
                const suggestions = suggestionsContainer.querySelectorAll('.autocomplete-suggestion');
                
                if (suggestionsContainer.style.display === 'none') return;
                
                switch (e.key) {
                    case 'ArrowDown':
                        e.preventDefault();
                        selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
                        break;
                        
                    case 'ArrowUp':
                        e.preventDefault();
                        selectedIndex = Math.max(selectedIndex - 1, -1);
                        break;
                        
                    case 'Enter':
                        e.preventDefault();
                        if (selectedIndex >= 0) {
                            suggestions[selectedIndex].click();
                        }
                        return;
                        
                    case 'Escape':
                        suggestionsContainer.style.display = 'none';
                        return;
                        
                    default:
                        return;
                }
                
                suggestions.forEach((s, i) => {
                    if (i === selectedIndex) {
                        s.classList.add('selected');
                        s.scrollIntoView({ block: 'nearest' });
                    } else {
                        s.classList.remove('selected');
                    }
                });
            });
        }

        document.addEventListener('click', (event) => {
            const isClickInside = event.target.closest('.product-name');
            if (!isClickInside) {
                document.querySelectorAll('.autocomplete-suggestions').forEach(container => {
                    container.style.display = 'none';
                });
            }
        });

        function calculateRowTotal(row) {
            const price = parseFloat(row.querySelector('.item-price').value) || 0;
            const quantity = parseInt(row.querySelector('.item-quantity').value) || 0;
            const discount = parseFloat(row.querySelector('.item-discount').value) || 0;
            
            const total = price * quantity * (1 - discount / 100);
            row.querySelector('.item-total').textContent = `₹${total.toFixed(2)}`;
            
            calculateBillTotals();
        }

        function calculateBillTotals() {
            let subtotal = 0;
            document.querySelectorAll('#bill-items tr').forEach(row => {
                subtotal += parseFloat(row.querySelector('.item-total').textContent.replace('₹', '')) || 0;
            });
            
            const tax = subtotal * 0.10; // 10% tax
            const discount = Array.from(document.querySelectorAll('.item-discount'))
                .reduce((total, input) => {
                    const rowPrice = parseFloat(input.closest('tr').querySelector('.item-price').value) || 0;
                    const rowQuantity = parseInt(input.closest('tr').querySelector('.item-quantity').value) || 0;
                    const discountPercent = parseFloat(input.value) || 0;
                    return total + (rowPrice * rowQuantity * (discountPercent / 100));
                }, 0);
            
            const grandTotal = subtotal + tax;
            
            document.getElementById('subtotal').textContent = `₹${subtotal.toFixed(2)}`;
            document.getElementById('tax').textContent = `₹${tax.toFixed(2)}`;
            document.getElementById('total-discount').textContent = `₹${discount.toFixed(2)}`;
            document.getElementById('grand-total').textContent = `₹${grandTotal.toFixed(2)}`;
        }

        function addNewRow() {
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td>
                    <input type="text" class="product-name" placeholder="Enter name" autocomplete="off">
                    <div class="autocomplete-suggestions" style="display: none;"></div>
                </td>
                <td><input type="text" class="product-id" placeholder="Enter ID" readonly></td>
                <td><input type="number" class="item-price" value="0.00" step="0.01" readonly></td>
                <td><input type="number" class="item-quantity" value="1" min="1"></td>
                <td><input type="number" class="item-discount" value="0" min="0" max="100"></td>
                <td class="item-total">$0.00</td>
                <td>
                    <button class="delete-row" type="button">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>`;
        
            billItemsTable.appendChild(newRow);
            setupRowEventListeners(newRow);
            setupProductAutocomplete();
        }

        function setupRowEventListeners(row) {
            row.querySelector('.item-quantity').addEventListener('input', () => calculateRowTotal(row));
            row.querySelector('.item-discount').addEventListener('input', () => calculateRowTotal(row));
            row.querySelector('.delete-row').addEventListener('click', () => {
                if (billItemsTable.children.length > 1) {
                    row.remove();
                    calculateBillTotals();
                } else {
                    displayMessage("Cannot delete the last row", "error");
                }
            });
        }

        function initializeFirstRow() {
            const firstRow = billItemsTable.querySelector('tr');
            if (firstRow) {
                setupRowEventListeners(firstRow);
                setupProductAutocomplete();
            }
        }

        // Save draft invoice
        async function saveDraft() {
            if (!validateForm()) return;
            
            const token = checkLogin();
            if (!token) return;

            const invoiceData = collectInvoiceData();
            
            try {
                const response = await fetch(`${BASE_URL}/api/invoices/draft`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(invoiceData),
                });
                
                if (!response.ok) throw new Error("Failed to save draft");
                displayMessage("Draft saved successfully!", "success");
            } catch (error) {
                displayMessage(error.message);
            }
        }

        // Generate final invoice
        async function generateInvoice() {
            if (!validateForm()) return;
            
            const token = checkLogin();
            if (!token) return;

            const invoiceData = collectInvoiceData();
            
            try {
                const response = await fetch(`${BASE_URL}/api/invoices`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(invoiceData),
                });
                
                if (!response.ok) throw new Error("Failed to generate invoice");
                const { invoiceId } = await response.json();
                displayMessage("Invoice generated successfully!", "success");
                window.location.href = `../invoice/view.html?id=${invoiceId}`;
            } catch (error) {
                displayMessage(error.message);
            }
        }

        // Process payment
        async function processPayment() {
            if (!validateForm()) return;
            
            const token = checkLogin();
            if (!token) return;

            const paymentData = {
                invoiceId: document.getElementById('invoice-no').value,
                method: document.getElementById('payment-method').value,
                status: document.getElementById('payment-status').value,
                amount: parseFloat(document.getElementById('grand-total').textContent.replace('$', '')),
                note: document.getElementById('payment-note').value
            };
            
            try {
                const response = await fetch(`${BASE_URL}/api/payments`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(paymentData),
                });
                
                if (!response.ok) throw new Error("Failed to process payment");
                displayMessage("Payment processed successfully!", "success");
                resetForm();
            } catch (error) {
                displayMessage(error.message);
            }
        }

        function validateForm() {
            // Customer validation
            const customerName = document.getElementById('customer-name').value;
            const customerPhone = document.getElementById('customer-phone').value;
            
            if (!customerName || !customerPhone) {
                displayMessage("Please fill in required customer information", "error");
                return false;
            }

            // Items validation
            const items = document.querySelectorAll('#bill-items tr');
            let hasValidItems = false;

            items.forEach(row => {
                const productName = row.querySelector('.product-name').value;
                const productId = row.querySelector('.product-id').value;
                if (productName && productId) hasValidItems = true;
            });

            if (!hasValidItems) {
                displayMessage("Please add at least one valid item", "error");
                return false;
            }

            // Payment validation
            const paymentMethod = document.getElementById('payment-method').value;
            const paymentStatus = document.getElementById('payment-status').value;

            if (!paymentMethod || !paymentStatus) {
                displayMessage("Please select payment method and status", "error");
                return false;
            }

            return true;
        }

        function collectInvoiceData() { 
            return {
                invoiceNo: document.getElementById('invoice-no').value,
                date: document.getElementById('invoice-date').value,
                cashier: document.getElementById('cashier').value,
                customer: {
                    name: document.getElementById('customer-name').value,
                    email: document.getElementById('customer-email').value,
                    phone: document.getElementById('customer-phone').value,
                    address: document.getElementById('customer-address').value
                },
                items: Array.from(document.querySelectorAll('#bill-items tr')).map(row => ({
                    productId: row.querySelector('.product-id').value,
                    name: row.querySelector('.product-name').value,
                    price: parseFloat(row.querySelector('.item-price').value),
                    quantity: parseInt(row.querySelector('.item-quantity').value),
                    discount: parseFloat(row.querySelector('.item-discount').value),
                    total: parseFloat(row.querySelector('.item-total').textContent.replace('₹', ''))
                })).filter(item => item.productId && item.name), // Filter out empty rows
                subtotal: parseFloat(document.getElementById('subtotal').textContent.replace('₹', '')),
                tax: parseFloat(document.getElementById('tax').textContent.replace('₹', '')),
                discount: parseFloat(document.getElementById('total-discount').textContent.replace('₹', '')),
                grandTotal: parseFloat(document.getElementById('grand-total').textContent.replace('₹', '')),
                payment: {
                    method: document.getElementById('payment-method').value,
                    status: document.getElementById('payment-status').value,
                    note: document.getElementById('payment-note').value
                }
            };
        }

        function resetForm() {
            // Reset customer information
            document.getElementById('customer-name').value = '';
            document.getElementById('customer-email').value = '';
            document.getElementById('customer-phone').value = '';
            document.getElementById('customer-address').value = '';

            // Reset items
            billItemsTable.innerHTML = '';
            addNewRow();

            // Reset payment information
            document.getElementById('payment-method').value = '';
            document.getElementById('payment-status').value = 'pending';
            document.getElementById('payment-note').value = '';

            // Update totals
            calculateBillTotals();

            // Generate new invoice number
            updateInvoiceNumber();
        }

        function updateInvoiceNumber() {
            const currentNumber = parseInt(nextInvoiceNumber.split('-')[2]);
            nextInvoiceNumber = `INV-2024-${(currentNumber + 1).toString().padStart(3, '0')}`;
            document.getElementById('invoice-no').value = nextInvoiceNumber;
        }

        // Watch for last row being filled
        billItemsTable.addEventListener('input', (e) => {
            const row = e.target.closest('tr');
            if (row === billItemsTable.lastElementChild) {
                const inputs = row.querySelectorAll('input');
                const isFilled = Array.from(inputs).some(input => input.value !== '');
                if (isFilled) {
                    addNewRow();
                }
            }
        });

        // Initialize
        fetchProfile();
        fetchProducts();
        initializeFirstRow();

        // Expose functions for button click handlers
        window.saveDraft = saveDraft;
        window.generateInvoice = generateInvoice;
        window.processPayment = processPayment;
    });