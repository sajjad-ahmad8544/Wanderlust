const Listing = require("../models/listing");
const ExpressError = require("../utils/ExpressError.js");

const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");

// Converts "Manali, India" -> { type: "Point", coordinates: [lng, lat] }
// Never throws: if the token is missing or the place isn't found, returns null
async function geocode(place) {
  try {
    const geocodingClient = mbxGeocoding({ accessToken: process.env.MAP_TOKEN });
    const response = await geocodingClient
      .forwardGeocode({ query: place, limit: 1 })
      .send();
    const feature = response.body.features[0];
    return feature ? feature.geometry : null;
  } catch (err) {
    console.log("Geocoding failed:", err.message);
    return null;
  }
}

// special characters (  )  +  *  etc. se regex crash na ho
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports.index = async (req, res) => {
  let { search, category } = req.query;
  let filter = {};

  // SEARCH FILTER
  if (search && search.trim() !== "") {
    search = search.trim();
    const safeSearch = escapeRegex(search);
    filter.$or = [
      { location:    { $regex: safeSearch, $options: "i" } },
      { country:     { $regex: safeSearch, $options: "i" } },
      { title:       { $regex: safeSearch, $options: "i" } },
      { description: { $regex: safeSearch, $options: "i" } },
    ];
  }

  // CATEGORY FILTER
  // "iconic-cities" (button) ko "iconic cities" (form se save hua) se bhi match karao
  if (category && category.trim() !== "") {
    const parts = category.trim().split(/[-\s]+/).map(escapeRegex);
    filter.category = {
      $regex: `^${parts.join("[\\s-]+")}$`,
      $options: "i",
    };
  }

  const allListings = await Listing.find(filter);
  res.render("listings/index.ejs", { allListings, search, category });
};

module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs");
};

module.exports.showListing = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: { path: "author" },
    })
    .populate("owner");
  if (!listing) {
    req.flash("error", "Listing you requested for does not exist!");
    return res.redirect("/listings");
  }
  res.render("listings/show.ejs", { listing });
};

module.exports.createListing = async (req, res, next) => {
  // image na ho to pehle crash hota tha
  if (!req.file) {
    req.flash("error", "Please upload an image for the listing.");
    return res.redirect("/listings/new");
  }
  let url = req.file.path;
  let filename = req.file.filename;

  const newListing = new Listing(req.body.listing);
  newListing.owner = req.user._id;
  newListing.image = { url, filename };

  const geometry = await geocode(`${newListing.location}, ${newListing.country}`);
  if (geometry) newListing.geometry = geometry;

  let savedListing = await newListing.save();
  console.log(savedListing);

  req.flash("success", "New Listing Created!");
  res.redirect("/listings");
};

module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing you requested for does not exist!");
    return res.redirect("/listings");
  }
  let originalImageUrl = (listing.image && listing.image.url) || "";
  originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");
  res.render("listings/edit.ejs", { listing, originalImageUrl });
};

module.exports.updateListing = async (req, res) => {
  let { id } = req.params;
  let listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing }, { new: true });

  // location change ho sakti hai -> map pin refresh
  const geometry = await geocode(`${listing.location}, ${listing.country}`);
  if (geometry) listing.geometry = geometry;

  if (typeof req.file !== "undefined") {
    let url = req.file.path;
    let filename = req.file.filename;
    listing.image = { url, filename };
  }
  await listing.save();
  req.flash("success", "Listing Updated!");
  res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;
  let deletedListing = await Listing.findByIdAndDelete(id);
  console.log(deletedListing);
  req.flash("success", "Listing Deleted");
  res.redirect("/listings");
};