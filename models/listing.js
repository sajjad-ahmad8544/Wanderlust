const { ref } = require("joi");
const mongoose = require("mongoose");
const Review = require("./review.js");
// create schema
const Schema = mongoose.Schema;
const listingSchema = new Schema({
    title: {
       type: String,
       required: true,
    },
    description: String,
    image: {
        url: String,
        filename: String,
    },
    price: Number,
    location: String,
    country: String,
    
    category: {
    type: String,
},
    reviews: [
        {
            type: Schema.Types.ObjectId,
            ref: "Review",
        },
    ],
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    geometry: {
        type: {
            type: String, 
            enum: ['Point'], // 'geometry.type' must be 'Point'
            // required: true
        },
        coordinates: {
            type: [Number],
            // required: true
        }
    }
});

listingSchema.post("findOneAndDelete", async(listing) =>{
    if(listing) { 
        await Review.deleteMany({_id :{$in: listing.reviews}});
    }
});
// create models
const Listing = mongoose.model("Listing", listingSchema);
// export models to app.js
module.exports = Listing;

