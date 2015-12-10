/*jslint todo: true, browser: true, continue: true, white: true*/
/*global GCodeToGeometry, GParser*/

/**
 * Written by Alex Canales for ShopBotTools, Inc.
 */

/**
 * Parses the GCode into a series of lines and curves and checks if errors.
 * @param  {string}  code  The GCode
 * @returns  {object}  The parsed GCode
 */
GCodeToGeometry.parse = function(code) {
    "use strict";

    /**
     * Removes the comments and spaces.
     * @param  {string}  command  The command to parse
     * @return  {string}  The command without the commands and spaces.
     */
    function removeCommentsAndSpaces(command) {
        var s = command.split('(')[0].split(';')[0]; //No need to use regex
        return s.split(/\s/).join('').trim();
    }

    /**
     * Parses the result of GParser.parse.
     * @param  {array}  Result of GParser.parse
     * @return  {array}  Array of object.
     */
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

    /**
     * Checks if there is a wrong parameter.
     * @param  {array}  acceptedParameters  Array of accepted parameters (should
     *                                      not include the type of the command)
     * @param  {array}  parameters          The current given parameters
     * @return  {bool}  True if there is a wrong parameter.
     */
    function checkWrongParameter(acceptedParameters, parameters) {
        var i = 0, j = 0;
        var accepted = true;

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
                return true;
            }
        }
        return false;
    }

    /**
     * Checks and modifies the total size.
     * @param  {object}  totalSize  The the whole operation size (modified)
     * @param  {object}  size       The added operation size
     */
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

    /**
     * Checks if there is an error due to the feed rate configuration.
     * @param  {object}  command    The command (the feed rate can be changed)
     * @param  {object}  errorList  The error list
     * @param  {number}  line       The line number
     * @param  {object}  settings   The modularity settings
     * @return {bool}  True if the command is skipped (error), else false if the
     *                 feedrate is correct or emits only a warning
     */
    function checkErrorFeedrate(command, errorList, line, settings) {
        var c = command;
        var consideredFeedrate = (c.f === undefined) ? settings.feedrate : c.f;

        if(c.type !== undefined && c.type !== "G1" && c.type !== "G2" &&
                c.type !== "G3") {
            return false;
        }

        if(consideredFeedrate > 0) {
            return false;
        }

        if(consideredFeedrate < 0) {
            errorList.push({
                line : line,
                message : "(warning) Cannot use a negative feed rate " +
                          "(the absolute value is used).",
                isSkipped : false
            });
            c.f = Math.abs(consideredFeedrate);
            return false;
        }

        errorList.push({
            line : line,
            message : "(error) Cannot use a null feed rate (skipped).",
            isSkipped : true
        });
        settings.feedrate = 0;

        return true;
    }

    /**
     * Sets the command type if not set and if a previous move command was set.
     * @param  {object}  parsedCommand        The command (is modified)
     * @param  {string}  previousMoveCommand  The type of the previous move
     *                                        command
     */
    function setGoodType(parsedCommand, previousMoveCommand) {
        if(parsedCommand.type !== undefined) {
            return;
        }
        if(previousMoveCommand !== "") {
            parsedCommand.type = previousMoveCommand;
        }
    }

    /**
     * Checks a G0 command.
     * @param  {object}  command    The command
     * @param  {array}   errorList  The error list
     * @param  {number}  line       The line number
     * @return  {bool}   Returns true if the command is done, false if skipped
     */
    function checkG0(command, errorList, line) {
        var acceptedParameters = [ "X", "Y", "Z" ];
        var parameters = Object.keys(command);
        parameters.splice(parameters.indexOf("type"), 1);

        if(checkWrongParameter(acceptedParameters, parameters) === true) {
            errorList.push({
                line : line,
                message : "(warning) Some parameters are wrong.",
                isSkipped : false
            });
        }
        return true;
    }

    /**
     * Checks a G1 command.
     * @param  {object}  command           The command
     * @param  {array}   errorList         The error list
     * @param  {number}  line              The line number
     * @param  {number}  previousFeedrate  The previous feedrate
     * @return  {bool}   Returns true if the command is done, false if skipped
     */
    function checkG1(command, errorList, line, previousFeedrate) {
        var acceptedParameters = [ "X", "Y", "Z", "F" ];
        var parameters = Object.keys(command);
        parameters.splice(parameters.indexOf("type"), 1);

        if(checkWrongParameter(acceptedParameters, parameters) === true) {
            errorList.push({
                line : line,
                message : "(warning) Some parameters are wrong.",
                isSkipped : false
            });
        }

        return !checkErrorFeedrate(command, errorList, line, previousFeedrate);
    }

    /**
     * Checks a G2 or G3 command.
     * @param  {object}  command           The command
     * @param  {array}   errorList         The error list
     * @param  {number}  line              The line number
     * @param  {number}  previousFeedrate  The previous feedrate
     * @return  {bool}   Returns true if the command is done, false if skipped
     */
    function checkG2G3(command, errorList, line, previousFeedrate) {
        var acceptedParameters = [ "X", "Y", "Z", "F", "I", "J", "K", "R" ];
        var parameters = Object.keys(command);
        parameters.splice(parameters.indexOf("type"), 1);

        if(checkWrongParameter(acceptedParameters, parameters) === true) {
            errorList.push({
                line : line,
                message : "(warning) Some parameters are wrong.",
                isSkipped : false
            });
        }

        if(command.r !== undefined && (command.i !== undefined ||
            command.j !== undefined || command.k !== undefined)) {
            errorList.push({
                line : line,
                message : "(error) Cannot use R and I, J or K at the same time.",
                isSkipped : true
            });
            return false;
        }

        return !checkErrorFeedrate(command, errorList, line, previousFeedrate);
    }

    /**
     * Manages a command (check it, create geometrical line, change setting...).
     * @param  {object}  command    The command
     * @param  {object}  settings   The modularity settings
     * @param  {number}  lineNumber The line number
     * @param  {object}  totalSize  The the whole operation size (modified)
     * @param  {object}  errorList  The error list
     * @return {bool}  Returns true if have to continue, else false
     */
    function manageCommand(command, settings, lineNumber, lines, totalSize,
            errorList) {
        var line = {};
        var type = "";
        setGoodType(command, settings.typeMove);
        type = command.type;

        if(type === undefined) {
            if(command.f !== undefined) {
                checkErrorFeedrate(command, errorList, lineNumber,
                        settings.feedrate);
                settings.feedrate = command.f;
            }
        } else if(type === "G0" && checkG0(command, errorList, lineNumber)) {
            line = new GCodeToGeometry.StraightLine(lineNumber,
                    settings.position, command, settings);
            settings.typeMove = type;
            checkTotalSize(totalSize, line.getSize());
            lines.push(line.returnLine());
            settings.position = GCodeToGeometry.copyObject(line.end);
        } else if (type === "G1" &&
            checkG1(command, errorList, lineNumber, settings) === true)
        {
            line = new GCodeToGeometry.StraightLine(lineNumber,
                    settings.position, command, settings);
            settings.feedrate = line.feedrate;
            settings.typeMove = type;
            checkTotalSize(totalSize, line.getSize());
            lines.push(line.returnLine());
            settings.position = GCodeToGeometry.copyObject(line.end);
        } else if((type === "G2" || type === "G3") &&
                checkG2G3(command, errorList, lineNumber, settings))
        {
            line = new GCodeToGeometry.CurvedLine(lineNumber, settings.position,
                    command, settings);
            if(line.center !== false) {
                settings.feedrate = line.feedrate;
                settings.typeMove = type;
                checkTotalSize(totalSize, line.getSize());
                lines.push(line.returnLine());
                settings.position = GCodeToGeometry.copyObject(line.end);
            } else {
                errorList.push({
                    line : lineNumber,
                    message : "(error) Impossible to find the center.",
                    isSkipped : true
                });
            }
        } else if(type === "G17") {
            settings.crossAxe = "z";
        } else if(type === "G18") {
            settings.crossAxe = "y";
        } else if(type === "G19") {
            settings.crossAxe = "x";
        } else if(type === "G20") {
            settings.inMm = false;
        } else if(type === "G21") {
            settings.inMm = true;
        } else if(type === "G90") {
            settings.relative = false;
        } else if(type === "G91") {
            settings.relative = true;
        } else if(type === "M2") {
            return false;
        }

        return true;
    }

    var totalSize = {
        min : { x: 0, y : 0, z : 0 },
        max : { x: 0, y : 0, z : 0 }
    };
    var i = 0, j = 0;
    var tabRes = [];
    var parsing = true;
    var lines= [];
    var errorList = [];

    var settings = {
        feedrate : 0,
        typeMove : "",
        crossAxe : "z",
        inMm : false,
        relative : false,
        position : { x : 0, y : 0, z : 0 }
    };

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
            parsing = manageCommand(tabRes[j], settings, i+1, lines, totalSize,
                    errorList);
            j++;
        }
        i++;
    }

    if(i < gcode.length) {
        errorList.push({
            line : i + 1,
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
