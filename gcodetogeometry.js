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

    //Returns a string if no command
    function removeCommentsAndSpaces(command) {
        var s = command.split('(')[0].split(';')[0]; //No need to use regex
        return s.split(/\s/).join('').trim();
    }

    //Parsing the result of GParser.parse
    function parseParsedGCode(parsed) {
        var obj = {};
        var i = 0;
        var letter = "", number = "";
        var tab = [];
        var emptyObj = true;

        for(i=0; i < parsed.words.length; i++) {
            letter = parsed.words[i][0];
            number = parsed.words[i][1];
            if(letter === "G" || letter === "M") {
                //Make sure multiple commands in one line are interpreted as
                //multiple commands:
                if(emptyObj === false) {
                    tab.push(obj);
                    obj = {};
                }
                obj.type = letter + number;
                emptyObj = false;
            } else  {
                obj[letter.toLowerCase()] = parseFloat(number, 10);
            }
        }
        tab.push(obj);
        return tab;
    }

    //Checks if a paramater in parameters is not supposed to be there
    function checkWrongParameter(acceptedParameters, parameters) {
        var i = 0, j = 0;
        var accepted = true;
        console.log(acceptedParameters);
        console.log(parameters);

        for(j = parameters.length - 1; j >= 0; j--) {
            for(i = acceptedParameters.length - 1; i >= 0; i--) {
                accepted = false;
                if(parameters[j].toUpperCase() === acceptedParameters[i].toUpperCase()) {
                    accepted = true;
                    acceptedParameters.splice(i, 1);
                    break;
                }
            }
            if(accepted === false) {
                return false;
            }
        }
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

    //Returns true if the command is correct about the feed rate (that means
    // that if the command does not accept)
    function checkFeedrate(parsedCommand, previousFeedrate) {
        var c = parsedCommand;
        if(c.type !== "G1" && c.type !== "G2" && c.type !== "G3") {
            return true;
        }

        return !((c.f === undefined && previousFeedrate === 0) || c.f === 0);
    }

    //TODO: delete this function to change checkFeedrate
    // Returns true if the command is skipped
    function errorCheckFeedrate(command, errorList, line, previousFeedrate) {
        if(checkFeedrate(command, previousFeedrate) === true) {
            return false;
        }

        if(command.f === undefined) {
            errorList.push({
                line : line,
                message : "(warning) No feed rate set (the default is used).",
                isSkipped : false
            });
            return false;
        }

        errorList.push({
            line : line,
            message : "(error) Cannot use a null feed rate.",
            isSkipped : false
        });
        return true;
    }

    //Will set the command type if not set
    function setGoodType(parsedCommand, previousMoveCommand) {
        if(parsedCommand.type !== undefined) {
            return;
        }
        parsedCommand.type = previousMoveCommand;
    }

    // Returns true if the command is done, false if skipped
    function checkG0(command, errorList, line) {
        var acceptedParameters = [ "X", "Y", "Z" ];
        var parameters = Object.keys(command);
        parameters.splice(parameters.indexOf("type"), 1);

        if(checkWrongParameter(acceptedParameters, parameters) === false) {
            errorList.push({
                line : line,
                message : "(warning) Some parameters are wrong.",
                isSkipped : false
            });
        }
        return true;
    }

    // Returns true if the command is done, false if skipped
    function checkG1(command, errorList, line, previousFeedrate) {
        var acceptedParameters = [ "X", "Y", "Z", "F" ];
        var parameters = Object.keys(command);
        parameters.splice(parameters.indexOf("type"), 1);

        if(checkWrongParameter(acceptedParameters, parameters) === false) {
            errorList.push({
                line : line,
                message : "(warning) Some parameters are wrong.",
                isSkipped : false
            });
        }

        return errorCheckFeedrate(command, errorList, line, previousFeedrate);
    }

    // Returns true if the command is done, false if skipped
    function checkG2G3(command, errorList, line, previousFeedrate) {
        var acceptedParameters = [ "X", "Y", "Z", "F", "I", "J", "K", "R" ];
        var parameters = Object.keys(command);
        parameters.splice(parameters.indexOf("type"), 1);
        var errorFeedrate = true;

        if(checkWrongParameter(acceptedParameters, parameters) === false) {
            errorList.push({
                line : line,
                message : "(warning) Some parameters are wrong.",
                isSkipped : false
            });
        }

        errorFeedrate = !errorCheckFeedrate(command, errorList, line, previousFeedrate);

        if(command.r !== undefined && (command.i !== undefined ||
            command.j !== undefined || command.k !== undefined)) {
            errorList.push({
                line : line,
                message : "(error) Cannot use R and I, J or K at the same time.",
                isSkipped : true
            });
            return false;
        }

        return errorFeedrate;
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
    var previousMoveCommand = "";
    var errorList = [];

    if(typeof code !== "string" || code  === "") {
        return {
            gcode : [],
            lines : [],
            size : totalSize,
            errorList : [ { line : 0, message : "(error) No command." } ]
        };
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

            setGoodType(res, previousMoveCommand);

            if(res.type === "G0" && checkG0(res, errorList, i+1)) {
                line = new GCodeToGeometry.StraightLine(i+1, start, res,
                        relative, 0, inMm);
                previousMoveCommand = res.type;
                checkTotalSize(totalSize, line.getSize());
                lines.push(line.returnLine());
                start = GCodeToGeometry.copyObject(line.end);
            } else if (res.type === "G1" &&
                    checkG1(res, errorList, i+1, previousFeedrate) === true)
            {
                line = new GCodeToGeometry.StraightLine(i+1, start, res,
                        relative, previousFeedrate, inMm);
                previousFeedrate = line.feedrate;
                previousMoveCommand = res.type;
                checkTotalSize(totalSize, line.getSize());
                lines.push(line.returnLine());
                start = GCodeToGeometry.copyObject(line.end);
            } else if((res.type === "G2" || res.type === "G3") &&
                    checkG2G3(res, errorList, i+1, previousFeedrate)) {
                line = new GCodeToGeometry.CurvedLine(i+1, start,
                        res, relative, previousFeedrate, inMm, crossAxe);
                if(line.center !== false) {
                    previousFeedrate = line.feedrate;
                    previousMoveCommand = res.type;
                    checkTotalSize(totalSize, line.getSize());
                    lines.push(line.returnLine());
                    start = GCodeToGeometry.copyObject(line.end);
                } else {
                    errorList.push({
                        line : i + 1,
                        message : "(error) Impossible to find the center.",
                        isSkipped : true
                    });
                }
            } else if(res.type === "G17") {
                crossAxe = "z";
            } else if(res.type === "G18") {
                crossAxe = "y";
            } else if(res.type === "G19") {
                crossAxe = "x";
            } else if(res.type === "G20") {
                inMm = false;
            } else if(res.type === "G21") {
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

    if(i < gcode.length) {
        errorList.push({
            line :i + 1,
            message : "(warning) The next code is not executed.",
            isSkipped : false
        });
    }

    return {
        gcode : gcode,
        lines : lines,
        size : totalSize,
        errorList : errorList
    };
};
