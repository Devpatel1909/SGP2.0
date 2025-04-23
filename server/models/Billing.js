import mongoose from 'mongoose';

// Item Schema (no changes needed)
const itemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    id: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    total: { type: Number, required: true }
});

// Modified Billing Schema with customerId
const billingSchema = new mongoose.Schema({
    // Add customerId field
    customerId: { 
        type: String,
        required: false, // Make it optional to support both new and existing customers
        index: true // Add index for faster lookups
    },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    customerEmail: { type: String, required: false },
    customerAddress: { type: String, required: false },
    invoiceDate: { type: Date, default: Date.now },
    invoiceNo: { type: String, required: true, unique: true }, // Added unique constraint
    paymentMethod: { type: String, required: true },
    paymentStatus: { type: String, required: true },
    paymentNote: { type: String, required: false },
    items: [itemSchema],
    bill_id: { type: String, required: true, unique: true },
}, { 
    timestamps: true // Add timestamps for createdAt and updatedAt
});

// Create indexes for more efficient querying
billingSchema.index({ customerId: 1 });
billingSchema.index({ customerPhone: 1 });
billingSchema.index({ invoiceNo: 1 }, { unique: true });

const Billing = mongoose.model('Billing', billingSchema);

export default Billing;
