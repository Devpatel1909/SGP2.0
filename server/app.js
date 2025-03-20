import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
import User from "../models/User.js";
import Billing from "../models/Billing.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
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
    const newUser = new User({ username, email, password: hashedPassword, items: [] });
    await newUser.save();

    res.status(201).json({ message: "User signed up successfully" });
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
    res.status(200).json({ token });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get User Profile
app.get("/api/profile", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("username email");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ username: user.username, email: user.email });
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
  const itemId = req.params.id; // Keep id as a string
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

    await user.save(); // Save the updated user document
    res.json(user.items[itemIndex]); // Return updated item
  } catch (error) {
    console.error("Error updating item:", error);
    res.status(500).json({ message: "Error updating item" });
  }
});


// Delete Item
app.delete("/api/items/:id", verifyToken, async (req, res) => {
  const itemId = req.params.id; // Keep id as a string

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const itemIndex = user.items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Item not found" });
    }

    user.items.splice(itemIndex, 1); // Remove item from the array
    await user.save(); // Save the updated user document

    res.json({ message: "Item deleted successfully" });
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).json({ message: "Error deleting item" });
  }
});

app.post('/api/billing', async (req, res) => {  
  try {  
      const billing = new Billing(req.body);  
      await billing.save();  
      res.status(201).send(billing);  
  } catch (error) {  
      res.status(400).send(error);  
  }  
});  

// Get All Billing Records  
app.get('/api/billing', async (req, res) => {  
  try {  
      const billings = await Billing.find().populate('user').populate('items.item');  
      res.status(200).send(billings);  
  } catch (error) {  
      res.status(500).send(error);  
  }  
});  

// Get Billing Record by ID  
app.get('/api/billing/:id', async (req, res) => {  
  try {  
      const billing = await Billing.findById(req.params.id).populate('user').populate('items.item');  
      if (!billing) {  
          return res.status(404).send();  
      }  
      res.status(200).send(billing);  
  } catch (error) {  
      res.status(500).send(error);  
  }  
});  

// Update Billing Record by ID  
app.patch('/api/billing/:id', async (req, res) => {  
  try {  
      const billing = await Billing.findByIdAndUpdate(req.params.id, req.body, { new: true });  
      if (!billing) {  
          return res.status(404).send();  
      }  
      res.status(200).send(billing);  
  } catch (error) {  
      res.status(400).send(error);  
  }  
});  

// Delete Billing Record by ID  
app.delete('/api/billing/:id', async (req, res) => {  
  try {  
      const billing = await Billing.findByIdAndDelete(req.params.id);  
      if (!billing) {  
          return res.status(404).send();  
      }  
      res.status(200).send(billing);  
  } catch (error) {  
      res.status(500).send(error);  
  }  
});  
// Undefined Routes Handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Start Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));