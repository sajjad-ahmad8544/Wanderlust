// ========================================
// 1. Load Environment Variables
// ========================================
require("dotenv").config();

// ========================================
// 2. Import Packages
// ========================================
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;

const ExpressError = require("./utils/ExpressError.js");
const User = require("./models/user.js");

// ========================================
// 3. Import Routes
// ========================================
const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const wishlistRouter = require("./routes/wishlist.js");
const bookingRouter = require("./routes/booking.js");

// ========================================
// 4. Environment Variables
// ========================================
const dbUrl = process.env.ATLASDB_URL;
const sessionSecret = process.env.SESSION_SECRET;

console.log("SESSION_SECRET loaded:", Boolean(sessionSecret));
console.log("ATLASDB_URL loaded:", Boolean(dbUrl));

// ========================================
// 5. Validate Environment Variables
// ========================================
if (!dbUrl) {
    throw new Error("ATLASDB_URL is missing from the .env file.");
}

if (!sessionSecret) {
    throw new Error("SESSION_SECRET is missing from the .env file.");
}

// ========================================
// 6. Express Configuration
// ========================================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Render / Railway jaise hosting pe secure cookie ke liye zaruri
if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);

app.use(express.static(path.join(__dirname, "public")));

// ========================================
// 7. MongoDB Session Store
// ========================================
const store = MongoStore.create({
    mongoUrl: dbUrl,
    collectionName: "app_sessions",   // fresh collection (purane encrypted sessions ignore honge)
    touchAfter: 24 * 3600,
});

store.on("error", (err) => {
    console.error("MONGO SESSION STORE ERROR:", err.message);
});

// ========================================
// 8. Express Session Configuration
// ========================================
const sessionOptions = {
    store: store,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
    },
};

app.use(session(sessionOptions));

// ========================================
// 9. Flash Messages
// ========================================
app.use(flash());

// ========================================
// 10. Passport Authentication
// ========================================
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// ========================================
// 11. EJS Global Variables
// ========================================
app.use((req, res, next) => {
    res.locals.currUser = req.user || null;
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");

    next();
});

// ========================================
// 12. Request and Response Logging
// ========================================
app.use((req, res, next) => {
    console.log("REQUEST:", req.method, req.originalUrl);

    res.on("finish", () => {
        console.log(
            "RESPONSE SENT:",
            req.method,
            req.originalUrl,
            res.statusCode
        );
    });

    next();
});

// ========================================
// 13. Application Routes
// ========================================
app.use("/wishlist", wishlistRouter);
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", bookingRouter);
app.use("/", userRouter);

// ========================================
// 14. 404 Error Handler
// ========================================
app.use((req, res, next) => {
    next(new ExpressError(404, "Page Not Found!"));
});

// ========================================
// 15. Global Error Handler
// ========================================
app.use((err, req, res, next) => {
    console.error("ERROR MESSAGE:", err.message);

    if (process.env.NODE_ENV !== "production") {
        console.error(err.stack);
    }

    if (res.headersSent) {
        return next(err);
    }

    // Error section 11 se pehle aa sakta hai (jaise session store fail ho),
    // tab ye locals set nahi hote aur navbar/flash crash kar dete hain.
    res.locals.currUser = res.locals.currUser || req.user || null;
    res.locals.success = res.locals.success || [];
    res.locals.error = res.locals.error || [];

    const statusCode = err.statusCode || 500;

    res.status(statusCode).render("error.ejs", {
        message:
            statusCode === 500 && process.env.NODE_ENV === "production"
                ? "Something went wrong. Please try again later."
                : err.message || "Something went wrong.",
        err,
    });
});

// ========================================
// 16. Connect Database and Start Server
// ========================================
async function startServer() {
    try {
        await mongoose.connect(dbUrl);

        console.log("Connected to MongoDB Atlas");

        const PORT = process.env.PORT || 8080;

        app.listen(PORT, () => {
            console.log(`Server is listening on port ${PORT}`);
        });
    } catch (err) {
        console.error("SERVER STARTUP ERROR:", err.message);
        process.exit(1);
    }
}

startServer();