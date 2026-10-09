const express = require("express");
const router = express.Router();

const User = require("../models/user");
const Listing = require("../models/listing");
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn } = require("../middleware");

// ADD TO WISHLIST
router.post(
  "/:id",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      req.flash("error", "Listing not found");
      return res.redirect("/listings");
    }

    // $addToSet = duplicate nahi banega
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { wishlist: listing._id },
    });

    req.flash("success", "Added to wishlist!");
    res.redirect(`/listings/${listing._id}`);
  })
);

// SHOW WISHLIST
router.get(
  "/",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.user._id).populate("wishlist");
    const wishlist = (user.wishlist || []).filter(Boolean);
    res.render("listings/wishlist.ejs", { wishlist });
  })
);

// REMOVE FROM WISHLIST
router.delete(
  "/:id",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { wishlist: req.params.id },
    });

    req.flash("success", "Removed from wishlist");
    res.redirect("/wishlist");
  })
);

module.exports = router;