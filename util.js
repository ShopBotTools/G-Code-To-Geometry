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
GCodeToGeometry.MILLIMETER_TO_INCH = 0.03937008;  //Convert a millimeter to an inch

//Return the feedrate converted
GCodeToGeometry.calculateFeedrate = function(feedrate, inMm) {
    return (inMm === false) ? feedrate : feedrate * GCodeToGeometry.MILLIMETER_TO_INCH;
};


//Find the next position according to the x, y and z contained or not by in the
//command parameters
GCodeToGeometry.findPosition = function(start, parameters, relative, inMm) {
    var pos = { x : start.x, y : start.y, z : start.z };
    var d = (inMm === false) ? 1 : GCodeToGeometry.MILLIMETER_TO_INCH;
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
};

//It has to be the same objects, too bad if it's not
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

//Return the copy of the object
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

GCodeToGeometry.movePoint = function(point, vector) {
    var keys = Object.keys(vector);
    var i = 0;
    for(i = 0; i < keys.length; i++) {
        if(point[keys[i]] !== undefined) {
            point[keys[i]] += vector[keys[i]];
        }
    }
};

GCodeToGeometry.dotProduct2 = function(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y;
};

GCodeToGeometry.crossProduct2 = function(v1, v2) {
    return v1.x * v2.y - v2.x * v1.y;
};

GCodeToGeometry.lengthVector3 = function(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
};

//Returns object of 3 axes:
// re is the axes for REal numbers
// im for the IMaginary numbers
// cr for the CRoss axe
GCodeToGeometry.findAxes = function(crossAxe) {
    if(crossAxe.toLowerCase() === "x") {
        return { re : "y", im : "z", cr : "x"};
    }
    if(crossAxe.toLowerCase() === "y") {
        return { re : "z", im : "x", cr : "y"};
    }
    return { re : "x", im : "y", cr : "z"};
};

//Do a rotation and scale of point according to center and store
// the result in newPoint. re and im for axes Real and Imaginary
// angle is in radian
// Copy the value of point before doing calculus so point and newPoint
// can be the same object
GCodeToGeometry.scaleAndRotation = function(center, point, newPoint, angle, length, re, im) {
    var c = center, p = point, nP = newPoint;
    var l = length, cA = Math.cos(angle), sA = Math.sin(angle);
    var pRe = p[re], pIm = p[im], cRe = c[re], cIm = c[im];

    nP[re] = l * ((pRe - cRe) * cA - (pIm - cIm) * sA) + cRe;
    nP[im] = l * ((pIm - cIm) * cA + (pRe - cRe) * sA) + cIm;
};

//Returns the signed angle in radian in 2D (between -PI and PI)
GCodeToGeometry.findAngleVectors2 = function(v1, v2) {
    var cross = GCodeToGeometry.crossProduct2(v1, v2);
    var dot = GCodeToGeometry.dotProduct2(v1, v2);
    var lV1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    var lV2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    if(lV1 === 0 || lV2 === 0) {
        return 0;
    }
    if(cross === 0) {
        cross = 1;
    }
    if(cross < 0) {
        return -Math.acos(dot / (lV1 * lV2));  //For the sign
    }
    return Math.acos(dot / (lV1 * lV2));  //For the sign
};

GCodeToGeometry.findAngleOrientedVectors2 = function(v1, v2, positive) {
    var angle =  GCodeToGeometry.findAngleVectors2(v1, v2);

    if(positive === false && angle > 0) {
        return -(Math.PI * 2 - angle);
    }
    if(positive === true && angle < 0) {
        return Math.PI * 2 + angle;
    }

    return angle;
};

//radius is positive or negative
//Return false if impossible to set the center, else return the center position
GCodeToGeometry.findCenter = function(start, end, radius, clockwise, crossAxe) {
    var se = { x : end.x - start.x, y : end.y - start.y,
        z : end.z - start.z
    };
    var angle = 0, l = 1, lSE = 0, r = Math.abs(radius), aCSCE = 0;
    var center = { x : 0, y : 0, z : 0 };
    var axes = GCodeToGeometry.findAxes(crossAxe);
    lSE = Math.sqrt(se[axes.re] * se[axes.re] + se[axes.im] * se[axes.im]);

    if(lSE > Math.abs(radius * 2) || lSE === 0) {
        return false;
    }

    angle = Math.acos(lSE / (2 * r));
    l = r / lSE;
    GCodeToGeometry.scaleAndRotation(start, end, center, angle, l, axes.re, axes.im);
    aCSCE = GCodeToGeometry.findAngleVectors2(
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

    GCodeToGeometry.scaleAndRotation(start, end, center, -angle, l, axes.re, axes.im);
    return center;
};
