import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
import axios from "axios";
import User from './models/User.js';
import Billing from './models/Billing.js';
import { OAuth2Client } from 'google-auth-library';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Improved CORS configuration
// Update your corsOptions in server.js
const corsOptions = {
  origin: '*', // For development only - in production, limit to your domain
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept']
};


// Also add this before your routes to handle preflight requests
app.options('*', cors(corsOptions));

app.use(cors(corsOptions));
app.use(express.json());

// MongoDB Connection
const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/SGP2";
mongoose
  .connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("Database connection error:", err);
    process.exit(1);
  });

 app.get('/api/healthcheck', (req, res) => {
    res.status(200).json({ message: 'Server is healthy' });
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) {
    return res.status(403).json({ message: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    req.userId = decoded.userId;
    next();
  });
};


app.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) {
      return res.status(400).send('Missing authorization code');
  }

  try {
      // Exchange code for tokens
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', null, {
          params: {
              code,
              client_id: GOOGLE_CLIENT_ID,
              client_secret: GOOGLE_CLIENT_SECRET,
              redirect_uri: `${req.protocol}://${req.get('host')}/auth/google/callback`,
              grant_type: 'authorization_code',
          },
          headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
          },
      });

      const { id_token, access_token } = tokenResponse.data;

      // Decode ID token to get user info
      const userInfo = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo`, {
          headers: {
              Authorization: `Bearer ${access_token}`,
          },
      });

      const user = userInfo.data;
      console.log("Google user:", user);

      // Here: Find or create user in your DB using email
      // For demo, just generate a token
      const jwtToken = jwt.sign({ email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '1h' });

      // Option 1: Redirect with token in query (e.g., for frontend to store in localStorage)
      res.redirect(`/inventory/index.html?token=${jwtToken}`);

      // Option 2: Set cookie and redirect
      // res.cookie("token", jwtToken, { httpOnly: true }).redirect('/inventory/index.html');

  } catch (error) {
      console.error("Error exchanging Google code:", error?.response?.data || error.message);
      res.status(500).send("Failed to authenticate with Google");
  }
});

app.get('/auth/google/', (req, res) => {
  const authUrl = googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'],
      redirect_uri: 'http://localhost:3000/auth/google/callback', // Ensure this matches your registered URI
  });
  res.redirect(authUrl);
});

// Google OAuth Authentication - Updated for better error handling
app.post("/api/auth/google", async (req, res) => {
  // Add these headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  const { token, authType } = req.body;
  
  if (!token) {
    return res.status(400).json({ message: "No token provided" });
  }
  
  try {
    console.log(`Processing ${authType} request with Google token`);
    
    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(400).json({ message: "Invalid token payload" });
    }
    
    const { email, name, picture } = payload;
    console.log(`Google auth - Email: ${email}, Name: ${name}`);
    
    // Check if user exists
    let user = await User.findOne({ email });
    
    // For signup: create user if doesn't exist
    if (!user) {
      if (authType === 'login') {
        return res.status(400).json({ message: "User not found. Please sign up first." });
      }
      
      // Create a new user with a random password (they'll login via Google)
      const randomPassword = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      
      user = new User({
        username: name,
        email,
        password: hashedPassword,
        profilePicture: picture,
        authProvider: 'google',
        items: []
      });
      
      await user.save();
      console.log(`New Google user created: ${email}`);
    }
    
    // Generate JWT token
    const jwtToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    
    // Return token
    res.status(200).json({ token: jwtToken, user: { email: user.email, name: user.username } });
    
  } catch (error) {
    console.error("Google authentication error:", error);
    res.status(500).json({ message: "Authentication failed", error: error.message });
  }
});

// GitHub OAuth Authentication
app.post("/api/auth/github", async (req, res) => {
  const { code, authType } = req.body;
  
  if (!code) {
    return res.status(400).json({ message: "No code provided" });
  }
  
  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      },
      {
        headers: {
          Accept: 'application/json'
        }
      }
    );
    
    const accessToken = tokenResponse.data.access_token;
    
    // Get user info using the access token
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${accessToken}`
      }
    });
    
    const githubUser = userResponse.data;
    
    // Get user's email (GitHub might not provide it in the user info)
    let userEmail;
    try {
      const emailResponse = await axios.get('https://api.github.com/user/emails', {
        headers: {
          Authorization: `token ${accessToken}`
        }
      });
      
      // Get the primary or first email
      const primaryEmail = emailResponse.data.find(email => email.primary) || emailResponse.data[0];
      userEmail = primaryEmail.email;
    } catch (error) {
      // If we can't get the email, use the login as backup
      userEmail = `${githubUser.login}@github.com`;
      console.log(`Couldn't get GitHub email, using fallback: ${userEmail}`);
    }
    
    // Check if user exists
    let user = await User.findOne({ email: userEmail });
    
    // For signup: create user if doesn't exist
    if (!user) {
      if (authType === 'login') {
        return res.status(400).json({ message: "User not found. Please sign up first." });
      }
      
      // Create a new user with a random password (they'll login via GitHub)
      const randomPassword = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      
      user = new User({
        username: githubUser.name || githubUser.login,
        email: userEmail,
        password: hashedPassword,
        profilePicture: githubUser.avatar_url,
        authProvider: 'github',
        items: []
      });
      
      await user.save();
      console.log(`New GitHub user created: ${userEmail}`);
    }
    
    // Generate JWT token
    const jwtToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    
    // Return token
    res.status(200).json({ token: jwtToken, user: { email: user.email, name: user.username } });
    
  } catch (error) {
    console.error("GitHub authentication error:", error);
    res.status(500).json({ message: "Authentication failed", error: error.message });
  }
});

