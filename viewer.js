/*jslint todo: true, browser: true, continue: true, white: true*/
/*global THREE, GParser, GCodeViewer, dat */

/**
 * Written by Alex Canales for ShopBotTools, Inc.
 */

/**
 * This file contains the class managing the viewer. This the class that the
 * user will instantiate. This is the main class.
 */

GCodeViewer.Viewer = (function() {
    "use strict";
    function Viewer(configuration, domElement, callbackError) {
        var that = this;

        function animate() {
            window.requestAnimationFrame(animate);
            that.controls.update();
        }

        function render() {
            that.renderer.render(that.scene, that.camera);
        }

        that.refreshDisplay = function() {
            render();
            animate();
        };

        function displayError(message) {
            if(that.callbackError !== undefined) {
                that.callbackError(message);
            }
        }

        // function cameraPosition(x, y, z) {
        //     that.controls
        // }

        // function setCamera() {
        //     that.camera.up = new THREE.Vector3(0, 0, 1);
        //     that.controls = new THREE.OrbitControls(that.camera,
        //             that.renderer.domElement);
        //     if(that.cameraSet === false) {
        //         that.cameraSet = true;
        //         that.controls.damping = 0.2;
        //         that.controls.addEventListener('change', render);
        //     }
        // }

        that.setPerspectiveCamera = function() {
            that.camera.toPerspective();
            that.refreshDisplay();
            // var width = that.renderer.domElement.width;
            // var height = that.renderer.domElement.height;
            // that.camera = new THREE.PerspectiveCamera(75, width/height, 0.1, 1000);
            // setCamera();
        };

        that.setOrthographicCamera = function() {
            that.camera.toOrthographic();
            that.refreshDisplay();
            // var width = that.renderer.domElement.width;
            // var height = that.renderer.domElement.height;
            // var viewSize = 50;
            // var aspectRatio = width / height;
            // that.camera = new THREE.OrthographicCamera(
            //     -aspectRatio * viewSize / 2, aspectRatio * viewSize / 2,
            //     viewSize / 2, - viewSize / 2, -100, 100
            // );
            // setCamera();
        };

        function setCombinedCamera() {
            var width = that.renderer.domElement.width/2; //-- Camera frustum width.
            var height = that.renderer.domElement.height/2; //-- Camera frustum height.
            var fov = 75; //— Camera frustum vertical field of view in perspective view.
            var near = 0.1; //— Camera frustum near plane in perspective view.
            var far = 1000; //— Camera frustum far plane in perspective view.
            var orthoNear = -100; //— Camera frustum near plane in orthographic view.
            var orthoFar = 100; //— Camera frustum far plane in orthographic view.
            that.camera = new THREE.CombinedCamera(width, height, fov, near,
                    far, orthoNear, orthoFar);

            that.controls = new THREE.OrbitControls(that.camera,
                    that.renderer.domElement);
            that.controls.damping = 0.2;
            that.controls.addEventListener('change', render);
        }

        //Return the distance needed to fetch the view according to the axe
        //exemple: fetch the XY plane, "x" and "y" as parameter, return 0 if no
        // path
        //Return distance if perspective, else the zoom
        function distanceToFetch(axe1, axe2) {
            if(that.path === undefined) {
                return 5;
            }
            var size = that.path.getTotalSize();
            var distance = 0, width = 0, height = 0, length = 0;
            width = Math.abs(size.max[axe1] - size.min[axe1]);
            height = Math.abs(size.max[axe2] - size.min[axe2]);
            if(width === 0 && height === 0) {
                return 5;
            }
            length = (width < height) ? height : width;

            if(that.camera.inPerspectiveMode === true) {
                if(that.camera.fov === 0 || that.camera.fov === 180) {
                    return distance;
                }
                distance = (length / 2)/Math.tan(that.camera.fov * Math.PI /180);
            } else {
                var cW = Math.abs(that.camera.right - that.camera.left);
                var cH = Math.abs(that.camera.top - that.camera.bottom);
                console.log("width: " + width + " | height: " + height);
                console.log("cW: " + cW + " | cH: " + cH);
                //TODO: think about that
                if(cW < width || cH < height) {  //if must unzoom
                    distance = (width < height) ? cH / height : cW / width;
                } else {  //if must zoom
                    distance = (width < height) ? height / cH : width / cW;
                }
            }
            console.log(distance);

            return distance;
        }

        //Return the center of the board
        function centerPath() {
            var center = { x : 0, y : 0, z : 0 };
            if(that.path === undefined || that.path.getTotalSize() === undefined) {
                return center;
            }
            var size = that.path.getTotalSize();
            center.x = size.min.x + Math.abs(size.max.x - size.min.x) / 2 ;
            center.y = size.min.y + Math.abs(size.max.y - size.min.y) / 2 ;
            center.z = size.min.z + Math.abs(size.max.z - size.min.z) / 2 ;
            return center;
        }

        function lookAtPoint(point, cameraPosition, rotation) {
            that.controls.reset();
            that.camera.position.x = cameraPosition.x;
            that.camera.position.y = cameraPosition.y;
            that.camera.position.z = cameraPosition.z;
            if(that.camera.inOrthographicMode === true) {
                that.controls.dollyIn(that.camera.zoom);
            }
            if(rotation !== undefined) {
                that.camera.rotateX(rotation.x);
                that.camera.rotateY(rotation.y);
                that.camera.rotateZ(rotation.z);
            }
            // that.camera.lookAt(point);
            that.controls.target.x = point.x;
            that.controls.target.y = point.y;
            that.controls.target.z = point.z;
            that.refreshDisplay();
        }

        function showPlane(axeReal, axeImaginary, crossAxe) {
            var center = centerPath();
            var cameraPosition = { x : center.x, y : center.y, z : center.z };
            if(that.camera.inPerspectiveMode === true) {
                cameraPosition[crossAxe]=distanceToFetch(axeReal, axeImaginary);
            } else {
                that.camera.zoom = distanceToFetch(axeReal, axeImaginary);
            }
            if(crossAxe === "y") {
                cameraPosition.y *= -1;
            }
            lookAtPoint(center, cameraPosition);
        }

        //TODO: fit with the board size
        that.showX = function() {
            showPlane("y", "z", "x");
            // var center = centerPath();
            // var distance = 0;
            // if(that.camera.inPerspectiveMode === true) {
            //     distance = distanceToFetch("y", "z");
            // } else {
            //     that.camera.zoom = distanceToFetch("y", "z");
            // }
            // lookAtPoint(center, { x : distance, y : 0, z : 0 },
            //         { x : Math.PI/2, y : 0, z : 0 });

            // lookAtPoint(that.scene.position, { x : 5, y : 0, z : 0 },
            //         { x : Math.PI/2, y : 0, z : 0 });
        };

        that.showY = function() {
            showPlane("x", "z", "y");
            // var center = centerPath();
            // var distance = 0;
            // if(that.camera.inPerspectiveMode === true) {
            //     distance = distanceToFetch("x", "z");
            // } else {
            //     that.camera.zoom = distanceToFetch("x", "z");
            // }
            // lookAtPoint(center, { x : 0, y : -distance, z : 0 },
            //         { x : 0, y : Math.PI, z : 0 });

            // lookAtPoint(that.scene.position, { x : 0, y : -5, z : 0 },
            //         { x : 0, y : Math.PI, z : 0 });
        };

        that.showZ = function() {
            showPlane("x", "y", "z");
            // var center = centerPath();
            // var distance = 0;
            // if(that.camera.inPerspectiveMode === true) {
            //     distance = distanceToFetch("x", "y");
            // } else {
            //     that.camera.zoom = distanceToFetch("x", "y");
            // }
            // lookAtPoint(center, { x : 0, y : 0, z : distance },
            //         { x : 0, y : 0, z : 0 });

            // lookAtPoint(that.scene.position, { x : 0, y : 0, z : 5 },
            //         { x : 0, y : 0, z : 0 });
        };

        //Helpers management:
        that.showAxisHelper = function() {
            that.helpers.addAxisHelper();
            that.refreshDisplay();
        };

        that.hideAxisHelper = function() {
            that.helpers.removeAxisHelper();
            that.refreshDisplay();
        };

        that.showArrows = function() {
            that.helper.addArrows();
            that.refreshDisplay();
        };

        that.hideArrows = function() {
            that.helper.removeArrows();
            that.refreshDisplay();
        };

        that.showHelpers = function() {
            that.helper.addHelpers();
            that.refreshDisplay();
        };

        that.hideHelpers = function() {
            that.helper.removeHelpers();
            that.refreshDisplay();
        };

        that.showBoard = function() {
            if(that.cncConfiguration.board === undefined) {
                return;
            }
            var geometry = new THREE.BoxGeometry(
                that.cncConfiguration.board.width,
                that.cncConfiguration.board.length,
                that.cncConfiguration.board.height
            );

            var material = new THREE.MeshBasicMaterial(0xff0000);
            material.transparent = true;
            material.opacity = 0;
            var object = new THREE.Mesh(geometry, material);
            object.position.x = that.cncConfiguration.board.width / 2;
            object.position.y = that.cncConfiguration.board.length / 2;
            object.position.z = that.cncConfiguration.board.height / 2;
            var box = new THREE.BoxHelper(object);
            that.scene.add(object);
            that.scene.add(box);
            that.boardObject = object;
            that.boardHelper = box;
        };

        that.hideBoard = function() {
            that.scene.remove(that.boardObject);
            that.scene.remove(that.boardBox);
        };

        //Returns a string if no command
        function removeCommentsAndSpaces(command) {
            var s = command.split('(')[0].split(';')[0]; //No need to use regex
            return s.split(' ').join('').split('\t').join('');
        }

        //Parsing the result of GParser.parse
        function parseParsedGCode(parsed) {
            var obj = {};
            var i = 0;
            var w1 = "", w2 = "";
            var tab = [];
            var emptyObj = true;

            for(i=0; i < parsed.words.length; i++) {
                w1 = parsed.words[i][0];
                w2 = parsed.words[i][1];
                if(w1 === "G" || w1 === "M") {
                    if(emptyObj === false) {
                        tab.push(obj);
                        obj = {};
                    }
                    obj.type = w1 + w2;
                    emptyObj = false;
                } else  {
                    obj[w1.toLowerCase()] = parseFloat(w2, 10);
                }
            }
            tab.push(obj);
            return tab;
        }

        function setLines() {
            var i = 0, j = 0, commandNumber = 0;
            var line = {}, res = {};  //RESult
            var start = { x: 0, y : 0, z : 0 };
            var tabRes = [];
            var crossAxe = "z";
            var relative = false, inMm = false;

            that.lines= [];

            if(that.cncConfiguration.initialPosition !== undefined) {
                start = {
                    x : that.cncConfiguration.initialPosition.x,
                    y : that.cncConfiguration.initialPosition.y,
                    z : that.cncConfiguration.initialPosition.z
                };
            }

            for(i=0; i < that.gcode.length; i++) {
                //Sorry for not being really readable :'(
                tabRes = parseParsedGCode(
                    GParser.parse(
                        removeCommentsAndSpaces(that.gcode[i]).toUpperCase()
                    )
                );

                for(j = 0; j < tabRes.length; j++) {
                    res = tabRes[j];
                    if(res.type === "G0" || res.type === "G1") {
                        line = new GCodeViewer.StraightLine(commandNumber,
                                start, res, relative, inMm);
                        that.lines.push(line);
                        start = GCodeViewer.copyObject(line.end);
                    } else if(res.type === "G2" || res.type === "G3") {
                        line = new GCodeViewer.CurvedLine(commandNumber, start,
                                res, relative, inMm, crossAxe);
                        if(line.center === false) {
                            displayError("Radius too short "+
                                    "for command " + that.gcode[i] + " (line " +
                                    i +")"
                                    );
                            break;
                        }
                        that.lines.push(line);
                        start = GCodeViewer.copyObject(line.end);
                    } else if(res.type === "G4") {
                        console.log("Set pause so continue");
                        // continue;  //Add the pause time somewhere?
                    } else if(res.type === "G17") {
                        crossAxe = "z";
                    } else if(res.type === "G18") {
                        crossAxe = "y";
                    } else if(res.type === "G19") {
                        crossAxe = "z";
                    } else if(res.type === "G20") {
                        //No need to convert start: always in inches
                        inMm = false;
                        console.log("set inches");
                    } else if(res.type === "G21") {
                        //No need to convert start: always in inches
                        inMm = true;
                        console.log("set mm");
                    } else if(res.type === "G90") {
                        relative = false;
                        console.log("set absolute");
                    } else if(res.type === "G91") {
                        relative = true;
                        console.log("set relative");
                    } else if(res.type === "M4") {
                        console.log("set spin on");
                    } else if(res.type === "M8") {
                        console.log("set spin off");
                    } else if(res.type === "M30") {
                        break;
                    }

                    commandNumber++;
                }
            }
        }

        that.setGCode = function(string) {
            if(string === "") {
                displayError("There is no GCode");
                return;
            }
            that.gcode = string.split('\n');
            setLines();
            that.path.remove();  //Removing old stuff
            that.path.setMeshes(that.lines);
            that.refreshDisplay();  //To avoid confusion, we remove everything
        };

        that.hidePaths = function() {
            that.path.remove();
            that.refreshDisplay();
        };

        //Have to set the gcode before
        that.viewPaths = function() {
            that.path.remove();  //Don't know how to check if already in scene
            that.path.add(true);
            that.refreshDisplay();
        };

        function changeDisplay(inMm) {
            if(that.path.totalSizeIsDisplayed()) {
                that.path.setTotalSize(inMm);
                that.path.addTotalSize();
            }
            that.refreshDisplay();
        }

        that.displayInMm = function() {
            changeDisplay(true);
        };

        that.displayInInch = function() {
            changeDisplay(false);
        };

        //TODO: delete that
        that.printLines = function() {
            var i = 0;
            var l = {};
            for(i = 0; i < that.lines.length; i++) {
                l = that.lines[i];
                console.log("("+l.start.x+"; "+l.start.y+"; "+l.start.z+") => ("+l.end.x+"; "+l.end.y+"; "+l.end.z+")");

            }
        };
        that.createCircle = function(radius, segments) {
            var material = new THREE.LineBasicMaterial({ color: 0xffffff });
            var circleGeometry = new THREE.CircleGeometry(radius, segments);
            that.circleGeometry = circleGeometry;
            return new THREE.Line(circleGeometry , material);
        };

        that.testBezier = function() {
            var start = {x : 0, y : 0, z : 0};
            var end = {x : 10, y : 15, z : 5};
            var crossAxe = "z";
            var radius = -20;
            var result = { r : radius, x : end.x, y : end.y, z : end.z,
                type : "G2"};
            that.lines.push(new GCodeViewer.CurvedLine(0, start, result, false,
                        crossAxe));

            that.path.setMeshes(that.lines);

            var circle = that.createCircle(20, 32);
            circle.position.z = 10;
            that.scene.add(circle);

            var circle2 = that.createCircle(20, 32);
            circle2.position.z = 0;
            that.scene.add(circle2);
        };

        that.test = function() {
            that.testBezier();

            that.refreshDisplay();
        };

        function initialize() {
            //Members declaration
            that.renderer = {};
            that.camera = {};
            that.scene = {};
            that.controls = {};
            that.lines = [];  //Represents the paths of the bit (lines are straight or curve).
            that.cncConfiguration= {};
            that.gcode = [];

            that.cameraSet = false;

            var width = window.innerWidth, height = window.innerHeight;

            that.cncConfiguration = configuration;

            if(domElement === undefined || domElement === null) {
                that.renderer = new THREE.WebGLRenderer({antialias: true});
                that.renderer.setSize(width, height);
                document.body.appendChild(that.renderer.domElement);
            } else {
                that.renderer = new THREE.WebGLRenderer({
                    canvas: domElement,
                    antialias: true
                });
                width = parseInt(domElement.width, 10);
                height = parseInt(domElement.height, 10);
            }
            // that.renderer.setClearColor( 0xf0f0f0 );
            that.renderer.setPixelRatio( window.devicePixelRatio );

            that.scene = new THREE.Scene();
            // that.setPerspectiveCamera();
            // that.setOrthographicCamera();
            setCombinedCamera();
            that.showZ();

            var light = new THREE.PointLight( 0xffffff, 0.8 );
            light.position.set(0, 1, 1);
            that.scene.add( light );

            that.helpers = new GCodeViewer.Helpers(that.scene);
            that.showBoard();
            that.refreshDisplay();

            that.path = new GCodeViewer.Path(that.scene);

            that.callbackError = callbackError;
            // that.setCameraControl();

            //Add the UI
            that.inMm = false;
            that.gui = new dat.GUI({ autoPlace : false });
            that.gui.add(that, "inMm").onFinishChange(function() {
                changeDisplay(that.inMm);
            });
            var folderPlanes = that.gui.addFolder("Planes");
            folderPlanes.add(that, "showX");
            folderPlanes.add(that, "showY");
            folderPlanes.add(that, "showZ");
            var folderCamera = that.gui.addFolder("Camera");
            folderCamera.add(that, "setPerspectiveCamera");
            folderCamera.add(that, "setOrthographicCamera");

            //Set the display of the UI in the HTML page
            that.renderer.domElement.parentNode.style.position = "relative";
            that.renderer.domElement.parentNode.appendChild(that.gui.domElement);
            that.renderer.domElement.style.position = "absolute";
            that.renderer.domElement.style.zIndex = 1;
            that.gui.domElement.style.position = "absolute";
            that.gui.domElement.style.zIndex = 2;
            that.gui.domElement.style.top = 0;
            that.gui.domElement.style.left = 0;
        }

        initialize();
    }  //    function Viewer(configuration, domElement)

    return Viewer;
}());
