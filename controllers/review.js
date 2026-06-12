const Listing = require("../models/listing");
const Review = require("../models/review");

module.exports.createReview = async(req, res) => {
    let id = req.params.id.trim(); 
    console.log(id);
    let listing = await Listing.findById(id);
    let newReview = new Review(req.body.review);
    newReview.author = req.user._id;
    console.log(newReview);
    listing.reviews.push(newReview);

    await newReview.save();
    await listing.save();
    req.flash("success", "New Review Created!");
    console.log("new review saved"); 
    // Redirect back to the listing's show page to see the updated interface
    res.redirect(`/listings/${listing._id}`); 
}

module.exports.destroyReview = async(req,res) => {
    let { id, reviewId } = req.params;

    await Listing.findByIdAndUpdate(id, {$pull: {reviews: reviewId}});
    await Review.findByIdAndDelete(reviewId);
    req.flash("success", "Review Deleted!");

    res.redirect(`/listings/${id}`);
};