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

// Create notification system
const notificationSystem = document.createElement("div");
notificationSystem.className = "notification-system";
document.body.appendChild(notificationSystem);
// Development configuration - set to true when working without a backend server
const OFFLINE_DEV_MODE = false; // Change to true when developing without a server

// Add CSS for notifications
const notificationStyle = document.createElement("style");
notificationStyle.textContent = `
  .notification-system {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 350px;
    max-width: 90%;
    z-index: 10000;
  }
  
  .notification {
    background-color: white;
    color: #333;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
    margin-bottom: 15px;
    transform: translateX(120%);
    animation: slide-in 0.5s forwards;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  
  .notification.closing {
    animation: slide-out 0.5s forwards;
  }
  
  @keyframes slide-in {
    100% { transform: translateX(0%); }
  }
  
  @keyframes slide-out {
    100% { transform: translateX(120%); }
  }
  
  .notification-header {
    display: flex;
    align-items: center;
    padding: 12px 15px;
    background-color: #f8f8f8;
    border-bottom: 1px solid #eee;
  }
  
  .notification-icon {
    margin-right: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    color: white;
    flex-shrink: 0;
  }
  
  .notification-title {
    font-weight: 600;
    font-size: 16px;
    flex-grow: 1;
  }
  
  .notification-close {
    cursor: pointer;
    font-size: 18px;
    padding: 5px;
    line-height: 0.6;
    color: #999;
  }
  
  .notification-close:hover {
    color: #333;
  }
  
  .notification-body {
    padding: 15px;
    line-height: 1.5;
  }
  
  .notification-progress {
    height: 3px;
    width: 100%;
    background-color: rgba(255, 255, 255, 0.5);
    position: absolute;
    bottom: 0;
    left: 0;
  }
  
  .notification-progress-bar {
    height: 100%;
    width: 100%;
    transform-origin: left;
    animation: progress 5s linear forwards;
  }
  
  @keyframes progress {
    0% { transform: scaleX(1); }
    100% { transform: scaleX(0); }
  }
  
  /* Success notification */
  .notification.success .notification-icon {
    background-color: #4CAF50;
  }
  
  .notification.success .notification-progress-bar {
    background-color: #4CAF50;
  }
  
  /* Error notification */
  .notification.error .notification-icon {
    background-color: #F44336;
  }
  
  .notification.error .notification-progress-bar {
    background-color: #F44336;
  }
  
  /* Warning notification */
  .notification.warning .notification-icon {
    background-color: #FF9800;
  }
  
  .notification.warning .notification-progress-bar {
    background-color: #FF9800;
  }
  
  /* Info notification */
  .notification.info .notification-icon {
    background-color: #2196F3;
  }
  
  .notification.info .notification-progress-bar {
    background-color: #2196F3;
  }
`;
document.head.appendChild(notificationStyle);

// Loading spinner container
const loadingSpinner = document.createElement("div");
loadingSpinner.className = "loading-spinner";
loadingSpinner.innerHTML = `
  <div class="spinner"></div>
  <p>Processing authentication...</p>
`;
document.body.appendChild(loadingSpinner);

