import mongoose from "mongoose"; // Import mongoose

// Define the schema for an item
const itemSchema = new mongoose.Schema({
  id:{  type:String ,require:true},
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 }, // Ensure quantity is non-negative
  price: { type: Number, required: true, min: 0 }, // Ensure price is non-negative
  profit: { type: Number, required: true, min: 0 }, // Ensure profit is non-negative
  expiry: { type: Date, required: true }, // Add expiry date
});

// Define the schema for a user
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  items: [itemSchema], // Define items as an array of i;temSchema
});

// Create the User model
const User = mongoose.model("User", userSchema);

export default User;
