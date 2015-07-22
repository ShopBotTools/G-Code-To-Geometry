/*jslint todo: true, browser: true, continue: true, white: true*/
/*global GCodeToGeometry, GParser*/

/**
 * Written by Alex Canales for ShopBotTools, Inc.
 */

/**
 * Function to parse the GCode into a series of lines and curves.
 */

GCodeToGeometry.parse = function(code) {
    "use strict";

    function makeResult(gcodeParsed, lines, size, isComplete, errorMessage) {
        return {
            gcode : gcodeParsed,
            lines : lines,
            size : size,
            isComplete : isComplete,
            errorMessage : errorMessage
        };
    }

    //Returns a string if no command
    function removeCommentsAndSpaces(command) {
        var s = command.split('(')[0].split(';')[0]; //No need to use regex
        return s.split(' ').join('').split('\t').join('');
    }

    //Parsing the result of GParser.parse
    function parseParsedGCode(parsed) {
        var obj = {};
        var i = 0;
        var w1 = "", w2 = "";
        var tab = [];
        var emptyObj = true;

        for(i=0; i < parsed.words.length; i++) {
            w1 = parsed.words[i][0];
            w2 = parsed.words[i][1];
            if(w1 === "G" || w1 === "M") {
                if(emptyObj === false) {
                    tab.push(obj);
                    obj = {};
                }
                obj.type = w1 + w2;
                emptyObj = false;
            } else  {
                obj[w1.toLowerCase()] = parseFloat(w2, 10);
            }
        }
        tab.push(obj);
        return tab;
    }

    var totalSize = {
        min : { x: 0, y : 0, z : 0 },
        max : { x: 0, y : 0, z : 0 }
    };

    function checkTotalSize(totalSize, size) {
        var keys = ["x", "y", "z"];
        var i = 0;
        for(i = keys.length - 1; i >= 0; i--) {
            if(totalSize.min[keys[i]] > size.min[keys[i]]) {
                totalSize.min[keys[i]] = size.min[keys[i]];
            }
            if(totalSize.max[keys[i]] < size.max[keys[i]]) {
                totalSize.max[keys[i]] = size.max[keys[i]];
            }
        }
    }

    var i = 0, j = 0;
    var line = {}, res = {};  //RESult
    var start = { x: 0, y : 0, z : 0 };
    var tabRes = [];
    var crossAxe = "z";
    var relative = false, inMm = false;
    var lines= [];

    if(typeof code !== "string" || code  === "") {
        return makeResult([], [], false, totalSize, "There is no GCode");
    }
    var gcode = code.split('\n');


    for(i=0; i < gcode.length; i++) {
        //Sorry for not being really readable :'(
        tabRes = parseParsedGCode(
            GParser.parse(
                removeCommentsAndSpaces(gcode[i]).toUpperCase()
            )
        );

        for(j = 0; j < tabRes.length; j++) {
            res = tabRes[j];
            if(res.type === "G0" || res.type === "G1") {
                line = new GCodeToGeometry.StraightLine(i,
                        start, res, relative, inMm);
                lines.push(line.returnLine());
                checkTotalSize(totalSize, line.getSize());
                start = GCodeToGeometry.copyObject(line.end);
            } else if(res.type === "G2" || res.type === "G3") {
                line = new GCodeToGeometry.CurvedLine(i, start,
                        res, relative, inMm, crossAxe);
                if(line.center === false) {
                    return makeResult(gcode, lines, false, "Radius too short " +
                            "for command " + gcode[i] + " (line " + i +")");
                    // break;
                }
                checkTotalSize(totalSize, line.getSize());
                lines.push(line.returnLine());
                start = GCodeToGeometry.copyObject(line.end);
            } else if(res.type === "G4") {
                console.log("Set pause so continue");
                // continue;  //Add the pause time somewhere?
            } else if(res.type === "G17") {
                crossAxe = "z";
            } else if(res.type === "G18") {
                crossAxe = "y";
            } else if(res.type === "G19") {
                crossAxe = "z";
            } else if(res.type === "G20") {
                //No need to convert start: always in inches
                inMm = false;
                console.log("set inches");
            } else if(res.type === "G21") {
                //No need to convert start: always in inches
                inMm = true;
                console.log("set mm");
            } else if(res.type === "G90") {
                relative = false;
                console.log("set absolute");
            } else if(res.type === "G91") {
                relative = true;
                console.log("set relative");
            } else if(res.type === "M4") {
                console.log("set spin on");
            } else if(res.type === "M8") {
                console.log("set spin off");
            } else if(res.type === "M30") {
                break;
            }

        }
    }

    return makeResult(gcode, lines, totalSize, true, "");
};
