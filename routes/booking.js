const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isBookingAuthor, isListingOwnerForBooking, validateBooking } = require("../middleware.js");
const bookingController = require("../controllers/bookings.js");
const paymentController = require("../controllers/payment.js");

// STEP 1: guest submits booking form -> validate + create Razorpay order + show checkout page
router.post(
    "/listings/:id/bookings",
    isLoggedIn,
    validateBooking,
    wrapAsync(paymentController.initiatePayment)
);

// STEP 2: Razorpay popup succeeded -> verify signature -> confirm the booking
router.post(
    "/payments/verify",
    isLoggedIn,
    wrapAsync(paymentController.verifyPayment)
);

// Guest closed the payment popup -> release the held dates
router.post(
    "/payments/cancel",
    isLoggedIn,
    wrapAsync(paymentController.cancelPending)
);

// "My Bookings" dashboard
router.get(
    "/bookings",
    isLoggedIn,
    wrapAsync(bookingController.index)
);

// Cancel a booking
router.delete(
    "/bookings/:id",
    isLoggedIn,
    isBookingAuthor,
    wrapAsync(bookingController.destroy)
);

// Host Dashboard - bookings made on the current user's own listings
router.get(
    "/host/bookings",
    isLoggedIn,
    wrapAsync(bookingController.hostIndex)
);

// Host cancels a booking on one of their own listings
router.delete(
    "/host/bookings/:id",
    isLoggedIn,
    isListingOwnerForBooking,
    wrapAsync(bookingController.hostDestroy)
);

module.exports = router;