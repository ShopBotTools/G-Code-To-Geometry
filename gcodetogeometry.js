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
                //Make sure multiple commands in one line are interpreted as
                //multiple commands:
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

    var totalSize = {
        min : { x: 0, y : 0, z : 0 },
        max : { x: 0, y : 0, z : 0 }
    };
    var i = 0, j = 0;
    var line = {}, res = {};  //RESult
    var start = { x: 0, y : 0, z : 0 };
    var tabRes = [];
    var crossAxe = "z";
    var relative = false, inMm = false, parsing = true;
    var lines= [];
    var previousFeedrate = 0;

    if(typeof code !== "string" || code  === "") {
        return makeResult([], [], false, totalSize, "There is no GCode");
    }
    var gcode = code.split('\n');


    i = 0;
    while(i < gcode.length && parsing === true) {
        //Sorry for not being really readable :'(
        tabRes = parseParsedGCode(
            GParser.parse(
                removeCommentsAndSpaces(gcode[i]).toUpperCase()
            )
        );

        j = 0;
        while(j < tabRes.length && parsing === true) {
            res = tabRes[j];
            if(res.type === "G0" || res.type === "G1") {
                if(previousFeedrate === 0 && res.f === undefined)
                {
                    return makeResult(gcode, lines, totalSize, false,
                            "No feedrate set");
                }
                if(res.f === 0) {
                    return makeResult(gcode, lines, totalSize, false,
                            "Feedrate cannot be equal to 0 (line " + i +")");
                }

                line = new GCodeToGeometry.StraightLine(i+1,
                        start, res, relative, previousFeedrate, inMm);
                previousFeedrate = line.feedrate;
                checkTotalSize(totalSize, line.getSize());
                lines.push(line.returnLine());
                start = GCodeToGeometry.copyObject(line.end);
            } else if(res.type === "G2" || res.type === "G3") {
                if(previousFeedrate === 0 && res.f === undefined)
                {
                    return makeResult(gcode, lines, totalSize, false,
                            "No feedrate set");
                }
                if(res.f === 0) {
                    return makeResult(gcode, lines, totalSize, false,
                            "Feedrate cannot be equal to 0 (line " + i +")");
                }

                line = new GCodeToGeometry.CurvedLine(i+1, start,
                        res, relative, previousFeedrate, inMm, crossAxe);
                if(line.center === false) {
                    return makeResult(gcode, lines, totalSize, false,
                            "Impossible to find the center for " + gcode[i] +
                            " (line " + i +")");
                }
                previousFeedrate = line.feedrate;
                checkTotalSize(totalSize, line.getSize());
                lines.push(line.returnLine());
                start = GCodeToGeometry.copyObject(line.end);
            } else if(res.type === "G17") {
                crossAxe = "z";
            } else if(res.type === "G18") {
                crossAxe = "y";
            } else if(res.type === "G19") {
                crossAxe = "x";
            } else if(res.type === "G20") {
                //No need to convert start: always in inches
                inMm = false;
            } else if(res.type === "G21") {
                //No need to convert start: always in inches
                inMm = true;
            } else if(res.type === "G90") {
                relative = false;
            } else if(res.type === "G91") {
                relative = true;
            } else if(res.type === "M2") {
                parsing = false;
            }

            j++;
        }

        i++;
    }

    return makeResult(gcode, lines, totalSize, true, "");
};
