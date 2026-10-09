const joi = require("joi");

module.exports.listingSchema = joi.object({
    listing: joi.object({
        title: joi.string().required(),
        description: joi.string().allow("", null),
        location: joi.string().required(),
        country: joi.string().required(),
        category: joi.string().required(),
        price: joi.number().required().min(0),
        image: joi.string().allow("",null),
    }).required(),
});

module.exports.reviewSchema = joi.object({
    review: joi.object({
        rating: joi.number().required(),
        comment: joi.string().required(),
    }).required(),
});

module.exports.bookingSchema = joi.object({
    booking: joi.object({
        checkIn: joi.date().required(),
        checkOut: joi.date().required().greater(joi.ref("checkIn")),
        guests: joi.number().required().min(1),
    }).required(),
});
