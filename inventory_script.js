// Example data storage for inventory items
let inventory = [];

function addItem() {
    // Toggle the visibility of the add item form
    const addItemForm = document.querySelector('.add-item');
    addItemForm.style.display = addItemForm.style.display === 'flex' ? 'none' : 'flex';
}

function saveItem() {
    const itemId = document.getElementById('item-id').value;
    const itemName = document.getElementById('item-name').value;
    const itemQuantity = document.getElementById('item-quantity').value;
    const itemPrice = document.getElementById('item-price').value;

    // Check if all fields are filled
    if (itemId && itemName && itemQuantity && itemPrice) {
        const newItem = {
            id: itemId,
            name: itemName,
            quantity: itemQuantity,
            price: itemPrice
        };

        // Add the new item to the inventory
        inventory.push(newItem);

        // Clear input fields
        document.getElementById('item-id').value = '';
        document.getElementById('item-name').value = '';
        document.getElementById('item-quantity').value = '';
        document.getElementById('item-price').value = '';

        // Update the table
        updateTable();
    } else {
        alert('Please fill in all fields');
    }
}

function updateTable() {
    const tbody = document.querySelector('table tbody');
    tbody.innerHTML = ''; // Clear current table rows

    // Loop through inventory and populate the table
    inventory.forEach((item, index) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${item.id}</td>
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td>${item.price}</td>
            <td class="actions">
                <button onclick="editItem(${index})">Edit</button>
                <button class="delete" onclick="removeItem(${index})">Remove</button>
            </td>
        `;
    });
}

function editItem(index) {
    const item = inventory[index];
    document.getElementById('item-id').value = item.id;
    document.getElementById('item-name').value = item.name;
    document.getElementById('item-quantity').value = item.quantity;
    document.getElementById('item-price').value = item.price;

    // Toggle the form visibility to update the item
    const addItemForm = document.querySelector('.add-item');
    addItemForm.style.display = 'flex';
    addItemForm.querySelector('button').onclick = () => updateItem(index);
}

function updateItem(index) {
    const itemId = document.getElementById('item-id').value;
    const itemName = document.getElementById('item-name').value;
    const itemQuantity = document.getElementById('item-quantity').value;
    const itemPrice = document.getElementById('item-price').value;

    // Update the item in the inventory
    inventory[index] = {
        id: itemId,
        name: itemName,
        quantity: itemQuantity,
        price: itemPrice
    };

    // Clear input fields
    document.getElementById('item-id').value = '';
    document.getElementById('item-name').value = '';
    document.getElementById('item-quantity').value = '';
    document.getElementById('item-price').value = '';

    // Update the table
    updateTable();
}

function removeItem(index) {
    // Remove the item from the inventory
    inventory.splice(index, 1);

    // Update the table
    updateTable();
}

function updateInventory() {
    // Placeholder for actual inventory update logic
    alert('Inventory updated!');
}
