if(process.env.NODE_ENV != "production"){
    require("dotenv").config();
}
// basic setup
const express = require('express');
const app = express();
const mongoose = require("mongoose");
// const Listing =  require("./models/listing.js");
const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
// const wrapAsync = require("./utils/wrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");
// const { listingSchema, reviewSchema} = require("./schema.js");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const User = require("./models/user.js");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const wishlistRouter = require("./routes/wishlist.js");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

const sessionOptions = {
    secret: "mysupersecretcode",
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 1000,
        httpOnly: true,
    },
};

// app.get("/", (req, res)=>{
//     res.send("Hi, I am root");
// });

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()) );

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(async (req, res, next) => {
    if(req.user){
        res.locals.currUser =
        await User.findById(req.user._id);
    } else {
        res.locals.currUser = null;
    }
    next();
});

app.use((req,res,next) =>{
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    // console.log(success);
    next();
});

// app.get("/demouser", async(req, res) => {
//     let fakeUser = new User({
//         email: "student@gmail.com",
//         username: "delta-student",
//     });

//     let registerUser = await User.register(fakeUser, "helloworld");
//     res.send(registerUser);
// });

// mongoose setup
main().then(()=>{
    console.log("connected to DB");
}).catch((err)=>{
    console.log(err);
});
async function main() {
    await mongoose.connect(MONGO_URL);
}


// // validate listing
// const validateListing =(req,res,next)=>{
// const { error } = listingSchema.validate(req.body);
//     if(error){
//         let errMsg = error.details.map(el => el.message).join(",");
//      throw new ExpressError(400, errMsg);
//     } else{
//         next();
//     }
// }

// validate review
// const validateReview =(req,res,next)=>{
// const { error } = reviewSchema.validate(req.body);
//     if(error){
//         let errMsg = error.details.map(el => el.message).join(",");
//      throw new ExpressError(400, errMsg);
//     } else{
//         next();
//     }
// };

app.use("/wishlist", wishlistRouter);
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);

// // index route for listings
// app.get("/listings",wrapAsync (async(req, res)=>{
//      const allListings = await Listing.find({});
//      res.render("listings/index.ejs", {allListings});
// }));
// // new route
//  app.get("/listings/new", (req, res)=>{
//   res.render("listings/new.ejs");
// });
// //show route
// app.get("/listings/:id",wrapAsync(async(req, res)=>{
//     const {id} = req.params;
//     const listing = await Listing.findById(id).populate("reviews");
//     res.render("listings/show.ejs",{listing});
// })
// );
// // create route
// app.post("/listings",validateListing, wrapAsync(async(req, res, next) => {
    
//     const newListing = new Listing(req.body.listing);
//     await newListing.save();
//     res.redirect("/listings");
// }));
// // edit route
// app.get("/listings/:id/edit",wrapAsync(async(req, res)=>{
// let {id} = req.params;
// const listing = await Listing.findById(id);
// res.render("listings/edit.ejs", {listing});
// }));
// // update route
// app.put("/listings/:id",validateListing,wrapAsync(async(req, res)=>{
//   let {id} = req.params;
//   await Listing.findByIdAndUpdate(id, {...req.body.listing});
//   res.redirect(`/listings/${id}`);
// }));

// // delete route
// app.delete("/listings/:id",wrapAsync(async(req, res)=>{
//     let {id} = req.params;
//    let deletedListing = await Listing.findByIdAndDelete(id);
// //    console.log(deletedListing);
//    res.redirect("/listings");
// }));

//Review Post Route
// app.post("/listings/:id/reviews", wrapAsync(async(req,res) =>{
//    let listing = await Listing.findById(req.params.id);
//    let newReview = new Review(req.body.review);

//    listing.reviews.push(newReview);
   
//    await newReview.save();
//    await listing.save();

//    console.log("new review saved");
//    res.send("new review saved");
// }));

// //Review Post Route
// app.post("/listings/:id/reviews",validateReview, wrapAsync(async(req, res) => {
//     // Trim the ID to remove any accidental spaces that cause the "Cast to ObjectId" error
//     let id = req.params.id.trim(); 
    
//     let listing = await Listing.findById(id);
//     let newReview = new Review(req.body.review);

//     listing.reviews.push(newReview);
    
//     await newReview.save();
//     await listing.save();

//     console.log("new review saved");
    
//     // Redirect back to the listing's show page to see the updated interface
//     res.redirect(`/listings/${listing._id}`); 
// }));

// //Delete Review Route
// app.delete("/listings/:id/reviews/:reviewId", wrapAsync(async(req,res) => {
//     let { id, reviewId } = req.params;

//     await Listing.findByIdAndUpdate(id, {$pull: {reviews: reviewId}});
//     await Review.findByIdAndDelete(reviewId);

//     res.redirect(`/listings/${id}`);
// }));


// error handling middleware
app.use((req,res,next) => {
    next(new ExpressError(404, "Page Not Found!"))
});

app.use((err,req,res,next)=>{
let {statusCode=500, message ="Something went wrong"} = err;
res.status(statusCode).render("error.ejs",{message, err});
// res.status(statusCode).send(message);
    // res.send("something went wrong!");
});
app.listen(8080,()=>{
     console.log("server is listening to port 8080");
})