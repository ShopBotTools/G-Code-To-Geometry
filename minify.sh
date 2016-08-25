#!/bin/bash

#Automatize the treatment for minifying the code. Used on Linux.
#Need to have uglify installed (if nodejs installed, do: npm -g install uglify )

uglify -s browser/gcodetogeometry.js -o browser/gcodetogeometry.min.js
