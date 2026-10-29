const { format } = require("node:util");

// connect-flash 0.1.1 calls the deprecated util.isArray() API on writes.
// Keep its small request API while using the supported Array.isArray().
module.exports = function flash() {
    return function flashMiddleware(req, res, next) {
        if (!req.flash) {
            req.flash = function flashMessage(type, message, ...formatArgs) {
                if (!req.session) {
                    throw new Error("req.flash() requires sessions");
                }

                const messages = req.session.flash || (req.session.flash = {});

                if (type && message) {
                    if (formatArgs.length > 0) {
                        message = format(message, ...formatArgs);
                    }

                    if (Array.isArray(message)) {
                        messages[type] = messages[type] || [];
                        messages[type].push(...message);
                        return messages[type].length;
                    }

                    messages[type] = messages[type] || [];
                    messages[type].push(message);
                    return messages[type].length;
                }

                if (type) {
                    const queued = messages[type] || [];
                    delete messages[type];
                    return queued;
                }

                req.session.flash = {};
                return messages;
            };
        }

        next();
    };
};
