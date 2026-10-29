const express = require("express");
const router = express.Router();

router.get("/privacy", (req, res) => {
    res.render("static/privacy.ejs");
});

router.get("/terms", (req, res) => {
    res.render("static/term.ejs");
});

module.exports = router;