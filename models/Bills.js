import mongoose from "mongoose";
const url = "mongodb://localhost:27017";
const billing=new mongoose.Schema({
    "bill_id":{type:String},
    "bill_date":{type:String},
    "bill_items":{type:String},
    "bill_amount":{type:String},
    "bill_type":{type:String},
    "bill_user_name":{type:String},
    "bill_user_email":{type:String},
    "bill_user_phone":{type:String},
    
mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });