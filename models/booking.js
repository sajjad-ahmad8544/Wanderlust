const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema({
    listing: {
        type: Schema.Types.ObjectId,
        ref: "Listing",
        required: true,
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    checkIn: {
        type: Date,
        required: true,
    },
    checkOut: {
        type: Date,
        required: true,
    },
    guests: {
        type: Number,
        required: true,
        min: 1,
    },
    totalPrice: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ["pending", "confirmed", "cancelled"],
        default: "pending",
    },
    // Razorpay order created on the server (order_xxx)
    razorpayOrderId: {
        type: String,
    },
    // Razorpay payment id (pay_xxx), set after successful verification
    paymentId: {
        type: String,
    },
    refundId: {
        type: String,
    },
}, { timestamps: true });

module.exports = mongoose.model("Booking", bookingSchema);