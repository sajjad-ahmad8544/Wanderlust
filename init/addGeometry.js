require("dotenv").config();
const mongoose = require("mongoose");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const Listing = require("../models/listing.js");

(async () => {
  await mongoose.connect("mongodb://127.0.0.1:27017/wanderlust");
  const client = mbxGeocoding({ accessToken: process.env.MAP_TOKEN });

  const listings = await Listing.find({ "geometry.coordinates.0": { $exists: false } });
  console.log(`${listings.length} listings need coordinates`);

  for (const l of listings) {
    try {
      const res = await client
        .forwardGeocode({ query: `${l.location}, ${l.country}`, limit: 1 })
        .send();
      const feature = res.body.features[0];
      if (feature) {
        await Listing.updateOne({ _id: l._id }, { $set: { geometry: feature.geometry } });
        console.log("done:", l.title);
      } else {
        console.log("not found:", l.title, "-", l.location);
      }
    } catch (err) {
      console.log("failed:", l.title, err.message);
    }
  }
  await mongoose.disconnect();
})();