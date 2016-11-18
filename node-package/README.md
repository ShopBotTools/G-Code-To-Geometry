# G-code to geometry

Parse GCode into geometrical lines and curves.

This program is a part of the Shopbot Tools new system called Fabmo but it can
be used independently.

This software uses a modified version of [Ryan Sturmer's
node-gcode](https://github.com/ryansturmer/node-gcode) under MIT license. The
copyright notice can be found in the file ``PARSER-LICENSE`` in the
``node-package`` folder.

The rest of this software is under Apachage Licence Version 2.0, see the file
``LICENSE`` and ``NOTICE``, also in the ``node-package`` folder, which includes
the license and the copyrights.

Generated API documentation can be found
[here](http://shopbottools.github.io/G-Code-To-Geometry/). This is only useful
for people maintaining the library, read below if you want to use the library.
This is the version before the conversion to a node js environment friendly, it
will be updated later but functionnalities are still the same.

## Including this library

If you want to use it in node.js.

    npm install gcodetogeometry

Webpack is used for converting the package in a browser version. If you want to
use it in a browser, include ``gcodetogeometry.js`` or
``gcodetogeometry.min.js`` located in the ``browser`` folder in the git
repository.

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

GCode has no real standard, therefore we had to make choices on what is
supported or not. This software tries to support all the features Shopbot Tools
support.

For each line, everything written after a ``(`` or ``;`` is considered as
comment.

## Behaviour

By default, the GCode is considered having this setting:
* It works on a XY plane (``G17``)
* The values are considered being in inches (``G20``)
* The position is absolute (``G90``)
* The bit is at (0, 0, 0)
* The feed rate is set to 0

All the values returned by this program are in inches.

If no feed rate or a negative feed rate has been set for a ``G1``, ``G2`` or
``G3`` command, it is considered that the machine will use a default value for
the feed rate. However, if the feed rate is equal to zero, the command will be
skipped.

## Error and warning system

When parsed, a list of errors is made. When a command has an error, this means
this command is skipped. When a command has a warning, this means this command
is executed but the behaviour can be different when executed by a real tool.

The error and warning correspond to the behaviour of the Shopbot Tools'
machines.

## How to use it:

### How to include the library

**If you use it in a browser**

1. Download the minified version (if there is one) or the non minified version
   (they are in the folder ``browser``) and include the file. Or download all
   the scripts and include as in the example.html file.
2. In your code, you just have to use the function gcodetogeometry.parse(code).

    var result = gcodetogeometry.parse(myGCode);

**If you use it in node js**. The package will be soon updated in npm.

### Function explanation

The parameter of the ``parse`` function must be the GCode in string.

The function will return an object which contains:
* **gcode** : an array of strings, contains the gcode parsed split (each cell
contains a line)
* **size** : an object, contains the maximum and minimal coordinate of
the bounding box (explained further)
* **lines** : an array of objects, each cell represent a straight or curved line
* **errorList** : an array of errors and warnings
* **displayInInch** : indicate if the values should be displayed in inches (else
in millimeters)

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

## Error object
This object contains the information about an error or warning for a command at
a line number. Is considered as error when the command is skipped, else as a
warning.
Example:

    error = {
        isSkipped : false
        line : 2
        message : "(warning) No feed rate set (the default is used)."
    }

## Example
Here is an example of a GCode correctly parsed:

    (Illerminaty)
    G1 Z-0.333 F66.6
    G1 X2
    G1 X1 Y1.73205
    G1 X0 Y0
    G1 Z1
    G0 X0.4 Y0.57735
    G1 Z-0.333 F66.6
    G3 X1.6 R0.8 F91.1
    G3 X0.4 R0.8
    G1 Z1

# License

For this software

```
   Copyright 2016 Alex Canales

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

For the modified version of Ryan Sturmer's node-gcode software

```
The MIT License (MIT)

Copyright (c) 2015 Ryan Sturmer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
