const crypto = require("crypto");
const Razorpay = require("razorpay");
const Listing = require("../models/listing.js");
const Booking = require("../models/booking.js");
const { isAvailable } = require("./bookings.js");
const { sendEmail } = require("../utils/sendEmail.js");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// STEP 1: guest submits the booking form.
// - validate dates + availability
// - calculate price ON THE SERVER (never trust the browser)
// - create a Razorpay order
// - save a "pending" booking (this holds the dates for a few minutes)
// - render the checkout page which opens the Razorpay popup
module.exports.initiatePayment = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing not found");
        return res.redirect("/listings");
    }

    let { checkIn, checkOut, guests } = req.body.booking;
    checkIn = new Date(checkIn);
    checkOut = new Date(checkOut);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkIn < today) {
        req.flash("error", "Check-in date cannot be in the past");
        return res.redirect(`/listings/${id}`);
    }

    if (checkOut <= checkIn) {
        req.flash("error", "Check-out date must be after check-in date");
        return res.redirect(`/listings/${id}`);
    }

        // Agar isi user ki pehle ki unpaid (pending) booking padi hai
    // (popup band kiya / Back dabaya), to use release karo, warna wo khud ko hi block karti hai.
    await Booking.updateMany(
        { listing: listing._id, user: req.user._id, status: "pending" },
        { status: "cancelled" }
    );

    const available = await isAvailable(id, checkIn, checkOut);
    if (!available) {
        req.flash("error", "Sorry, this listing is already booked for those dates. Please choose different dates.");
        return res.redirect(`/listings/${id}`);
    }

    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    const totalPrice = nights * listing.price;

    // Razorpay amount is in the smallest unit (paise): Rs 1 = 100 paise
    const order = await razorpay.orders.create({
        amount: Math.round(totalPrice * 100),
        currency: "INR",
        receipt: `bk_${Date.now()}`,
        notes: {
            listingId: String(listing._id),
            userId: String(req.user._id),
        },
    });

    const booking = await Booking.create({
        listing: listing._id,
        user: req.user._id,
        checkIn,
        checkOut,
        guests,
        totalPrice,
        status: "pending",
        razorpayOrderId: order.id,
    });

    res.render("bookings/payment.ejs", {
        listing,
        booking,
        checkIn: checkIn.toISOString().slice(0, 10),
        checkOut: checkOut.toISOString().slice(0, 10),
        guests,
        totalPrice,
        order,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
};

// STEP 2: Razorpay popup succeeded -> browser posts the 3 values here.
// We verify the signature with our secret key. Only if it matches do we
// mark the booking as confirmed.
module.exports.verifyPayment = async (req, res) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        req.flash("error", "Invalid payment response");
        return res.redirect("/listings");
    }

    // Find OUR pending booking for this order, and make sure it belongs to this user
    const booking = await Booking.findOne({
        razorpayOrderId: razorpay_order_id,
        user: req.user._id,
    }).populate("listing");

    if (!booking) {
        req.flash("error", "Booking not found for this payment");
        return res.redirect("/listings");
    }

    // Already confirmed (e.g. user refreshed the page) - don't process twice
    if (booking.status === "confirmed") {
        req.flash("success", "Booking already confirmed.");
        return res.redirect("/bookings");
    }

    // signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
    const expected = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

    const valid =
        expected.length === razorpay_signature.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));

    if (!valid) {
        req.flash("error", "Payment verification failed. If money was deducted, it will be refunded automatically.");
        return res.redirect(`/listings/${booking.listing._id}`);
    }

    // The dates could have been taken while the user was paying.
    // (isAvailable ignores THIS booking so it doesn't clash with itself.)
    const available = await isAvailable(
        booking.listing._id,
        booking.checkIn,
        booking.checkOut,
        booking._id
    );
    if (!available) {
        // Payment is real but dates are gone -> refund right away
        try {
            const refund = await razorpay.payments.refund(razorpay_payment_id, {
                amount: Math.round(booking.totalPrice * 100),
            });
            booking.refundId = refund.id;
        } catch (err) {
            console.log("Refund failed:", err.message);
        }
        booking.status = "cancelled";
        booking.paymentId = razorpay_payment_id;
        await booking.save();
        req.flash("error", "Sorry, those dates were just booked by someone else. Your payment is being refunded.");
        return res.redirect(`/listings/${booking.listing._id}`);
    }

    booking.status = "confirmed";
    booking.paymentId = razorpay_payment_id;
    await booking.save();

    await sendEmail({
        to: req.user.email,
        subject: "Booking Confirmed - Wanderlust",
        html: `
            <h2>Your booking is confirmed! 🎉</h2>
            <p>Hi ${req.user.username},</p>
            <p>Your stay at <strong>${booking.listing.title}</strong> is booked.</p>
            <ul>
                <li><strong>Check-in:</strong> ${booking.checkIn.toDateString()}</li>
                <li><strong>Check-out:</strong> ${booking.checkOut.toDateString()}</li>
                <li><strong>Guests:</strong> ${booking.guests}</li>
                <li><strong>Total Paid:</strong> ₹${Number(booking.totalPrice).toLocaleString("en-IN")}</li>
                <li><strong>Payment ID:</strong> ${razorpay_payment_id}</li>
            </ul>
            <p>Thanks for booking with Wanderlust!</p>
        `,
    });

    req.flash("success", "Payment successful! Booking confirmed.");
    res.redirect("/bookings");
};

// Called when the user closes the popup / payment fails, so the dates are
// released immediately instead of waiting for the hold to expire.
module.exports.cancelPending = async (req, res) => {
    const { orderId } = req.body;
    await Booking.findOneAndUpdate(
        { razorpayOrderId: orderId, user: req.user._id, status: "pending" },
        { status: "cancelled" }
    );
    res.json({ ok: true });
};

// Full refund for a paid booking (used when a booking is cancelled).
// Safe to call for old DEMO bookings or unpaid ones - it just skips them.
module.exports.refundBooking = async (booking) => {
    if (!booking || !booking.paymentId || booking.paymentId.startsWith("DEMO_")) {
        return null;
    }
    if (booking.refundId) return booking.refundId; // already refunded
    try {
        const refund = await razorpay.payments.refund(booking.paymentId, {
            amount: Math.round(booking.totalPrice * 100),
        });
        booking.refundId = refund.id;
        await booking.save();
        return refund.id;
    } catch (err) {
        console.log("Refund failed:", err.message);
        return null;
    }
};