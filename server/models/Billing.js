import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    id: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    total: { type: Number, required: true }
});

const billingSchema = new mongoose.Schema({
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    customerEmail: { type: String, required: false },
    customerAddress: { type: String, required: false },
    invoiceDate: { type: Date, default: Date.now },
    invoiceNo: { type: String, required: true },
    paymentMethod: { type: String, required: true },
    paymentStatus: { type: String, required: true },
    paymentNote: { type: String, required: false },
    items: [itemSchema],
    bill_id: { type: String, required: true, unique: true } // Ensure bill_id is defined
});

const Billing = mongoose.model('Billing', billingSchema);

export default Billing;