// Signup Route
app.post("/api/signup", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ 
      username, 
      email, 
      password: hashedPassword, 
      authProvider: 'local',
      items: [] 
    });
    await newUser.save();

    // Generate and return a token for auto-login after signup
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.status(201).json({ message: "User signed up successfully", token });
  } catch (error) {
    console.error("Error signing up:", error);
    res.status(500).json({ message: "Error signing up" });
  }
});

// Login Route
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.status(200).json({ token, user: { email: user.email, name: user.username } });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get User Profile
app.get("/api/profile", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("username email profilePicture authProvider");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ 
      username: user.username, 
      email: user.email,
      profilePicture: user.profilePicture,
      authProvider: user.authProvider
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Error fetching profile" });
  }
});

// Add Item
app.post("/api/items", verifyToken, async (req, res) => {
  const { name, quantity, price, profit, expiry } = req.body;

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const nextId = user.items.length > 0 
      ? Math.max(...user.items.map((item) => item.id)) + 1 
      : 1;

    const newItem = { 
      id: nextId, 
      name, 
      quantity, 
      price, 
      profit, 
      expiry 
    };

    user.items.push(newItem);
    await user.save();

    res.status(201).json(newItem);
  } catch (error) {
    console.error("Error adding item:", error);
    res.status(500).json({ message: "Error adding item" });
  }
});

// Get All Items
app.get("/api/items", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user.items);
  } catch (error) {
    console.error("Error fetching items:", error);
    res.status(500).json({ message: "Error fetching items" });
  }
});

// Update Item
app.put("/api/items/:id", verifyToken, async (req, res) => {
  const itemId = parseInt(req.params.id);
  const { name, quantity, price, profit, expiry } = req.body;

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const itemIndex = user.items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Update the item fields
    if (name !== undefined) user.items[itemIndex].name = name;
    if (quantity !== undefined) user.items[itemIndex].quantity = quantity;
    if (price !== undefined) user.items[itemIndex].price = price;
    if (profit !== undefined) user.items[itemIndex].profit = profit;
    if (expiry !== undefined) user.items[itemIndex].expiry = expiry;

    await user.save();
    res.json(user.items[itemIndex]);
  } catch (error) {
    console.error("Error updating item:", error);
    res.status(500).json({ message: "Error updating item" });
  }
});

// Delete Item
app.delete("/api/items/:id", verifyToken, async (req, res) => {
  const itemId = parseInt(req.params.id);

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const itemIndex = user.items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Item not found" });
    }

    user.items.splice(itemIndex, 1);
    await user.save();

    res.json({ message: "Item deleted successfully" });
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).json({ message: "Error deleting item" });
  }
});

// Endpoint to get suggestions based on item names
app.get('/api/items/suggestions', async (req, res) => {
  const query = req.query.query || '';

  try {
    // Find users with items that match the query
    const users = await User.find({
      'items.name': { $regex: query, $options: 'i' }
    });

    const suggestions = [];

    // Extract matching items from each user
    users.forEach(user => {
      user.items.forEach(item => {
        if (item.name.toLowerCase().includes(query.toLowerCase())) {
          suggestions.push({
            name: item.name,
            id: item.id,
            price: item.price
          });
        }
      });
    });

    // Remove duplicate suggestions based on item name
    const uniqueSuggestions = Array.from(new Set(suggestions.map(item => item.name)))
      .map(name => suggestions.find(item => item.name === name));

    res.json(uniqueSuggestions);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/billing', async (req, res) => {
  const {
      customerName,
      customerPhone,  
      customerEmail,
      customerAddress,
      invoiceDate,
      invoiceNo,
      paymentMethod,
      paymentStatus,
      paymentNote,
      items
  } = req.body;

  // Basic validation
  if (!customerName || !customerPhone || !invoiceNo || !paymentMethod || !paymentStatus || !items || items.length === 0) {
      return res.status(400).json({ message: 'Please fill in all required fields and add at least one product.' });
  }

  try {
      // Generate a unique bill_id
      const bill_id = 'BILL-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

      const billingData = new Billing({
          customerName,
          customerPhone,
          customerEmail,
          customerAddress,
          invoiceDate,
          invoiceNo,
          paymentMethod,
          paymentStatus,
          paymentNote,
          items,
          bill_id
      });

      await billingData.save();
      res.status(201).json({ message: 'Billing data saved successfully!', billingData });
  } catch (error) {
      console.error('Error saving billing data:', error);
      res.status(500).json({ message: 'Failed to save billing data.', error: error.message });
  }
});

// Start Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));