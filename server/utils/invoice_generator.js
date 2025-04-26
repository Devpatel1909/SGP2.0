// Save this as: D:\Projects\Sgp2\server\utils\invoice_generator.js
import InvoiceCounter from '../models/invoice_counter.js';

export async function getNextInvoiceNumber() {
    try {
        const counter = await InvoiceCounter.findOneAndUpdate(
            { _id: 'invoiceNo' },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        
        const year = new Date().getFullYear();
        const paddedNumber = counter.seq.toString().padStart(5, '0');
        
        return `INV-${year}-${paddedNumber}`;
    } catch (error) {
        console.error('Error generating invoice number:', error);
        throw error;
    }
}
