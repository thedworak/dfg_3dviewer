//Supported file formats: OBJ, DAE, FBX, PLY, IFC, STL, XYZ, JSON, 3DS, glTF

const container = document.getElementById("DFG_3DViewer");

import * as THREE from '/modules/dfg_3dviewer/build/three.module.js';
import { TWEEN } from '/modules/dfg_3dviewer/js/jsm/libs/tween.module.min.js';

import Stats from '/modules/dfg_3dviewer/js/jsm/libs/stats.module.js';

import { OrbitControls } from '/modules/dfg_3dviewer/js/jsm/controls/OrbitControls.js';
import { TransformControls } from '/modules/dfg_3dviewer/js/jsm/controls/TransformControls.js';
import { GUI } from '/modules/dfg_3dviewer/js/jsm/libs/dat.gui.module.js'
import { FBXLoader } from '/modules/dfg_3dviewer/js/jsm/loaders/FBXLoader.js';
import { DDSLoader } from '/modules/dfg_3dviewer/js/jsm/loaders/DDSLoader.js';
import { MTLLoader } from '/modules/dfg_3dviewer/js/jsm/loaders/MTLLoader.js';
import { OBJLoader } from '/modules/dfg_3dviewer/js/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from '/modules/dfg_3dviewer/js/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from '/modules/dfg_3dviewer/js/jsm/loaders/DRACOLoader.js'
import { KTX2Loader } from '/modules/dfg_3dviewer/js/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from '/modules/dfg_3dviewer/js/jsm/libs/meshopt_decoder.module.js';
import { IFCLoader } from '/modules/dfg_3dviewer/js/jsm/loaders/IFCLoader.js';
import { PLYLoader } from '/modules/dfg_3dviewer/js/jsm/loaders/PLYLoader.js';
import { ColladaLoader } from '/modules/dfg_3dviewer/js/jsm/loaders/ColladaLoader.js';
import { STLLoader } from '/modules/dfg_3dviewer/js/jsm/loaders/STLLoader.js';
import { XYZLoader } from '/modules/dfg_3dviewer/js/jsm/loaders/XYZLoader.js';
import { TDSLoader } from '/modules/dfg_3dviewer/js/jsm/loaders/TDSLoader.js';

let camera, scene, renderer, stats, controls, loader;
let imported;

const clock = new THREE.Clock();

let mixer;

const supportedFormats = [ 'OBJ', 'DAE', 'FBX', 'PLY', 'IFC', 'STL', 'XYZ', 'JSON' ];

var spinnerContainer = document.createElement("div");
spinnerContainer.id = 'spinnerContainer';
spinnerContainer.className = 'spinnerContainer';
spinnerContainer.style.position = 'absolute';
spinnerContainer.style.left = '35%';
spinnerContainer.style.marginTop = '10px';
var spinnerElement = document.createElement("div");
spinnerElement.id = 'spinner';
spinnerElement.className = 'lv-determinate_circle lv-mid md';
spinnerElement.setAttribute("data-label", "Loading...");
spinnerElement.setAttribute("data-percentage", "true");
spinnerContainer.appendChild(spinnerElement);
container.appendChild(spinnerContainer);

var guiContainer = document.createElement("div");
guiContainer.id = 'guiContainer';
guiContainer.className = 'guiContainer';
guiContainer.style.position = 'absolute';
guiContainer.style.left = '80%';
guiContainer.style.marginTop = '0px';
var guiElement = document.createElement("div");
guiElement.id = 'guiContainer';
guiElement.className = 'guiContainer';
guiElement.appendChild(guiContainer);
container.appendChild(guiContainer);

let spinner = new lv();
spinner.initLoaderAll();
spinner.startObserving();
let circle = lv.create(spinnerElement);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const onUpPosition = new THREE.Vector2();
const onDownPosition = new THREE.Vector2();

const geometry = new THREE.BoxGeometry( 20, 20, 20 );
let transformControl;

const helperObjects = [];

var windowHalfX;
var windowHalfY;

var transformType = "";

var transformText =
{
    Transform: 'Transform'
}

const gui = new GUI()
const metadataFolder = gui.addFolder('Metadata')
const chierarchyFolder = gui.addFolder('Chierarchy')
const editorFolder = gui.addFolder('Editor')
editorFolder.add(transformText, 'Transform', { None: '', Move: 'translate', Rotate: 'rotate', Scale: 'scale' } ).onChange(function (value) { if (value == '') transformControl.detach(); transformType = value; } );
guiContainer.appendChild(gui.domElement);

