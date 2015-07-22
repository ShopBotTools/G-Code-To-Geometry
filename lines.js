/*jslint todo: true, browser: true, continue: true, white: true*/
/*global GCodeToGeometry */

/**
 * Written by Alex Canales for ShopBotTools, Inc.
 */

/**
 * This file contains the classes managing the lines. The lines are
 * the representation of the G0, G1, G2 and G3 commands.
 */

GCodeToGeometry.StraightLine = (function() {
    "use strict";

    //TODO: should "throw" an error if bad parameters
    function StraightLine(index, start, commandParsed, relative, inMm) {
        var that = this;

        that.returnLine = function() {
            return {
                lineNumber : that.index,
                type : that.word,
                start : that.start,
                end : that.end
            };
        };

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

        function initialize(index, start, commandParsed, relative, inMm) {
            that.index = index;
            that.type = GCodeToGeometry.STRAIGHT;
            that.word = commandParsed.type;
            that.start = { x : start.x, y : start.y, z : start.z };
            that.end = GCodeToGeometry.findPosition(start, commandParsed,
                    relative, inMm);
        }


        initialize(index, start, commandParsed, relative, inMm);
    }

    return StraightLine;
}());

GCodeToGeometry.CurvedLine = (function() {
    "use strict";

    function CurvedLine(index, start, commandParsed, relative, inMm, crossAxe) {
        var that = this;

        function getBezierAngle() {
            var axes = GCodeToGeometry.findAxes(that.crossAxe);
            var cs = { x : that.start[axes.re] - that.center[axes.re],
                y : that.start[axes.im] - that.center[axes.im], z : 0};
            var ce = { x : that.end[axes.re] - that.center[axes.re],
                y : that.end[axes.im] - that.center[axes.im], z : 0};

            return GCodeToGeometry.findAngleOrientedVectors2(cs, ce,
                    that.clockwise === false);
        }

        function getBezierRadius() {
            var axes = GCodeToGeometry.findAxes(that.crossAxe);
            var cs = { x : that.start[axes.re] - that.center[axes.re],
                y : that.start[axes.im] - that.center[axes.im], z : 0};
            return GCodeToGeometry.lengthVector(cs);
        }

        //Simple cubic Bézier curve interpolation clockwise on XY plane
        //angle in radian included in [0; pi/2]
        //radius > 0
        //From Richard A DeVeneza's work
        function simCubBezInt(angle, radius) {
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

        //Transform a simple cubic Bézier's curve clockwise on XY plane
        // to a Bézier's curve in 3D with the right crossAxe and clock direction
        // clockwise is bool
        // pitch can be positive or negative
        function simCubBezTo3D(curve, clockwise, pitch, crossAxe) {
            var height = 0;  //height position for p1, p2 and p3

            if(clockwise === false) {
                GCodeToGeometry.swapObjects(curve.p0, curve.p3);
                GCodeToGeometry.swapObjects(curve.p1, curve.p2);
            }

            //NOTE: not sure for the height, maybe this is better:
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
            GCodeToGeometry.scaleAndRotation(c,curve.p0,curve.p0, angle, 1, re, im);
            GCodeToGeometry.scaleAndRotation(c,curve.p1,curve.p1, angle, 1, re, im);
            GCodeToGeometry.scaleAndRotation(c,curve.p2,curve.p2, angle, 1, re, im);
            GCodeToGeometry.scaleAndRotation(c,curve.p3,curve.p3, angle, 1, re, im);

            GCodeToGeometry.movePoint(curve.p0, center);
            GCodeToGeometry.movePoint(curve.p1, center);
            GCodeToGeometry.movePoint(curve.p2, center);
            GCodeToGeometry.movePoint(curve.p3, center);
        }

        // The Bézier's curve must be on the good plane
        function getFullBezier(num90, bez90, numSmall, bezSmall, pitch90) {
            var arcs = [];
            var center = GCodeToGeometry.copyObject(that.center);
            var axes = GCodeToGeometry.findAxes(that.crossAxe);
            var cs = { x : that.start[axes.re] - center[axes.re],
                y : that.start[axes.im] - center[axes.im] };
            var i = 0, angle = 0, sign = (that.clockwise === true) ? -1 : 1;

            if(num90 === 0 && numSmall === 0) {
                return arcs;
            }

            if(num90 > 0) {
                angle = GCodeToGeometry.findAngleOrientedVectors2(
                    { x : bez90.p0[axes.re], y : bez90.p0[axes.im] }, cs,
                    that.clockwise === false
                );

                for(i = 0; i < num90; i++) {
                    arcs.push(GCodeToGeometry.copyObject(bez90));
                    rotAndPlaBez(arcs[i], center, angle, axes.re, axes.im);
                    // angle += Math.PI / 2 * sign;
                    angle += 1.570796326794897 * sign;
                    center[that.crossAxe] += pitch90;
                }
            }

            if(numSmall > 0) {
                angle = GCodeToGeometry.findAngleOrientedVectors2(
                    { x : bezSmall.p0[axes.re], y : bezSmall.p0[axes.im] }, cs,
                    that.clockwise === false
                );

                if(num90 !== 0) {
                    angle += num90 * 1.570796326794897 * sign;
                }
                arcs.push(GCodeToGeometry.copyObject(bezSmall));
                rotAndPlaBez(arcs[i], center, angle, axes.re, axes.im);
            }

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
            var angle = getBezierAngle(), radius = getBezierRadius();
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
                bez90 = simCubBezInt(halfPI, radius);
                simCubBezTo3D(bez90, (angle < 0), p90, that.crossAxe);
            }
            if(numSmall > 0) {
                angle = absAngle - num90 * halfPI;
                if(that.clockwise === true) {
                    angle = -angle;
                }
                bezSmall = simCubBezInt(angle, radius);
                simCubBezTo3D(bezSmall, (angle < 0), pLittle, that.crossAxe);
            }

            return getFullBezier(num90, bez90, numSmall, bezSmall, p90);
        }

        that.returnLine = function() {
            var bez = arcToBezier();
            return {
                lineNumber  : that.index,
                type : that.word,
                beziers : bez
            };
        };

        //radius is positive or negative
        function findCenter(start, end, commandParsed, clockwise, crossAxe, inMm) {
            var delta = (inMm === false) ? 1 : GCodeToGeometry.mmToInch;
            if(commandParsed.r === undefined) {
                var center = { x : start.x, y : start.y, z : start.z };
                if(commandParsed.i !== undefined) {
                    center.x += commandParsed.i * delta;
                }
                if(commandParsed.j !== undefined) {
                    center.y += commandParsed.j * delta;
                }
                if(commandParsed.k !== undefined) {
                    center.z += commandParsed.k * delta;
                }
                return center;
            }
            return GCodeToGeometry.findCenter(start, end, commandParsed.r * delta,
                    clockwise, crossAxe);
        }

        // The value is include between the value a and b
        function isInclude(value, a, b) {
            if(b < a) {  //Swap
                a = a + b;
                b = a - b;
                a = a - b;
            }
            return (a <= value && value <= b);
        }

        function axeCutArc(reValue, imValue, angleBezier, cs) {
            //Find the angle in the same orientation that the Bézier's angle
            var a = GCodeToGeometry.findAngleOrientedVectors2(cs,
                    { x : reValue, y : imValue }, that.clockwise === false);
            return (isInclude(a, 0, angleBezier) === true);
        }

        that.getSize = function() {
            //TODO: test it
            var axes = GCodeToGeometry.findAxes(that.crossAxe);
            var cs = {
                x : that.start[axes.re] - that.center[axes.re],
                y : that.start[axes.im] - that.center[axes.im]
            };
            var radius = getBezierRadius(), aBez = getBezierAngle();
            var min = { x : 0 , y : 0, z : 0 }, max = { x : 0 , y : 0, z : 0 };
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

        function initialize(index, start, commandParsed, relative, inMm, crossAxe) {
            that.index = index;
            that.type = GCodeToGeometry.CURVED;
            that.word = commandParsed.type;
            that.start = { x : start.x, y : start.y, z : start.z };
            that.end = GCodeToGeometry.findPosition(start, commandParsed, relative,
                    inMm);
            that.clockwise = (commandParsed.type === "G2");
            that.center = findCenter(start, that.end, commandParsed,
                    that.clockwise, crossAxe, inMm);
            that.crossAxe = crossAxe;
        }

        initialize(index, start, commandParsed, relative, inMm, crossAxe);
    }

    return CurvedLine;
}());
