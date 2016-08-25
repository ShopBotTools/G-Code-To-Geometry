var path = require("path");
module.exports = {
    entry: {
        gcodetogeometry : "./node-package/gcodetogeometry.js"
    },
    output: {
        path: path.join(__dirname, "browser"),
        filename: "[name].js",
        library: "gcodetogeometry",
        libraryTarget: "umd"
    }
};