init();
animate();

function init() {

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 200000 );
	camera.position.set( 0, 0, 0 );

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0xa0a0a0 );
	scene.fog = new THREE.Fog( 0xa0a0a0, 90000, 1000000 );

	const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
	hemiLight.position.set( 0, 200, 0 );
	scene.add( hemiLight );

	const dirLight = new THREE.DirectionalLight( 0xffffff );
	dirLight.position.set( 0, 100, 50 );
	dirLight.castShadow = true;
	dirLight.shadow.camera.top = 180;
	dirLight.shadow.camera.bottom = - 100;
	dirLight.shadow.camera.left = - 120;
	dirLight.shadow.camera.right = 120;
	dirLight.shadow.bias = -0.0001;
	dirLight.shadow.mapSize.width = 1024*4;
	dirLight.shadow.mapSize.height = 1024*4;
	scene.add( dirLight );

	// scene.add( new THREE.CameraHelper( dirLight.shadow.camera ) );

	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.shadowMap.enabled = true;
	container.appendChild( renderer.domElement );

	controls = new OrbitControls( camera, renderer.domElement );
	controls.target.set( 0, 100, 0 );
	controls.update();
	
	transformControl = new TransformControls( camera, renderer.domElement );
	transformControl.addEventListener( 'change', render );
	transformControl.addEventListener( 'dragging-changed', function ( event ) {
		controls.enabled = ! event.value;
	} );
	scene.add( transformControl );

	transformControl.addEventListener( 'objectChange', function () {
		updateObject();
	} );

	// model
	const filename = container.getAttribute("3d").split("/").pop();
	const basename = filename.substring(0, filename.lastIndexOf('.'));
	const extension = filename.substring(filename.lastIndexOf('.') + 1);	
	const path = container.getAttribute("3d").substring(0, container.getAttribute("3d").lastIndexOf(filename));

	/*try {

	} catch (e) {
		// statements to handle any exceptions
		console.log("No glTF file, loading original file.");
		loadModel(path, basename, filename, extension);
	}*/
	if (extension == "glb" || extension == "GLB" || extension == "gltf" || extension == "GLTF")
		loadModel (path, basename, filename, extension, extension);
	else if  (extension == "zip" || extension == "ZIP" ) {
		loadModel (path+basename+"_ZIP/"+"gltf/", basename, filename, "glb", extension);
	}
	else {
		loadModel (path+"gltf/", basename, filename, "glb", extension);
	}

	document.addEventListener( 'pointerdown', onPointerDown );
	document.addEventListener( 'pointerup', onPointerUp );
	document.addEventListener( 'pointermove', onPointerMove );
	window.addEventListener( 'resize', onWindowResize );

	// stats
	stats = new Stats();
	container.appendChild( stats.dom );
	
	windowHalfX = window.innerWidth / 2;
	windowHalfY = window.innerHeight / 2;

}

