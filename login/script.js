// Get references to DOM elements
const signupForm = document.getElementById("signup-form-content");
const loginForm = document.getElementById("login-form-content");
const container = document.getElementById("container");
const registerBtn = document.getElementById("register");
const loginBtn = document.getElementById("login");

// OAuth buttons
const googleLoginBtn = document.getElementById("google-login");
const githubLoginBtn = document.getElementById("github-login");
const googleSignupBtn = document.getElementById("google-signup");
const githubSignupBtn = document.getElementById("github-signup");

// Toggle between Sign In and Sign Up forms
registerBtn.addEventListener("click", () => {
    container.classList.add("active");
});

loginBtn.addEventListener("click", () => {
    container.classList.remove("active");
});


// Replace your current loadGoogleAuth and initializeGoogleAuth functions with this updated version
function loadGoogleAuth() {
    console.log("Loading simplified Google Auth...");
    
    // Your Google Client ID
    const googleClientId = '35808394147-02ktr768hq4evcgjfsui4pvjtr8kqurj.apps.googleusercontent.com';
    
    // Set up click handlers for custom buttons that use a redirect flow instead
    googleSignupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log("Google signup button clicked - using redirect");
        
        // Store auth type
        sessionStorage.setItem('googleAuthType', 'signup');
        
        // Redirect to Google's OAuth page
        const redirectUri = encodeURIComponent(`${window.location.origin}/auth/google/callback`);
        const scope = encodeURIComponent('email profile');
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&prompt=select_account`;
        
        console.log("Redirecting to:", authUrl);
        window.location.href = authUrl;
    });
    
    googleLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log("Google login button clicked - using redirect");
        
        // Store auth type
        sessionStorage.setItem('googleAuthType', 'login');
        
        // Redirect to Google's OAuth page
        const redirectUri = encodeURIComponent(`${window.location.origin}/auth/google/callback`);
        const scope = encodeURIComponent('email profile');
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
        
        console.log("Redirecting to:", authUrl);
        window.location.href = authUrl;
    });
}

function initializeGoogleAuth(clientId) {
    console.log("Initializing Google Auth...");
    
    // Initialize Google Identity Services
    google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
    });
    
    // Set up click handlers for custom buttons
    googleSignupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log("Google signup button clicked");
        sessionStorage.setItem('googleAuthType', 'signup');
        
        // Instead of using prompt, try redirecting to the Google OAuth URL directly
        const redirectUri = `${window.location.origin}/auth/google/callback`;
        const scope = 'email profile';
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&prompt=select_account`;
        
        window.location.href = authUrl;
    });
    
    googleLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log("Google login button clicked");
        sessionStorage.setItem('googleAuthType', 'login');
        
        // Instead of using prompt, try redirecting to the Google OAuth URL directly
        const redirectUri = `${window.location.origin}/auth/google/callback`;
        const scope = 'email profile';
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
        
        window.location.href = authUrl;
    });
}
// Initialize Google Auth
function initializeGoogleAuth(clientId) {
    console.log("Initializing Google Auth...");
    
    // Initialize Google Identity Services
    google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
    });
    // Add this function to your JavaScript

    // Set up click handlers for custom buttons
    googleSignupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log("Google signup button clicked");
        sessionStorage.setItem('googleAuthType', 'signup');
        
        // Show Google One Tap UI with notification callback
        google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed()) {
                console.log('Google prompt not displayed:', notification.getNotDisplayedReason());
            } else if (notification.isSkippedMoment()) {
                console.log('Google prompt skipped:', notification.getSkippedReason());
            } else if (notification.isDismissedMoment()) {
                console.log('Google prompt dismissed:', notification.getDismissedReason());
            }
        });
    });
    
    googleLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log("Google login button clicked");
        sessionStorage.setItem('googleAuthType', 'login');
        
        // Show Google One Tap UI with notification callback
        google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed()) {
                console.log('Google prompt not displayed:', notification.getNotDisplayedReason());
            } else if (notification.isSkippedMoment()) {
                console.log('Google prompt skipped:', notification.getSkippedReason());
            } else if (notification.isDismissedMoment()) {
                console.log('Google prompt dismissed:', notification.getDismissedReason());
            }
        });
    });
}

