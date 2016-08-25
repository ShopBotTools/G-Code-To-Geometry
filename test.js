var GCodeToGeometry = require("./node-package/gcodetogeometry");
console.log(GCodeToGeometry);

var code = "(Illerminaty)\n";
code += "G1 Z-0.333 F66.6\n";
code += "G1 X2\n";
code += "G1 X1 Y1.73205\n";
code += "G1 X0 Y0\n";
code += "G1 Z1\n";
code += "G0 X0.4 Y0.57735\n";
code += "G1 Z-0.333 F66.6\n";
code += "G3 X1.6 R0.8 F91.1\n";
code += "G3 X0.4 R0.8\n";
code += "G1 Z1\n";
var result = GCodeToGeometry.parse(code);
console.log("G-Code parsed in:");
console.log(result);
