// Get references to DOM elements
const signupForm = document.getElementById("signup-form-content");
const loginForm = document.getElementById("login-form-content");
const container = document.getElementById("container");
const registerBtn = document.getElementById("register");
const loginBtn = document.getElementById("login");

// Toggle between Sign In and Sign Up forms
registerBtn.addEventListener("click", () => {
    container.classList.add("active");
});

loginBtn.addEventListener("click", () => {
    container.classList.remove("active");
});

// Handle Sign Up form submission
signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("signup-username").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value.trim();

    // Validate inputs
    if (!username || !email || !password) {
        alert("Please fill in all fields.");
        return;
    }

    if (password.length < 8) {
        alert("Password must be at least 8 characters long.");
        return;
    }

    try {
        const response = await fetch("http://localhost:3000/api/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password }),
        });

        const data = await response.json();
        if (response.ok) {
            // Sign up successful
            alert("Sign up successful!...");
            localStorage.setItem("token", data.token); // Optionally store a token
            // Redirect to inventory page

        } else {
            // Handle signup errors from the server
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error("Error during sign up:", error);
        alert("Sign up failed. Please try again.");
    }
});

// Handle Login form submission
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();

    // Validate inputs
    if (!email || !password) {
        alert("Please fill in both fields.");
        return;
    }

    try {
        const response = await fetch("http://localhost:3000/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        if (response.ok) {
            // Store the token in localStorage
            localStorage.setItem("token", data.token);
            alert("Login successful!");
            // Redirect to inventory page
            window.location.href = "../inventory/index.html";
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error("Error during login:", error);
        alert("Login failed. Please try again.");
    }
});