// Add CSS for loading spinner
const spinnerStyle = document.createElement("style");
spinnerStyle.textContent = `
  .loading-spinner {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    justify-content: center;
    align-items: center;
    flex-direction: column;
  }
  .loading-spinner.active {
    display: flex;
  }
  .spinner {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin-bottom: 10px;
  }
  .loading-spinner p {
    color: white;
    font-size: 16px;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(spinnerStyle);

// Show notification function
function showNotification(message, type = "info", duration = 5000) {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  
  // Get icon based on notification type
  let icon = "";
  switch(type) {
    case "success":
      icon = "✓";
      break;
    case "error":
      icon = "✕";
      break;
    case "warning":
      icon = "!";
      break;
    case "info":
    default:
      icon = "i";
      break;
  }
  
  // Get title based on notification type
  let title = "";
  switch(type) {
    case "success":
      title = "Success";
      break;
    case "error":
      title = "Error";
      break;
    case "warning":
      title = "Warning";
      break;
    case "info":
    default:
      title = "Information";
      break;
  }
  
  notification.innerHTML = `
    <div class="notification-header">
      <div class="notification-icon">${icon}</div>
      <div class="notification-title">${title}</div>
      <div class="notification-close">×</div>
    </div>
    <div class="notification-body">${message}</div>
    <div class="notification-progress">
      <div class="notification-progress-bar"></div>
    </div>
  `;
  
  notificationSystem.appendChild(notification);
  
  // Close notification when clicking the close button
  const closeBtn = notification.querySelector(".notification-close");
  closeBtn.addEventListener("click", () => {
    closeNotification(notification);
  });
  
  // Auto-close after duration
  setTimeout(() => {
    closeNotification(notification);
  }, duration);
  
  return notification;
}

// Close notification function
function closeNotification(notification) {
  if (notification.classList.contains("closing")) return;
  
  notification.classList.add("closing");
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 500); // Match the slide-out animation duration
}

// Show/hide loading spinner
function showLoading(message = "Processing authentication...") {
  loadingSpinner.querySelector("p").textContent = message;
  loadingSpinner.classList.add("active");
}

function hideLoading() {
  loadingSpinner.classList.remove("active");
}

// Generate a random state for CSRF protection
function generateRandomState() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// Toggle between Sign In and Sign Up forms
registerBtn.addEventListener("click", () => {
  container.classList.add("active");
});

loginBtn.addEventListener("click", () => {
  container.classList.remove("active");
});

// Google OAuth Implementation - Redirect Flow
function setupGoogleAuth() {
  // Your Google Client ID
  const googleClientId = '35808394147-02ktr768hq4evcgjfsui4pvjtr8kqurj.apps.googleusercontent.com';
  
  // Signup with Google
  googleSignupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    console.log("Google signup button clicked");
    
    // Generate and store state for CSRF protection
    const state = generateRandomState();
    sessionStorage.setItem('googleAuthState', state);
    sessionStorage.setItem('googleAuthType', 'signup');
    
    // Important: Redirect to your BACKEND server, not frontend
    const redirectUri = encodeURIComponent(`http://localhost:3000/auth/google/callback`);
    const scope = encodeURIComponent('email profile');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&prompt=select_account&state=${state}`;
    
    // Store the frontend URL so backend knows where to redirect back to
    sessionStorage.setItem('frontendRedirectUrl', `${window.location.origin}/login/login.html`);
    
    console.log("Redirecting to Google OAuth...");
    showLoading("Redirecting to Google...");
    
    setTimeout(() => {
      window.location.href = authUrl;
    }, 500);
  });
  
  // Login with Google
  googleLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    console.log("Google login button clicked");
    
    // Generate and store state for CSRF protection
    const state = generateRandomState();
    sessionStorage.setItem('googleAuthState', state);
    sessionStorage.setItem('googleAuthType', 'login');
    
    // Important: Redirect to your BACKEND server, not frontend
    const redirectUri = encodeURIComponent(`http://localhost:3000/auth/google/callback`);
    const scope = encodeURIComponent('email profile');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;
    
    // Store the frontend URL so backend knows where to redirect back to
    sessionStorage.setItem('frontendRedirectUrl', `${window.location.origin}/login/login.html`);
    
    console.log("Redirecting to Google OAuth...");
    showLoading("Redirecting to Google...");
    
    setTimeout(() => {
      window.location.href = authUrl;
    }, 500);
  });
}

// GitHub OAuth Implementation
function setupGitHubAuth() {
  // GitHub OAuth button handlers
  githubLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    initiateGitHubAuth('login');
  });

  githubSignupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    initiateGitHubAuth('signup');
  });
}

