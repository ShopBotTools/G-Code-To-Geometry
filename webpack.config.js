var path = require("path");
module.exports = {
    entry: {
        gcodetogeometry : "./node-package/gcodetogeometry.js"
    },
    output: {
        path: path.join(__dirname, "build"),
        filename: "[name].js",
        library: "",
        libraryTarget: "umd"
    }
};
