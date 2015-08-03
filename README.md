# Handibot-GCode-To-Geometry
Parse GCode into geometrical lines and curves.
This is a work in progress but it should be functionnal. Maybe the variables
will be renamed so be careful if you update for a new version.

##List of supported commands:
* G0
* G1
* G2
* G3
* G17
* G18
* G19
* G20
* G21
* G90
* G91
* M02

##How to use it:
1. Download the minified version (if there is one) and include the file. Or
download all the scripts and include as in the example.html file.
2. In your code, you just have to use the function GCodeToGeometry.parse(code).

    var result = GCodeToGeometry.parse(myGCode);

The parameter must be the GCode in string.

The function will return an object which contains:
* **isComplete** : a boolean, true if the whole GCode is parsed, else false
* **errorMessage** : a string, if an error occurs, contains an error message
* **gcode** : an array of strings, contains the gcode parsed splitted (each cell
contains a line)
* **size** : an object, contains the maximum and minimal coordinate of
the bounding box (explained further)
* **lines** : an array of objects, each cell represent a straight or curved line

**All numerical values are in inches**.

##Object size
It contains the "minimal" point and the "maximum" point of the bounding box of
the whole path operation.
You can use it to calculate the width, length and width of the operation.
The points are in inches.
Example:

    size = {
        min : { x : 0, y : 0, z : -2 },
        max : { x : 10, y : 5, z : 3 }
    }

##Line objects
There are two types of lines.

###Straight line
This object contains the line number in the GCode where the the command is used.
**The line numbers start by 1**.
It contains the type of command (**G0** or **G1**).
It contains the start point and the end point.
Example:

    line = {
        lineNumber : 12,
        type : "G0",
        start : { x : 5, y : 9, z : 3 },
        end : { x : 3, y : 5, z : 3 }
    }


###Curved line
This object contains the line number in the GCode where the the command is used.
**The line numbers start by 1**.
It contains the type of command (**G2** or **G3**).
It contains an array of cubic Bézier's curves approximating the circular path.
Each Bézier's curve object contain four control point.
Example:

    line = {
        lineNumber : 4,
        type : "G3",
        beziers : [
            {
                p0 : { x : 0     , y : 0     , z : 8.881 }  ,
                p1 : { x : 0.846 , y : 1.677 , z : -3.279 } ,
                p2 : { x : 0.846 , y : 3.333 , z : -6.721 } ,
                p3 : { x : 0     , y : 5     , z : -10 }    ,
            }
        ]
    }
