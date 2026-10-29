// ========================================
// 1. Load Environment Variables
// ========================================
require("dotenv").config({ quiet: true });

// ========================================
// 2. Import Packages
// ========================================
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const dns = require("dns");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("./utils/flash.js");
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
const staticRouter = require("./routes/static.js");

// ========================================
// 4. Environment Variables
// ========================================
const dbUrl = process.env.ATLASDB_URL;
const sessionSecret = process.env.SESSION_SECRET;

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
app.get("/favicon.ico", (req, res) => res.redirect(302, "/favicon.svg"));

// ========================================
// 7. MongoDB Session Store
// ========================================
const store = process.env.NODE_ENV === "production"
    ? MongoStore.create({
        mongoUrl: dbUrl,
        collectionName: "app_sessions",
        touchAfter: 24 * 3600,
    })
    : undefined;

if (store) {
    store.on("error", (err) => {
        console.error("MONGO SESSION STORE ERROR:", err.message);
    });
}

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
// 12. Optional Request and Response Logging
// ========================================
app.use((req, res, next) => {
    if (process.env.LOG_REQUESTS !== "true") {
        return next();
    }

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

// Chrome DevTools probes this optional endpoint when inspecting localhost.
app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
    res.status(204).end();
});

// Keep the site reachable while Atlas is unavailable so the browser shows the
// actual dependency problem (with the real reason) instead of a blank/error page.
// The page auto-refreshes every 10s and the server keeps retrying the DB in the
// background, so the site comes up by itself once the DB is reachable.
let lastDbError = null;
const unavailableTemplate = fs.readFileSync(
    path.join(__dirname, "public", "database-unavailable.html"),
    "utf8"
);
const escapeHtml = (str) =>
    String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

app.use((req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        const reason = process.env.NODE_ENV === "production"
            ? "Database connection unavailable."
            : (lastDbError || "Connecting to the database...");
        return res
            .status(503)
            .type("html")
            .send(unavailableTemplate.replace("__DB_ERROR__", escapeHtml(reason)));
    }
    next();
});

// ========================================
// 13. Application Routes
// ========================================
app.use("/", staticRouter);
app.use("/wishlist", wishlistRouter);
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", bookingRouter);
app.use("/", userRouter);

// The default browser URL should open the listings page.
app.get("/", (req, res) => {
    res.redirect("/listings");
});

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
let dnsFallbackApplied = false;

async function connectWithRetry(attempt = 1) {
    try {
        await mongoose.connect(dbUrl, { serverSelectionTimeoutMS: 10000 });
        lastDbError = null;
        console.log("Connected to MongoDB Atlas");
    } catch (err) {
        lastDbError = err.message;
        console.error(`DB CONNECT FAILED (attempt ${attempt}):`, err.message);

        // Many ISP/router DNS servers cannot resolve the SRV record used by
        // mongodb+srv:// URLs. Retry once with public DNS servers.
        if (!dnsFallbackApplied && /querySrv/.test(err.message)) {
            dnsFallbackApplied = true;
            dns.setServers(["8.8.8.8", "1.1.1.1"]);
            console.error("Switched to public DNS (8.8.8.8 / 1.1.1.1), retrying now...");
            return connectWithRetry(attempt + 1);
        }

        console.error(
            "Check: (1) internet is on, (2) Atlas cluster is not paused, " +
            "(3) your current IP is allowed in Atlas -> Network Access, " +
            "(4) username/password in ATLASDB_URL are correct. Retrying in 10s..."
        );
        setTimeout(() => connectWithRetry(attempt + 1), 10000);
    }
}

function startServer() {
    const PORT = process.env.PORT || 8080;
    const server = app.listen(PORT, () => {
        console.log(`Server is listening on port ${PORT}`);
    });

    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.error(
                `PORT ${PORT} is already in use. Close the other running server ` +
                `(or set a different PORT in .env) and run npm start again.`
            );
        } else {
            console.error("SERVER ERROR:", err.message);
        }
        process.exit(1);
    });

    connectWithRetry();
}

startServer();