function loadModel ( path, basename, filename, extension, org_extension ) {
	if (!imported) {
		circle.show();
		circle.set(0, 100);
		switch(extension) {
			case 'obj':
			case 'OBJ':
				const manager = new THREE.LoadingManager();
				manager.onLoad = function ( ) { console.log("Model has been loaded."); }
				manager.addHandler( /\.dds$/i, new DDSLoader() );
				// manager.addHandler( /\.tga$/i, new TGALoader() );
				new MTLLoader( manager )
					.setPath( path )
					.load( basename + '.mtl', function ( materials ) {
						materials.preload();
						new OBJLoader( manager )
							.setMaterials( materials )
							.setPath( path )
							.load( filename, function ( object ) {
								object.position.set (0, 0, 0);
								scene.add( object );
								fetchSettings (path.replace("gltf/", ""), basename, filename, object, camera, controls, org_extension, extension );
								fitCameraToCenteredObject ( camera, object, 1.7, controls );
							}, onProgress, onError );
					} );
			break;
			
			case 'fbx':
			case 'FBX':
				var FBXloader = new FBXLoader();
				FBXloader.load( path + filename, function ( object ) {
					object.traverse( function ( child ) {
						if ( child.isMesh ) {
							child.castShadow = true;
							child.receiveShadow = true;
						}
					} );
					object.position.set (0, 0, 0);
					scene.add( object );
					console.log(object);
					fetchSettings (path.replace("gltf/", ""), basename, filename, object.children, camera, controls, org_extension, extension );
					fitCameraToCenteredObject ( camera, object.children, 1.7, controls );
				}, onProgress, onError );
			break;
			
			case 'ply':
			case 'PLY':
				loader = new PLYLoader();
				loader.load( path + filename, function ( geometry ) {
					geometry.computeVertexNormals();
					const material = new THREE.MeshStandardMaterial( { color: 0x0055ff, flatShading: true } );
					const object = new THREE.Mesh( geometry, material );
					object.position.set (0, 0, 0);
					object.castShadow = true;
					object.receiveShadow = true;
					scene.add( object );
					fetchSettings (path.replace("gltf/", ""), basename, filename, object, camera, controls, org_extension, extension );
					fitCameraToCenteredObject ( camera, object, 1.7, controls );
				}, onProgress, onError );
			break;
			
			case 'dae':
			case 'DAE':
				const loadingManager = new THREE.LoadingManager( function () {
					scene.add( object );
				} );
				loader = new ColladaLoader( loadingManager );
				loader.load( path + filename, function ( object ) {
					object = object.scene;
					object.position.set (0, 0, 0);
					scene.add( object );
					fetchSettings (path.replace("gltf/", ""), basename, filename, object, camera, controls, org_extension, extension );
					fitCameraToCenteredObject ( camera, object, 1.7, controls );
				}, onProgress, onError );
			break;
			
			case 'ifc':
			case 'IFC':
				const ifcLoader = new IFCLoader();
				ifcLoader.setWasmPath( '/modules/dfg_3dviewer/js/jsm/loaders/ifc/' );
				ifcLoader.load( path + filename, function ( object ) {
					//object.position.set (0, 300, 0);
					scene.add( object );
					fetchSettings (path.replace("gltf/", ""), basename, filename, object, camera, controls, org_extension, extension );
					fitCameraToCenteredObject ( camera, object, 1.7, controls );
				}, onProgress, onError );
			break;
			
			case 'stl':
			case 'STL':
				loader = new STLLoader();
				loader.load( path + filename, function ( geometry ) {
					let meshMaterial = new THREE.MeshPhongMaterial( { color: 0xff5533, specular: 0x111111, shininess: 200 } );
					if ( geometry.hasColors ) {
						meshMaterial = new THREE.MeshPhongMaterial( { opacity: geometry.alpha, vertexColors: true } );
					}
					const object = new THREE.Mesh( geometry, meshMaterial );
					object.position.set (0, 0, 0);
					object.castShadow = true;
					object.receiveShadow = true;
					scene.add( object );
					fetchSettings (path.replace("gltf/", ""), basename, filename, object, camera, controls, org_extension, extension );
					fitCameraToCenteredObject ( camera, object, 1.7, controls );
				}, onProgress, onError );
			break;

			case 'xyz':
			case 'XYZ':
				loader = new XYZLoader();
				loader.load( path + filename, function ( geometry ) {
					geometry.center();
					const vertexColors = ( geometry.hasAttribute( 'color' ) === true );
					const material = new THREE.PointsMaterial( { size: 0.1, vertexColors: vertexColors } );
					object = new THREE.Points( geometry, material );
					object.position.set (0, 0, 0);
					scene.add( object );
					fetchSettings (path.replace("gltf/", ""), basename, filename, object, camera, controls, org_extension, extension );
					fitCameraToCenteredObject ( camera, object, 1.7, controls );
				}, onProgress, onError );
			break;

			case 'json':
			case 'JSON':
				loader = new THREE.ObjectLoader();
				loader.load(
					path + filename, function ( object ) {
						object.position.set (0, 0, 0);
						scene.add( object );
						fetchSettings (path.replace("gltf/", ""), basename, filename, object, camera, controls, org_extension, extension );
					}, onProgress, onError );
			break;

			case '3ds':
			case '3DS':
				loader = new TDSLoader( );
				loader.setResourcePath( path );
				loader.load( path + filename, function ( object ) {
					object.traverse( function ( child ) {
						if ( child.isMesh ) {
							//child.material.specular.setScalar( 0.1 );
							//child.material.normalMap = normal;
						}
					} );
					scene.add( object );
				} );
			break;

			case 'zip':
			case 'ZIP':
				console.log("TEST");
			break;
			
			case 'glb':
			case 'GLB':
			case 'gltf':
			case 'GLTF':
				const dracoLoader = new DRACOLoader();
				dracoLoader.setDecoderPath( '/modules/dfg_3dviewer/js/libs/draco/' );
				dracoLoader.preload();
				const gltf = new GLTFLoader();
				gltf.setDRACOLoader(dracoLoader);
				console.log("[i] Loading model from " + extension + " representation.");

				const glbPath = path + basename + "." + extension;
				gltf.load(glbPath, function(gltf) {
					gltf.scene.traverse( function ( child ) {
						if ( child.isMesh ) {
							child.castShadow = true;
							child.receiveShadow = true;
							child.geometry.computeVertexNormals();
							if(child.material.map) child.material.map.anisotropy = 16;
						}
					});
					fetchSettings (path.replace("gltf/", ""), basename, filename, gltf.scene, camera, controls, org_extension, extension );					
					scene.add( gltf.scene );
					
				},
					function ( xhr ) {
						var percentComplete = xhr.loaded / xhr.total * 100;
						if (percentComplete != Infinity) {
							//console.log( ( percentComplete ) + '% loaded' );
							circle.set(percentComplete, 100);
							if (percentComplete >= 100) {
								circle.hide();
								console.log("[i] Model " + filename + " has been loaded.");
							}
						}
					},
					function ( ) {						
							console.log("[i] GLTF representation not found, trying original file " + path.replace("gltf/", "") + filename + " [" + org_extension + "]");
							loadModel(path.replace("gltf/", ""), basename, filename, org_extension, org_extension);
							imported = true;
					}
				);
			break;
			default:
				console.log("[i] Extension not supported yet");
		}
	}
	else {
		console.log("File " + path + basename + " not found.");
		//circle.set(100, 100);
		circle.hide();
	}
}

