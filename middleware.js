const Listing = require("./models/listing");
const Review = require("./models/review");
const Booking = require("./models/booking");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema, bookingSchema } = require("./schema.js");

module.exports.isLoggedIn = (req, res, next) => {
    if(!req.isAuthenticated()){
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "You must be logged in to do that!");
        return res.redirect("/login");
    }
    next();
};

module.exports.saveRedirectUrl = (req,res,next) => {
    if(req.session.redirectUrl) {
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
};

module.exports.isOwner = async (req,res,next) => {
  let {id} = req.params;
  let listing = await Listing.findById(id);
  if(!listing){
    req.flash("error", "Listing you requested for does not exist!");
    return res.redirect("/listings");
  }
  if(!listing.owner || !listing.owner.equals(res.locals.currUser._id)){
    req.flash("error", "you are not the owner of this listing");
    return res.redirect(`/listings/${id}`);
  }
  next();
};

module.exports.validateListing =(req,res,next)=>{
    const { error } = listingSchema.validate(req.body);
    if(error){
        let errMsg = error.details.map(el => el.message).join(",");
        throw new ExpressError(400, errMsg);
    } else{
        next();
    }
};

// validate review
module.exports.validateReview =(req,res,next)=>{
    const { error } = reviewSchema.validate(req.body);
    if(error){
        let errMsg = error.details.map(el => el.message).join(",");
        throw new ExpressError(400, errMsg);
    } else{
        next();
    }
};

module.exports.isReviewAuthor = async(req, res, next) => {
    let { id, reviewId } = req.params;
    let review = await Review.findById(reviewId);
    if(!review){
        req.flash("error", "Review not found");
        return res.redirect(`/listings/${id}`);
    }
    if(!review.author || !review.author.equals(res.locals.currUser._id)){
        req.flash("error","you are not the author of this review");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

// validate booking
module.exports.validateBooking = (req, res, next) => {
    const { error } = bookingSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map(el => el.message).join(",");
        req.flash("error", errMsg);
        let { id } = req.params;
        return res.redirect(`/listings/${id}`);
    } else {
        next();
    }
};

module.exports.isBookingAuthor = async (req, res, next) => {
    let { id } = req.params;
    let booking = await Booking.findById(id);
    if(!booking){
        req.flash("error", "Booking not found");
        return res.redirect("/bookings");
    }
    if(!booking.user.equals(res.locals.currUser._id)){
        req.flash("error", "you are not authorized to modify this booking");
        return res.redirect("/bookings");
    }
    next();
};

// Host Dashboard: current user must OWN the listing linked to this booking
module.exports.isListingOwnerForBooking = async (req, res, next) => {
    let { id } = req.params;
    let booking = await Booking.findById(id).populate("listing");
    if(!booking){
        req.flash("error", "Booking not found");
        return res.redirect("/host/bookings");
    }
    if(!booking.listing || !booking.listing.owner.equals(res.locals.currUser._id)){
        req.flash("error", "you are not authorized to manage this booking");
        return res.redirect("/host/bookings");
    }
    next();
};