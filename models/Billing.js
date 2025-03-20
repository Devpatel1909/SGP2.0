const mongoose = require('mongoose');  

const billingSchema = new mongoose.Schema({  
    user: {   
        type: mongoose.Schema.Types.ObjectId, // Reference to User model  
        ref: 'User',  
        required: true   
    },  
    customerDetails: {  
        name: { type: String, required: true },  
        email: { type: String, required: true },  
        phone: { type: String }, // Optional  
        address: { type: String }  
    },  
    items: [{   
        item: {   
            type: mongoose.Schema.Types.ObjectId, // Reference to Item model  
            ref: 'Item',  
            required: true   
        },  
        quantity: { type: Number, required: true },  
        price: { type: Number, required: true }  
    }],  
    totalAmount: { type: Number, required: true },  
    billingDate: { type: Date, default: Date.now }, // Automatically sets to current date  
    paymentStatus: {   
        type: String,   
        enum: ['Paid', 'Pending', 'Cancelled'],   
        default: 'Pending'   
    }  
});  

const Billing = mongoose.model('Billing', billingSchema);  
module.exports = Billing;  