function fetchSettings ( path, basename, filename, object, camera, controls, org_extension, extension ) {
	var metadata = {'vertices': 0, 'faces': 0};
	var chierarchy = [];
	fetch(path + "metadata/" + filename + "_viewer")
	.then(response => {
		if (response['status'] != "404") {
			console.log("Metadata " + path + "metadata/" + filename + "_viewer found");
			return response.json();
		}
		else if (response['status'] == "404") {
			console.log("No metadata " + path + "metadata/" + filename + "_viewer found");
		}
	})
	.then(data => {
		var tempArray = [];
		if (object.name == "Scene") {
			object.traverse( function ( child ) {
				if ( child.isMesh ) {
					setupObject(child, camera, data, controls);
					metadata['vertices'] += fetchMetadata (child, 'vertices');
					metadata['faces'] += fetchMetadata (child, 'faces');
					if (child.name == '')
						tempArray = {'name': "Mesh", 'id': child.uuid};
					else
						tempArray = { [child.name]: function(){}, 'id': child.uuid};
					if (child.children.isMesh) console.log(child.children);
					chierarchyFolder.add(tempArray, child.name);
				}
			});			
			setupCamera (object, camera, data, controls);				
		}
		else {
			setupObject(object, camera, data, controls);
			setupCamera (object, camera, data, controls);
			metadata['vertices'] += fetchMetadata (object, 'vertices');
			metadata['faces'] += fetchMetadata (object, 'faces');
			if (object.name == '')
				tempArray = {'name': "Mesh", 'id': object.uuid};
			else
				tempArray = {'name': object.name, 'id': object.uuid};
			if (object.children.isMesh) console.log(object.children);
			//chierarchy.push(tempArray);
			chierarchyFolder.add(tempArray, 'name' ).name(object.name);
			metadata['vertices'] += fetchMetadata (object, 'vertices');
			metadata['faces'] += fetchMetadata (object, 'faces');
		}
		var loadedFile = basename + "." + extension;
		var metadataText =
		{
			'Original extension': org_extension.toUpperCase(),
			'Loaded file': loadedFile,
			Vertices: metadata['vertices'],
			Faces: metadata['faces']
		}
		metadataFolder.add(metadataText, 'Original extension' );
		metadataFolder.add(metadataText, 'Loaded file' );
		metadataFolder.add(metadataText, 'Vertices' );
		metadataFolder.add(metadataText, 'Faces' );
		//chierarchyFolder.add(chierarchyText, 'Faces' );
	});
	helperObjects.push (object);
}

function fetchMetadata (_object, _type) {
	switch (_type) {
		case 'vertices':
			if (typeof (_object.geometry.index) != "undefined")
				return _object.geometry.index.count;
			else
				return _object.attributes.position.count;
		case 'faces':
			if (typeof (_object.geometry.index) != "undefined")
				return _object.geometry.index.count/3;
			else
				return _object.attributes.position.count/3;
		break;
	}
}

