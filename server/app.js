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


// Add these routes to your server.js file

// Google OAuth callback handler
// In your Express backend
app.get('/auth/google/callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    // Redirect to frontend with error
    return res.redirect(`http://localhost:5500/login/login.html?error=missing_code`);
  }
  
  try {
    // Exchange the code for tokens with Google
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `http://localhost:3000/auth/google/callback`,
      grant_type: 'authorization_code'
    });

    const { id_token, access_token } = tokenResponse.data;
    
    // Get user info from Google
    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    
    const userData = userInfoResponse.data;
    
    // Find or create user in your database
    let user = await User.findOne({ email: userData.email });
    
    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      
      user = new User({
        username: userData.name,
        email: userData.email,
        password: hashedPassword,
        profilePicture: userData.picture,
        authProvider: 'google',
        items: []
      });
      
      await user.save();
    }
    
    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    
    // IMPORTANT: Redirect back to the frontend with the token
    res.redirect(`http://localhost:5500/login/login.html?token=${token}&provider=google&state=${state}`);
  } catch (error) {
    console.error('Google auth error:', error);
    res.redirect(`http://localhost:5500/login/login.html?error=google_auth_failed`);
  }
});


// GitHub OAuth callback handler (similar approach)
app.get('/auth/github/callback', (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  
  if (!code) {
    return res.redirect('/login/login.html?error=missing_code');
  }
  
  res.redirect(`/login/login.html?code=${code}&state=${state}&provider=github`);
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
// Get Billing Data
app.get("/api/billing/:billId", verifyToken, async (req, res) => {
  try {
    const billing = await Billing.findOne({ bill_id: req.params.billId });
    if (!billing) {
      return res.status(404).json({ message: "Billing not found" });
    }
    res.json(billing);
  } catch (error) {
    console.error("Error fetching billing:", error);
    res.status(500).json({ message: "Error fetching billing data" });
  }
});


app.get("/api/billing", verifyToken, async (req, res) => {
  try {
    // Get pagination parameters from query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // Count total records for pagination info
    const total = await Billing.countDocuments();
    
    // Get records for the current page
    const billingRecords = await Billing.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Return with pagination info
    res.status(200).json({ 
      message: "Billing records retrieved successfully", 
      records: billingRecords,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching billing records:", error);
    res.status(500).json({ message: "Error fetching billing records" });
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
// Add this to your server.js file after your existing routes

// Get Dashboard Metrics
app.get("/api/dashboard/metrics", verifyToken, async (req, res) => {
  try {
    // Get current date and date from 30 days ago for comparison
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(today.getDate() - 60);
    
    // Get total sales for current period
    const currentPeriodSales = await Billing.aggregate([
      { 
        $match: { 
          createdAt: { $gte: thirtyDaysAgo }
        } 
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$grandTotal" }
        }
      }
    ]);
    
    // Get total sales for previous period
    const previousPeriodSales = await Billing.aggregate([
      { 
        $match: { 
          createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
        } 
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$grandTotal" }
        }
      }
    ]);
    
    // Calculate total sales and percentage change
    const totalSales = currentPeriodSales.length > 0 ? currentPeriodSales[0].total : 0;
    const previousSales = previousPeriodSales.length > 0 ? previousPeriodSales[0].total : 0;
    const salesChange = previousSales === 0 ? 0 : Math.round(((totalSales - previousSales) / previousSales) * 100);
    
    // Get total orders count for current period
    const currentPeriodOrdersCount = await Billing.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    // Get total orders count for previous period
    const previousPeriodOrdersCount = await Billing.countDocuments({
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
    });
    
    // Calculate orders percentage change
    const ordersChange = previousPeriodOrdersCount === 0 ? 0 : 
      Math.round(((currentPeriodOrdersCount - previousPeriodOrdersCount) / previousPeriodOrdersCount) * 100);
    
    // Get total products count
    const totalProducts = await User.aggregate([
      { $unwind: "$items" },
      { $group: { _id: null, count: { $sum: 1 } } }
    ]);
    
    // Get total customers count (assuming each billing record has a unique customer)
    const totalCustomers = await Billing.distinct('customerPhone').length;
    
    // Return all metrics
    res.status(200).json({
      totalSales,
      totalOrders: currentPeriodOrdersCount,
      totalProducts: totalProducts.length > 0 ? totalProducts[0].count : 0,
      totalCustomers,
      changes: {
        sales: salesChange,
        orders: ordersChange,
        products: 0, // Assuming no change for demo
        customers: 12 // Hardcoded for demo, replace with actual calculation
      }
    });
  } catch (error) {
    console.error("Error fetching dashboard metrics:", error);
    res.status(500).json({ message: "Error fetching dashboard metrics" });
  }
});

// Get Monthly Sales Data for Chart
app.get("/api/dashboard/sales-chart", verifyToken, async (req, res) => {
  try {
    // Get current year
    const currentYear = new Date().getFullYear();
    
    // Aggregate monthly sales for the current year
    const monthlySales = await Billing.aggregate([
      {
        $match: {
          invoiceDate: {
            $gte: new Date(`${currentYear}-01-01`),
            $lte: new Date(`${currentYear}-12-31`)
          }
        }
      },
      {
        $group: {
          _id: { $month: "$invoiceDate" },
          total: { $sum: "$grandTotal" }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Create an array for all 12 months with 0 as default
    const salesData = Array(12).fill(0);
    
    // Fill in the actual data
    monthlySales.forEach(item => {
      salesData[item._id - 1] = item.total;
    });
    
    res.status(200).json({
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      data: salesData
    });
  } catch (error) {
    console.error("Error fetching sales chart data:", error);
    res.status(500).json({ message: "Error fetching sales chart data" });
  }
});

// Get Top Products for Chart
app.get("/api/dashboard/top-products", verifyToken, async (req, res) => {
  try {
    // Aggregate all items from billing records and count quantities
    const topProducts = await Billing.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          totalSold: { $sum: "$items.quantity" }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 }
    ]);
    
    res.status(200).json({
      labels: topProducts.map(product => product._id),
      data: topProducts.map(product => product.totalSold)
    });
  } catch (error) {
    console.error("Error fetching top products data:", error);
    res.status(500).json({ message: "Error fetching top products data" });
  }
});

// Get Low Stock Items
app.get("/api/inventory/low-stock", verifyToken, async (req, res) => {
  try {
    // Get all items from all users
    const users = await User.find({}, { items: 1 });
    
    // Flatten items array and filter low stock items
    const allItems = [];
    users.forEach(user => {
      user.items.forEach(item => {
        // Add item with reorder level calculation
        // Assuming reorder level is 20% of initial quantity or at least 10 units
        const reorderLevel = Math.max(10, Math.ceil(item.quantity * 0.2));
        
        // Determine status based on current stock level
        let status = 'normal';
        if (item.quantity <= reorderLevel * 0.5) {
          status = 'critical';
        } else if (item.quantity <= reorderLevel) {
          status = 'warning';
        }
        
        if (status !== 'normal') {
          allItems.push({
            name: item.name,
            currentStock: item.quantity,
            reorderLevel,
            status
          });
        }
      });
    });
    
    // Sort by status (critical first) and then by stock level (lowest first)
    const sortedItems = allItems.sort((a, b) => {
      if (a.status === 'critical' && b.status !== 'critical') return -1;
      if (a.status !== 'critical' && b.status === 'critical') return 1;
      return a.currentStock - b.currentStock;
    });
    
    // Return limited number of items
    res.status(200).json(sortedItems.slice(0, 10));
  } catch (error) {
    console.error("Error fetching low stock items:", error);
    res.status(500).json({ message: "Error fetching low stock items" });
  }
});

// Start Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));