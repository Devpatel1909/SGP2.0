// Save this as: D:\Projects\Sgp2\server\models\invoice_counter.js
import mongoose from "mongoose";

const InvoiceCounterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
});

const InvoiceCounter = mongoose.model('InvoiceCounter', InvoiceCounterSchema);

export default InvoiceCounter;
