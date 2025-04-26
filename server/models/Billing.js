import mongoose from "mongoose";

// Define a schema for bill items
const BillItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    id: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    total: { type: Number, required: true }
});

// Define the main billing schema
const BillingSchema = new mongoose.Schema({
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    customerEmail: { type: String },
    customerAddress: { type: String },
    invoiceDate: { type: Date, default: Date.now },
    invoiceNo: { type: String, required: true },
    cashier: { type: String },
    paymentMethod: { type: String, required: true },
    paymentStatus: { type: String, required: true },
    paymentNote: { type: String },
    items: [BillItemSchema],
    isDraft: { type: Boolean, default: false },
    bill_id: { type: String, required: true, unique: true },
    grandTotal: { type: Number, default: 0 }
}, {
    timestamps: true
});

// Define indexes separately
BillingSchema.index({ invoiceNo: 1 }, { unique: true });
BillingSchema.index({ customerPhone: 1 });

const Billing = mongoose.model('Billing', BillingSchema);

export default Billing;