function setupObject (_object, _camera, _data, _controls) {
	if (typeof (_data) != "undefined") {
		_object.position.set (_data["objPosition"][0], _data["objPosition"][1], _data["objPosition"][2]);
		_object.scale.set (_data["objScale"][0], _data["objScale"][1], _data["objScale"][2]);
		_object.rotation.set (THREE.Math.degToRad(_data["objRotation"][0]), THREE.Math.degToRad(_data["objRotation"][1]), THREE.Math.degToRad(_data["objRotation"][2]));
	}
	else {
		var boundingBox = new THREE.Box3();
		if (Array.isArray(_object)) {
			for (var i = 0; i < _object.length; i++) {
				boundingBox.setFromObject( _object[i] );
				_object[i].position.set (0, 0, 0);
				_object[i].needsUpdate = true;
				_object[i].geometry.computeBoundingBox();
				_object[i].geometry.computeBoundingSphere();				
			}
		}
		else {
			boundingBox.setFromObject( _object );
			_object.position.set (0, 0, 0);
			_object.needsUpdate = true;
			_object.geometry.computeBoundingBox();
			_object.geometry.computeBoundingSphere();
		}
	}

}

function setupCamera (_object, _camera, _data, _controls) {
	if (typeof (_data) != "undefined") {
		_camera.position.set( _data["camPosition"][0], _data["camPosition"][1], _data["camPosition"][2] );
		_camera.updateProjectionMatrix();
		_controls.update();
		fitCameraToCenteredObject ( _camera, _object, 1.7, _controls );
	}
	else {
		var boundingBox = new THREE.Box3();
		if (Array.isArray(_object)) {
			for (var i = 0; i < _object.length; i++) {
				boundingBox.setFromObject( _object[i] );
			}
		}
		else {
			boundingBox.setFromObject( _object );
		}
		var size = new THREE.Vector3();
		boundingBox.getSize(size);
		camera.position.set(size.x, size.y, size.z);
		fitCameraToCenteredObject ( _camera, _object, 1.7, _controls );
	}
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );
	render();
}

//

function animate() {
	requestAnimationFrame( animate );
	const delta = clock.getDelta();
	if ( mixer ) mixer.update( delta );
	TWEEN.update();
	renderer.render( scene, camera );
	stats.update();
}

