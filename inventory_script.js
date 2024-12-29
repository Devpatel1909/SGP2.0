// Function to add a new row for item entry
function addItem() {
    let table = document.querySelector('table tbody');
    let newRow = table.insertRow();

    // Create new cells for ID, Name, Quantity, Price, and Actions
    newRow.innerHTML = `
        <td><input type="text" placeholder="Enter ID"></td>
        <td><input type="text" placeholder="Enter Name"></td>
        <td><input type="number" placeholder="Enter Quantity"></td>
        <td><input type="number" placeholder="Enter Price"></td>
        <td>
            <button onclick="editItem(this)">Edit</button>
            <button onclick="removeItem(this)">Remove</button>
        </td>
    `;
}

// Function to save item data and replace the input fields with text
function editItem(button) {
    let row = button.closest('tr');
    let idInput = row.cells[0].querySelector('input');
    let nameInput = row.cells[1].querySelector('input');
    let quantityInput = row.cells[2].querySelector('input');
    let priceInput = row.cells[3].querySelector('input');

    // If the input fields are already displayed (indicating that the row is in 'edit' mode), save the changes
    if (idInput) {
        row.cells[0].innerText = idInput.value;
        row.cells[1].innerText = nameInput.value;
        row.cells[2].innerText = quantityInput.value;
        row.cells[3].innerText = priceInput.value;

        // Change button to "Edit" again
        button.innerText = 'Edit';
        button.setAttribute('onclick', 'editItem(this)');
    } else {
        // Otherwise, show input fields for editing
        row.cells[0].innerHTML = `<input type="text" value="${row.cells[0].innerText}">`;
        row.cells[1].innerHTML = `<input type="text" value="${row.cells[1].innerText}">`;
        row.cells[2].innerHTML = `<input type="number" value="${row.cells[2].innerText}">`;
        row.cells[3].innerHTML = `<input type="number" value="${row.cells[3].innerText}">`;

        // Change button to "Save"
        button.innerText = 'Save';
        button.setAttribute('onclick', 'editItem(this)');
    }
}

// Function to remove an item row
function removeItem(button) {
    let row = button.closest('tr');
    row.remove();
}
