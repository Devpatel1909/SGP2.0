// Get references to the DOM elements
const signupForm = document.getElementById("signup-form-content");
const loginForm = document.getElementById("login-form-content");
const signupTab = document.getElementById("signup-tab");
const loginTab = document.getElementById("login-tab");
const signupFormContainer = document.getElementById("signup-form");
const loginFormContainer = document.getElementById("login-form");

// Switch to the Sign Up form
signupTab.addEventListener("click", () => {
  signupFormContainer.classList.add("active-form");
  loginFormContainer.classList.remove("active-form");
  signupTab.classList.add("active");
  loginTab.classList.remove("active");
});

// Switch to the Login form
loginTab.addEventListener("click", () => {
  loginFormContainer.classList.add("active-form");
  signupFormContainer.classList.remove("active-form");
  loginTab.classList.add("active");
  signupTab.classList.remove("active");
});

// Handle Sign Up form submission
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("signup-username").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value.trim();

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
      alert("Sign up successful!");
      signupForm.reset(); // Optionally reset the form
    } else {
      alert(`Error: ${data.message}`);
    }
  } catch (error) {
    console.error("Error signing up:", error);
    alert("Sign up failed. Please try again.");
  }
});

// Handle Login form submission
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();

  if (!email || !password) {
    alert("Please fill in both fields.");
    return;
  }

  try {
    const response = await fetch("http://localhost:3000/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (response.ok) {
      localStorage.setItem("token", data.token); // Store the token in local storage
      alert("Login successful!");
      // Redirect to the inventory page or another page
      window.location.href = "../index.html"; // Change this to your inventory page
    } else {
      alert(`Error: ${data.message}`);
    }
  } catch (error) {
    console.error("Error logging in:", error);
    alert("Login failed. Please try again.");
  }
});