function fitCameraToCenteredObject (camera, object, offset, orbitControls ) {
	const boundingBox = new THREE.Box3();
	if (Array.isArray(object)) {
		for (var i = 0; i < object.length; i++) {			
			boundingBox.setFromObject( object[i] );
		}
	}
	else {
		boundingBox.setFromObject( object );
	}

    var middle = new THREE.Vector3();
    var size = new THREE.Vector3();
    boundingBox.getSize(size);
	console.log("Centering camera");
	// ground
	var distance = new THREE.Vector3(Math.abs(boundingBox.max.x - boundingBox.min.x), Math.abs(boundingBox.max.y - boundingBox.min.y), Math.abs(boundingBox.max.z - boundingBox.min.z));
	var gridSize = Math.max(distance.x, distance.y, distance.z);
	var gridSizeScale = gridSize*1.5;
	const mesh = new THREE.Mesh( new THREE.PlaneGeometry( gridSizeScale, gridSizeScale ), new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false, transparent: true, opacity: 0.85 } ) );
	mesh.rotation.x = - Math.PI / 2;
	mesh.position.set(0, 0, 0);
	mesh.receiveShadow = false;
	scene.add( mesh );	

	const axesHelper = new THREE.AxesHelper( gridSize );
	axesHelper.position.set(0, 0, 0);
	scene.add( axesHelper );
	
	const grid = new THREE.GridHelper( gridSizeScale, 80, 0x000000, 0x000000 );
	grid.material.opacity = 0.2;
	grid.material.transparent = true;
	grid.position.set(0, 0, 0);
	scene.add( grid );

    // figure out how to fit the box in the view:
    // 1. figure out horizontal FOV (on non-1.0 aspects)
    // 2. figure out distance from the object in X and Y planes
    // 3. select the max distance (to fit both sides in)
    //
    // The reason is as follows:
    //
    // Imagine a bounding box (BB) is centered at (0,0,0).
    // Camera has vertical FOV (camera.fov) and horizontal FOV
    // (camera.fov scaled by aspect, see fovh below)
    //
    // Therefore if you want to put the entire object into the field of view,
    // you have to compute the distance as: z/2 (half of Z size of the BB
    // protruding towards us) plus for both X and Y size of BB you have to
    // figure out the distance created by the appropriate FOV.
    //
    // The FOV is always a triangle:
    //
    //  (size/2)
    // +--------+
    // |       /
    // |      /
    // |     /
    // | F° /
    // |   /
    // |  /
    // | /
    // |/
    //
    // F° is half of respective FOV, so to compute the distance (the length
    // of the straight line) one has to: `size/2 / Math.tan(F)`.
    //
    // FTR, from https://threejs.org/docs/#api/en/cameras/PerspectiveCamera
    // the camera.fov is the vertical FOV.

    const fov = camera.fov * ( Math.PI / 180 );
    const fovh = 2*Math.atan(Math.tan(fov/2) * camera.aspect);
    let dx = size.z / 2 + Math.abs( size.x / 2 / Math.tan( fovh / 2 ) );
    let dy = size.z / 2 + Math.abs( size.y / 2 / Math.tan( fov / 2 ) );
    let cameraZ = Math.max(dx, dy);

    // offset the camera, if desired (to avoid filling the whole canvas)
    if( offset !== undefined && offset !== 0 ) cameraZ *= offset;
	const coords = {x: camera.position.x, y: camera.position.y, z: cameraZ*0.8};
    new TWEEN.Tween(coords)
		.to({ z: cameraZ }, 800)
		.onUpdate(() =>
			{
				camera.position.set( coords.x, coords.y, coords.z );
				camera.updateProjectionMatrix();
				controls.update();
			}
      )
      .start();

    //camera.position.set( camera.position.x, camera.position.y, cameraZ );

    // set the far plane of the camera so that it easily encompasses the whole object
    const minZ = boundingBox.min.z;
    const cameraToFarEdge = ( minZ < 0 ) ? -minZ + cameraZ : cameraZ - minZ;

    camera.far = cameraToFarEdge * 3;
    camera.updateProjectionMatrix();

    if ( orbitControls !== undefined ) {
        // set camera to rotate around the center
        orbitControls.target = new THREE.Vector3(0, 0, 0);

        // prevent camera from zooming out far enough to create far plane cutoff
        orbitControls.maxDistance = cameraToFarEdge * 2;
    }
	controls.update();
}

function render() {
	renderer.render( scene, camera );
}

function updateObject () {
	//console.log(helperObjects[0].position);
}

function onPointerDown( event ) {
	onDownPosition.x = event.clientX;
	onDownPosition.y = event.clientY;
}

function onPointerUp() {
	onUpPosition.x = event.clientX;
	onUpPosition.y = event.clientY;
	if ( onDownPosition.distanceTo( onUpPosition ) === 0 ) { 
		transformControl.detach();

		if (typeof(helperObjects[0]) !== "undefined" && transformType != '') {
			if (helperObjects[0].name == "Scene") {
				helperObjects[0].children.needsUpdate = true;
				helperObjects[0].children.geometry.computeBoundingBox();
				helperObjects[0].children.geometry.computeBoundingSphere();
			}
			else {
				helperObjects[0].needsUpdate = true;
				helperObjects[0].geometry.computeBoundingBox();
				helperObjects[0].geometry.computeBoundingSphere();
			}
		}
	}
}

function onPointerMove( event ) {
	//pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	//pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
	pointer.x = ( event.clientX - windowHalfX ) / window.innerWidth;
	pointer.y = ( event.clientY - windowHalfY ) / window.innerHeight;
	raycaster.setFromCamera( pointer, camera );
	if (typeof(helperObjects[0]) !== "undefined") {
		if (helperObjects[0].name == "Scene")
			var intersects = raycaster.intersectObjects( helperObjects[0].children, false );
		else
			var intersects = raycaster.intersectObjects( helperObjects[0], false );

		if ( intersects.length > 0 ) {
			const object = intersects[ 0 ].object;
			if ( object !== transformControl.object ) {
				if ( transformType != "" ) {
					transformControl.mode = transformType;
					transformControl.attach( helperObjects[0] );
				}
			}
		}
	}
}

const onError = function () {
	circle.set(100, 100);
	circle.hide();	
};

const onProgress = function ( xhr ) {
	var percentComplete = xhr.loaded / xhr.total * 100;
	//console.log( ( percentComplete ) + '% loaded' );					
	circle.set(percentComplete, 100);
	if (percentComplete >= 100) {
		circle.hide();
		console.log("Model has been loaded.");
	}
};