// Handle Google credential response
function handleGoogleCredentialResponse(response) {
    console.log("Google credential response received");
    
    if (response && response.credential) {
        const token = response.credential;
        const authType = sessionStorage.getItem('googleAuthType') || 'login';
        
        console.log(`Received Google ${authType} token, sending to backend...`);
        
        // Send token to backend
        authenticateWithServer('google', token, authType)
            .catch(error => {
                console.error("Authentication error:", error);
                alert("Authentication with Google failed. Please try again.");
            });
    } else {
        console.error("No credential received from Google");
        alert("Failed to get credentials from Google. Please try again.");
    }
}

// GitHub OAuth Implementation
githubLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    initiateGitHubAuth('login');
});

githubSignupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    initiateGitHubAuth('signup');
});

function initiateGitHubAuth(authType) {
    // Replace with your GitHub OAuth App Client ID
    const githubClientId = 'Ov23liYicj2Cn5275wkL';
    
    // The redirect URI configured in your GitHub OAuth App
    const redirectUri = window.location.origin + '/auth/github/callback';
    
    // Store the auth type (login or signup) in session storage
    sessionStorage.setItem('authType', authType);
    
    // GitHub OAuth authorization URL
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${redirectUri}&scope=user:email`;
    
    // Redirect to GitHub OAuth
    window.location.href = githubAuthUrl;
}
function testServerConnection() {
    console.log("Testing server connection...");
    fetch('http://localhost:3000/api/healthcheck')
        .then(response => {
            console.log("Server response status:", response.status);
            return response.json();
        })
        .then(data => {
            console.log('Server connection successful:', data);
            alert('Server connection successful!');
        })
        .catch(error => {
            console.error('Server connection test failed:', error);
            alert('Server connection failed. Make sure the server is running at http://localhost:3000');
        });
}
testServerConnection();
// Check if returning from GitHub OAuth
window.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded");
 
    
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        // Get the auth type from session storage
        const authType = sessionStorage.getItem('authType') || 'login';
        
        // Exchange code for token via your backend
        exchangeGitHubCode(code, authType);
    }
    
    // Load Google Auth
    loadGoogleAuth();
});

// Exchange GitHub code for token via your backend
async function exchangeGitHubCode(code, authType) {
    try {
        console.log(`Exchanging GitHub code for auth type: ${authType}`);
        
        const response = await fetch(`http://localhost:3000/api/auth/github`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, authType })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store user token and redirect
            localStorage.setItem('token', data.token);
            alert(`GitHub ${authType} successful!`);
            
            // Redirect to inventory page
            window.location.href = "../inventory/index.html";
        } else {
            alert(`GitHub ${authType} error: ${data.message}`);
        }
    } catch (error) {
        console.error(`GitHub ${authType} error:`, error);
        alert(`GitHub ${authType} failed. Please try again.`);
    }
}

// Send auth tokens to your backend
async function authenticateWithServer(provider, token, authType) {
    console.log(`Authenticating with ${provider} (${authType})`);
    
    try {
        // Log request details for debugging
        console.log(`Sending ${provider} auth request to: http://localhost:3000/api/auth/${provider}`);
        
        const response = await fetch(`http://localhost:3000/api/auth/${provider}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, authType })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store the token in localStorage
            localStorage.setItem('token', data.token);
            console.log(`${provider} ${authType} successful!`);
            alert(`${provider} ${authType} successful!`);
            
            // Redirect to inventory page
            window.location.href = "../inventory/index.html";
        } else {
            console.error(`${provider} auth error:`, data.message);
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error(`Error during ${provider} ${authType}:`, error);
        alert(`${provider} ${authType} failed. Please try again.`);
        throw error; // Re-throw for additional handling if needed
    }
}

// Handle Sign Up form submission for email/password
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
            alert("Sign up successful!");
            localStorage.setItem("token", data.token); // Store token
            // Redirect to inventory page
            window.location.href = "../inventory/index.html";
        } else {
            // Handle signup errors from the server
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error("Error during sign up:", error);
        alert("Sign up failed. Please try again.");
    }
});

// Handle Login form submission for email/password
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

// Add this to help with debugging
console.log("Updated script loaded successfully");