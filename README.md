
# 3D DFG Viewer


The module was primarily created for viewing 3D data as a Drupal extension for a WissKI based repository. During development it became also possible to use as a standalone version to be integrated with more environments.
The Viewer is written in JavScript, based on the three.js library for viewing 3D models and can handle PHP/bash scripts for server-side operations.
Supported 3D file formats: OBJ, DAE, FBX, PLY, IFC, STL, XYZ, JSON, 3DS, glTF. There is also prepared complete workflow to handle more file formats and allow to render thumbnails for entries. If uploaded file is saved in one of the compression-supported format (obj, fbx, ply, dae, abc, blend, stl, wrl, x3d, glb, gltf), it is compressed on-the-fly and converted into GLB format and triggers automatic rendering (based on Blender utility).



## Minimal Requirements

- uploaded files (3D models, textures, other sources) should be named like:
    - hyphens or underscores instead of spaces
    - no national characters such as symbols or spaces
    - uploaded archive should be named the same as input file and content should be placed directly in the archive (without subdirectories)
- upload all the sources needed for rendering. For example OBJ needs MTL files (if any) and textures uploaded too. If you want to do this, please place them inside single archive.

## Screenshots

![Functions and other features](https://i.postimg.cc/zHSkMWdh/image2.png)

![Main view](https://i.postimg.cc/qthxrWb4/image4.png)

![Gallery Set](https://i.postimg.cc/R3yGnv6W/image7.png)

![Gallery Preview Element](https://i.postimg.cc/xXF3W9P6/image1.png) 

![Gallery Preview Element 2](https://i.postimg.cc/TKPc7Kny/image6.png)



## Tech Stack

**Client:** JavaScript, three.js, CSS, HTML, PHP, Drupal

**Server:** PHP, Drupal, bash, blender

The main part is located in the ```viewer``` directory and the ```main.js``` is responsible for delivering 3D content.
The viewer at first imports all necessary three.js components:
```bash
import * as THREE from './build/three.module.js';
import { TWEEN } from './js/jsm/libs/tween.module.min.js';

import Stats from './js/jsm/libs/stats.module.js';

import { OrbitControls } from './js/jsm/controls/OrbitControls.js';
import { TransformControls } from './js/jsm/controls/TransformControls.js';
import { GUI } from './js/jsm/libs/lil-gui.module.min.js';
import { FBXLoader } from './js/jsm/loaders/FBXLoader.js';
import { DDSLoader } from './js/jsm/loaders/DDSLoader.js';
import { MTLLoader } from './js/jsm/loaders/MTLLoader.js';
import { OBJLoader } from './js/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from './js/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from './js/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from './js/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from './js/jsm/libs/meshopt_decoder.module.js';
import { IFCLoader } from './js/jsm/loaders/IFCLoader.js';
import { PLYLoader } from './js/jsm/loaders/PLYLoader.js';
import { ColladaLoader } from './js/jsm/loaders/ColladaLoader.js';
import { STLLoader } from './js/jsm/loaders/STLLoader.js';
import { XYZLoader } from './js/jsm/loaders/XYZLoader.js'; 
import { TDSLoader } from './js/jsm/loaders/TDSLoader.js';
import { PCDLoader } from './js/jsm/loaders/PCDLoader.js';
import { FontLoader } from './js/jsm/loaders/FontLoader.js';
import { TextGeometry } from './js/jsm/geometries/TextGeometry.js';
```

**Basic Viewer configuration**

Then, basic configuration should be changed:

```bash
const CONFIG = {
	"domain": "https://3d-repository.hs-mainz.de",
	"metadataDomain": "https://3d-repository.hs-mainz.de",
	"container": "DFG_3DViewer",
	"galleryContainer": "block-bootstrap5-content",
	"galleryImageClass": "field--type-image",
	"basePath": "/modules/dfg_3dviewer/viewer",
	"entityIdUri": "/wisski/navigate/(.*)/view",
	"viewEntityPath": "/wisski/navigate/",
	"attributeId": "wisski_id",
	"lightweight": false
};

domain, metadaDomain - domains that deliver 3D content and metadata content respectively
container - container to attach to and will contain 3D content
galleryContainer - container with generated thumbnails
galleryImageClass - class for gallery 
basePath - relative path where this script is placed
entityIdUri - WissKI side uri that can deliver ID of the entity
attributeId - the ID name that container will be given
lightweight - use Viewer as simple version - mostly for viewing 3D content
```

**3D DFG Viewer functions overview**

```bash
createClippingPlaneGroup(geometry, plane, renderOrder) - creates group of planes for clipping 3D (available via GUI controller)
showToast (_str) - shows information about current operations
addTextWatermark (_text, _scale) - adds watermark
addTextPoint (_text, _scale, _point) - adds text at given point
selectObjectHierarchy (_id) - selects object from hierarchy
fetchMetadata (_object, _type) - fetches metadata about object
recreateBoundingBox (object) - creates new bounding box
setupObject (_object, _light, _data, _controls) - setups basic properties for object, lights, camera and controls
invertHexColor(hexTripletColor) - inverts color in hex
setupClippingPlanes (_geometry, _size, _distance) - setups clipping planes for given geometry
fitCameraToCenteredObject (camera, object, offset, orbitControls, _fit)- setups camera view centered to given object
buildGallery() - builds gallery of thumbnails
render() - main function for rendering
setupCamera (_object, _camera, _light, _data, _controls) - setups camera according to object properties
distanceBetweenPoints(pointA, pointB) - calculates distance between two given points
distanceBetweenPointsVector(vector) - calculates distance of given vector
vectorBetweenPoints (pointA, pointB) - creates vector between two given points
halfwayBetweenPoints(pointA, pointB) - calculates halfway between two given points
interpolateDistanceBetweenPoints(pointA, vector, length, scalar) - calculates distance from given point, with vector and it’s length
pickFaces(_id) - picks face with given id

buildRuler(_id) - creates ruler for measurement geometry
onWindowResize() - handler for window resize
addWissKIMetadata(label, value) - adds metadata fetched from WissKI repository
truncateString(str, n) - truncates given string with n length
getProxyPath(url) - gets proxy path from given url
expandMetadata () - expands metadata
fullscreen() - handler for fullscreen mode
exitFullscreenHandler() - handler for fullscreen exit
appendMetadata (metadataContent, canvasText, metadataContainer, container) - appends metadata to given container
fetchSettings (path, basename, filename, object, camera, light, controls, orgExtension, extension) - fetches settings for object
onError = function (_event) - error loading handler
onErrorMTL = function (_event) - MTL error loading handler
onProgress = function (xhr) - loading progress handler
setupMaterials (_object) - setups materials of an object
getMaterialByID (_object, _uuid) - gets material with given ID
traverseMesh (object) - traverses mesh to get more datiled info
loadModel (path, basename, filename, extension, orgExtension) - main function for loading object
animate() - main animation funcion
onPointerDown(e) - mouse down click handler
onPointerUp(e)- mouse up click handler
onPointerMove(e)- mouse move handler
changeScale()- changes scale of an object (available via GUI controller)
calculateObjectScale() - calculates object scale
changeLightRotation() - changes light rotation (available via GUI controller)
takeScreenshot()- takes screenshot for thumbnail rendering\
mainLoadModel (_ext)- main function for loading objects
init() - main function that inits workflow
```

![Viewer overview](https://i.postimg.cc/VdgRWq0Q/image5.png)

## Server side scripts

![Backend overview|500](https://i.postimg.cc/7fw9zs6n/image3.png)

Main workflow is divided into two automatic parts:
- pre-processing - uploaded model is uncompressed (if so) and converted into glTF (glb) format
- automatic rendering - Blender side rendering of 3D model’s thumbnails

Scripts needed there are placed under ```scripts``` and ```php``` directory.

After uploading 3D model into repository there are triggered following steps:
- uncompressing 3D models - it is done on Drupal side module script inside ```dfg_3dviewer_entity_presave``` and supports following archive formats: zip, rar, tar, xz, gz. According to the format, the bash script is triggered with following arguments: 
```/scripts/uncompress.sh archiveType -i inputPath -o extractPath -n fileName```
- automatic conversion into glTF (glb) format for the following supported formats:
    - abc, dae, fbx, obj, ply, stl, wrl, x3d - function ```handle_file```
    - ifc - function ```handle_ifc_file```
    - blend (in progress) - function ```handle_blend_file```
    - glb - triggers next step - function ```render_preview```


This step is performed inside ```scripts/convert.sh``` bash script.
Script defaults (need to be changed if used in different environment):
```bash
BLENDER_PATH=''

#Defaults:
COMPRESSION=false
COMPRESSION_LEVEL=3
GLTF="gltf"
FORCE="false"
isOutput=false
IS_ARCHIVE=false
SPATH="/var/www/html/3drepository/modules/dfg_3dviewer"
```

Functions used during this step:
- ```handle_file``` - uses python script (downloaded and modified version of https://github.com/ux3d/2gltf2/tree/master) triggered by blender 
```${BLENDER_PATH}blender -b -P ${SPATH}/scripts/2gltf2/2gltf2.py -- "$INPATH/$FILENAME" "$GLTF" "$COMPRESSION" "$COMPRESSION_LEVEL" "$OUTPUT$OUTPUTPATH"```
- ```handle_ifc_file``` - uses IfcConvert script (available at https://ifcopenshell.sourceforge.net/ifcconvert.html)
```${SPATH}/scripts/IfcConvert "$INPATH/$FILENAME" "$INPATH/gltf/$NAME.glb"```
- ```handle_blend_file``` - (not fully tested yet) uses python script triggered by blender
```${BLENDER_PATH}blender -b -P ${SPATH}/scripts/convert-blender-to-gltf.py "$INPATH/$FILENAME" "$INPATH/gltf/$NAME.glb"```

- automatic rendering of 3D model for thumbnails - function ```render_preview```, which uses wrapper for triggering virtual environment (xvfb-run) for blender and it’s python script
```xvfb-run --auto-servernum --server-args="-screen 0 512x512x16" sudo ${BLENDER_PATH}blender -b -P ${SPATH}/scripts/render.py -- "$INPATH/$NAME.glb" "glb" $1 "$INPATH/views/" $IS_ARCHIVE -E BLENDER_EEVEE -f 1```
This step needs some steps to be performed before rendering:
- create scene containing loaded 3D model
- calculate bounding box (for camera and lights settlement)
- scale scene according to bounding box
- setup basic properties for rendering engine, output quality, lights, camera
- prepare rendering from camera placed in 9 different positions (left, left top, front, front top, right, right top, back, back top, top)
- write rendering outputs into png files with consecutive naming

## Minimal effort setup for 3D DFG Viewer


```html
<!doctype html>
<html>
    <head>
    	<title>Three.js 3D-DFG-Viewer</title>
    	<link rel="stylesheet" href="./3D-DFG-Viewer/css/spinner.css">
    	<link rel="stylesheet" href="./3D-DFG-Viewer/css/main.css">
    </head>
    <body>
    	<script type="module" src="./3D-DFG-Viewer/main/jquery-3.6.0.min.js"></script>
    	<script src="./3D-DFG-Viewer/main/toastify.js"></script>
    	<script src="./3D-DFG-Viewer/main/spinner/main.js"></script>
    	<script type="module" src="./3D-DFG-Viewer/main/main.js"></script>
    	<div id="DFG_3DViewer" 3d="your_model_name"></div>
    </body>
</html>

```
    
## Documentation



[Documentation](https://docs.google.com/document/d/10Qw37DwgMXHsuZqCol3xEf68S29eaj0Q-rOOAe3XhXE)


## Features

- 3D file formats: OBJ, DAE, FBX, PLY, IFC, STL, XYZ, JSON, 3DS, glTF
- compression and rendering on-the-fly: obj, fbx, ply, dae, abc, blend, stl, wrl, x3d, glb, gltf
- basic interaction (rotate, scale, translate, zoom)
- metadata displaying
- saving/loading custom object's position, scale, rotation, lights, camera
- view object's hierarchy and select groups by name
- distance measurement
- face picking
- clipping planes
- manage materials
- fullscreen mode
- cross platform
- add watermark

