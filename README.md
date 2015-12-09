# Handibot-GCode-To-Geometry
Parse GCode into geometrical lines and curves.

This program is a part of the Shopbot Tools new system but it can be used
independently.

This is a work in progress but it should be functional. Maybe the variables
will be renamed so be careful if you update for a new version.

## List of supported commands:

This software supports the following commands with the following parameters
(which can be optional):

* ``G0 X... Y... Z...``
* ``G1 X... Y... Z... F...``
* ``G2 X... Y... Z... F... I... J... K...`` or  ``G2 X... Y... Z... F... R...``
* ``G3 X... Y... Z... F... I... J... K...`` or  ``G3 X... Y... Z... F... R...``
* ``G17``
* ``G18``
* ``G19``
* ``G20``
* ``G21``
* ``G90``
* ``G91``
* ``M02``  (this is the only M command parsed because it stops everything, after
  this command nothing is parsed)

If a parameter is wrong, it will be parsed. It will maybe be skipped.

Example:

    G0 X1 Y1  Ook (will act as G0 X1 Y1, will have a warning)
    G2 I1 R2      (will be skipped because cannot have R and I, J or K at)
                  (the same time. Also, will have an error).

GCode has no real standard, therefore had to make choices on what is supported
or not. This software tries to support all the features Shopbot Tools support.

For each line, everything written after a ``(`` or ``;`` is considered as
comment.

## Behaviour
All the values returned by this program are in inches. Also if in the GCode
parsed, no G20 or G21 commands (respectively set the values in inches and in
millimeters) are present, the value are assumed to be in inches.

The feed rate has to be set at least once before using the commands G0, G1, G2
or G3, else an error will occur. Once the feed rate has been set, if no feed
rate is specified, the precedent feed rate specified is used.

The coordinates are assumed to be absolute by default.

## How to use it:
1. Download the minified version (if there is one) and include the file. Or
download all the scripts and include as in the example.html file.
2. In your code, you just have to use the function GCodeToGeometry.parse(code).

    var result = GCodeToGeometry.parse(myGCode);

The parameter must be the GCode in string.

The function will return an object which contains:
* **isComplete** : a boolean, true if the whole GCode is parsed, else false
* **errorMessage** : a string, if an error occurs, contains an error message
* **gcode** : an array of strings, contains the gcode parsed split (each cell
contains a line)
* **size** : an object, contains the maximum and minimal coordinate of
the bounding box (explained further)
* **lines** : an array of objects, each cell represent a straight or curved line

**All numerical values are in inches**.

## Object size
It contains the "minimal" point and the "maximum" point of the bounding box of
the whole path operation.
You can use it to calculate the width, length and width of the operation.
The points are in inches.
Example:

    size = {
        min : { x : 0, y : 0, z : -2 },
        max : { x : 10, y : 5, z : 3 }
    }

## Line objects
There are two types of lines.

### Straight line
This object contains the line number in the GCode where the command is used.
**The line numbers start by 1**.
It contains the type of command (**G0** or **G1**) and the feed rate (in inch by
minute).
It contains the start point, the end point.
Example:

    line = {
        lineNumber : 12,
        type : "G0",
        feedrate : 2.5,
        start : { x : 5, y : 9, z : 3 },
        end : { x : 3, y : 5, z : 3 }
    }


### Curved line
This object contains the line number in the GCode where the command is used.
**The line numbers start by 1**.
It contains the type of command (**G2** or **G3**) and the feed rate (in inch by
minute).
It contains an array of cubic Bézier's curves approximating the circular path.
Each Bézier's curve object contain four control point.
Example:

    line = {
        lineNumber : 4,
        type : "G3",
        feedrate : 2.5,
        beziers : [
            {
                p0 : { x : 0     , y : 0     , z : 8.881 }  ,
                p1 : { x : 0.846 , y : 1.677 , z : -3.279 } ,
                p2 : { x : 0.846 , y : 3.333 , z : -6.721 } ,
                p3 : { x : 0     , y : 5     , z : -10 }    ,
            }
        ]
    }


## Example
Here is an example of a GCode correctly parsed:

    (Illerminaty)
    G1 Z-0.333 F66.6
    G1 X2
    G1 X1 Y1.73205
    G1 X0 Y0
    G1 Z1
    G0 X0.4 Y0.57735 F91.1
    G1 Z-0.333 F66.6
    G3 X1.6 R0.8
    G3 X0.4 R0.8
    G1 Z1
