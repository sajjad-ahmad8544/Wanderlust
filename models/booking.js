const express = require("express");

const router =
express.Router({ mergeParams: true });

const Booking =
require("../models/booking");

const Listing =
require("../models/listing");

const { isLoggedIn } =
require("../middleware");


// CREATE BOOKING
router.post(
  "/",
  isLoggedIn,
  async (req, res) => {

    const { id } = req.params;

    const listing =
    await Listing.findById(id);

    const {
      checkIn,
      checkOut,
      guests,
    } = req.body;

    // TOTAL DAYS
    const days =
    Math.ceil(
      (
        new Date(checkOut) -
        new Date(checkIn)
      ) /
      (1000 * 60 * 60 * 24)
    );

    // TOTAL PRICE
    const totalPrice =
    days * listing.price;

    // CREATE BOOKING
    const booking =
    new Booking({

      listing: listing._id,

      user: req.user._id,

      checkIn,

      checkOut,

      guests,

      totalPrice,

    });

    await booking.save();

    req.flash(
      "success",
      "Booking Confirmed!"
    );

    res.redirect(
      `/listings/${id}`
    );
  }
);


// MY BOOKINGS
router.get(
  "/my-bookings",
  isLoggedIn,
  async (req, res) => {

    const bookings =
    await Booking.find({
      user: req.user._id,
    }).populate("listing");

    res.render(
      "listings/bookings.ejs",
      { bookings }
    );
  }
);

module.exports = router;