function initiateGitHubAuth(authType) {
  // Replace with your GitHub OAuth App Client ID
  const githubClientId = 'Ov23liYicj2Cn5275wkL';
  
  // Generate and store state for CSRF protection
  const state = generateRandomState();
  sessionStorage.setItem('githubAuthState', state);
  sessionStorage.setItem('githubAuthType', authType);
  
  // The redirect URI configured in your GitHub OAuth App
  const redirectUri = encodeURIComponent(`http://localhost:3000/auth/github/callback`);
  
  // GitHub OAuth authorization URL
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${redirectUri}&scope=user:email&state=${state}`;
  
  // Store the frontend URL so backend knows where to redirect back to
  sessionStorage.setItem('frontendRedirectUrl', `${window.location.origin}/login/login.html`);
  
  console.log(`Initiating GitHub ${authType}...`);
  showLoading("Redirecting to GitHub...");
  
  // Short delay to allow the loading spinner to appear
  setTimeout(() => {
    window.location.href = githubAuthUrl;
  }, 500);
}

// Test server connection
function testServerConnection() {
  console.log("Testing server connection...");
  
  if (OFFLINE_DEV_MODE) {
    console.log("Running in offline development mode - skipping server check");
    showNotification('Running in development mode without server connection', 'info', 5000);
    return Promise.resolve(false);
  }
  
  return fetch('http://localhost:3000/api/healthcheck')
    .then(response => {
      console.log("Server response status:", response.status);
      return response.json();
    })
    .then(data => {
      console.log('Server connection successful:', data);
      showNotification('Server connection successful', 'success', 3000);
      return true;
    })
    .catch(error => {
      console.error('Server connection test failed:', error);
      showNotification('Authentication server is not available. Some features may not work properly.', 'warning', 10000);
      return false;
    });
}

// Handle callbacks from OAuth providers
function handleAuthCallbacks() {
  // Parse the URL to check for OAuth callbacks
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const provider = url.searchParams.get('provider');
  const error = url.searchParams.get('error');
  const token = url.searchParams.get('token');
  
  // Handle direct token (if the backend handles the full OAuth flow)
  if (token) {
    // Store the token
    localStorage.setItem('token', token);
    
    // Show success message
    showNotification('Authentication successful!', 'success');
    
    // Clean the URL
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Redirect to the inventory page after a delay
    setTimeout(() => {
      window.location.href = "../inventory/index.html";
    }, 2000);
    
    return;
  }
  
  // Handle errors from OAuth providers
  if (error) {
    hideLoading();
    console.error("OAuth Error:", error);
    showNotification(`Authentication error: ${error}`, 'error');
    
    // Clean the URL
    window.history.replaceState({}, document.title, window.location.pathname);
    return;
  }
  
  // If no code, not a callback
  if (!code) {
    return;
  }
  
  console.log(`Detected OAuth callback with code`);
  
  // Process Google callback
  if (provider === 'google') {
    const storedState = sessionStorage.getItem('googleAuthState');
    const authType = sessionStorage.getItem('googleAuthType') || 'login';
    
    // Verify state to prevent CSRF attacks
    if (state !== storedState) {
      hideLoading();
      console.error("Google Auth: State mismatch - possible CSRF attack");
      showNotification("Security error: Authentication states don't match", 'error');
      
      // Clean the URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
    
    showLoading(`Processing Google ${authType}...`);
    exchangeGoogleCode(code, authType);
    
    // Clean the URL
    window.history.replaceState({}, document.title, window.location.pathname);
    return;
  }
  
  // Process GitHub callback
  if (provider === 'github') {
    const storedState = sessionStorage.getItem('githubAuthState');
    const authType = sessionStorage.getItem('githubAuthType') || 'login';
    
    // Verify state to prevent CSRF attacks
    if (state !== storedState) {
      hideLoading();
      console.error("GitHub Auth: State mismatch - possible CSRF attack");
      showNotification("Security error: Authentication states don't match", 'error');
      
      // Clean the URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
    
    showLoading(`Processing GitHub ${authType}...`);
    exchangeGitHubCode(code, authType);
    
    // Clean the URL
    window.history.replaceState({}, document.title, window.location.pathname);
    return;
  }
  
  // If code exists but no provider specified, check stored states
  if (code) {
    // Check if this matches a stored Google state
    const googleState = sessionStorage.getItem('googleAuthState');
    if (googleState && state === googleState) {
      const authType = sessionStorage.getItem('googleAuthType') || 'login';
      showLoading(`Processing Google ${authType}...`);
      exchangeGoogleCode(code, authType);
      
      // Clean the URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
    
    // Check if this matches a stored GitHub state
    const githubState = sessionStorage.getItem('githubAuthState');
    if (githubState && state === githubState) {
      const authType = sessionStorage.getItem('githubAuthType') || 'login';
      showLoading(`Processing GitHub ${authType}...`);
      exchangeGitHubCode(code, authType);
      
      // Clean the URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
  }
}

// Exchange Google code for token
async function exchangeGoogleCode(code, authType) {
  try {
    console.log(`Exchanging Google code for auth type: ${authType}`);
    
    const response = await fetch(`http://localhost:3000/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, authType })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Store user token and redirect
      localStorage.setItem('token', data.token);
      
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      
      console.log(`Google ${authType} successful!`);
      
      // Clear auth state data
      sessionStorage.removeItem('googleAuthState');
      sessionStorage.removeItem('googleAuthType');
      sessionStorage.removeItem('frontendRedirectUrl');
      
      hideLoading();
      
      // Show success message and redirect to inventory page
      showNotification(`Google ${authType} successful!`, 'success');
      setTimeout(() => {
        window.location.href = "../inventory/index.html";
      }, 2000);
    } else {
      hideLoading();
      console.error(`Google auth error:`, data.message);
      showNotification(`Error: ${data.message || "Authentication failed"}`, 'error');
      
      // Clear auth state data
      sessionStorage.removeItem('googleAuthState');
      sessionStorage.removeItem('googleAuthType');
      sessionStorage.removeItem('frontendRedirectUrl');
    }
  } catch (error) {
    hideLoading();
    console.error(`Google ${authType} error:`, error);
    showNotification(`Google ${authType} failed. Please try again.`, 'error');
    
    // Clear auth state data
    sessionStorage.removeItem('googleAuthState');
    sessionStorage.removeItem('googleAuthType');
    sessionStorage.removeItem('frontendRedirectUrl');
  }
}

