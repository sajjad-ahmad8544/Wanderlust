const express = require("express");

const router = express.Router();

const User = require("../models/user");

const Listing = require("../models/listing");

const { isLoggedIn } = require("../middleware");


// ADD TO WISHLIST
router.post(
  "/:id",
  isLoggedIn,
  async (req, res) => {

    const listing =
    await Listing.findById(req.params.id);

    const user =
    await User.findById(req.user._id);

    // CHECK ALREADY EXISTS
    if (
      !user.wishlist.includes(listing._id)
    ) {

      user.wishlist.push(listing._id);

      await user.save();
    }

    req.flash(
      "success",
      "Added to wishlist!"
    );

    res.redirect(
      `/listings/${listing._id}`
    );
  }
);


// SHOW WISHLIST
router.get(
  "/",
  isLoggedIn,
  async (req, res) => {

    const user =
    await User.findById(req.user._id)
      .populate("wishlist");

    res.render(
      "listings/wishlist.ejs",
      {
        wishlist: user.wishlist,
      }
    );
  }
);


// REMOVE FROM WISHLIST
router.delete(
  "/:id",
  isLoggedIn,
  async (req, res) => {

    await User.findByIdAndUpdate(
      req.user._id,
      {
        $pull: {
          wishlist: req.params.id,
        },
      }
    );

    req.flash(
      "success",
      "Removed from wishlist"
    );

    res.redirect("/wishlist");
  }
);

module.exports = router;