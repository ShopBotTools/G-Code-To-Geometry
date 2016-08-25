(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["gcodetogeometry"] = factory();
	else
		root["gcodetogeometry"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	/*jslint todo: true, browser: true, continue: true, white: true*/

	// Written by Alex Canales for ShopBotTools, Inc.

	var util = __webpack_require__(1);
	var StraightLine = __webpack_require__(2).StraightLine;
	var CurvedLine = __webpack_require__(2).CurvedLine;
	var GParser = __webpack_require__(3).GParser;

	/**
	 * Parses the GCode into a series of lines and curves and checks if errors.
	 *
	 * @param {string} code - The GCode.
	 * @returns {ParsedGCode} The parsed GCode.
	 */
	var parse = function(code) {
	    "use strict";

	    var unitIsSet = false;
	    var setInInch = true;

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
	     * Creates an error object.
	     *
	     * @param {number} line The line number.
	     * @param {string} message The message.
	     * @param {boolean} isSkipped If the command is skipped.
	     * @return {Error} The error object.
	     */
	    function createError(line, message, isSkipped) {
	        return { line : line, message : message, isSkipped : isSkipped };
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
	            errorList.push(createError(
	                line,
	                "(warning) Cannot use a negative feed rate " +
	                          "(the absolute value is used).",
	                false
	            ));
	            c.f = Math.abs(consideredFeedrate);
	            return false;
	        }

	        errorList.push(createError(
	            line, "(error) Cannot use a null feed rate (skipped).", true
	        ));
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
	     * Finds the next position according to the x, y and z contained or not in
	     * the command parameters.
	     *
	     * @param {object} start The 3D start point.
	     * @param {object} parameters The command parameters.
	     * @param {boolean} relative If the point in the parameters is a relative
	     * point.
	     * @param {boolean} inMm If the values are in inches.
	     * @return {object} The point.
	    */
	    function findPosition (start, parameters, relative, inMm) {
	        var pos = { x : start.x, y : start.y, z : start.z };
	        var d = (inMm === false) ? 1 : util.MILLIMETER_TO_INCH;
	        if(relative === true) {
	            if(parameters.x !== undefined) { pos.x += parameters.x * d; }
	            if(parameters.y !== undefined) { pos.y += parameters.y * d; }
	            if(parameters.z !== undefined) { pos.z += parameters.z * d; }
	        } else {
	            if(parameters.x !== undefined) { pos.x = parameters.x * d; }
	            if(parameters.y !== undefined) { pos.y = parameters.y * d; }
	            if(parameters.z !== undefined) { pos.z = parameters.z * d; }
	        }

	        return pos;
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
	            errorList.push(createError(
	                line, "(warning) Some parameters are wrong.", false
	            ));
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
	            errorList.push(createError(
	                line, "(warning) Some parameters are wrong.", false
	            ));
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
	            errorList.push(createError(
	                line, "(warning) Some parameters are wrong.", false
	            ));
	        }

	        if(command.r === undefined && command.i === undefined &&
	                command.j === undefined && command.k === undefined) {
	            errorList.push(createError(
	                line, "(error) No parameter R, I, J or K.", true
	            ));
	            return false;
	        }

	        if(command.r !== undefined && (command.i !== undefined ||
	            command.j !== undefined || command.k !== undefined)) {
	            errorList.push(createError(
	                line,
	                "(error) Cannot use R and I, J or K at the same time.",
	                true
	            ));
	            return false;
	        }

	        return !checkErrorFeedrate(command, errorList, line, previousFeedrate);
	    }

	    /**
	     * Manages a 60 or G1 command.
	     * @param  {object}  command    The command
	     * @param  {object}  settings   The modularity settings
	     * @param  {object}  totalSize  The the whole operation size (modified)
	     * @param  {array}   lines      The array containing the lines
	     * @param  {number}  lineNumber The line number
	     * @param  {object}  errorList  The error list
	     */
	    function manageG0G1(command, settings, lineNumber, lines, totalSize) {
	        var nextPosition = findPosition(settings.position, command,
	            settings.relative, settings.inMm);
	        var line = new StraightLine(lineNumber,
	            settings.position, nextPosition, command, settings);
	        settings.previousMoveCommand = command.type;
	        checkTotalSize(totalSize, line.getSize());
	        lines.push(line.returnLine());
	        settings.position = util.copyObject(line.end);
	        if(command.f !== undefined) {
	            settings.feedrate = command.f;
	        }
	    }

	    /**
	     * Manages a G2 or G3 command.
	     * @param  {object}  command    The command
	     * @param  {object}  settings   The modularity settings
	     * @param  {number}  lineNumber The line number
	     * @param  {array}   lines      The array containing the lines
	     * @param  {object}  totalSize  The the whole operation size (modified)
	     * @param  {object}  errorList  The error list
	     */
	    function manageG2G3(command, settings, lineNumber, lines, totalSize,
	            errorList) {
	        var nextPosition = findPosition(settings.position, command,
	            settings.relative, settings.inMm);
	        var line = new CurvedLine(lineNumber, settings.position,
	            nextPosition, command, settings);
	        if(line.center !== false) {
	            var temp = line.returnLine();
	            if(temp === false) {
	                errorList.push(createError(
	                    lineNumber, "(error) Impossible to create arc.", true
	                ));
	                return;
	            }
	            settings.feedrate = line.feedrate;
	            settings.previousMoveCommand = command.type;
	            checkTotalSize(totalSize, line.getSize());
	            lines.push(temp);
	            settings.position = util.copyObject(line.end);
	        } else {
	            errorList.push(createError(
	                lineNumber,
	                "(error) Physically impossible to do with those values.",
	                true
	            ));
	        }
	    }

	    /**
	     * Manages a command (check it, create geometrical line, change setting...).
	     * @param  {object}  command    The command
	     * @param  {object}  settings   The modularity settings
	     * @param  {number}  lineNumber The line number
	     * @param  {array}   lines      The array containing the lines
	     * @param  {object}  totalSize  The the whole operation size (modified)
	     * @param  {object}  errorList  The error list
	     * @return {bool}  Returns true if have to continue, else false
	     */
	    function manageCommand(command, settings, lineNumber, lines, totalSize,
	            errorList) {
	        //Empty line
	        if(command.type === undefined && Object.keys(command).length === 0) {
	            return true;
	        }

	        setGoodType(command, settings.previousMoveCommand);

	        if(command.type === undefined) {
	            if(command.f !== undefined) {
	                checkErrorFeedrate(command, errorList, lineNumber,
	                        settings.feedrate);
	                settings.feedrate = command.f;
	            }
	        } else if(command.type === "G0" &&
	                checkG0(command, errorList, lineNumber) === true)
	        {
	            manageG0G1(command, settings, lineNumber, lines, totalSize);
	        } else if (command.type === "G1" &&
	            checkG1(command, errorList, lineNumber, settings) === true)
	        {
	            manageG0G1(command, settings, lineNumber, lines, totalSize);
	        } else if((command.type === "G2" || command.type === "G3") &&
	                checkG2G3(command, errorList, lineNumber, settings) === true)
	        {
	            manageG2G3(command, settings, lineNumber, lines, totalSize, errorList);
	        } else if(command.type === "G17") {
	            settings.crossAxe = "z";
	        } else if(command.type === "G18") {
	            settings.crossAxe = "y";
	        } else if(command.type === "G19") {
	            settings.crossAxe = "x";
	        } else if(command.type === "G20") {
	            settings.inMm = false;
	            if(unitIsSet === false) {
	                setInInch = true;
	                unitIsSet = true;
	            }
	        } else if(command.type === "G21") {
	            settings.inMm = true;
	            if(unitIsSet === false) {
	                setInInch = false;
	                unitIsSet = true;
	            }
	        } else if(command.type === "G90") {
	            settings.relative = false;
	        } else if(command.type === "G91") {
	            settings.relative = true;
	        } else if(command.type === "M2") {
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
	    var lines = [];
	    var errorList = [];

	    var settings = {
	        feedrate : 0,
	        previousMoveCommand : "",
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
	            displayInInch : setInInch,
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
	        errorList.push(createError(
	            i + 1, "(warning) The next code is not executed.", false
	        ));
	    }

	    return {
	        gcode : gcode,
	        lines : lines,
	        size : totalSize,
	        displayInInch : setInInch,
	        errorList : errorList
	    };
	};

	exports.parse = parse;


/***/ },
/* 1 */
/***/ function(module, exports) {

	/*jslint todo: true, continue: true, white: true*/

	//  Written by Alex Canales for ShopBotTools, Inc.

	/**
	 * A 3D point.
	 *
	 * @typedef {object} Point
	 * @property {number} x - The x coordinate.
	 * @property {number} y - The y coordinate.
	 * @property {number} z - The z coordinate.
	 */

	/**
	 * A helper for finding axes according to the chosen plane.
	 *
	 * @typedef {object} Axes
	 * @property {string} re - The axis for REal numbers.
	 * @property {string} im - The axis for IMaginary numbers.
	 * @property {string} cr - The CRoss axis.
	 */

	/**
	 * An object defining a cubic Bézier curve.
	 *
	 * @typedef {object} Bezier
	 * @property {Point} p0 - The first control point.
	 * @property {Point} p1 - The second control point.
	 * @property {Point} p2 - The third control point.
	 * @property {Point} p3 - The fourth control point.
	 */

	/**
	 * An object defining a line.
	 *
	 * @typedef {object} Line
	 * @property {number} lineNumber - The line number in the G-Code file
	 * corresponding to the line definition.
	 * @property {string} type - The G-Code command.
	 * @property {number} feedrate - The feed rate for doing the path defined by
	 * the line.
	 * @property {Point} [start] - The starting point of the line if type "G0" or
	 * "G1".
	 * @property {Point} [end] - The ending point of the line if type "G0" or "G1".
	 * @property {Bezier[]} [bez] - The bezier curves defining the point if type
	 * "G2" or G3".
	 */

	/**
	 * Defines the settings of the G-Code. It changes constantly according to the
	 * G-Code commands used.
	 *
	 * @typedef {object} Settings
	 * @property {string} [crossAxe="z"] - The cross axe.
	 * @property {number} [feedrate=0] - The feed rate.
	 * @property {boolean} [inMm=false] - If the units are in millimeters.
	 * @property {Point} [position={x:0, y:0, z:0}] - The last position of the bit.
	 * @property {string} [previousMoveCommand=""] - The previous move command
	 * ("G0", "G1", "G2", "G3").
	 * @property {boolean} [relative=false] - If the coordinates are relative.
	*/

	/**
	 * Defines a single command parsed by the G-Code syntax parser. The definition
	 * is not exhaustive.
	 *
	 * @typedef {object} ParsedCommand
	 * @property {string} type - The command type.
	 * @property {number} [x] - The X argument.
	 * @property {number} [y] - The Y argument.
	 * @property {number} [z] - The Z argument.
	 * @property {number} [f] - The F argument.
	 * @property {number} [r] - The R argument.
	 * @property {number} [i] - The I argument.
	 * @property {number} [j] - The J argument.
	 * @property {number} [k] - The K argument.
	 */

	/**
	 * An object defining the size.
	 *
	 * @typedef {object} Size
	 * @property {Point} min - The lowest values in x, y and z coordinates.
	 * @property {Point} max - The highest values in x, y and z coordinates.
	 */

	/**
	 * Errors can happen in G-Code files. It can be simple warning where code is
	 * parsed but can have a different behaviour depending on the machine, or it
	 * can be a real error and the command is skipped.
	 *
	 * @typedef {object} Error
	 * @property {number} line - The line number where the error occurs.
	 * @property {string} message - The message explaining the error.
	 * @property {boolean} isSkipped - If the command is skipped.
	 */

	/**
	 * An object defining the parsed G-Code. This is what that should be used by
	 * the developper using this library.
	 *
	 * @typedef {object} ParsedGCode
	 * @property {string[]} gcode - The original G-Code, each cell contains a
	 * single command.
	 * @property {Lines[]} lines - The lines defining the path the bit will take.
	 * @property {Size} size - The size the job will take.
	 * @property {boolean} displayInInch - If the job shoud be display in inches.
	 * @property {Error} errorList - The error the G-Code contains.
	 */

	/**
	 * This file contains useful scripts for different purposes (geometry, object
	 * operations...). It also create the util namespace.
	 */

	"use strict";

	/**
	 * Namespace for the library.
	 *
	 * @namespace
	 */
	var util = {};

	/**
	 * Constant for converting inches values into millimeters values.
	 */
	util.INCH_TO_MILLIMETER = 25.4;

	/**
	 * Constant for converting millimeters values into inches values.
	 */
	util.MILLIMETER_TO_INCH = 0.03937008;

	/*
	 * Precision constant for comparing floats. Used in util.nearlyEqual.
	 */
	util.FLOAT_PRECISION = 0.001;

	/*
	 * Converts the feedrate in inches according to the types of unit used.
	 *
	 * @param {number} feedrate - The given feedrate.
	 * @param {number} inMm - If the feedrate is in millimeters.
	 * Returns the feedrate in inches.
	 */
	util.calculateFeedrate = function(feedrate, inMm) {
	    return (inMm === false) ? feedrate : feedrate * util.MILLIMETER_TO_INCH;
	};

	/**
	 * Checks if two numbers are nearly equal. This function is used to avoid
	 * to have too much precision when checking values between floating-point
	 * numbers.
	 *
	 * @param {number} a - Number A.
	 * @param {number} b - Number B.
	 * @param {number} [precision=util.FLOAT_PRECISION] - The precision
	 * of the comparaison.
	 * @return {boolean} True if the two values are nearly equal.
	 */
	util.nearlyEqual = function(a, b, precision) {
	    var p = (precision === undefined) ? util.FLOAT_PRECISION : precision;
	    return Math.abs(b - a) <= p;
	};

	/**
	 * Swaps two objects. It has to be the same objects, too bad if it's not.
	 *
	 * @param {object} obj1 - The first object.
	 * @param {object} obj2 - The second object.
	*/
	util.swapObjects = function(obj1, obj2) {
	    function swapSingleField(objA, objB, key) {
	        var temp;
	        temp = objA[key];
	        objA[key] = objB[key];
	        objB[key] = temp;
	    }
	    var keys = Object.keys(obj1);
	    var i = 0;

	    for(i = 0; i < keys.length; i++) {
	        if(typeof obj1[keys[i]] === "object") {
	            util.swapObjects(obj1[keys[i]], obj2[keys[i]]);
	        } else {
	            swapSingleField(obj1, obj2, keys[i]);
	        }
	    }
	};

	/**
	 * Returns the copy of the object.
	 *
	 * @param {object} object - The object.
	 * @return {object} The copy of the object.
	*/
	util.copyObject = function(object) {
	    var keys = Object.keys(object);
	    var i = 0;
	    var copy = {};
	    for(i = 0; i < keys.length; i++) {
	        if(typeof object[keys[i]] === "object") {
	            copy[keys[i]] = util.copyObject(object[keys[i]]);
	        } else {
	            copy[keys[i]] = object[keys[i]];
	        }
	    }
	    return copy;
	};

	/**
	 * Moves the point according to the vector.
	 *
	 * @param {Point} point - The point to move.
	 * @param {Point} vector - The vector.
	 */
	util.movePoint = function(point, vector) {
	    var keys = Object.keys(vector);
	    var i = 0;
	    for(i = 0; i < keys.length; i++) {
	        if(point[keys[i]] !== undefined) {
	            point[keys[i]] += vector[keys[i]];
	        }
	    }
	};

	/**
	 * Does a 2D dot product.
	 *
	 * @param {Point} v1 - The first vector.
	 * @param {Point} v2 - The second vector.
	 * @return {number} The result.
	 */
	util.dotProduct2 = function(v1, v2) {
	    return v1.x * v2.x + v1.y * v2.y;
	};

	/**
	 * Does a 2D cross product.
	 *
	 * @param {Point} v1 - The first vector.
	 * @param {Point} v2 - The second vector.
	 * @return {number} The result on the Z axis.
	 */
	util.crossProduct2 = function(v1, v2) {
	    return v1.x * v2.y - v2.x * v1.y;
	};

	/**
	 * Calculates the length of a 3D vector.
	 *
	 * @param {Point} v - The vector.
	 * @return {number} The vector length.
	 */
	util.lengthVector3 = function(v) {
	    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
	};

	/**
	 * Returns object of 3 axes:
	 *  re is the axes for REal numbers;
	 *  im for the IMaginary numbers;
	 *  cr for the CRoss axis
	 *
	 * @param {string} crossAxe The name of the axis given by the cross product of
	 * the vectors defining the plane. Should be "x", "y" or "z", considered "z" if
	 * not "x" or "y".
	 * @return {Axes} The object defining the real, imaginary and cross axis.
	 */
	util.findAxes = function(crossAxe) {
	    if(crossAxe.toLowerCase() === "x") {
	        return { re : "y", im : "z", cr : "x"};
	    }
	    if(crossAxe.toLowerCase() === "y") {
	        return { re : "z", im : "x", cr : "y"};
	    }
	    return { re : "x", im : "y", cr : "z"};
	};

	/**
	 * Does a rotation and scale of point according to center. Stores the result in
	 * newPoint.
	 *
	 * @param {Point} center - The center of the rotation and scale.
	 * @param {Point} point - The point to modify.
	 * @param {Point} newPoint - The point storying the result.
	 * @param {number} angle - The angle in radians.
	 * @param {number} length - The scale ratio.
	 * @param {string} re - The real axis.
	 * @param {string} im - The imaginary axis.
	 */
	util.scaleAndRotation = function(
	    center, point, newPoint, angle, length, re, im
	) {
	    var c = center, p = point, nP = newPoint;
	    var l = length, cA = Math.cos(angle), sA = Math.sin(angle);
	    var pRe = p[re], pIm = p[im], cRe = c[re], cIm = c[im];

	    nP[re] = l * ((pRe - cRe) * cA - (pIm - cIm) * sA) + cRe;
	    nP[im] = l * ((pIm - cIm) * cA + (pRe - cRe) * sA) + cIm;
	};

	/**
	 * Returns the signed angle in radian in 2D (between -PI and PI).
	 *
	 * @param {Point} v1 - The first vector.
	 * @param {Point} v2 - The second vector.
	 * @return {number} The angle in radian.
	 */
	util.findAngleVectors2 = function(v1, v2) {
	    var sign = (util.crossProduct2(v1, v2) < 0) ? -1 : 1;
	    var dot = util.dotProduct2(v1, v2);
	    var lV1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
	    var lV2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

	    if(lV1 === 0 || lV2 === 0) {
	        return 0;
	    }

	    return sign * Math.acos(dot / (lV1 * lV2));
	};

	/**
	 * Returns the signed angle in radian in 2d (between -2pi and 2pi).
	 *
	 * @param {Point} v1 - The first vector.
	 * @param {Point} v2 - The second vector.
	 * @param {boolean} positive - If the oriented angle goes counter-clockwise.
	 * @return {number} The angle in radian.
	 */
	util.findAngleOrientedVectors2 = function(v1, v2, positive) {
	    var angle =  util.findAngleVectors2(v1, v2);

	    if(positive === false && angle > 0) {
	        return angle - Math.PI * 2;
	    }
	    if(positive === true && angle < 0) {
	        return Math.PI * 2 + angle;
	    }

	    return angle;
	};

	/**
	 * Checks if the value is include between the value a (include) and b (include).
	 * Order between a and b does not matter.
	 *
	 * @param {number} value - The value.
	 * @param {number} a - The first boundary.
	 * @param {number} b - The second boundary.
	 * @return {boolean} The result.
	 */
	util.isInclude = function(value, a, b) {
	    return (b < a) ? (b <= value && value <= a) : (a <= value && value <= b);
	};

	var keys = Object.keys(util);
	var i = 0;
	for(i = 0; i < keys.length; i++) {
	    exports[keys[i]] = util[keys[i]];
	}


/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	/*jslint todo: true, continue: true, white: true*/

	// Written by Alex Canales for ShopBotTools, Inc.

	var util = __webpack_require__(1);

	/**
	 * This file contains the classes managing the lines. The lines are
	 * the representation of the G0, G1, G2 and G3 commands.
	 */

	/**
	 * Creates an instance of the StraightLine class. This class does the
	 * computations for the G0 and G1 commands.
	 *
	 * @class
	 * @param {number} index - The line number where this command appears.
	 * @param {Point} start - The 3D start point.
	 * @param {ParsedCommand} parsedCommand - The parsed command.
	 * @param {Settings} settings - The modularity settings.
	 * @return {StraightLine} An instance of the StraightLine class.
	 */
	var StraightLine = function(index, start, end, parsedCommand, settings) {
	    "use strict";
	    var that = this;

	    /**
	     * Returns a line object of type "G0" or "G1" (corresponding to
	     * parsedCommand).
	     *
	     * @function returnLine
	     * @memberof util.StraightLine
	     * @instance
	     * @return {Line} The line object.
	     */
	    that.returnLine = function() {
	        return {
	            lineNumber : that.index,
	            type : that.word,
	            start : that.start,
	            end : that.end,
	            feedrate : that.feedrate
	        };
	    };

	    /**
	     * Returns the size of the line.
	     *
	     * @function getSize
	     * @memberof util.StraightLine
	     * @instance
	     * @return {Size} The size.
	     */
	    that.getSize = function() {
	        return {
	            min : {
	                x : Math.min(that.start.x, that.end.x),
	                y : Math.min(that.start.y, that.end.y),
	                z : Math.min(that.start.z, that.end.z),
	            }, max : {
	                x : Math.max(that.start.x, that.end.x),
	                y : Math.max(that.start.y, that.end.y),
	                z : Math.max(that.start.z, that.end.z),
	            }
	        };
	    };

	    function initialize(index, start, parsedCommand, settings) {
	        that.index = index;
	        that.word = parsedCommand.type;
	        that.start = { x : start.x, y : start.y, z : start.z };
	        that.end = end;
	        if(parsedCommand.type === "G0") {
	            that.feedrate = 0;
	        } else if(parsedCommand.f === undefined) {
	            that.feedrate = settings.feedrate;
	        } else {
	            that.feedrate = util.calculateFeedrate(parsedCommand.f,
	                    settings.inMm);
	        }
	    }

	    initialize(index, start, parsedCommand, settings);
	};

	/**
	 * Creates an instance of the CurvedLine class. This class does the computations
	 * for the G2 and G3 commands.
	 *
	 * @class
	 * @param {number} index - The line number where this command appears.
	 * @param {Point} start - The 3D start point.
	 * @param {ParsedCommand} parsedCommand - The parsed command.
	 * @param {Settings} settings - The modularity settings.
	 * @return {CurvedLine} An instance of the CurvedLine class.
	 */
	var CurvedLine = function(index, start, end, parsedCommand, settings) {
	    "use strict";
	    var that = this;

	    // Will give 0 if start and end are the same
	    function getBezierAngle() {
	        var axes = util.findAxes(that.crossAxe);
	        var cs = { x : that.start[axes.re] - that.center[axes.re],
	            y : that.start[axes.im] - that.center[axes.im], z : 0};
	        var ce = { x : that.end[axes.re] - that.center[axes.re],
	            y : that.end[axes.im] - that.center[axes.im], z : 0};

	        return util.findAngleOrientedVectors2(cs, ce,
	                that.clockwise === false);
	    }

	    function getBezierRadius() {
	        var axes = util.findAxes(that.crossAxe);
	        var cs = { x : that.start[axes.re] - that.center[axes.re],
	            y : that.start[axes.im] - that.center[axes.im], z : 0};
	        return util.lengthVector3(cs);
	    }

	    //Simple cubic Bézier curve interpolation clockwise on XY plane
	    //angle in radian included in [0; pi/2]
	    //radius > 0
	    //From Richard A DeVeneza's work
	    function cubBez2DInt(angle, radius) {
	        var p0 = {}, p1 = {}, p2 ={}, p3 = {};
	        angle = Math.abs(angle);
	        if(angle === Math.PI / 2) {
	            //cos(PI/4) == sin(PI/4) but JavaScript doesn't believe it
	            p0 = { x : 0.707106781186548, y : 0.707106781186548, z : 0 };
	            p1 = { x : 1.097631072937817, y : 0.316582489435277, z : 0 };
	        } else {
	            p0 = { x : Math.cos(angle/2), y : Math.sin(angle/2), z : 0 };
	            p1 = {
	                x : (4 - p0.x) / 3,
	                y : (1 - p0.x) * (3 - p0.x) / (3 * p0.y),
	                z : 0
	            };
	        }
	        p0.x *= radius;
	        p0.y *= radius;
	        p1.x *= radius;
	        p1.y *= radius;
	        p2 = { x : p1.x, y : -p1.y, z : 0 };
	        p3 = { x : p0.x, y : -p0.y, z : 0 };

	        return { p0 : p0, p1 : p1, p2 : p2, p3 : p3 };
	    }

	    //Transform a 2D cubic Bézier's curve clockwise on XY plane
	    // to a Bézier's curve in 3D with the right crossAxe and clock direction
	    // clockwise is bool
	    // pitch can be positive or negative
	    function cubBez2DTo3D(curve, clockwise, pitch, crossAxe) {
	        var height = 0;  //height position for p1, p2 and p3

	        if(clockwise === false) {
	            util.swapObjects(curve.p0, curve.p3);
	            util.swapObjects(curve.p1, curve.p2);
	        }

	        //NOTE: maybe this is better:
	        // b = p*alpha*(r - ax)*(3*r -ax)/(ay*(4*r - ax)*Math.tan(alpha))
	        //Set the good cross axe and transform into a helical Bézier curve
	        height = pitch / 3;
	        if(crossAxe.toLowerCase() === "z") {
	            curve.p0.z = 0;
	            curve.p1.z = height;
	            curve.p2.z = height * 2;
	            curve.p3.z = height * 3;
	        } else if(crossAxe.toLowerCase() === "x") {
	            curve.p0.z = curve.p0.y;
	            curve.p0.y = curve.p0.x;
	            curve.p0.x = 0;
	            curve.p1.z = curve.p1.y;
	            curve.p1.y = curve.p1.x;
	            curve.p1.x = height;
	            curve.p2.z = curve.p2.y;
	            curve.p2.y = curve.p2.x;
	            curve.p2.x = height * 2;
	            curve.p3.z = curve.p3.y;
	            curve.p3.y = curve.p3.x;
	            curve.p3.x = height * 3;
	        } else if(crossAxe.toLowerCase() === "y") {
	            curve.p0.z = curve.p0.x;
	            curve.p0.x = curve.p0.y;
	            curve.p0.y = 0;
	            curve.p1.z = curve.p1.x;
	            curve.p1.x = curve.p1.y;
	            curve.p1.y = height;
	            curve.p2.z = curve.p2.x;
	            curve.p2.x = curve.p2.y;
	            curve.p2.y = height * 2;
	            curve.p3.z = curve.p3.x;
	            curve.p3.x = curve.p3.y;
	            curve.p3.y = height * 3;
	        }

	        return curve;
	    }

	    function rotAndPlaBez(curve, center, angle, re, im) {
	        var c = { x : 0, y : 0, z : 0 };
	        util.scaleAndRotation(c,curve.p0,curve.p0, angle, 1, re, im);
	        util.scaleAndRotation(c,curve.p1,curve.p1, angle, 1, re, im);
	        util.scaleAndRotation(c,curve.p2,curve.p2, angle, 1, re, im);
	        util.scaleAndRotation(c,curve.p3,curve.p3, angle, 1, re, im);

	        util.movePoint(curve.p0, center);
	        util.movePoint(curve.p1, center);
	        util.movePoint(curve.p2, center);
	        util.movePoint(curve.p3, center);
	    }

	    // The Bézier's curve must be on the good plane
	    function getFullBezier(num90, bez90, numSmall, bezSmall, pitch90) {
	        var arcs = [];
	        var center = util.copyObject(that.center);
	        var axes = util.findAxes(that.crossAxe);
	        var cs = { x : that.start[axes.re] - center[axes.re],
	            y : that.start[axes.im] - center[axes.im] };
	        var i = 0, angle = 0, sign = (that.clockwise === true) ? -1 : 1;

	        if(num90 === 0 && numSmall === 0) {
	            return arcs;
	        }

	        if(num90 > 0) {
	            angle = util.findAngleOrientedVectors2(
	                    { x : bez90.p0[axes.re], y : bez90.p0[axes.im] }, cs,
	                    that.clockwise === false
	                    );

	            for(i = 0; i < num90; i++) {
	                arcs.push(util.copyObject(bez90));
	                rotAndPlaBez(arcs[i], center, angle, axes.re, axes.im);
	                // angle += Math.PI / 2 * sign;
	                angle += 1.570796326794897 * sign;
	                center[that.crossAxe] += pitch90;
	            }
	        }

	        if(numSmall > 0) {
	            angle = util.findAngleOrientedVectors2(
	                    { x : bezSmall.p0[axes.re], y : bezSmall.p0[axes.im] }, cs,
	                    that.clockwise === false
	                    );

	            if(num90 !== 0) {
	                angle += num90 * 1.570796326794897 * sign;
	            }
	            arcs.push(util.copyObject(bezSmall));
	            rotAndPlaBez(arcs[i], center, angle, axes.re, axes.im);
	        }

	        //To be sure the first point is at the start
	        arcs[0].p0.x = that.start.x;
	        arcs[0].p0.y = that.start.y;
	        arcs[0].p0.z = that.start.z;

	        //To be sure the last point is at the end
	        arcs[arcs.length-1].p3.x = that.end.x;
	        arcs[arcs.length-1].p3.y = that.end.y;
	        arcs[arcs.length-1].p3.z = that.end.z;

	        return arcs;
	    }

	    function arcToBezier() {
	        var num90 = 0, numSmall = 1;  //Number arc = pi/2 and arc < pi/2
	        var bez90 = {}, bezSmall = {};
	        var p90 = 0, pLittle = 0, pAngle = 0; //Pitch of the arcs
	        var angle = getBezierAngle();
	        var radius = getBezierRadius();
	        var absAngle = Math.abs(angle), halfPI = 1.570796326794897;

	        if(angle === 0 || radius === 0) {
	            return [];
	        }

	        //Find number of diferent sections
	        if(absAngle > halfPI) {
	            //Untrustful (as this language) function, should be tested:
	            num90 = parseInt(absAngle / halfPI, 10);
	            numSmall = (absAngle % halfPI !== 0) ? 1 : 0;
	        }

	        //Find pitches
	        pAngle = (that.end[that.crossAxe] - that.start[that.crossAxe]) / absAngle;
	        p90 = halfPI * pAngle;
	        pLittle = (absAngle - num90 * halfPI) * pAngle;

	        //Find helical Bézier's curves
	        if(num90 > 0) {
	            bez90 = cubBez2DInt(halfPI, radius);
	            cubBez2DTo3D(bez90, (angle < 0), p90, that.crossAxe);
	        }
	        if(numSmall > 0) {
	            angle = absAngle - num90 * halfPI;
	            if(that.clockwise === true) {
	                angle = -angle;
	            }
	            bezSmall = cubBez2DInt(angle, radius);
	            cubBez2DTo3D(bezSmall, (angle < 0), pLittle, that.crossAxe);
	        }

	        return getFullBezier(num90, bez90, numSmall, bezSmall, p90);
	    }

	    //Cannot use arcToBezier because of calculus of oriented angle
	    function circleToBezier() {
	        var bez90 = {};
	        var bezier = [];
	        var pitch = 0;
	        var halfPI = 1.570796326794897;
	        var sign = (that.clockwise === true) ? -1 : 1;
	        var rotAngle = sign * Math.PI * 2;
	        var radius = getBezierRadius();
	        var i = 0;
	        var center = util.copyObject(that.center);
	        var axes = util.findAxes(that.crossAxe);

	        if(radius === 0) {
	            return [];
	        }

	        //We cannot just make a full circle without caring of the start and
	        //end point. Therefore, we need to use the rotation
	        pitch = (that.end[that.crossAxe] - that.start[that.crossAxe]) / 4;
	        bez90 = cubBez2DInt(halfPI, radius);
	        cubBez2DTo3D(bez90, that.clockwise, pitch, that.crossAxe);

	        for(i = 0; i < 4; i++) {
	            bezier.push(util.copyObject(bez90));
	            rotAndPlaBez(bezier[i], center, rotAngle, axes.re, axes.im);
	            rotAngle += halfPI * sign;
	            center[that.crossAxe] += pitch;
	        }

	        return getFullBezier(4, bez90, 0, bez90, pitch);
	    }

	    /**
	     * Returns a line object of type "G2" or "G3" (corresponding to
	     * parsedCommand).
	     *
	     * @function returnLine
	     * @memberof util.CurvedLine
	     * @instance
	     * @return {Line|boolean} False if impossible line else the line object.
	     */
	    that.returnLine = function() {
	        var bez = [];
	        var axes = util.findAxes(that.crossAxe);

	        if(that.start[axes.re] === that.end[axes.re] &&
	                that.start[axes.im] === that.end[axes.im]) {
	            bez = circleToBezier();
	        } else {
	            bez = arcToBezier();
	        }

	        if(bez.length === 0) {
	            return false;
	        }

	        return {
	            lineNumber  : that.index,
	            type : that.word,
	            beziers : bez,
	            feedrate : that.feedrate
	        };
	    };

	    /**
	     * Finds the center of the arc. Returns false if impossible.
	     *
	     * @param {Point} start The starting point of the arc.
	     * @param {Point} end The ending point of the arc.
	     * @param {boolean} clockwise If the arc goes clockwise.
	     * @param {string} crossAxe The name of the axe given by the cross product
	     * of the vectors defining the plane.
	     * @return {object|boolean} The center point or false.
	     */
	    function findCenterWithRadius(start, end, radius, clockwise, crossAxe) {
	        var se = { x : end.x - start.x, y : end.y - start.y,
	            z : end.z - start.z
	        };
	        var angle = 0, l = 1, lSE = 0, r = Math.abs(radius), aCSCE = 0;
	        var center = { x : 0, y : 0, z : 0 };
	        var axes = util.findAxes(crossAxe);
	        lSE = Math.sqrt(se[axes.re] * se[axes.re] + se[axes.im] * se[axes.im]);

	        if(lSE > Math.abs(radius * 2) || lSE === 0) {
	            return false;
	        }

	        angle = Math.acos(lSE / (2 * r));
	        l = r / lSE;
	        util.scaleAndRotation(start, end, center, angle, l, axes.re, axes.im);
	        aCSCE = util.findAngleVectors2(
	            { x: start[axes.re]-center[axes.re], y: start[axes.im]-center[axes.im] },
	            { x: end[axes.re]-center[axes.re], y: end[axes.im]-center[axes.im] }
	        );

	        if(clockwise === true) {
	            if(radius > 0 && -Math.PI <= aCSCE && aCSCE <= 0) {
	                return center;
	            }
	            if(radius < 0 && 0 <= aCSCE && aCSCE <= Math.PI) {
	                return center;
	            }
	        } else {
	            if(radius > 0 && 0 <= aCSCE && aCSCE <= Math.PI) {
	                return center;
	            }
	            if(radius < 0 && -Math.PI <= aCSCE && aCSCE <= 0) {
	                return center;
	            }
	        }

	        util.scaleAndRotation(start, end, center, -angle, l, axes.re, axes.im);
	        return center;
	    }

	    //radius is positive or negative
	    function findCenter(start, end, parsedCommand, clockwise, crossAxe, inMm) {
	        var delta = (inMm === false) ? 1 : util.MILLIMETER_TO_INCH;
	        var center = { x : start.x, y : start.y, z : start.z };
	        var distCenterStart, distCenterEnd;
	        var axes = util.findAxes(crossAxe);

	        if(parsedCommand.r === undefined) {
	            if(parsedCommand.i !== undefined) {
	                center.x += parsedCommand.i * delta;
	            }
	            if(parsedCommand.j !== undefined) {
	                center.y += parsedCommand.j * delta;
	            }
	            if(parsedCommand.k !== undefined) {
	                center.z += parsedCommand.k * delta;
	            }

	            //Check if not impossible
	            distCenterStart = Math.pow(center[axes.re] - start[axes.re], 2);
	            distCenterStart += Math.pow(center[axes.im] - start[axes.im], 2);

	            distCenterEnd = Math.pow(center[axes.re] - end[axes.re], 2);
	            distCenterEnd += Math.pow(center[axes.im] - end[axes.im], 2);

	            if(util.nearlyEqual(distCenterStart, 0) === true ||
	                util.nearlyEqual(distCenterEnd, 0) === true) {
	                return false;
	            }

	            if(util.nearlyEqual(distCenterStart, distCenterEnd) === false) {
	                return false;
	            }
	        } else {
	            center = findCenterWithRadius(start, end, parsedCommand.r * delta,
	                clockwise, crossAxe);
	            if(center === false) {
	                return false;
	            }
	        }
	        center[crossAxe] = start[crossAxe];
	        return center;
	    }

	    function axeCutArc(reValue, imValue, angleBezier, cs) {
	        //Find the angle in the same orientation than the Bézier's angle
	        var a = util.findAngleOrientedVectors2(cs,
	                { x : reValue, y : imValue }, that.clockwise === false);
	        return (util.isInclude(a, 0, angleBezier) === true);
	    }

	    /**
	     * Returns the size of the line.
	     *
	     * @function getSize
	     * @memberof util.CurvedLine
	     * @instance
	     * @return {Size} The size.
	     */
	    that.getSize = function() {
	        var axes = util.findAxes(that.crossAxe);
	        var cs = {
	            x : that.start[axes.re] - that.center[axes.re],
	            y : that.start[axes.im] - that.center[axes.im]
	        };
	        var radius = getBezierRadius(), aBez = getBezierAngle();
	        var min = { x : 0 , y : 0, z : 0 }, max = { x : 0 , y : 0, z : 0 };

	        // Is circle
	        if(that.start[axes.re] === that.end[axes.re] &&
	                that.start[axes.im] === that.end[axes.im]) {
	            min[axes.re] = that.center[axes.re] - radius;
	            min[axes.im] = that.center[axes.im] - radius;
	            min[axes.cr] = Math.min(that.start[axes.cr], that.end[axes.cr]);
	            max[axes.re] = that.center[axes.re] + radius;
	            max[axes.im] = that.center[axes.im] + radius;
	            max[axes.cr] = Math.max(that.start[axes.cr], that.end[axes.cr]);
	            return { min : min, max : max };
	        }

	        min.x = Math.min(that.start.x, that.end.x);
	        min.y = Math.min(that.start.y, that.end.y);
	        min.z = Math.min(that.start.z, that.end.z);
	        max.x = Math.max(that.start.x, that.end.x);
	        max.y = Math.max(that.start.y, that.end.y);
	        max.z = Math.max(that.start.z, that.end.z);

	        if(axeCutArc(0, 1, aBez, cs) === true) {
	            max[axes.im] = that.center[axes.im] + radius;
	        }
	        if(axeCutArc(0, -1, aBez, cs) === true) {
	            min[axes.im] = that.center[axes.im] - radius;
	        }
	        if(axeCutArc(1, 0, aBez, cs) === true) {
	            max[axes.re] = that.center[axes.re] + radius;
	        }
	        if(axeCutArc(-1, 0, aBez, cs) === true) {
	            min[axes.re] = that.center[axes.re] - radius;
	        }

	        return { min : min, max : max };
	    };

	    function initialize(index, start, parsedCommand, settings) {
	        that.index = index;
	        that.word = parsedCommand.type;
	        that.start = { x : start.x, y : start.y, z : start.z };
	        that.end = end;
	        that.clockwise = (parsedCommand.type === "G2");
	        that.center = findCenter(start, that.end, parsedCommand,
	                that.clockwise, settings.crossAxe, settings.inMm);
	        that.crossAxe = settings.crossAxe;
	        if(parsedCommand.f === undefined) {
	            that.feedrate = settings.feedrate;
	        } else {
	            that.feedrate = util.calculateFeedrate(parsedCommand.f,
	                    settings.inMm);
	        }
	    }

	    initialize(index, start, parsedCommand, settings);
	};

	exports.StraightLine = StraightLine;
	exports.CurvedLine = CurvedLine;


/***/ },
/* 3 */
/***/ function(module, exports) {

	var GParser = (function() {
	  /*
	   * Generated by PEG.js 0.8.0.
	   *
	   * http://pegjs.majda.cz/
	   */

	  function peg$subclass(child, parent) {
	    function ctor() { this.constructor = child; }
	    ctor.prototype = parent.prototype;
	    child.prototype = new ctor();
	  }

	  function SyntaxError(message, expected, found, offset, line, column) {
	    this.message  = message;
	    this.expected = expected;
	    this.found    = found;
	    this.offset   = offset;
	    this.line     = line;
	    this.column   = column;

	    this.name     = "SyntaxError";
	  }

	  peg$subclass(SyntaxError, Error);

	  function parse(input) {
	    var options = arguments.length > 1 ? arguments[1] : {},

	        peg$FAILED = {},

	        peg$startRuleFunctions = { start: peg$parsestart },
	        peg$startRuleFunction  = peg$parsestart,

	        peg$c0 = peg$FAILED,
	        peg$c1 = null,
	        peg$c2 = [],
	        peg$c3 = function(num, words) {
	              return {'N':num, 'words':words}
	        },
	        peg$c4 = function(word, value) { return [word, value]; },
	        peg$c5 = "N",
	        peg$c6 = { type: "literal", value: "N", description: "\"N\"" },
	        peg$c7 = /^[0-9]/,
	        peg$c8 = { type: "class", value: "[0-9]", description: "[0-9]" },
	        peg$c9 = function() { return parseInt(text()); },
	        peg$c10 = /^[+\-]/,
	        peg$c11 = { type: "class", value: "[+\\-]", description: "[+\\-]" },
	        peg$c12 = /^[.]/,
	        peg$c13 = { type: "class", value: "[.]", description: "[.]" },
	        peg$c14 = function() { return parseFloat(text()); },
	        peg$c15 = "[",
	        peg$c16 = { type: "literal", value: "[", description: "\"[\"" },
	        peg$c17 = "]",
	        peg$c18 = { type: "literal", value: "]", description: "\"]\"" },
	        peg$c19 = function(expr) {return expr; },
	        peg$c20 = "ATAN",
	        peg$c21 = { type: "literal", value: "ATAN", description: "\"ATAN\"" },
	        peg$c22 = "/",
	        peg$c23 = { type: "literal", value: "/", description: "\"/\"" },
	        peg$c24 = function(left, right) { 
	            return {'op':"ATAN", 'left':left, 'right':right};
	        },
	        peg$c25 = function(op, expr) {return {'op':op, 'right':expr}},
	        peg$c26 = "#",
	        peg$c27 = { type: "literal", value: "#", description: "\"#\"" },
	        peg$c28 = function(expr) { return {'op':'#', 'right':expr }},
	        peg$c29 = function(first, rest) { 
	                return buildTree(first, rest);
	            },
	        peg$c30 = function(first, rest) {
	              return buildTree(first, rest);
	            },
	        peg$c31 = "**",
	        peg$c32 = { type: "literal", value: "**", description: "\"**\"" },
	        peg$c33 = "*",
	        peg$c34 = { type: "literal", value: "*", description: "\"*\"" },
	        peg$c35 = "MOD",
	        peg$c36 = { type: "literal", value: "MOD", description: "\"MOD\"" },
	        peg$c37 = "+",
	        peg$c38 = { type: "literal", value: "+", description: "\"+\"" },
	        peg$c39 = "-",
	        peg$c40 = { type: "literal", value: "-", description: "\"-\"" },
	        peg$c41 = "OR",
	        peg$c42 = { type: "literal", value: "OR", description: "\"OR\"" },
	        peg$c43 = "XOR",
	        peg$c44 = { type: "literal", value: "XOR", description: "\"XOR\"" },
	        peg$c45 = "AND",
	        peg$c46 = { type: "literal", value: "AND", description: "\"AND\"" },
	        peg$c47 = "ABS",
	        peg$c48 = { type: "literal", value: "ABS", description: "\"ABS\"" },
	        peg$c49 = "ACOS",
	        peg$c50 = { type: "literal", value: "ACOS", description: "\"ACOS\"" },
	        peg$c51 = "ASIN",
	        peg$c52 = { type: "literal", value: "ASIN", description: "\"ASIN\"" },
	        peg$c53 = "COS",
	        peg$c54 = { type: "literal", value: "COS", description: "\"COS\"" },
	        peg$c55 = "EXP",
	        peg$c56 = { type: "literal", value: "EXP", description: "\"EXP\"" },
	        peg$c57 = "FIX",
	        peg$c58 = { type: "literal", value: "FIX", description: "\"FIX\"" },
	        peg$c59 = "FUP",
	        peg$c60 = { type: "literal", value: "FUP", description: "\"FUP\"" },
	        peg$c61 = "ROUND",
	        peg$c62 = { type: "literal", value: "ROUND", description: "\"ROUND\"" },
	        peg$c63 = "LN",
	        peg$c64 = { type: "literal", value: "LN", description: "\"LN\"" },
	        peg$c65 = "SIN",
	        peg$c66 = { type: "literal", value: "SIN", description: "\"SIN\"" },
	        peg$c67 = "SQRT",
	        peg$c68 = { type: "literal", value: "SQRT", description: "\"SQRT\"" },
	        peg$c69 = "TAN",
	        peg$c70 = { type: "literal", value: "TAN", description: "\"TAN\"" },
	        peg$c71 = "EXISTS",
	        peg$c72 = { type: "literal", value: "EXISTS", description: "\"EXISTS\"" },
	        peg$c73 = "A",
	        peg$c74 = { type: "literal", value: "A", description: "\"A\"" },
	        peg$c75 = "B",
	        peg$c76 = { type: "literal", value: "B", description: "\"B\"" },
	        peg$c77 = "C",
	        peg$c78 = { type: "literal", value: "C", description: "\"C\"" },
	        peg$c79 = "D",
	        peg$c80 = { type: "literal", value: "D", description: "\"D\"" },
	        peg$c81 = "F",
	        peg$c82 = { type: "literal", value: "F", description: "\"F\"" },
	        peg$c83 = "G",
	        peg$c84 = { type: "literal", value: "G", description: "\"G\"" },
	        peg$c85 = "H",
	        peg$c86 = { type: "literal", value: "H", description: "\"H\"" },
	        peg$c87 = "I",
	        peg$c88 = { type: "literal", value: "I", description: "\"I\"" },
	        peg$c89 = "J",
	        peg$c90 = { type: "literal", value: "J", description: "\"J\"" },
	        peg$c91 = "K",
	        peg$c92 = { type: "literal", value: "K", description: "\"K\"" },
	        peg$c93 = "L",
	        peg$c94 = { type: "literal", value: "L", description: "\"L\"" },
	        peg$c95 = "M",
	        peg$c96 = { type: "literal", value: "M", description: "\"M\"" },
	        peg$c97 = "P",
	        peg$c98 = { type: "literal", value: "P", description: "\"P\"" },
	        peg$c99 = "Q",
	        peg$c100 = { type: "literal", value: "Q", description: "\"Q\"" },
	        peg$c101 = "R",
	        peg$c102 = { type: "literal", value: "R", description: "\"R\"" },
	        peg$c103 = "S",
	        peg$c104 = { type: "literal", value: "S", description: "\"S\"" },
	        peg$c105 = "T",
	        peg$c106 = { type: "literal", value: "T", description: "\"T\"" },
	        peg$c107 = "X",
	        peg$c108 = { type: "literal", value: "X", description: "\"X\"" },
	        peg$c109 = "Y",
	        peg$c110 = { type: "literal", value: "Y", description: "\"Y\"" },
	        peg$c111 = "Z",
	        peg$c112 = { type: "literal", value: "Z", description: "\"Z\"" },

	        peg$currPos          = 0,
	        peg$reportedPos      = 0,
	        peg$cachedPos        = 0,
	        peg$cachedPosDetails = { line: 1, column: 1, seenCR: false },
	        peg$maxFailPos       = 0,
	        peg$maxFailExpected  = [],
	        peg$silentFails      = 0,

	        peg$result;

	    if ("startRule" in options) {
	      if (!(options.startRule in peg$startRuleFunctions)) {
	        throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
	      }

	      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
	    }

	    function text() {
	      return input.substring(peg$reportedPos, peg$currPos);
	    }

	    function offset() {
	      return peg$reportedPos;
	    }

	    function line() {
	      return peg$computePosDetails(peg$reportedPos).line;
	    }

	    function column() {
	      return peg$computePosDetails(peg$reportedPos).column;
	    }

	    function expected(description) {
	      throw peg$buildException(
	        null,
	        [{ type: "other", description: description }],
	        peg$reportedPos
	      );
	    }

	    function error(message) {
	      throw peg$buildException(message, null, peg$reportedPos);
	    }

	    function peg$computePosDetails(pos) {
	      function advance(details, startPos, endPos) {
	        var p, ch;

	        for (p = startPos; p < endPos; p++) {
	          ch = input.charAt(p);
	          if (ch === "\n") {
	            if (!details.seenCR) { details.line++; }
	            details.column = 1;
	            details.seenCR = false;
	          } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
	            details.line++;
	            details.column = 1;
	            details.seenCR = true;
	          } else {
	            details.column++;
	            details.seenCR = false;
	          }
	        }
	      }

	      if (peg$cachedPos !== pos) {
	        if (peg$cachedPos > pos) {
	          peg$cachedPos = 0;
	          peg$cachedPosDetails = { line: 1, column: 1, seenCR: false };
	        }
	        advance(peg$cachedPosDetails, peg$cachedPos, pos);
	        peg$cachedPos = pos;
	      }

	      return peg$cachedPosDetails;
	    }

	    function peg$fail(expected) {
	      if (peg$currPos < peg$maxFailPos) { return; }

	      if (peg$currPos > peg$maxFailPos) {
	        peg$maxFailPos = peg$currPos;
	        peg$maxFailExpected = [];
	      }

	      peg$maxFailExpected.push(expected);
	    }

	    function peg$buildException(message, expected, pos) {
	      function cleanupExpected(expected) {
	        var i = 1;

	        expected.sort(function(a, b) {
	          if (a.description < b.description) {
	            return -1;
	          } else if (a.description > b.description) {
	            return 1;
	          } else {
	            return 0;
	          }
	        });

	        while (i < expected.length) {
	          if (expected[i - 1] === expected[i]) {
	            expected.splice(i, 1);
	          } else {
	            i++;
	          }
	        }
	      }

	      function buildMessage(expected, found) {
	        function stringEscape(s) {
	          function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase(); }

	          return s
	            .replace(/\\/g,   '\\\\')
	            .replace(/"/g,    '\\"')
	            .replace(/\x08/g, '\\b')
	            .replace(/\t/g,   '\\t')
	            .replace(/\n/g,   '\\n')
	            .replace(/\f/g,   '\\f')
	            .replace(/\r/g,   '\\r')
	            .replace(/[\x00-\x07\x0B\x0E\x0F]/g, function(ch) { return '\\x0' + hex(ch); })
	            .replace(/[\x10-\x1F\x80-\xFF]/g,    function(ch) { return '\\x'  + hex(ch); })
	            .replace(/[\u0180-\u0FFF]/g,         function(ch) { return '\\u0' + hex(ch); })
	            .replace(/[\u1080-\uFFFF]/g,         function(ch) { return '\\u'  + hex(ch); });
	        }

	        var expectedDescs = new Array(expected.length),
	            expectedDesc, foundDesc, i;

	        for (i = 0; i < expected.length; i++) {
	          expectedDescs[i] = expected[i].description;
	        }

	        expectedDesc = expected.length > 1
	          ? expectedDescs.slice(0, -1).join(", ")
	              + " or "
	              + expectedDescs[expected.length - 1]
	          : expectedDescs[0];

	        foundDesc = found ? "\"" + stringEscape(found) + "\"" : "end of input";

	        return "Expected " + expectedDesc + " but " + foundDesc + " found.";
	      }

	      var posDetails = peg$computePosDetails(pos),
	          found      = pos < input.length ? input.charAt(pos) : null;

	      if (expected !== null) {
	        cleanupExpected(expected);
	      }

	      return new SyntaxError(
	        message !== null ? message : buildMessage(expected, found),
	        expected,
	        found,
	        pos,
	        posDetails.line,
	        posDetails.column
	      );
	    }

	    function peg$parsestart() {
	      var s0;

	      s0 = peg$parseline();

	      return s0;
	    }

	    function peg$parseline() {
	      var s0, s1, s2, s3;

	      s0 = peg$currPos;
	      s1 = peg$parseline_number();
	      if (s1 === peg$FAILED) {
	        s1 = peg$c1;
	      }
	      if (s1 !== peg$FAILED) {
	        s2 = [];
	        s3 = peg$parseword();
	        while (s3 !== peg$FAILED) {
	          s2.push(s3);
	          s3 = peg$parseword();
	        }
	        if (s2 !== peg$FAILED) {
	          peg$reportedPos = s0;
	          s1 = peg$c3(s1, s2);
	          s0 = s1;
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parseword() {
	      var s0, s1, s2;

	      s0 = peg$currPos;
	      s1 = peg$parseletter();
	      if (s1 !== peg$FAILED) {
	        s2 = peg$parsefactor1();
	        if (s2 !== peg$FAILED) {
	          peg$reportedPos = s0;
	          s1 = peg$c4(s1, s2);
	          s0 = s1;
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parseline_number() {
	      var s0, s1, s2;

	      s0 = peg$currPos;
	      if (input.charCodeAt(peg$currPos) === 78) {
	        s1 = peg$c5;
	        peg$currPos++;
	      } else {
	        s1 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c6); }
	      }
	      if (s1 !== peg$FAILED) {
	        s2 = peg$parseinteger();
	        if (s2 !== peg$FAILED) {
	          s1 = [s1, s2];
	          s0 = s1;
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parseinteger() {
	      var s0, s1, s2;

	      s0 = peg$currPos;
	      s1 = [];
	      if (peg$c7.test(input.charAt(peg$currPos))) {
	        s2 = input.charAt(peg$currPos);
	        peg$currPos++;
	      } else {
	        s2 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c8); }
	      }
	      if (s2 !== peg$FAILED) {
	        while (s2 !== peg$FAILED) {
	          s1.push(s2);
	          if (peg$c7.test(input.charAt(peg$currPos))) {
	            s2 = input.charAt(peg$currPos);
	            peg$currPos++;
	          } else {
	            s2 = peg$FAILED;
	            if (peg$silentFails === 0) { peg$fail(peg$c8); }
	          }
	        }
	      } else {
	        s1 = peg$c0;
	      }
	      if (s1 !== peg$FAILED) {
	        peg$reportedPos = s0;
	        s1 = peg$c9();
	      }
	      s0 = s1;

	      return s0;
	    }

	    function peg$parsenumber() {
	      var s0, s1, s2, s3, s4, s5, s6;

	      s0 = peg$currPos;
	      if (peg$c10.test(input.charAt(peg$currPos))) {
	        s1 = input.charAt(peg$currPos);
	        peg$currPos++;
	      } else {
	        s1 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c11); }
	      }
	      if (s1 === peg$FAILED) {
	        s1 = peg$c1;
	      }
	      if (s1 !== peg$FAILED) {
	        s2 = [];
	        if (peg$c7.test(input.charAt(peg$currPos))) {
	          s3 = input.charAt(peg$currPos);
	          peg$currPos++;
	        } else {
	          s3 = peg$FAILED;
	          if (peg$silentFails === 0) { peg$fail(peg$c8); }
	        }
	        if (s3 !== peg$FAILED) {
	          while (s3 !== peg$FAILED) {
	            s2.push(s3);
	            if (peg$c7.test(input.charAt(peg$currPos))) {
	              s3 = input.charAt(peg$currPos);
	              peg$currPos++;
	            } else {
	              s3 = peg$FAILED;
	              if (peg$silentFails === 0) { peg$fail(peg$c8); }
	            }
	          }
	        } else {
	          s2 = peg$c0;
	        }
	        if (s2 !== peg$FAILED) {
	          s3 = peg$currPos;
	          if (peg$c12.test(input.charAt(peg$currPos))) {
	            s4 = input.charAt(peg$currPos);
	            peg$currPos++;
	          } else {
	            s4 = peg$FAILED;
	            if (peg$silentFails === 0) { peg$fail(peg$c13); }
	          }
	          if (s4 !== peg$FAILED) {
	            s5 = [];
	            if (peg$c7.test(input.charAt(peg$currPos))) {
	              s6 = input.charAt(peg$currPos);
	              peg$currPos++;
	            } else {
	              s6 = peg$FAILED;
	              if (peg$silentFails === 0) { peg$fail(peg$c8); }
	            }
	            if (s6 !== peg$FAILED) {
	              while (s6 !== peg$FAILED) {
	                s5.push(s6);
	                if (peg$c7.test(input.charAt(peg$currPos))) {
	                  s6 = input.charAt(peg$currPos);
	                  peg$currPos++;
	                } else {
	                  s6 = peg$FAILED;
	                  if (peg$silentFails === 0) { peg$fail(peg$c8); }
	                }
	              }
	            } else {
	              s5 = peg$c0;
	            }
	            if (s5 !== peg$FAILED) {
	              s4 = [s4, s5];
	              s3 = s4;
	            } else {
	              peg$currPos = s3;
	              s3 = peg$c0;
	            }
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	          if (s3 === peg$FAILED) {
	            s3 = peg$c1;
	          }
	          if (s3 !== peg$FAILED) {
	            peg$reportedPos = s0;
	            s1 = peg$c14();
	            s0 = s1;
	          } else {
	            peg$currPos = s0;
	            s0 = peg$c0;
	          }
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parseexpression() {
	      var s0, s1, s2, s3;

	      s0 = peg$currPos;
	      if (input.charCodeAt(peg$currPos) === 91) {
	        s1 = peg$c15;
	        peg$currPos++;
	      } else {
	        s1 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c16); }
	      }
	      if (s1 !== peg$FAILED) {
	        s2 = peg$parsefactor4();
	        if (s2 !== peg$FAILED) {
	          if (input.charCodeAt(peg$currPos) === 93) {
	            s3 = peg$c17;
	            peg$currPos++;
	          } else {
	            s3 = peg$FAILED;
	            if (peg$silentFails === 0) { peg$fail(peg$c18); }
	          }
	          if (s3 !== peg$FAILED) {
	            peg$reportedPos = s0;
	            s1 = peg$c19(s2);
	            s0 = s1;
	          } else {
	            peg$currPos = s0;
	            s0 = peg$c0;
	          }
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parseatan_factor() {
	      var s0, s1, s2, s3, s4;

	      s0 = peg$currPos;
	      if (input.substr(peg$currPos, 4) === peg$c20) {
	        s1 = peg$c20;
	        peg$currPos += 4;
	      } else {
	        s1 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c21); }
	      }
	      if (s1 !== peg$FAILED) {
	        s2 = peg$parseexpression();
	        if (s2 !== peg$FAILED) {
	          if (input.charCodeAt(peg$currPos) === 47) {
	            s3 = peg$c22;
	            peg$currPos++;
	          } else {
	            s3 = peg$FAILED;
	            if (peg$silentFails === 0) { peg$fail(peg$c23); }
	          }
	          if (s3 !== peg$FAILED) {
	            s4 = peg$parseexpression();
	            if (s4 !== peg$FAILED) {
	              peg$reportedPos = s0;
	              s1 = peg$c24(s2, s4);
	              s0 = s1;
	            } else {
	              peg$currPos = s0;
	              s0 = peg$c0;
	            }
	          } else {
	            peg$currPos = s0;
	            s0 = peg$c0;
	          }
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parseunary_factor() {
	      var s0, s1, s2;

	      s0 = peg$currPos;
	      s1 = peg$parseunary_op();
	      if (s1 !== peg$FAILED) {
	        s2 = peg$parseexpression();
	        if (s2 !== peg$FAILED) {
	          peg$reportedPos = s0;
	          s1 = peg$c25(s1, s2);
	          s0 = s1;
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parseparam_value() {
	      var s0, s1, s2;

	      s0 = peg$currPos;
	      if (input.charCodeAt(peg$currPos) === 35) {
	        s1 = peg$c26;
	        peg$currPos++;
	      } else {
	        s1 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c27); }
	      }
	      if (s1 !== peg$FAILED) {
	        s2 = peg$parseexpression();
	        if (s2 === peg$FAILED) {
	          s2 = peg$parsenumber();
	          if (s2 === peg$FAILED) {
	            s2 = peg$parseparam_value();
	          }
	        }
	        if (s2 !== peg$FAILED) {
	          peg$reportedPos = s0;
	          s1 = peg$c28(s2);
	          s0 = s1;
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parsefactor1() {
	      var s0;

	      s0 = peg$parseexpression();
	      if (s0 === peg$FAILED) {
	        s0 = peg$parsenumber();
	        if (s0 === peg$FAILED) {
	          s0 = peg$parseatan_factor();
	          if (s0 === peg$FAILED) {
	            s0 = peg$parseunary_factor();
	            if (s0 === peg$FAILED) {
	              s0 = peg$parseparam_value();
	            }
	          }
	        }
	      }

	      return s0;
	    }

	    function peg$parsefactor2() {
	      var s0, s1, s2, s3, s4, s5;

	      s0 = peg$currPos;
	      s1 = peg$parsefactor1();
	      if (s1 !== peg$FAILED) {
	        s2 = [];
	        s3 = peg$currPos;
	        s4 = peg$parsegroup1_op();
	        if (s4 !== peg$FAILED) {
	          s5 = peg$parsefactor1();
	          if (s5 !== peg$FAILED) {
	            s4 = [s4, s5];
	            s3 = s4;
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	        } else {
	          peg$currPos = s3;
	          s3 = peg$c0;
	        }
	        while (s3 !== peg$FAILED) {
	          s2.push(s3);
	          s3 = peg$currPos;
	          s4 = peg$parsegroup1_op();
	          if (s4 !== peg$FAILED) {
	            s5 = peg$parsefactor1();
	            if (s5 !== peg$FAILED) {
	              s4 = [s4, s5];
	              s3 = s4;
	            } else {
	              peg$currPos = s3;
	              s3 = peg$c0;
	            }
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	        }
	        if (s2 !== peg$FAILED) {
	          peg$reportedPos = s0;
	          s1 = peg$c29(s1, s2);
	          s0 = s1;
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parsefactor3() {
	      var s0, s1, s2, s3, s4, s5;

	      s0 = peg$currPos;
	      s1 = peg$parsefactor2();
	      if (s1 !== peg$FAILED) {
	        s2 = [];
	        s3 = peg$currPos;
	        s4 = peg$parsegroup2_op();
	        if (s4 !== peg$FAILED) {
	          s5 = peg$parsefactor2();
	          if (s5 !== peg$FAILED) {
	            s4 = [s4, s5];
	            s3 = s4;
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	        } else {
	          peg$currPos = s3;
	          s3 = peg$c0;
	        }
	        while (s3 !== peg$FAILED) {
	          s2.push(s3);
	          s3 = peg$currPos;
	          s4 = peg$parsegroup2_op();
	          if (s4 !== peg$FAILED) {
	            s5 = peg$parsefactor2();
	            if (s5 !== peg$FAILED) {
	              s4 = [s4, s5];
	              s3 = s4;
	            } else {
	              peg$currPos = s3;
	              s3 = peg$c0;
	            }
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	        }
	        if (s2 !== peg$FAILED) {
	          peg$reportedPos = s0;
	          s1 = peg$c30(s1, s2);
	          s0 = s1;
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parsefactor4() {
	      var s0, s1, s2, s3, s4, s5;

	      s0 = peg$currPos;
	      s1 = peg$parsefactor3();
	      if (s1 !== peg$FAILED) {
	        s2 = [];
	        s3 = peg$currPos;
	        s4 = peg$parsegroup3_op();
	        if (s4 !== peg$FAILED) {
	          s5 = peg$parsefactor3();
	          if (s5 !== peg$FAILED) {
	            s4 = [s4, s5];
	            s3 = s4;
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	        } else {
	          peg$currPos = s3;
	          s3 = peg$c0;
	        }
	        while (s3 !== peg$FAILED) {
	          s2.push(s3);
	          s3 = peg$currPos;
	          s4 = peg$parsegroup3_op();
	          if (s4 !== peg$FAILED) {
	            s5 = peg$parsefactor3();
	            if (s5 !== peg$FAILED) {
	              s4 = [s4, s5];
	              s3 = s4;
	            } else {
	              peg$currPos = s3;
	              s3 = peg$c0;
	            }
	          } else {
	            peg$currPos = s3;
	            s3 = peg$c0;
	          }
	        }
	        if (s2 !== peg$FAILED) {
	          peg$reportedPos = s0;
	          s1 = peg$c30(s1, s2);
	          s0 = s1;
	        } else {
	          peg$currPos = s0;
	          s0 = peg$c0;
	        }
	      } else {
	        peg$currPos = s0;
	        s0 = peg$c0;
	      }

	      return s0;
	    }

	    function peg$parsegroup1_op() {
	      var s0;

	      if (input.substr(peg$currPos, 2) === peg$c31) {
	        s0 = peg$c31;
	        peg$currPos += 2;
	      } else {
	        s0 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c32); }
	      }

	      return s0;
	    }

	    function peg$parsegroup2_op() {
	      var s0;

	      if (input.charCodeAt(peg$currPos) === 42) {
	        s0 = peg$c33;
	        peg$currPos++;
	      } else {
	        s0 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c34); }
	      }
	      if (s0 === peg$FAILED) {
	        if (input.charCodeAt(peg$currPos) === 47) {
	          s0 = peg$c22;
	          peg$currPos++;
	        } else {
	          s0 = peg$FAILED;
	          if (peg$silentFails === 0) { peg$fail(peg$c23); }
	        }
	        if (s0 === peg$FAILED) {
	          if (input.substr(peg$currPos, 3) === peg$c35) {
	            s0 = peg$c35;
	            peg$currPos += 3;
	          } else {
	            s0 = peg$FAILED;
	            if (peg$silentFails === 0) { peg$fail(peg$c36); }
	          }
	        }
	      }

	      return s0;
	    }

	    function peg$parsegroup3_op() {
	      var s0;

	      if (input.charCodeAt(peg$currPos) === 43) {
	        s0 = peg$c37;
	        peg$currPos++;
	      } else {
	        s0 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c38); }
	      }
	      if (s0 === peg$FAILED) {
	        if (input.charCodeAt(peg$currPos) === 45) {
	          s0 = peg$c39;
	          peg$currPos++;
	        } else {
	          s0 = peg$FAILED;
	          if (peg$silentFails === 0) { peg$fail(peg$c40); }
	        }
	        if (s0 === peg$FAILED) {
	          if (input.substr(peg$currPos, 2) === peg$c41) {
	            s0 = peg$c41;
	            peg$currPos += 2;
	          } else {
	            s0 = peg$FAILED;
	            if (peg$silentFails === 0) { peg$fail(peg$c42); }
	          }
	          if (s0 === peg$FAILED) {
	            if (input.substr(peg$currPos, 3) === peg$c43) {
	              s0 = peg$c43;
	              peg$currPos += 3;
	            } else {
	              s0 = peg$FAILED;
	              if (peg$silentFails === 0) { peg$fail(peg$c44); }
	            }
	            if (s0 === peg$FAILED) {
	              if (input.substr(peg$currPos, 3) === peg$c45) {
	                s0 = peg$c45;
	                peg$currPos += 3;
	              } else {
	                s0 = peg$FAILED;
	                if (peg$silentFails === 0) { peg$fail(peg$c46); }
	              }
	            }
	          }
	        }
	      }

	      return s0;
	    }

	    function peg$parseunary_op() {
	      var s0;

	      if (input.substr(peg$currPos, 3) === peg$c47) {
	        s0 = peg$c47;
	        peg$currPos += 3;
	      } else {
	        s0 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c48); }
	      }
	      if (s0 === peg$FAILED) {
	        if (input.substr(peg$currPos, 4) === peg$c49) {
	          s0 = peg$c49;
	          peg$currPos += 4;
	        } else {
	          s0 = peg$FAILED;
	          if (peg$silentFails === 0) { peg$fail(peg$c50); }
	        }
	        if (s0 === peg$FAILED) {
	          if (input.substr(peg$currPos, 4) === peg$c51) {
	            s0 = peg$c51;
	            peg$currPos += 4;
	          } else {
	            s0 = peg$FAILED;
	            if (peg$silentFails === 0) { peg$fail(peg$c52); }
	          }
	          if (s0 === peg$FAILED) {
	            if (input.substr(peg$currPos, 3) === peg$c53) {
	              s0 = peg$c53;
	              peg$currPos += 3;
	            } else {
	              s0 = peg$FAILED;
	              if (peg$silentFails === 0) { peg$fail(peg$c54); }
	            }
	            if (s0 === peg$FAILED) {
	              if (input.substr(peg$currPos, 3) === peg$c55) {
	                s0 = peg$c55;
	                peg$currPos += 3;
	              } else {
	                s0 = peg$FAILED;
	                if (peg$silentFails === 0) { peg$fail(peg$c56); }
	              }
	              if (s0 === peg$FAILED) {
	                if (input.substr(peg$currPos, 3) === peg$c57) {
	                  s0 = peg$c57;
	                  peg$currPos += 3;
	                } else {
	                  s0 = peg$FAILED;
	                  if (peg$silentFails === 0) { peg$fail(peg$c58); }
	                }
	                if (s0 === peg$FAILED) {
	                  if (input.substr(peg$currPos, 3) === peg$c59) {
	                    s0 = peg$c59;
	                    peg$currPos += 3;
	                  } else {
	                    s0 = peg$FAILED;
	                    if (peg$silentFails === 0) { peg$fail(peg$c60); }
	                  }
	                  if (s0 === peg$FAILED) {
	                    if (input.substr(peg$currPos, 5) === peg$c61) {
	                      s0 = peg$c61;
	                      peg$currPos += 5;
	                    } else {
	                      s0 = peg$FAILED;
	                      if (peg$silentFails === 0) { peg$fail(peg$c62); }
	                    }
	                    if (s0 === peg$FAILED) {
	                      if (input.substr(peg$currPos, 2) === peg$c63) {
	                        s0 = peg$c63;
	                        peg$currPos += 2;
	                      } else {
	                        s0 = peg$FAILED;
	                        if (peg$silentFails === 0) { peg$fail(peg$c64); }
	                      }
	                      if (s0 === peg$FAILED) {
	                        if (input.substr(peg$currPos, 3) === peg$c65) {
	                          s0 = peg$c65;
	                          peg$currPos += 3;
	                        } else {
	                          s0 = peg$FAILED;
	                          if (peg$silentFails === 0) { peg$fail(peg$c66); }
	                        }
	                        if (s0 === peg$FAILED) {
	                          if (input.substr(peg$currPos, 4) === peg$c67) {
	                            s0 = peg$c67;
	                            peg$currPos += 4;
	                          } else {
	                            s0 = peg$FAILED;
	                            if (peg$silentFails === 0) { peg$fail(peg$c68); }
	                          }
	                          if (s0 === peg$FAILED) {
	                            if (input.substr(peg$currPos, 3) === peg$c69) {
	                              s0 = peg$c69;
	                              peg$currPos += 3;
	                            } else {
	                              s0 = peg$FAILED;
	                              if (peg$silentFails === 0) { peg$fail(peg$c70); }
	                            }
	                            if (s0 === peg$FAILED) {
	                              if (input.substr(peg$currPos, 6) === peg$c71) {
	                                s0 = peg$c71;
	                                peg$currPos += 6;
	                              } else {
	                                s0 = peg$FAILED;
	                                if (peg$silentFails === 0) { peg$fail(peg$c72); }
	                              }
	                            }
	                          }
	                        }
	                      }
	                    }
	                  }
	                }
	              }
	            }
	          }
	        }
	      }

	      return s0;
	    }

	    function peg$parseletter() {
	      var s0;

	      if (input.charCodeAt(peg$currPos) === 65) {
	        s0 = peg$c73;
	        peg$currPos++;
	      } else {
	        s0 = peg$FAILED;
	        if (peg$silentFails === 0) { peg$fail(peg$c74); }
	      }
	      if (s0 === peg$FAILED) {
	        if (input.charCodeAt(peg$currPos) === 66) {
	          s0 = peg$c75;
	          peg$currPos++;
	        } else {
	          s0 = peg$FAILED;
	          if (peg$silentFails === 0) { peg$fail(peg$c76); }
	        }
	        if (s0 === peg$FAILED) {
	          if (input.charCodeAt(peg$currPos) === 67) {
	            s0 = peg$c77;
	            peg$currPos++;
	          } else {
	            s0 = peg$FAILED;
	            if (peg$silentFails === 0) { peg$fail(peg$c78); }
	          }
	          if (s0 === peg$FAILED) {
	            if (input.charCodeAt(peg$currPos) === 68) {
	              s0 = peg$c79;
	              peg$currPos++;
	            } else {
	              s0 = peg$FAILED;
	              if (peg$silentFails === 0) { peg$fail(peg$c80); }
	            }
	            if (s0 === peg$FAILED) {
	              if (input.charCodeAt(peg$currPos) === 70) {
	                s0 = peg$c81;
	                peg$currPos++;
	              } else {
	                s0 = peg$FAILED;
	                if (peg$silentFails === 0) { peg$fail(peg$c82); }
	              }
	              if (s0 === peg$FAILED) {
	                if (input.charCodeAt(peg$currPos) === 71) {
	                  s0 = peg$c83;
	                  peg$currPos++;
	                } else {
	                  s0 = peg$FAILED;
	                  if (peg$silentFails === 0) { peg$fail(peg$c84); }
	                }
	                if (s0 === peg$FAILED) {
	                  if (input.charCodeAt(peg$currPos) === 72) {
	                    s0 = peg$c85;
	                    peg$currPos++;
	                  } else {
	                    s0 = peg$FAILED;
	                    if (peg$silentFails === 0) { peg$fail(peg$c86); }
	                  }
	                  if (s0 === peg$FAILED) {
	                    if (input.charCodeAt(peg$currPos) === 73) {
	                      s0 = peg$c87;
	                      peg$currPos++;
	                    } else {
	                      s0 = peg$FAILED;
	                      if (peg$silentFails === 0) { peg$fail(peg$c88); }
	                    }
	                    if (s0 === peg$FAILED) {
	                      if (input.charCodeAt(peg$currPos) === 74) {
	                        s0 = peg$c89;
	                        peg$currPos++;
	                      } else {
	                        s0 = peg$FAILED;
	                        if (peg$silentFails === 0) { peg$fail(peg$c90); }
	                      }
	                      if (s0 === peg$FAILED) {
	                        if (input.charCodeAt(peg$currPos) === 75) {
	                          s0 = peg$c91;
	                          peg$currPos++;
	                        } else {
	                          s0 = peg$FAILED;
	                          if (peg$silentFails === 0) { peg$fail(peg$c92); }
	                        }
	                        if (s0 === peg$FAILED) {
	                          if (input.charCodeAt(peg$currPos) === 76) {
	                            s0 = peg$c93;
	                            peg$currPos++;
	                          } else {
	                            s0 = peg$FAILED;
	                            if (peg$silentFails === 0) { peg$fail(peg$c94); }
	                          }
	                          if (s0 === peg$FAILED) {
	                            if (input.charCodeAt(peg$currPos) === 77) {
	                              s0 = peg$c95;
	                              peg$currPos++;
	                            } else {
	                              s0 = peg$FAILED;
	                              if (peg$silentFails === 0) { peg$fail(peg$c96); }
	                            }
	                            if (s0 === peg$FAILED) {
	                              if (input.charCodeAt(peg$currPos) === 80) {
	                                s0 = peg$c97;
	                                peg$currPos++;
	                              } else {
	                                s0 = peg$FAILED;
	                                if (peg$silentFails === 0) { peg$fail(peg$c98); }
	                              }
	                              if (s0 === peg$FAILED) {
	                                if (input.charCodeAt(peg$currPos) === 81) {
	                                  s0 = peg$c99;
	                                  peg$currPos++;
	                                } else {
	                                  s0 = peg$FAILED;
	                                  if (peg$silentFails === 0) { peg$fail(peg$c100); }
	                                }
	                                if (s0 === peg$FAILED) {
	                                  if (input.charCodeAt(peg$currPos) === 82) {
	                                    s0 = peg$c101;
	                                    peg$currPos++;
	                                  } else {
	                                    s0 = peg$FAILED;
	                                    if (peg$silentFails === 0) { peg$fail(peg$c102); }
	                                  }
	                                  if (s0 === peg$FAILED) {
	                                    if (input.charCodeAt(peg$currPos) === 83) {
	                                      s0 = peg$c103;
	                                      peg$currPos++;
	                                    } else {
	                                      s0 = peg$FAILED;
	                                      if (peg$silentFails === 0) { peg$fail(peg$c104); }
	                                    }
	                                    if (s0 === peg$FAILED) {
	                                      if (input.charCodeAt(peg$currPos) === 84) {
	                                        s0 = peg$c105;
	                                        peg$currPos++;
	                                      } else {
	                                        s0 = peg$FAILED;
	                                        if (peg$silentFails === 0) { peg$fail(peg$c106); }
	                                      }
	                                      if (s0 === peg$FAILED) {
	                                        if (input.charCodeAt(peg$currPos) === 88) {
	                                          s0 = peg$c107;
	                                          peg$currPos++;
	                                        } else {
	                                          s0 = peg$FAILED;
	                                          if (peg$silentFails === 0) { peg$fail(peg$c108); }
	                                        }
	                                        if (s0 === peg$FAILED) {
	                                          if (input.charCodeAt(peg$currPos) === 89) {
	                                            s0 = peg$c109;
	                                            peg$currPos++;
	                                          } else {
	                                            s0 = peg$FAILED;
	                                            if (peg$silentFails === 0) { peg$fail(peg$c110); }
	                                          }
	                                          if (s0 === peg$FAILED) {
	                                            if (input.charCodeAt(peg$currPos) === 90) {
	                                              s0 = peg$c111;
	                                              peg$currPos++;
	                                            } else {
	                                              s0 = peg$FAILED;
	                                              if (peg$silentFails === 0) { peg$fail(peg$c112); }
	                                            }
	                                          }
	                                        }
	                                      }
	                                    }
	                                  }
	                                }
	                              }
	                            }
	                          }
	                        }
	                      }
	                    }
	                  }
	                }
	              }
	            }
	          }
	        }
	      }

	      return s0;
	    }


	       buildTree = function(first, rest) {
	          if(rest.length == 0) {
	              return first;
	          } else { 
	              var next = rest.shift();
	              var operator = next[0]
	              var term = next[1]
	              return {left: first, right: buildTree(term, rest), op: operator};
	          }
	       }


	    peg$result = peg$startRuleFunction();

	    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
	      return peg$result;
	    } else {
	      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
	        peg$fail({ type: "end", description: "end of input" });
	      }

	      throw peg$buildException(null, peg$maxFailExpected, peg$maxFailPos);
	    }
	  }

	  return {
	    SyntaxError: SyntaxError,
	    parse:       parse
	  };
	})();

	exports.GParser = GParser;


/***/ }
/******/ ])
});
;