// Exchange GitHub code for token
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
      
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      
      console.log(`GitHub ${authType} successful!`);
      
      // Clear auth state data
      sessionStorage.removeItem('githubAuthState');
      sessionStorage.removeItem('githubAuthType');
      sessionStorage.removeItem('frontendRedirectUrl');
      
      hideLoading();
      
      // Show success message and redirect to inventory page
      showNotification(`GitHub ${authType} successful!`, 'success');
      setTimeout(() => {
        window.location.href = "../inventory/index.html";
      }, 2000);
    } else {
      hideLoading();
      console.error(`GitHub auth error:`, data.message);
      showNotification(`Error: ${data.message || "Authentication failed"}`, 'error');
      
      // Clear auth state data
      sessionStorage.removeItem('githubAuthState');
      sessionStorage.removeItem('githubAuthType');
      sessionStorage.removeItem('frontendRedirectUrl');
    }
  } catch (error) {
    hideLoading();
    console.error(`GitHub ${authType} error:`, error);
    showNotification(`GitHub ${authType} failed. Please try again.`, 'error');
    
    // Clear auth state data
    sessionStorage.removeItem('githubAuthState');
    sessionStorage.removeItem('githubAuthType');
    sessionStorage.removeItem('frontendRedirectUrl');
  }
}

