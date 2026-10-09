const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Sends an email but never throws - a failed email should never break
// the booking/cancellation flow the user is actually waiting on.
module.exports.sendEmail = async ({ to, subject, html }) => {
    try {
        await transporter.sendMail({
            from: `"Wanderlust" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });
    } catch (err) {
        console.log("Email send failed:", err.message);
    }
};