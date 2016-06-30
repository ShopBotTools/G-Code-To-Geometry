/*jslint todo: true, browser: true, continue: true, white: true*/

/**
 * Written by Alex Canales for ShopBotTools, Inc.
 */

/**
 * This file contains useful scripts for different purposes (geometry, object
 * operations...). It also create the GCodeToGeometry namespace.
 */

var GCodeToGeometry = {};

//Global variables
GCodeToGeometry.INCH_TO_MILLIMETER = 25.4;
GCodeToGeometry.MILLIMETER_TO_INCH = 0.03937008;
GCodeToGeometry.FLOAT_PRECISION = 0.001;  // Precision for comparing floats

//Return the feedrate converted
GCodeToGeometry.calculateFeedrate = function(feedrate, inMm) {
    return (inMm === false) ? feedrate : feedrate * GCodeToGeometry.MILLIMETER_TO_INCH;
};

/**
 * Checks if two numbers are nearly equal. This function is used to avoid
 * to have too much precision when checking values between floating-point
 * numbers.
 *
 * @param {number} a Number A.
 * @param {number} b Number B.
 * @param {number} precision (optionnal) The precision of the comparaison, by
 * default the value is GCodeToGeometry.FLOAT_PRECISION.
 * @return {boolean} True if the two value are nearly equal.
 */
GCodeToGeometry.nearlyEqual = function(a, b, precision) {
    var p = (precision === undefined) ? GCodeToGeometry.FLOAT_PRECISION : precision;
    return Math.abs(b - a) <= p;
};

/**
 * Swaps two objects. It has to be the same objects, too bad if it's not.
 *
 * @param {object} obj1 The first object.
 * @param {object} obj2 The second object.
 * @param {boolean} inMm If the values are in inches.
*/
GCodeToGeometry.swapObjects = function(obj1, obj2) {
    var keys = Object.keys(obj1);
    var i = 0;
    var temp;

    for(i = 0; i < keys.length; i++) {
        if(typeof obj1[keys[i]] === "object") {
            GCodeToGeometry.swapObjects(obj1[keys[i]], obj2[keys[i]]);
        } else {
            temp = obj1[keys[i]];
            obj1[keys[i]] = obj2[keys[i]];
            obj2[keys[i]] = temp;
        }
    }
};

/**
 * Returns the copy of the object.
 *
 * @param {object} object The object.
 * @return {object} The copy of the object.
*/
GCodeToGeometry.copyObject = function(object) {
    var keys = Object.keys(object);
    var i = 0;
    var copy = {};
    for(i = 0; i < keys.length; i++) {
        if(typeof object[keys[i]] === "object") {
            copy[keys[i]] = GCodeToGeometry.copyObject(object[keys[i]]);
        } else {
            copy[keys[i]] = object[keys[i]];
        }
    }
    return copy;
};

/**
 * Moves the point according to the vector.
 *
 * @param {object} point The point to move.
 * @param {object} vector The vector.
 */
GCodeToGeometry.movePoint = function(point, vector) {
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
 * @param {object} v1 The first vector.
 * @param {object} v2 The second vector.
 * @return {number} The result.
 */
GCodeToGeometry.dotProduct2 = function(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y;
};

/**
 * Does a 2D cross product.
 *
 * @param {object} v1 The first vector.
 * @param {object} v2 The second vector.
 * @return {number} The result on the Z axe.
 */
GCodeToGeometry.crossProduct2 = function(v1, v2) {
    return v1.x * v2.y - v2.x * v1.y;
};

/**
 * Calculates the length of a 3D vector.
 * @param {object} v The vector.
 * @return {number} The vector length.
 */
GCodeToGeometry.lengthVector3 = function(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
};

/**
 * Returns object of 3 axes:
 *  re is the axes for REal numbers
 *  im for the IMaginary numbers
 *  cr for the CRoss axe
 * @param {string} crossAxe The name of the axe given by the cross product of
 * the vectors defining the plane.
 * @return {object} The object defining the real, imaginary and cross axe.
 */
GCodeToGeometry.findAxes = function(crossAxe) {
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
 * @param {object} center The center of the rotation and scale.
 * @param {object} point The point to modify.
 * @param {object} newPoint The point storying the result.
 * @param {number} angle The angle in radians.
 * @param {number} length The scale ratio.
 * @param {string} re The real axe.
 * @param {string} im The imaginary axe.
 */
GCodeToGeometry.scaleAndRotation = function(center, point, newPoint, angle, length, re, im) {
    var c = center, p = point, nP = newPoint;
    var l = length, cA = Math.cos(angle), sA = Math.sin(angle);
    var pRe = p[re], pIm = p[im], cRe = c[re], cIm = c[im];

    nP[re] = l * ((pRe - cRe) * cA - (pIm - cIm) * sA) + cRe;
    nP[im] = l * ((pIm - cIm) * cA + (pRe - cRe) * sA) + cIm;
};

/**
 * Returns the signed angle in radian in 2D (between -PI and PI).
 *
 * @param {object} v1 The first vector.
 * @param {object} v2 The second vector.
 * @return {number} The angle in radian.
 */
GCodeToGeometry.findAngleVectors2 = function(v1, v2) {
    var sign = (GCodeToGeometry.crossProduct2(v1, v2) < 0) ? -1 : 1;
    var dot = GCodeToGeometry.dotProduct2(v1, v2);
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
 * @param {object} v1 The first vector.
 * @param {object} v2 The second vector.
 * @param {boolean} positive If the oriented angle should go counter-clockwise.
 * @return {number} the angle in radian.
 */
GCodeToGeometry.findAngleOrientedVectors2 = function(v1, v2, positive) {
    var angle =  GCodeToGeometry.findAngleVectors2(v1, v2);

    if(positive === false && angle > 0) {
        return angle - Math.PI * 2;
    }
    if(positive === true && angle < 0) {
        return Math.PI * 2 + angle;
    }

    return angle;
};