// Setup traditional email/password authentication
function setupTraditionalAuth() {
  // Handle Sign Up form submission for email/password
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const username = document.getElementById("signup-username").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value.trim();
    
    // Validate inputs
    if (!username || !email || !password) {
      showNotification("Please fill in all fields.", "warning");
      return;
    }
    
    if (password.length < 8) {
      showNotification("Password must be at least 8 characters long.", "warning");
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showNotification("Please enter a valid email address.", "warning");
      return;
    }
    
    showLoading("Creating your account...");
    
    try {
      const response = await fetch("http://localhost:3000/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      
      const data = await response.json();
      
      hideLoading();
      
      if (response.ok) {
        // Sign up successful
        showNotification("Account created successfully!", "success");
        localStorage.setItem("token", data.token); // Store token
        
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        
        // Redirect to inventory page after a short delay
        setTimeout(() => {
          window.location.href = "../inventory/index.html";
        }, 2000);
      } else {
        // Handle signup errors from the server
        showNotification(`Error: ${data.message || "Sign up failed"}`, "error");
      }
    } catch (error) {
      hideLoading();
      console.error("Error during sign up:", error);
      showNotification("Sign up failed. Please try again.", "error");
    }
  });

  // Handle Login form submission for email/password
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();
    
    // Validate inputs
    if (!email || !password) {
      showNotification("Please fill in both fields.", "warning");
      return;
    }
    
    showLoading("Logging you in...");
    
    try {
      const response = await fetch("http://localhost:3000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      hideLoading();
      
      if (response.ok) {
        // Store the token in localStorage
        localStorage.setItem("token", data.token);
        
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        
        showNotification("Login successful!", "success");
        // Redirect to inventory page after a short delay
        setTimeout(() => {
          window.location.href = "../inventory/index.html";
        }, 2000);
      } else {
        showNotification(`Error: ${data.message || "Login failed"}`, "error");
      }
    } catch (error) {
      hideLoading();
      console.error("Error during login:", error);
      showNotification("Login failed. Please try again.", "error");
    }
  });
}

// Function to check if the user is already logged in
function checkExistingLogin() {
  const token = localStorage.getItem('token');
  
  if (token) {
    // Validate the token with the server
    fetch('http://localhost:3000/api/validate-token', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (response.ok) {
        // Token is valid, redirect to the inventory page
        console.log("User already logged in, redirecting...");
        showNotification("You're already logged in. Redirecting...", "info");
        setTimeout(() => {
          window.location.href = "../inventory/index.html";
        }, 2000);
      } else {
        // Token is invalid, clear it
        console.log("Invalid token, clearing...");
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    })
    .catch(error => {
      console.log("Error validating token:", error);
      // Don't clear the token on network errors
    });
  }
}

// Initialize auth system
async function initializeAuth() {
  console.log("Initializing authentication system...");
  
  // Check for token in URL (from OAuth redirect)
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const provider = urlParams.get('provider');
  const state = urlParams.get('state');
  const error = urlParams.get('error');
  const code = urlParams.get('code');
  
  // Handle errors
  if (error) {
    showNotification(`Authentication error: ${error}`, 'error');
    // Clean the URL
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // First check if user is already logged in
    checkExistingLogin();
    
    // Test server connection
    const serverConnected = await testServerConnection();
    
    if (!serverConnected) {
      // Warning notification is shown in testServerConnection
    }
    
    // Set up all auth methods
    setupGoogleAuth();
    setupGitHubAuth();
    setupTraditionalAuth();
    
    return;
  }
  
  // Handle successful authentication with direct token
  if (token && provider) {
    // Store the token
    localStorage.setItem('token', token);
    
    // Clean the URL
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Show success message
    showNotification(`${provider.charAt(0).toUpperCase() + provider.slice(1)} authentication successful!`, 'success');
    
    // Fetch user info using the token
    fetch('http://localhost:3000/api/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => response.json())
    .then(userData => {
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Redirect to inventory page after delay
      setTimeout(() => {
        window.location.href = "../inventory/index.html";
      }, 2000);
    })
    .catch(error => {
      console.error("Error fetching user data:", error);
      
      // Still redirect to inventory, just without the user data
      setTimeout(() => {
        window.location.href = "../inventory/index.html";
      }, 2000);
    });
    
    return; // Stop further initialization
  }
  
  // Process OAuth callback with code
  if (code) {
    // Let handleAuthCallbacks function process it
    handleAuthCallbacks();
    return;
  }
  
  // Standard initialization (no OAuth callback or token)
  
  // First check if user is already logged in
  checkExistingLogin();
  
  // Test server connection
  const serverConnected = await testServerConnection();
  
  if (!serverConnected) {
    // Warning notification is shown in testServerConnection
  }
  
  // Set up all auth methods
  setupGoogleAuth();
  setupGitHubAuth();
  setupTraditionalAuth();
  
  console.log("Authentication system initialized");
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  console.log("DOM fully loaded");
  initializeAuth();
});

