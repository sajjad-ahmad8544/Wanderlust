const Listing = require("../models/listing.js");
const Booking = require("../models/booking.js");
const { sendEmail } = require("../utils/sendEmail.js");

// A "pending" booking (user is still on the Razorpay page) holds the dates
// for this many minutes. After that, other guests can book them.
const PENDING_HOLD_MINUTES = 15;

// Returns true if the listing has NO overlapping booking for the given dates.
// Blocking bookings = confirmed ones + pending ones that are still within the hold time.
// (excludeBookingId lets you ignore a booking you're currently processing.)
module.exports.isAvailable = async (listingId, checkIn, checkOut, excludeBookingId = null) => {
    const holdCutoff = new Date(Date.now() - PENDING_HOLD_MINUTES * 60 * 1000);
    const query = {
        listing: listingId,
        $or: [
            { status: "confirmed" },
            { status: "pending", createdAt: { $gt: holdCutoff } },
        ],
        checkIn: { $lt: checkOut },
        checkOut: { $gt: checkIn },
    };
    if (excludeBookingId) {
        query._id = { $ne: excludeBookingId };
    }
    const overlapping = await Booking.findOne(query);
    return !overlapping;
};

// "My Bookings" dashboard - bookings made BY the current user
module.exports.index = async (req, res) => {
    const bookings = await Booking.find({ user: req.user._id, status: { $ne: "pending" } })
        .populate("listing")
        .sort({ checkIn: 1 });
    res.render("bookings/index.ejs", { bookings });
};

// Guest cancels their own booking - gets an email, and a refund if they had paid
module.exports.destroy = async (req, res) => {
    let { id } = req.params;
    const booking = await Booking.findByIdAndUpdate(id, { status: "cancelled" }, { new: true }).populate("listing");

    if (booking) {
        const { refundBooking } = require("./payment.js"); // lazy require (avoids circular import)
        const refundId = await refundBooking(booking);
        await sendEmail({
            to: req.user.email,
            subject: "Booking Cancelled - Wanderlust",
            html: `
                <h2>Your booking has been cancelled</h2>
                <p>Hi ${req.user.username},</p>
                <p>Your booking for <strong>${booking.listing.title}</strong>
                (${booking.checkIn.toDateString()} &rarr; ${booking.checkOut.toDateString()})
                has been cancelled as requested.</p>
                ${refundId ? "<p>Your full payment will be refunded to the original payment method in 5-7 working days.</p>" : ""}
            `,
        });
    }

    req.flash("success", "Booking cancelled");
    res.redirect("/bookings");
};

// Host Dashboard - all bookings made ON the current user's OWN listings
module.exports.hostIndex = async (req, res) => {
    const myListings = await Listing.find({ owner: req.user._id }).select("_id");
    const listingIds = myListings.map((l) => l._id);

    const bookings = await Booking.find({ listing: { $in: listingIds }, status: { $ne: "pending" } })
        .populate("listing")
        .populate("user")
        .sort({ checkIn: 1 });

    res.render("bookings/host.ejs", { bookings });
};

// Host cancels a booking made on one of their own listings - guest gets notified + refunded
module.exports.hostDestroy = async (req, res) => {
    let { id } = req.params;
    const booking = await Booking.findByIdAndUpdate(id, { status: "cancelled" }, { new: true })
        .populate("listing")
        .populate("user");

    if (booking && booking.user) {
        const { refundBooking } = require("./payment.js"); // lazy require (avoids circular import)
        const refundId = await refundBooking(booking);
        await sendEmail({
            to: booking.user.email,
            subject: "Booking Cancelled by Host - Wanderlust",
            html: `
                <h2>Your booking was cancelled by the host</h2>
                <p>Hi ${booking.user.username},</p>
                <p>Unfortunately, your booking for <strong>${booking.listing.title}</strong>
                (${booking.checkIn.toDateString()} &rarr; ${booking.checkOut.toDateString()})
                has been cancelled by the host.</p>
                <p>We're sorry for the inconvenience. ${refundId ? "Your full payment will be refunded to the original payment method in 5-7 working days." : "Please contact support if you need help with a refund."}</p>
            `,
        });
    }

    req.flash("success", "Booking cancelled");
    res.redirect("/host/bookings");
};