// Add server status indicator
const serverStatusIndicator = document.createElement('div');
serverStatusIndicator.className = 'server-status-indicator';
serverStatusIndicator.innerHTML = `
  <div class="status-dot"></div>
  <span class="status-text">Server: Checking...</span>
`;
document.body.appendChild(serverStatusIndicator);

// Add CSS for the indicator
const statusIndicatorStyle = document.createElement('style');
statusIndicatorStyle.textContent = `
   .server-status-indicator {
    position: fixed;
    bottom: 10px;
    left: 10px;
    background: rgba(0,0,0,0.7);
    color: white;
    padding: 5px 10px;
    border-radius: 3px;
    font-size: 12px;
    display: flex;
    align-items: center;
    z-index: 1000;
  }.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 5px;
    background-color: #FFC107; /* Yellow for checking */
  }
  .status-dot.online {
    background-color: #4CAF50; /* Green for online */
  }
  .status-dot.offline {
    background-color: #F44336; /* Red for offline */
  }
  .server-status-indicator.dev-mode {
    background: rgba(0,0,0,0.5);
  }
  .server-status-indicator.dev-mode .status-dot {
    background-color: #9C27B0; /* Purple for dev mode */
  }
`;
document.head.appendChild(statusIndicatorStyle);

// Update the testServerConnection function to set the indicator
function updateServerStatus(isConnected) {
  const dot = serverStatusIndicator.querySelector('.status-dot');
  const text = serverStatusIndicator.querySelector('.status-text');
  
  if (OFFLINE_DEV_MODE) {
    serverStatusIndicator.classList.add('dev-mode');
    text.textContent = 'Server: Development Mode';
    return;
  }
  
  if (isConnected) {
    dot.classList.add('online');
    dot.classList.remove('offline');
    text.textContent = 'Server: Online';
  } else {
    dot.classList.remove('online');
    dot.classList.add('offline');
    text.textContent = 'Server: Offline';
  }
}

// Update testServerConnection to call this
function testServerConnection() {
  console.log("Testing server connection...");
  
  if (OFFLINE_DEV_MODE) {
    console.log("Running in offline development mode - skipping server check");
    showNotification('Running in development mode without server connection', 'info', 5000);
    updateServerStatus(false);
    return Promise.resolve(false);
  }
  
  return fetch('http://localhost:3000/api/healthcheck')
    .then(response => {
      console.log("Server response status:", response.status);
      updateServerStatus(true);
      return response.json();
    })
    .then(data => {
      console.log('Server connection successful:', data);
      showNotification('Server connection successful', 'success', 3000);
      return true;
    })
    .catch(error => {
      console.error('Server connection test failed:', error);
      showNotification('Authentication server is not available. Some features may not work properly.', 'warning', 10000);
      updateServerStatus(false);
      return false;
    });
}

// Add a help button to the status indicator
serverStatusIndicator.addEventListener('click', () => {
  if (serverStatusIndicator.querySelector('.status-dot').classList.contains('offline')) {
    showServerTroubleshootingGuide();
  }
});

function showServerTroubleshootingGuide() {
  showNotification(`
    <strong>Server Connection Guide:</strong><br>
    1. Make sure the server is running:<br>
       <code>cd D:/Projects/Sgp2/server</code><br>
       <code>node app.js</code><br>
    2. Check the server console for errors<br>
    3. Verify the server is running on port 3000<br>
    4. If needed, update connection URLs in this file
  `, 'info', 15000);
}

// Add this to help with debugging
console.log("Updated authentication script loaded successfully");