import { dM as Controls, V as Vector3, eR as MOUSE, fE as TOUCH, bs as Quaternion, fs as Spherical, Q as Vector2, ff as Ray, aq as Plane, eS as MathUtils, fP as TrianglesDrawMode, fN as TriangleFanDrawMode, fO as TriangleStripDrawMode, am as BufferGeometry, a9 as BufferAttribute } from './three-DQIwNvhE.js';

/**
 * Fires when the camera has been transformed by the controls.
 *
 * @event OrbitControls#change
 * @type {Object}
 */
const _changeEvent = { type: 'change' };

/**
 * Fires when an interaction was initiated.
 *
 * @event OrbitControls#start
 * @type {Object}
 */
const _startEvent = { type: 'start' };

/**
 * Fires when an interaction has finished.
 *
 * @event OrbitControls#end
 * @type {Object}
 */
const _endEvent = { type: 'end' };

const _ray = new Ray();
const _plane = new Plane();
const _TILT_LIMIT = Math.cos( 70 * MathUtils.DEG2RAD );

const _v = new Vector3();
const _twoPI = 2 * Math.PI;

const _STATE = {
	NONE: -1,
	ROTATE: 0,
	DOLLY: 1,
	PAN: 2,
	TOUCH_ROTATE: 3,
	TOUCH_PAN: 4,
	TOUCH_DOLLY_PAN: 5,
	TOUCH_DOLLY_ROTATE: 6
};
const _EPS = 0.000001;


/**
 * Orbit controls allow the camera to orbit around a target.
 *
 * OrbitControls performs orbiting, dollying (zooming), and panning. Unlike {@link TrackballControls},
 * it maintains the "up" direction `object.up` (+Y by default).
 *
 * - Orbit: Left mouse / touch: one-finger move.
 * - Zoom: Middle mouse, or mousewheel / touch: two-finger spread or squish.
 * - Pan: Right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move.
 *
 * ```js
 * const controls = new OrbitControls( camera, renderer.domElement );
 *
 * // controls.update() must be called after any manual changes to the camera's transform
 * camera.position.set( 0, 20, 100 );
 * controls.update();
 *
 * function animate() {
 *
 * 	// required if controls.enableDamping or controls.autoRotate are set to true
 * 	controls.update();
 *
 * 	renderer.render( scene, camera );
 *
 * }
 * ```
 *
 * @augments Controls
 * @three_import import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
 */
class OrbitControls extends Controls {

	/**
	 * Constructs a new controls instance.
	 *
	 * @param {Object3D} object - The object that is managed by the controls.
	 * @param {?HTMLElement} domElement - The HTML element used for event listeners.
	 */
	constructor( object, domElement = null ) {

		super( object, domElement );

		this.state = _STATE.NONE;

		/**
		 * The focus point of the controls, the `object` orbits around this.
		 * It can be updated manually at any point to change the focus of the controls.
		 *
		 * @type {Vector3}
		 */
		this.target = new Vector3();

		/**
		 * The focus point of the `minTargetRadius` and `maxTargetRadius` limits.
		 * It can be updated manually at any point to change the center of interest
		 * for the `target`.
		 *
		 * @type {Vector3}
		 */
		this.cursor = new Vector3();

		/**
		 * How far you can dolly in (perspective camera only).
		 *
		 * @type {number}
		 * @default 0
		 */
		this.minDistance = 0;

		/**
		 * How far you can dolly out (perspective camera only).
		 *
		 * @type {number}
		 * @default Infinity
		 */
		this.maxDistance = Infinity;

		/**
		 * How far you can zoom in (orthographic camera only).
		 *
		 * @type {number}
		 * @default 0
		 */
		this.minZoom = 0;

		/**
		 * How far you can zoom out (orthographic camera only).
		 *
		 * @type {number}
		 * @default Infinity
		 */
		this.maxZoom = Infinity;

		/**
		 * How close you can get the target to the 3D `cursor`.
		 *
		 * @type {number}
		 * @default 0
		 */
		this.minTargetRadius = 0;

		/**
		 * How far you can move the target from the 3D `cursor`.
		 *
		 * @type {number}
		 * @default Infinity
		 */
		this.maxTargetRadius = Infinity;

		/**
		 * How far you can orbit vertically, lower limit. Range is `[0, Math.PI]` radians.
		 *
		 * @type {number}
		 * @default 0
		 */
		this.minPolarAngle = 0;

		/**
		 * How far you can orbit vertically, upper limit. Range is `[0, Math.PI]` radians.
		 *
		 * @type {number}
		 * @default Math.PI
		 */
		this.maxPolarAngle = Math.PI;

		/**
		 * How far you can orbit horizontally, lower limit. If set, the interval `[ min, max ]`
		 * must be a sub-interval of `[ - 2 PI, 2 PI ]`, with `( max - min < 2 PI )`.
		 *
		 * @type {number}
		 * @default -Infinity
		 */
		this.minAzimuthAngle = - Infinity;

		/**
		 * How far you can orbit horizontally, upper limit. If set, the interval `[ min, max ]`
		 * must be a sub-interval of `[ - 2 PI, 2 PI ]`, with `( max - min < 2 PI )`.
		 *
		 * @type {number}
		 * @default -Infinity
		 */
		this.maxAzimuthAngle = Infinity;

		/**
		 * Set to `true` to enable damping (inertia), which can be used to give a sense of weight
		 * to the controls. Note that if this is enabled, you must call `update()` in your animation
		 * loop.
		 *
		 * @type {boolean}
		 * @default false
		 */
		this.enableDamping = false;

		/**
		 * The damping inertia used if `enableDamping` is set to `true`.
		 *
		 * Note that for this to work, you must call `update()` in your animation loop.
		 *
		 * @type {number}
		 * @default 0.05
		 */
		this.dampingFactor = 0.05;

		/**
		 * Enable or disable zooming (dollying) of the camera.
		 *
		 * @type {boolean}
		 * @default true
		 */
		this.enableZoom = true;

		/**
		 * Speed of zooming / dollying.
		 *
		 * @type {number}
		 * @default 1
		 */
		this.zoomSpeed = 1.0;

		/**
		 * Enable or disable horizontal and vertical rotation of the camera.
		 *
		 * Note that it is possible to disable a single axis by setting the min and max of the
		 * `minPolarAngle` or `minAzimuthAngle` to the same value, which will cause the vertical
		 * or horizontal rotation to be fixed at that value.
		 *
		 * @type {boolean}
		 * @default true
		 */
		this.enableRotate = true;

		/**
		 * Speed of rotation.
		 *
		 * @type {number}
		 * @default 1
		 */
		this.rotateSpeed = 1.0;

		/**
		 * How fast to rotate the camera when the keyboard is used.
		 *
		 * @type {number}
		 * @default 1
		 */
		this.keyRotateSpeed = 1.0;

		/**
		 * Enable or disable camera panning.
		 *
		 * @type {boolean}
		 * @default true
		 */
		this.enablePan = true;

		/**
		 * Speed of panning.
		 *
		 * @type {number}
		 * @default 1
		 */
		this.panSpeed = 1.0;

		/**
		 * Defines how the camera's position is translated when panning. If `true`, the camera pans
		 * in screen space. Otherwise, the camera pans in the plane orthogonal to the camera's up
		 * direction.
		 *
		 * @type {boolean}
		 * @default true
		 */
		this.screenSpacePanning = true;

		/**
		 * How fast to pan the camera when the keyboard is used in
		 * pixels per keypress.
		 *
		 * @type {number}
		 * @default 7
		 */
		this.keyPanSpeed = 7.0;

		/**
		 * Setting this property to `true` allows to zoom to the cursor's position.
		 *
		 * @type {boolean}
		 * @default false
		 */
		this.zoomToCursor = false;

		/**
		 * Set to true to automatically rotate around the target
		 *
		 * Note that if this is enabled, you must call `update()` in your animation loop.
		 * If you want the auto-rotate speed to be independent of the frame rate (the refresh
		 * rate of the display), you must pass the time `deltaTime`, in seconds, to `update()`.
		 *
		 * @type {boolean}
		 * @default false
		 */
		this.autoRotate = false;

		/**
		 * How fast to rotate around the target if `autoRotate` is `true`. The default  equates to 30 seconds
		 * per orbit at 60fps.
		 *
		 * Note that if `autoRotate` is enabled, you must call `update()` in your animation loop.
		 *
		 * @type {number}
		 * @default 2
		 */
		this.autoRotateSpeed = 2.0;

		/**
		 * This object contains references to the keycodes for controlling camera panning.
		 *
		 * ```js
		 * controls.keys = {
		 * 	LEFT: 'ArrowLeft', //left arrow
		 * 	UP: 'ArrowUp', // up arrow
		 * 	RIGHT: 'ArrowRight', // right arrow
		 * 	BOTTOM: 'ArrowDown' // down arrow
		 * }
		 * ```
		 * @type {Object}
		 */
		this.keys = { LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', BOTTOM: 'ArrowDown' };

		/**
		 * This object contains references to the mouse actions used by the controls.
		 *
		 * ```js
		 * controls.mouseButtons = {
		 * 	LEFT: THREE.MOUSE.ROTATE,
		 * 	MIDDLE: THREE.MOUSE.DOLLY,
		 * 	RIGHT: THREE.MOUSE.PAN
		 * }
		 * ```
		 * @type {Object}
		 */
		this.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };

		/**
		 * This object contains references to the touch actions used by the controls.
		 *
		 * ```js
		 * controls.mouseButtons = {
		 * 	ONE: THREE.TOUCH.ROTATE,
		 * 	TWO: THREE.TOUCH.DOLLY_PAN
		 * }
		 * ```
		 * @type {Object}
		 */
		this.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

		/**
		 * Used internally by `saveState()` and `reset()`.
		 *
		 * @type {Vector3}
		 */
		this.target0 = this.target.clone();

		/**
		 * Used internally by `saveState()` and `reset()`.
		 *
		 * @type {Vector3}
		 */
		this.position0 = this.object.position.clone();

		/**
		 * Used internally by `saveState()` and `reset()`.
		 *
		 * @type {number}
		 */
		this.zoom0 = this.object.zoom;

		this._cursorStyle = 'auto';

		// the target DOM element for key events
		this._domElementKeyEvents = null;

		// internals

		this._lastPosition = new Vector3();
		this._lastQuaternion = new Quaternion();
		this._lastTargetPosition = new Vector3();

		// so camera.up is the orbit axis
		this._quat = new Quaternion().setFromUnitVectors( object.up, new Vector3( 0, 1, 0 ) );
		this._quatInverse = this._quat.clone().invert();

		// current position in spherical coordinates
		this._spherical = new Spherical();
		this._sphericalDelta = new Spherical();

		this._scale = 1;
		this._panOffset = new Vector3();

		this._rotateStart = new Vector2();
		this._rotateEnd = new Vector2();
		this._rotateDelta = new Vector2();

		this._panStart = new Vector2();
		this._panEnd = new Vector2();
		this._panDelta = new Vector2();

		this._dollyStart = new Vector2();
		this._dollyEnd = new Vector2();
		this._dollyDelta = new Vector2();

		this._dollyDirection = new Vector3();
		this._mouse = new Vector2();
		this._performCursorZoom = false;

		this._pointers = [];
		this._pointerPositions = {};

		this._controlActive = false;

		// event listeners

		this._onPointerMove = onPointerMove.bind( this );
		this._onPointerDown = onPointerDown.bind( this );
		this._onPointerUp = onPointerUp.bind( this );
		this._onContextMenu = onContextMenu.bind( this );
		this._onMouseWheel = onMouseWheel.bind( this );
		this._onKeyDown = onKeyDown.bind( this );

		this._onTouchStart = onTouchStart.bind( this );
		this._onTouchMove = onTouchMove.bind( this );

		this._onMouseDown = onMouseDown.bind( this );
		this._onMouseMove = onMouseMove.bind( this );

		this._interceptControlDown = interceptControlDown.bind( this );
		this._interceptControlUp = interceptControlUp.bind( this );

		//

		if ( this.domElement !== null ) {

			this.connect( this.domElement );

		}

		this.update();

	}

	/**
	 * Defines the visual representation of the cursor.
	 *
	 * @type {('auto'|'grab')}
	 * @default 'auto'
	 */
	set cursorStyle( type ) {

		this._cursorStyle = type;

		if ( type === 'grab' ) {

			this.domElement.style.cursor = 'grab';

		} else {

			this.domElement.style.cursor = 'auto';

		}

	}

	get cursorStyle() {

		return this._cursorStyle;

	}

	connect( element ) {

		super.connect( element );

		this.domElement.addEventListener( 'pointerdown', this._onPointerDown );
		this.domElement.addEventListener( 'pointercancel', this._onPointerUp );

		this.domElement.addEventListener( 'contextmenu', this._onContextMenu );
		this.domElement.addEventListener( 'wheel', this._onMouseWheel, { passive: false } );

		this.domElement.ownerDocument.addEventListener( 'keydown', this._interceptControlDown, { passive: true, capture: true } );

		this.domElement.style.touchAction = 'none'; // Disable touch scroll

	}

	disconnect() {

		this.state = _STATE.NONE;

		this.domElement.removeEventListener( 'pointerdown', this._onPointerDown );
		this.domElement.ownerDocument.removeEventListener( 'pointermove', this._onPointerMove );
		this.domElement.ownerDocument.removeEventListener( 'pointerup', this._onPointerUp );
		this.domElement.removeEventListener( 'pointercancel', this._onPointerUp );

		this.domElement.removeEventListener( 'wheel', this._onMouseWheel );
		this.domElement.removeEventListener( 'contextmenu', this._onContextMenu );

		this.stopListenToKeyEvents();

		this.domElement.ownerDocument.removeEventListener( 'keydown', this._interceptControlDown, { capture: true } );
		this.domElement.ownerDocument.removeEventListener( 'keyup', this._interceptControlUp, { capture: true } );

		this._controlActive = false;

		this._pointers.length = 0;
		this._pointerPositions = {};

		this.domElement.style.touchAction = ''; // Restore touch scroll
		this.domElement.style.cursor = 'auto';

	}

	dispose() {

		this.disconnect();

	}

	/**
	 * Get the current vertical rotation, in radians.
	 *
	 * @return {number} The current vertical rotation, in radians.
	 */
	getPolarAngle() {

		return this._spherical.phi;

	}

	/**
	 * Get the current horizontal rotation, in radians.
	 *
	 * @return {number} The current horizontal rotation, in radians.
	 */
	getAzimuthalAngle() {

		return this._spherical.theta;

	}

	/**
	 * Returns the distance from the camera to the target.
	 *
	 * @return {number} The distance from the camera to the target.
	 */
	getDistance() {

		return this.object.position.distanceTo( this.target );

	}

	/**
	 * Adds key event listeners to the given DOM element.
	 * `window` is a recommended argument for using this method.
	 *
	 * @param {HTMLElement} domElement - The DOM element
	 */
	listenToKeyEvents( domElement ) {

		domElement.addEventListener( 'keydown', this._onKeyDown );
		this._domElementKeyEvents = domElement;

	}

	/**
	 * Removes the key event listener previously defined with `listenToKeyEvents()`.
	 */
	stopListenToKeyEvents() {

		if ( this._domElementKeyEvents !== null ) {

			this._domElementKeyEvents.removeEventListener( 'keydown', this._onKeyDown );
			this._domElementKeyEvents = null;

		}

	}

	/**
	 * Save the current state of the controls. This can later be recovered with `reset()`.
	 */
	saveState() {

		this.target0.copy( this.target );
		this.position0.copy( this.object.position );
		this.zoom0 = this.object.zoom;

	}

	/**
	 * Reset the controls to their state from either the last time the `saveState()`
	 * was called, or the initial state.
	 */
	reset() {

		this.target.copy( this.target0 );
		this.object.position.copy( this.position0 );
		this.object.zoom = this.zoom0;

		this.object.updateProjectionMatrix();
		this.dispatchEvent( _changeEvent );

		this.update();

		this.state = _STATE.NONE;

	}

	/**
	 * Programmatically pan the camera.
	 *
	 * @param {number} deltaX - The horizontal pan amount in pixels.
	 * @param {number} deltaY - The vertical pan amount in pixels.
	 */
	pan( deltaX, deltaY ) {

		this._pan( deltaX, deltaY );
		this.update();

	}

	/**
	 * Programmatically dolly in (zoom in for perspective camera).
	 *
	 * @param {number} dollyScale - The dolly scale factor.
	 */
	dollyIn( dollyScale ) {

		this._dollyIn( dollyScale );
		this.update();

	}

	/**
	 * Programmatically dolly out (zoom out for perspective camera).
	 *
	 * @param {number} dollyScale - The dolly scale factor.
	 */
	dollyOut( dollyScale ) {

		this._dollyOut( dollyScale );
		this.update();

	}

	/**
	 * Programmatically rotate the camera left (around the vertical axis).
	 *
	 * @param {number} angle - The rotation angle in radians.
	 */
	rotateLeft( angle ) {

		this._rotateLeft( angle );
		this.update();

	}

	/**
	 * Programmatically rotate the camera up (around the horizontal axis).
	 *
	 * @param {number} angle - The rotation angle in radians.
	 */
	rotateUp( angle ) {

		this._rotateUp( angle );
		this.update();

	}

	update( deltaTime = null ) {

		const position = this.object.position;

		_v.copy( position ).sub( this.target );

		// rotate offset to "y-axis-is-up" space
		_v.applyQuaternion( this._quat );

		// angle from z-axis around y-axis
		this._spherical.setFromVector3( _v );

		if ( this.autoRotate && this.state === _STATE.NONE ) {

			this._rotateLeft( this._getAutoRotationAngle( deltaTime ) );

		}

		if ( this.enableDamping ) {

			this._spherical.theta += this._sphericalDelta.theta * this.dampingFactor;
			this._spherical.phi += this._sphericalDelta.phi * this.dampingFactor;

		} else {

			this._spherical.theta += this._sphericalDelta.theta;
			this._spherical.phi += this._sphericalDelta.phi;

		}

		// restrict theta to be between desired limits

		let min = this.minAzimuthAngle;
		let max = this.maxAzimuthAngle;

		if ( isFinite( min ) && isFinite( max ) ) {

			if ( min < - Math.PI ) min += _twoPI; else if ( min > Math.PI ) min -= _twoPI;

			if ( max < - Math.PI ) max += _twoPI; else if ( max > Math.PI ) max -= _twoPI;

			if ( min <= max ) {

				this._spherical.theta = Math.max( min, Math.min( max, this._spherical.theta ) );

			} else {

				this._spherical.theta = ( this._spherical.theta > ( min + max ) / 2 ) ?
					Math.max( min, this._spherical.theta ) :
					Math.min( max, this._spherical.theta );

			}

		}

		// restrict phi to be between desired limits
		this._spherical.phi = Math.max( this.minPolarAngle, Math.min( this.maxPolarAngle, this._spherical.phi ) );

		this._spherical.makeSafe();


		// move target to panned location

		if ( this.enableDamping === true ) {

			this.target.addScaledVector( this._panOffset, this.dampingFactor );

		} else {

			this.target.add( this._panOffset );

		}

		// Limit the target distance from the cursor to create a sphere around the center of interest
		this.target.sub( this.cursor );
		this.target.clampLength( this.minTargetRadius, this.maxTargetRadius );
		this.target.add( this.cursor );

		let zoomChanged = false;
		// adjust the camera position based on zoom only if we're not zooming to the cursor or if it's an ortho camera
		// we adjust zoom later in these cases
		if ( this.zoomToCursor && this._performCursorZoom || this.object.isOrthographicCamera ) {

			this._spherical.radius = this._clampDistance( this._spherical.radius );

		} else {

			const prevRadius = this._spherical.radius;
			this._spherical.radius = this._clampDistance( this._spherical.radius * this._scale );
			zoomChanged = prevRadius != this._spherical.radius;

		}

		_v.setFromSpherical( this._spherical );

		// rotate offset back to "camera-up-vector-is-up" space
		_v.applyQuaternion( this._quatInverse );

		position.copy( this.target ).add( _v );

		this.object.lookAt( this.target );

		if ( this.enableDamping === true ) {

			this._sphericalDelta.theta *= ( 1 - this.dampingFactor );
			this._sphericalDelta.phi *= ( 1 - this.dampingFactor );

			this._panOffset.multiplyScalar( 1 - this.dampingFactor );

		} else {

			this._sphericalDelta.set( 0, 0, 0 );

			this._panOffset.set( 0, 0, 0 );

		}

		// adjust camera position
		if ( this.zoomToCursor && this._performCursorZoom ) {

			let newRadius = null;
			if ( this.object.isPerspectiveCamera ) {

				// move the camera down the pointer ray
				// this method avoids floating point error
				const prevRadius = _v.length();
				newRadius = this._clampDistance( prevRadius * this._scale );

				const radiusDelta = prevRadius - newRadius;
				this.object.position.addScaledVector( this._dollyDirection, radiusDelta );
				this.object.updateMatrixWorld();

				zoomChanged = !! radiusDelta;

			} else if ( this.object.isOrthographicCamera ) {

				// adjust the ortho camera position based on zoom changes
				const mouseBefore = new Vector3( this._mouse.x, this._mouse.y, 0 );
				mouseBefore.unproject( this.object );

				const prevZoom = this.object.zoom;
				this.object.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, this.object.zoom / this._scale ) );
				this.object.updateProjectionMatrix();

				zoomChanged = prevZoom !== this.object.zoom;

				const mouseAfter = new Vector3( this._mouse.x, this._mouse.y, 0 );
				mouseAfter.unproject( this.object );

				this.object.position.sub( mouseAfter ).add( mouseBefore );
				this.object.updateMatrixWorld();

				newRadius = _v.length();

			} else {

				console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled.' );
				this.zoomToCursor = false;

			}

			// handle the placement of the target
			if ( newRadius !== null ) {

				if ( this.screenSpacePanning ) {

					// position the orbit target in front of the new camera position
					this.target.set( 0, 0, -1 )
						.transformDirection( this.object.matrix )
						.multiplyScalar( newRadius )
						.add( this.object.position );

				} else {

					// get the ray and translation plane to compute target
					_ray.origin.copy( this.object.position );
					_ray.direction.set( 0, 0, -1 ).transformDirection( this.object.matrix );

					// if the camera is 20 degrees above the horizon then don't adjust the focus target to avoid
					// extremely large values
					if ( Math.abs( this.object.up.dot( _ray.direction ) ) < _TILT_LIMIT ) {

						this.object.lookAt( this.target );

					} else {

						_plane.setFromNormalAndCoplanarPoint( this.object.up, this.target );
						_ray.intersectPlane( _plane, this.target );

					}

				}

			}

		} else if ( this.object.isOrthographicCamera ) {

			const prevZoom = this.object.zoom;
			this.object.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, this.object.zoom / this._scale ) );

			if ( prevZoom !== this.object.zoom ) {

				this.object.updateProjectionMatrix();
				zoomChanged = true;

			}

		}

		this._scale = 1;
		this._performCursorZoom = false;

		// update condition is:
		// min(camera displacement, camera rotation in radians)^2 > EPS
		// using small-angle approximation cos(x/2) = 1 - x^2 / 8

		if ( zoomChanged ||
			this._lastPosition.distanceToSquared( this.object.position ) > _EPS ||
			8 * ( 1 - this._lastQuaternion.dot( this.object.quaternion ) ) > _EPS ||
			this._lastTargetPosition.distanceToSquared( this.target ) > _EPS ) {

			this.dispatchEvent( _changeEvent );

			this._lastPosition.copy( this.object.position );
			this._lastQuaternion.copy( this.object.quaternion );
			this._lastTargetPosition.copy( this.target );

			return true;

		}

		return false;

	}

	_getAutoRotationAngle( deltaTime ) {

		if ( deltaTime !== null ) {

			return ( _twoPI / 60 * this.autoRotateSpeed ) * deltaTime;

		} else {

			return _twoPI / 60 / 60 * this.autoRotateSpeed;

		}

	}

	_getZoomScale( delta ) {

		const normalizedDelta = Math.abs( delta * 0.01 );
		return Math.pow( 0.95, this.zoomSpeed * normalizedDelta );

	}

	_rotateLeft( angle ) {

		this._sphericalDelta.theta -= angle;

	}

	_rotateUp( angle ) {

		this._sphericalDelta.phi -= angle;

	}

	_panLeft( distance, objectMatrix ) {

		_v.setFromMatrixColumn( objectMatrix, 0 ); // get X column of objectMatrix
		_v.multiplyScalar( - distance );

		this._panOffset.add( _v );

	}

	_panUp( distance, objectMatrix ) {

		if ( this.screenSpacePanning === true ) {

			_v.setFromMatrixColumn( objectMatrix, 1 );

		} else {

			_v.setFromMatrixColumn( objectMatrix, 0 );
			_v.crossVectors( this.object.up, _v );

		}

		_v.multiplyScalar( distance );

		this._panOffset.add( _v );

	}

	// deltaX and deltaY are in pixels; right and down are positive
	_pan( deltaX, deltaY ) {

		const element = this.domElement;

		if ( this.object.isPerspectiveCamera ) {

			// perspective
			const position = this.object.position;
			_v.copy( position ).sub( this.target );
			let targetDistance = _v.length();

			// half of the fov is center to top of screen
			targetDistance *= Math.tan( ( this.object.fov / 2 ) * Math.PI / 180.0 );

			// we use only clientHeight here so aspect ratio does not distort speed
			this._panLeft( 2 * deltaX * targetDistance / element.clientHeight, this.object.matrix );
			this._panUp( 2 * deltaY * targetDistance / element.clientHeight, this.object.matrix );

		} else if ( this.object.isOrthographicCamera ) {

			// orthographic
			this._panLeft( deltaX * ( this.object.right - this.object.left ) / this.object.zoom / element.clientWidth, this.object.matrix );
			this._panUp( deltaY * ( this.object.top - this.object.bottom ) / this.object.zoom / element.clientHeight, this.object.matrix );

		} else {

			// camera neither orthographic nor perspective
			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );
			this.enablePan = false;

		}

	}

	_dollyOut( dollyScale ) {

		if ( this.object.isPerspectiveCamera || this.object.isOrthographicCamera ) {

			this._scale /= dollyScale;

		} else {

			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
			this.enableZoom = false;

		}

	}

	_dollyIn( dollyScale ) {

		if ( this.object.isPerspectiveCamera || this.object.isOrthographicCamera ) {

			this._scale *= dollyScale;

		} else {

			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
			this.enableZoom = false;

		}

	}

	_updateZoomParameters( x, y ) {

		if ( ! this.zoomToCursor ) {

			return;

		}

		this._performCursorZoom = true;

		const rect = this.domElement.getBoundingClientRect();
		const dx = x - rect.left;
		const dy = y - rect.top;
		const w = rect.width;
		const h = rect.height;

		this._mouse.x = ( dx / w ) * 2 - 1;
		this._mouse.y = - ( dy / h ) * 2 + 1;

		this._dollyDirection.set( this._mouse.x, this._mouse.y, 1 ).unproject( this.object ).sub( this.object.position ).normalize();

	}

	_clampDistance( dist ) {

		return Math.max( this.minDistance, Math.min( this.maxDistance, dist ) );

	}

	//
	// event callbacks - update the object state
	//

	_handleMouseDownRotate( event ) {

		this._rotateStart.set( event.clientX, event.clientY );

	}

	_handleMouseDownDolly( event ) {

		this._updateZoomParameters( event.clientX, event.clientY );
		this._dollyStart.set( event.clientX, event.clientY );

	}

	_handleMouseDownPan( event ) {

		this._panStart.set( event.clientX, event.clientY );

	}

	_handleMouseMoveRotate( event ) {

		this._rotateEnd.set( event.clientX, event.clientY );

		this._rotateDelta.subVectors( this._rotateEnd, this._rotateStart ).multiplyScalar( this.rotateSpeed );

		const element = this.domElement;

		this._rotateLeft( _twoPI * this._rotateDelta.x / element.clientHeight ); // yes, height

		this._rotateUp( _twoPI * this._rotateDelta.y / element.clientHeight );

		this._rotateStart.copy( this._rotateEnd );

		this.update();

	}

	_handleMouseMoveDolly( event ) {

		this._dollyEnd.set( event.clientX, event.clientY );

		this._dollyDelta.subVectors( this._dollyEnd, this._dollyStart );

		if ( this._dollyDelta.y > 0 ) {

			this._dollyOut( this._getZoomScale( this._dollyDelta.y ) );

		} else if ( this._dollyDelta.y < 0 ) {

			this._dollyIn( this._getZoomScale( this._dollyDelta.y ) );

		}

		this._dollyStart.copy( this._dollyEnd );

		if ( this.zoomToCursor ) {

			// update() resets the cursor zoom, so keep zooming towards the position where the drag started

			this._performCursorZoom = true;
			this._dollyDirection.set( this._mouse.x, this._mouse.y, 1 ).unproject( this.object ).sub( this.object.position ).normalize();

		}

		this.update();

	}

	_handleMouseMovePan( event ) {

		this._panEnd.set( event.clientX, event.clientY );

		this._panDelta.subVectors( this._panEnd, this._panStart ).multiplyScalar( this.panSpeed );

		this._pan( this._panDelta.x, this._panDelta.y );

		this._panStart.copy( this._panEnd );

		this.update();

	}

	_handleMouseWheel( event ) {

		this._updateZoomParameters( event.clientX, event.clientY );

		if ( event.deltaY < 0 ) {

			this._dollyIn( this._getZoomScale( event.deltaY ) );

		} else if ( event.deltaY > 0 ) {

			this._dollyOut( this._getZoomScale( event.deltaY ) );

		}

		this.update();

	}

	_handleKeyDown( event ) {

		let needsUpdate = false;

		switch ( event.code ) {

			case this.keys.UP:

				if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

					if ( this.enableRotate ) {

						this._rotateUp( _twoPI * this.keyRotateSpeed / this.domElement.clientHeight );

					}

				} else {

					if ( this.enablePan ) {

						this._pan( 0, this.keyPanSpeed );

					}

				}

				needsUpdate = true;
				break;

			case this.keys.BOTTOM:

				if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

					if ( this.enableRotate ) {

						this._rotateUp( - _twoPI * this.keyRotateSpeed / this.domElement.clientHeight );

					}

				} else {

					if ( this.enablePan ) {

						this._pan( 0, - this.keyPanSpeed );

					}

				}

				needsUpdate = true;
				break;

			case this.keys.LEFT:

				if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

					if ( this.enableRotate ) {

						this._rotateLeft( _twoPI * this.keyRotateSpeed / this.domElement.clientHeight );

					}

				} else {

					if ( this.enablePan ) {

						this._pan( this.keyPanSpeed, 0 );

					}

				}

				needsUpdate = true;
				break;

			case this.keys.RIGHT:

				if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

					if ( this.enableRotate ) {

						this._rotateLeft( - _twoPI * this.keyRotateSpeed / this.domElement.clientHeight );

					}

				} else {

					if ( this.enablePan ) {

						this._pan( - this.keyPanSpeed, 0 );

					}

				}

				needsUpdate = true;
				break;

		}

		if ( needsUpdate ) {

			// prevent the browser from scrolling on cursor keys
			event.preventDefault();

			this.update();

		}


	}

	_handleTouchStartRotate( event ) {

		if ( this._pointers.length === 1 ) {

			this._rotateStart.set( event.pageX, event.pageY );

		} else {

			const position = this._getSecondPointerPosition( event );

			const x = 0.5 * ( event.pageX + position.x );
			const y = 0.5 * ( event.pageY + position.y );

			this._rotateStart.set( x, y );

		}

	}

	_handleTouchStartPan( event ) {

		if ( this._pointers.length === 1 ) {

			this._panStart.set( event.pageX, event.pageY );

		} else {

			const position = this._getSecondPointerPosition( event );

			const x = 0.5 * ( event.pageX + position.x );
			const y = 0.5 * ( event.pageY + position.y );

			this._panStart.set( x, y );

		}

	}

	_handleTouchStartDolly( event ) {

		const position = this._getSecondPointerPosition( event );

		const dx = event.pageX - position.x;
		const dy = event.pageY - position.y;

		const distance = Math.sqrt( dx * dx + dy * dy );

		this._dollyStart.set( 0, distance );

	}

	_handleTouchStartDollyPan( event ) {

		if ( this.enableZoom ) this._handleTouchStartDolly( event );

		if ( this.enablePan ) this._handleTouchStartPan( event );

	}

	_handleTouchStartDollyRotate( event ) {

		if ( this.enableZoom ) this._handleTouchStartDolly( event );

		if ( this.enableRotate ) this._handleTouchStartRotate( event );

	}

	_handleTouchMoveRotate( event ) {

		if ( this._pointers.length == 1 ) {

			this._rotateEnd.set( event.pageX, event.pageY );

		} else {

			const position = this._getSecondPointerPosition( event );

			const x = 0.5 * ( event.pageX + position.x );
			const y = 0.5 * ( event.pageY + position.y );

			this._rotateEnd.set( x, y );

		}

		this._rotateDelta.subVectors( this._rotateEnd, this._rotateStart ).multiplyScalar( this.rotateSpeed );

		const element = this.domElement;

		this._rotateLeft( _twoPI * this._rotateDelta.x / element.clientHeight ); // yes, height

		this._rotateUp( _twoPI * this._rotateDelta.y / element.clientHeight );

		this._rotateStart.copy( this._rotateEnd );

	}

	_handleTouchMovePan( event ) {

		if ( this._pointers.length === 1 ) {

			this._panEnd.set( event.pageX, event.pageY );

		} else {

			const position = this._getSecondPointerPosition( event );

			const x = 0.5 * ( event.pageX + position.x );
			const y = 0.5 * ( event.pageY + position.y );

			this._panEnd.set( x, y );

		}

		this._panDelta.subVectors( this._panEnd, this._panStart ).multiplyScalar( this.panSpeed );

		this._pan( this._panDelta.x, this._panDelta.y );

		this._panStart.copy( this._panEnd );

	}

	_handleTouchMoveDolly( event ) {

		const position = this._getSecondPointerPosition( event );

		const dx = event.pageX - position.x;
		const dy = event.pageY - position.y;

		const distance = Math.sqrt( dx * dx + dy * dy );

		this._dollyEnd.set( 0, distance );

		this._dollyDelta.set( 0, Math.pow( this._dollyEnd.y / this._dollyStart.y, this.zoomSpeed ) );

		this._dollyOut( this._dollyDelta.y );

		this._dollyStart.copy( this._dollyEnd );

		const centerX = ( event.pageX + position.x ) * 0.5;
		const centerY = ( event.pageY + position.y ) * 0.5;

		this._updateZoomParameters( centerX, centerY );

	}

	_handleTouchMoveDollyPan( event ) {

		if ( this.enableZoom ) this._handleTouchMoveDolly( event );

		if ( this.enablePan ) this._handleTouchMovePan( event );

	}

	_handleTouchMoveDollyRotate( event ) {

		if ( this.enableZoom ) this._handleTouchMoveDolly( event );

		if ( this.enableRotate ) this._handleTouchMoveRotate( event );

	}

	// pointers

	_addPointer( event ) {

		this._pointers.push( event.pointerId );

	}

	_removePointer( event ) {

		delete this._pointerPositions[ event.pointerId ];

		for ( let i = 0; i < this._pointers.length; i ++ ) {

			if ( this._pointers[ i ] == event.pointerId ) {

				this._pointers.splice( i, 1 );
				return;

			}

		}

	}

	_isTrackingPointer( event ) {

		for ( let i = 0; i < this._pointers.length; i ++ ) {

			if ( this._pointers[ i ] == event.pointerId ) return true;

		}

		return false;

	}

	_trackPointer( event ) {

		let position = this._pointerPositions[ event.pointerId ];

		if ( position === undefined ) {

			position = new Vector2();
			this._pointerPositions[ event.pointerId ] = position;

		}

		position.set( event.pageX, event.pageY );

	}

	_getSecondPointerPosition( event ) {

		const pointerId = ( event.pointerId === this._pointers[ 0 ] ) ? this._pointers[ 1 ] : this._pointers[ 0 ];

		return this._pointerPositions[ pointerId ];

	}

	//

	_customWheelEvent( event ) {

		const mode = event.deltaMode;

		// minimal wheel event altered to meet delta-zoom demand
		const newEvent = {
			clientX: event.clientX,
			clientY: event.clientY,
			deltaY: event.deltaY,
		};

		switch ( mode ) {

			case 1: // LINE_MODE
				newEvent.deltaY *= 16;
				break;

			case 2: // PAGE_MODE
				newEvent.deltaY *= 100;
				break;

		}

		// detect if event was triggered by pinching
		if ( event.ctrlKey && ! this._controlActive ) {

			newEvent.deltaY *= 10;

		}

		return newEvent;

	}

}

function onPointerDown( event ) {

	if ( this.enabled === false ) return;

	if ( this._pointers.length === 0 ) {

		this.domElement.setPointerCapture( event.pointerId );

		this.domElement.ownerDocument.addEventListener( 'pointermove', this._onPointerMove );
		this.domElement.ownerDocument.addEventListener( 'pointerup', this._onPointerUp );

	}

	//

	if ( this._isTrackingPointer( event ) ) return;

	//

	this._addPointer( event );

	if ( event.pointerType === 'touch' ) {

		this._onTouchStart( event );

	} else {

		this._onMouseDown( event );

	}

	if ( this._cursorStyle === 'grab' ) {

		this.domElement.style.cursor = 'grabbing';

	}

}

function onPointerMove( event ) {

	if ( this.enabled === false ) return;

	if ( event.pointerType === 'touch' ) {

		this._onTouchMove( event );

	} else {

		this._onMouseMove( event );

	}

}

function onPointerUp( event ) {

	this._removePointer( event );

	switch ( this._pointers.length ) {

		case 0:

			this.domElement.releasePointerCapture( event.pointerId );

			this.domElement.ownerDocument.removeEventListener( 'pointermove', this._onPointerMove );
			this.domElement.ownerDocument.removeEventListener( 'pointerup', this._onPointerUp );

			this.dispatchEvent( _endEvent );

			this.state = _STATE.NONE;

			if ( this._cursorStyle === 'grab' ) {

				this.domElement.style.cursor = 'grab';

			}

			break;

		case 1:

			const pointerId = this._pointers[ 0 ];
			const position = this._pointerPositions[ pointerId ];

			// minimal placeholder event - allows state correction on pointer-up
			this._onTouchStart( { pointerId: pointerId, pageX: position.x, pageY: position.y } );

			break;

	}

}

function onMouseDown( event ) {

	let mouseAction;

	switch ( event.button ) {

		case 0:

			mouseAction = this.mouseButtons.LEFT;
			break;

		case 1:

			mouseAction = this.mouseButtons.MIDDLE;
			break;

		case 2:

			mouseAction = this.mouseButtons.RIGHT;
			break;

		default:

			mouseAction = -1;

	}

	switch ( mouseAction ) {

		case MOUSE.DOLLY:

			if ( this.enableZoom === false ) return;

			this._handleMouseDownDolly( event );

			this.state = _STATE.DOLLY;

			break;

		case MOUSE.ROTATE:

			if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

				if ( this.enablePan === false ) return;

				this._handleMouseDownPan( event );

				this.state = _STATE.PAN;

			} else {

				if ( this.enableRotate === false ) return;

				this._handleMouseDownRotate( event );

				this.state = _STATE.ROTATE;

			}

			break;

		case MOUSE.PAN:

			if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

				if ( this.enableRotate === false ) return;

				this._handleMouseDownRotate( event );

				this.state = _STATE.ROTATE;

			} else {

				if ( this.enablePan === false ) return;

				this._handleMouseDownPan( event );

				this.state = _STATE.PAN;

			}

			break;

		default:

			this.state = _STATE.NONE;

	}

	if ( this.state !== _STATE.NONE ) {

		this.dispatchEvent( _startEvent );

	}

}

function onMouseMove( event ) {

	switch ( this.state ) {

		case _STATE.ROTATE:

			if ( this.enableRotate === false ) return;

			this._handleMouseMoveRotate( event );

			break;

		case _STATE.DOLLY:

			if ( this.enableZoom === false ) return;

			this._handleMouseMoveDolly( event );

			break;

		case _STATE.PAN:

			if ( this.enablePan === false ) return;

			this._handleMouseMovePan( event );

			break;

	}

}

function onMouseWheel( event ) {

	if ( this.enabled === false || this.enableZoom === false || this.state !== _STATE.NONE ) return;

	event.preventDefault();

	this.dispatchEvent( _startEvent );

	this._handleMouseWheel( this._customWheelEvent( event ) );

	this.dispatchEvent( _endEvent );

}

function onKeyDown( event ) {

	if ( this.enabled === false ) return;

	this._handleKeyDown( event );

}

function onTouchStart( event ) {

	this._trackPointer( event );

	switch ( this._pointers.length ) {

		case 1:

			switch ( this.touches.ONE ) {

				case TOUCH.ROTATE:

					if ( this.enableRotate === false ) {

						this.state = _STATE.NONE;
						break;

					}

					this._handleTouchStartRotate( event );

					this.state = _STATE.TOUCH_ROTATE;

					break;

				case TOUCH.PAN:

					if ( this.enablePan === false ) {

						this.state = _STATE.NONE;
						break;

					}

					this._handleTouchStartPan( event );

					this.state = _STATE.TOUCH_PAN;

					break;

				default:

					this.state = _STATE.NONE;

			}

			break;

		case 2:

			switch ( this.touches.TWO ) {

				case TOUCH.DOLLY_PAN:

					if ( this.enableZoom === false && this.enablePan === false ) return;

					this._handleTouchStartDollyPan( event );

					this.state = _STATE.TOUCH_DOLLY_PAN;

					break;

				case TOUCH.DOLLY_ROTATE:

					if ( this.enableZoom === false && this.enableRotate === false ) return;

					this._handleTouchStartDollyRotate( event );

					this.state = _STATE.TOUCH_DOLLY_ROTATE;

					break;

				default:

					this.state = _STATE.NONE;

			}

			break;

		default:

			this.state = _STATE.NONE;

	}

	if ( this.state !== _STATE.NONE ) {

		this.dispatchEvent( _startEvent );

	}

}

function onTouchMove( event ) {

	this._trackPointer( event );

	switch ( this.state ) {

		case _STATE.TOUCH_ROTATE:

			if ( this.enableRotate === false ) return;

			this._handleTouchMoveRotate( event );

			this.update();

			break;

		case _STATE.TOUCH_PAN:

			if ( this.enablePan === false ) return;

			this._handleTouchMovePan( event );

			this.update();

			break;

		case _STATE.TOUCH_DOLLY_PAN:

			if ( this.enableZoom === false && this.enablePan === false ) return;

			this._handleTouchMoveDollyPan( event );

			this.update();

			break;

		case _STATE.TOUCH_DOLLY_ROTATE:

			if ( this.enableZoom === false && this.enableRotate === false ) return;

			this._handleTouchMoveDollyRotate( event );

			this.update();

			break;

		default:

			this.state = _STATE.NONE;

	}

}

function onContextMenu( event ) {

	if ( this.enabled === false ) return;

	event.preventDefault();

}

function interceptControlDown( event ) {

	if ( event.key === 'Control' ) {

		this._controlActive = true;

		this.domElement.ownerDocument.addEventListener( 'keyup', this._interceptControlUp, { passive: true, capture: true } );

	}

}

function interceptControlUp( event ) {

	if ( event.key === 'Control' ) {

		this._controlActive = false;

		this.domElement.ownerDocument.removeEventListener( 'keyup', this._interceptControlUp, { passive: true, capture: true } );

	}

}

/**
 * Merges a set of geometries into a single instance. All geometries must have compatible attributes.
 *
 * @param {Array<BufferGeometry>} geometries - The geometries to merge.
 * @param {boolean} [useGroups=false] - Whether to use groups or not.
 * @return {?BufferGeometry} The merged geometry. Returns `null` if the merge does not succeed.
 */
function mergeGeometries( geometries, useGroups = false ) {

	const isIndexed = geometries[ 0 ].index !== null;

	const attributesUsed = new Set( Object.keys( geometries[ 0 ].attributes ) );
	const morphAttributesUsed = new Set( Object.keys( geometries[ 0 ].morphAttributes ) );

	const attributes = {};
	const morphAttributes = {};

	const morphTargetsRelative = geometries[ 0 ].morphTargetsRelative;

	const mergedGeometry = new BufferGeometry();
	mergedGeometry.morphTargetsRelative = morphTargetsRelative;

	let offset = 0;

	for ( let i = 0; i < geometries.length; ++ i ) {

		const geometry = geometries[ i ];
		let attributesCount = 0;
		let morphAttributesCount = 0;

		// ensure that all geometries are indexed, or none

		if ( isIndexed !== ( geometry.index !== null ) ) {

			console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + i + '. All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.' );
			return null;

		}

		// gather attributes, exit early if they're different

		for ( const name in geometry.attributes ) {

			if ( ! attributesUsed.has( name ) ) {

				console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + i + '. All geometries must have compatible attributes; make sure "' + name + '" attribute exists among all geometries, or in none of them.' );
				return null;

			}

			if ( attributes[ name ] === undefined ) attributes[ name ] = [];

			attributes[ name ].push( geometry.attributes[ name ] );

			attributesCount ++;

		}

		// ensure geometries have the same number of attributes

		if ( attributesCount !== attributesUsed.size ) {

			console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + i + '. Make sure all geometries have the same number of attributes.' );
			return null;

		}

		// gather morph attributes, exit early if they're different

		if ( morphTargetsRelative !== geometry.morphTargetsRelative ) {

			console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + i + '. .morphTargetsRelative must be consistent throughout all geometries.' );
			return null;

		}

		for ( const name in geometry.morphAttributes ) {

			if ( ! morphAttributesUsed.has( name ) ) {

				console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + i + '.  .morphAttributes must be consistent throughout all geometries.' );
				return null;

			}

			if ( geometry.morphAttributes[ name ].length !== geometries[ 0 ].morphAttributes[ name ].length ) {

				console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + i + '. All geometries must have the same number of morph targets for the "' + name + '" morph attribute.' );
				return null;

			}

			if ( morphAttributes[ name ] === undefined ) morphAttributes[ name ] = [];

			morphAttributes[ name ].push( geometry.morphAttributes[ name ] );

			morphAttributesCount ++;

		}

		// ensure geometries have the same number of morph attributes

		if ( morphAttributesCount !== morphAttributesUsed.size ) {

			console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + i + '. Make sure all geometries have the same number of morph attributes.' );
			return null;

		}

		if ( useGroups ) {

			let count;

			if ( isIndexed ) {

				count = geometry.index.count;

			} else if ( geometry.attributes.position !== undefined ) {

				count = geometry.attributes.position.count;

			} else {

				console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index ' + i + '. The geometry must have either an index or a position attribute' );
				return null;

			}

			mergedGeometry.addGroup( offset, count, i );

			offset += count;

		}

	}

	// merge indices

	if ( isIndexed ) {

		let indexOffset = 0;
		const mergedIndex = [];

		for ( let i = 0; i < geometries.length; ++ i ) {

			const index = geometries[ i ].index;

			for ( let j = 0; j < index.count; ++ j ) {

				mergedIndex.push( index.getX( j ) + indexOffset );

			}

			indexOffset += geometries[ i ].attributes.position.count;

		}

		mergedGeometry.setIndex( mergedIndex );

	}

	// merge attributes

	for ( const name in attributes ) {

		const mergedAttribute = mergeAttributes( attributes[ name ] );

		if ( ! mergedAttribute ) {

			console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the ' + name + ' attribute.' );
			return null;

		}

		mergedGeometry.setAttribute( name, mergedAttribute );

	}

	// merge morph attributes

	for ( const name in morphAttributes ) {

		const numMorphTargets = morphAttributes[ name ][ 0 ].length;
		if ( numMorphTargets === 0 ) continue;

		mergedGeometry.morphAttributes = mergedGeometry.morphAttributes || {};
		mergedGeometry.morphAttributes[ name ] = [];

		for ( let i = 0; i < numMorphTargets; ++ i ) {

			const morphAttributesToMerge = [];

			for ( let j = 0; j < morphAttributes[ name ].length; ++ j ) {

				morphAttributesToMerge.push( morphAttributes[ name ][ j ][ i ] );

			}

			const mergedMorphAttribute = mergeAttributes( morphAttributesToMerge );

			if ( ! mergedMorphAttribute ) {

				console.error( 'THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the ' + name + ' morphAttribute.' );
				return null;

			}

			mergedGeometry.morphAttributes[ name ].push( mergedMorphAttribute );

		}

	}

	return mergedGeometry;

}

/**
 * Merges a set of attributes into a single instance. All attributes must have compatible properties and types.
 * Instances of {@link InterleavedBufferAttribute} are not supported.
 *
 * @param {Array<BufferAttribute>} attributes - The attributes to merge.
 * @return {?BufferAttribute} The merged attribute. Returns `null` if the merge does not succeed.
 */
function mergeAttributes( attributes ) {

	let TypedArray;
	let itemSize;
	let normalized;
	let gpuType = -1;
	let arrayLength = 0;

	for ( let i = 0; i < attributes.length; ++ i ) {

		const attribute = attributes[ i ];

		if ( TypedArray === undefined ) TypedArray = attribute.array.constructor;
		if ( TypedArray !== attribute.array.constructor ) {

			console.error( 'THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes.' );
			return null;

		}

		if ( itemSize === undefined ) itemSize = attribute.itemSize;
		if ( itemSize !== attribute.itemSize ) {

			console.error( 'THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes.' );
			return null;

		}

		if ( normalized === undefined ) normalized = attribute.normalized;
		if ( normalized !== attribute.normalized ) {

			console.error( 'THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes.' );
			return null;

		}

		if ( gpuType === -1 ) gpuType = attribute.gpuType;
		if ( gpuType !== attribute.gpuType ) {

			console.error( 'THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes.' );
			return null;

		}

		arrayLength += attribute.count * itemSize;

	}

	const array = new TypedArray( arrayLength );
	const result = new BufferAttribute( array, itemSize, normalized );
	let offset = 0;

	for ( let i = 0; i < attributes.length; ++ i ) {

		const attribute = attributes[ i ];
		if ( attribute.isInterleavedBufferAttribute ) {

			const tupleOffset = offset / itemSize;
			for ( let j = 0, l = attribute.count; j < l; j ++ ) {

				for ( let c = 0; c < itemSize; c ++ ) {

					const value = attribute.getComponent( j, c );
					result.setComponent( j + tupleOffset, c, value );

				}

			}

		} else {

			array.set( attribute.array, offset );

		}

		offset += attribute.count * itemSize;

	}

	if ( gpuType !== undefined ) {

		result.gpuType = gpuType;

	}

	return result;

}

/**
 * Returns the amount of bytes used by all attributes to represent the geometry.
 *
 * @param {BufferGeometry} geometry - The geometry.
 * @return {number} The estimate bytes used.
 */
function estimateBytesUsed( geometry ) {

	// Return the estimated memory used by this geometry in bytes
	// Calculate using itemSize, count, and BYTES_PER_ELEMENT to account
	// for InterleavedBufferAttributes.
	let mem = 0;
	for ( const name in geometry.attributes ) {

		const attr = geometry.getAttribute( name );
		mem += attr.count * attr.itemSize * attr.array.BYTES_PER_ELEMENT;

	}

	const indices = geometry.getIndex();
	mem += indices ? indices.count * indices.itemSize * indices.array.BYTES_PER_ELEMENT : 0;
	return mem;

}

/**
 * Converts the given geometry to the `TrianglesDrawMode` draw mode, which
 * corresponds to the `gl.TRIANGLES` primitive in WebGL. The conversion only
 * rewrites the index, so the geometry is modified in place and returned.
 *
 * @param {BufferGeometry} geometry - The geometry to convert.
 * @param {number} drawMode - The current draw mode.
 * @return {BufferGeometry} The converted geometry using `TrianglesDrawMode`.
 */
function toTrianglesDrawMode( geometry, drawMode ) {

	if ( drawMode === TrianglesDrawMode ) {

		console.warn( 'THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles.' );
		return geometry;

	}

	if ( drawMode === TriangleFanDrawMode || drawMode === TriangleStripDrawMode ) {

		let index = geometry.getIndex();

		// generate index if not present

		if ( index === null ) {

			const indices = [];

			const position = geometry.getAttribute( 'position' );

			if ( position !== undefined ) {

				for ( let i = 0; i < position.count; i ++ ) {

					indices.push( i );

				}

				geometry.setIndex( indices );
				index = geometry.getIndex();

			} else {

				console.error( 'THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible.' );
				return geometry;

			}

		}

		//

		const numberOfTriangles = index.count - 2;
		const newIndices = [];

		if ( drawMode === TriangleFanDrawMode ) {

			// gl.TRIANGLE_FAN

			for ( let i = 1; i <= numberOfTriangles; i ++ ) {

				newIndices.push( index.getX( 0 ) );
				newIndices.push( index.getX( i ) );
				newIndices.push( index.getX( i + 1 ) );

			}

		} else {

			// gl.TRIANGLE_STRIP

			for ( let i = 0; i < numberOfTriangles; i ++ ) {

				if ( i % 2 === 0 ) {

					newIndices.push( index.getX( i ) );
					newIndices.push( index.getX( i + 1 ) );
					newIndices.push( index.getX( i + 2 ) );

				} else {

					newIndices.push( index.getX( i + 2 ) );
					newIndices.push( index.getX( i + 1 ) );
					newIndices.push( index.getX( i ) );

				}

			}

		}

		if ( ( newIndices.length / 3 ) !== numberOfTriangles ) {

			console.error( 'THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.' );

		}

		// updated indices

		geometry.setIndex( newIndices );
		geometry.clearGroups();

		return geometry;

	} else {

		console.error( 'THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:', drawMode );
		return geometry;

	}

}

// The sun's position for a place, day and hour - the astronomy of the
// viewer's sun study (editor/sun-study.js), on its own so that pages without
// the viewer (the intro, viewer/intro/feature-tour.js) can use it too.
//
// The Astronomical Almanac's low-precision formulas, good to a fraction of a
// degree; dates before 1582 are taken as proleptic Gregorian.

const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;
// The sun's centre this far below the horizon at sunrise and sunset
// (refraction and its radius).
const HORIZON = -0.833;

const pad = (value) => String(value).padStart(2, "0");

function formatSunTime(minutes) {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

// Milliseconds since 1970 (UTC) of a local date and time, `utcOffset` hours
// ahead of UTC. Years below 100 stay themselves (Date.UTC would add 1900).
function sunTimestamp({ year, month, day, minutes, utcOffset = 0 }) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime() + (minutes - utcOffset * 60) * 60000;
}

// Sun position at `timestamp` (ms, UTC) seen from latitude / longitude
// (degrees): elevation above the horizon and azimuth from north, clockwise,
// both in degrees. The Astronomical Almanac's low-precision formulas: the
// mean longitude runs at the tropical rate, so the seasons stay right
// centuries away from J2000.
function solarPosition(timestamp, latitude, longitude) {
  const days = timestamp / DAY_MS - 0.5 + J1970 - J2000;
  const meanLongitude = RAD * (280.46 + 0.9856474 * days);
  const meanAnomaly = RAD * (357.528 + 0.9856003 * days);
  const eclipticLongitude = meanLongitude + RAD * (1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly));
  const obliquity = RAD * (23.439 - 0.0000004 * days);
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude));
  const sidereal = RAD * (280.46061837 + 360.98564736629 * days) + RAD * longitude;
  const hourAngle = sidereal - rightAscension;
  const phi = RAD * latitude;
  const elevation = Math.asin(Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle));
  // From south, westwards; turned to a compass bearing.
  const fromSouth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(phi) - Math.tan(declination) * Math.cos(phi));
  const azimuth = ((fromSouth / RAD + 180) % 360 + 360) % 360;
  return { elevation: elevation / RAD, azimuth };
}

// Sunrise and sunset (minutes of the local day), or null for polar day / night.
function sunriseSunset({ year, month, day, utcOffset, latitude, longitude }) {
  const start = sunTimestamp({ year, month, day, minutes: 0, utcOffset });
  let sunrise = null;
  let sunset = null;
  let previous = solarPosition(start, latitude, longitude).elevation - HORIZON;
  for (let minutes = 2; minutes <= 1440; minutes += 2) {
    const current = solarPosition(start + minutes * 60000, latitude, longitude).elevation - HORIZON;
    if (previous < 0 && current >= 0 && sunrise == null) sunrise = minutes - 2 * (current / (current - previous));
    if (previous >= 0 && current < 0) sunset = minutes - 2 * (current / (current - previous));
    previous = current;
  }
  return { sunrise, sunset };
}

// The shape of a generated building (editor/surroundings-rules.js, a layout's
// `blocks`): its walls and its roof as faces, for the three ways the
// surroundings are drawn - the schematic look (editor/surroundings.js), the
// realistic one (editor/surroundings-realistic.js: the shapes it has no
// detailed version of) and the intro's (viewer/intro/intro-surroundings.js).
// Pure: no three.js.
//
//   writeBlockShape(face, block, { overhang, walls })
//
// calls face(points, kind, outward) for each face: `points` in the block's
// own frame - x along `w`, z along `d`, y up from its foot, metres -
// counter-clockwise seen from outside (from `outward`, a direction in the
// same frame); `kind` "wall", "roof", "under" (a roof's underside) or "gable"
// (a gable's triangle: wall-coloured). The caller turns and places them
// (`angle`, `x`, `z`) and colours them.
//
// Roofs: "gable" (ridge along `ridge`: "w" or "d"), "pyramid" and "onion"
// (drawn as a pyramid here), "hip" (four slopes, the ridge along the long
// side), "cone" (over round walls: `shape: "round"`), "pagoda" (`tiers`
// storeys, each under a wide roof, a finial `roofHeight` high); anything
// else a flat top.

const ROUND_SIDES = 12;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// The points in the right order for `outward`.
function orient(points, outward) {
  const normal = cross(sub(points[1], points[0]), sub(points[points.length - 1], points[0]));
  return dot(normal, outward) < 0 ? [...points].reverse() : points;
}

// A ring of points round the vertical axis at height y.
function ring(radius, y, sides = ROUND_SIDES, turn = 0) {
  return Array.from({ length: sides }, (_item, index) => {
    const angle = turn + (index / sides) * Math.PI * 2;
    return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
  });
}

// Walls between two outlines (bottom and top, the same count of corners).
function band(face, lower, upper, kind) {
  const count = lower.length;
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const mid = [(lower[index][0] + lower[next][0]) / 2, 0, (lower[index][2] + lower[next][2]) / 2];
    face(orient([lower[index], lower[next], upper[next], upper[index]], mid), kind, mid);
  }
}

// A roof from an outline up to a point (a cone, a pyramid), and its
// underside where it overhangs.
function spire(face, outline, apex, under = true) {
  const count = outline.length;
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const mid = [(outline[index][0] + outline[next][0]) / 2, 0, (outline[index][2] + outline[next][2]) / 2];
    face(orient([outline[index], outline[next], apex], [mid[0], 1, mid[2]]), "roof", [mid[0], 1, mid[2]]);
  }
  if (under) face(orient(outline, [0, -1, 0]), "under", [0, -1, 0]);
}

// A roof between two outlines (a frustum), its underside below the lower.
function frustum(face, lower, upper) {
  const count = lower.length;
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const mid = [(lower[index][0] + lower[next][0]) / 2, 0, (lower[index][2] + lower[next][2]) / 2];
    const out = [mid[0], 1, mid[2]];
    face(orient([lower[index], lower[next], upper[next], upper[index]], out), "roof", out);
  }
  face(orient(lower, [0, -1, 0]), "under", [0, -1, 0]);
}

const rect = (hw, hd, y) => [[-hw, y, -hd], [hw, y, -hd], [hw, y, hd], [-hw, y, hd]];

function writeBlockShape(face, block, { overhang = 0, walls = true } = {}) {
  const hw = block.w / 2;
  const hd = block.d / 2;
  const h = block.h;
  const rise = h + (block.roofHeight || 0);
  const o = overhang;

  if (block.roof === "pagoda") {
    // Each storey: a wall a little narrower than the one below, under a
    // roof reaching far out; the finial on top.
    const tiers = Math.max(1, Math.round(block.tiers || 3));
    const storey = h / tiers;
    let top = null;
    for (let tier = 0; tier < tiers; tier += 1) {
      const y0 = tier * storey;
      const wh = Math.min(hw, hd) * (1 - 0.11 * tier);
      const wallTop = y0 + storey * 0.5;
      band(face, rect(wh, wh, y0 - (tier ? 0 : 0.5)), rect(wh, wh, wallTop), "wall");
      const eave = rect(wh * 1.75, wh * 1.75, wallTop - storey * 0.05);
      top = rect(wh * 0.62, wh * 0.62, y0 + storey);
      frustum(face, eave, top);
    }
    spire(face, top, [0, rise, 0], false);
    return;
  }

  if (block.shape === "round") {
    // Round walls under a cone.
    const r = hw;
    band(face, ring(r, -0.5), ring(r, h), "wall");
    spire(face, ring(r + o, h - o * ((block.roofHeight || 1) / r)), [0, rise, 0]);
    return;
  }

  // walls: false - the caller draws a box's walls itself (with its doors
  // and windows), only the roof here.
  if (walls) band(face, rect(hw, hd, -0.5), rect(hw, hd, h), "wall");
  const roof = block.roof;
  if (roof === "pyramid" || roof === "onion") {
    const eave = h - o * ((block.roofHeight || 1) / Math.min(hw, hd));
    spire(face, rect(hw + o, hd + o, eave), [0, rise, 0], o > 0);
  } else if (roof === "hip") {
    // The ridge along the longer side, its ends as far in as the roof is
    // deep (slopes alike on all four sides).
    const alongW = hw >= hd;
    const span = (alongW ? hd : hw) + o;
    const length = (alongW ? hw : hd) + o;
    const eave = h - o * ((block.roofHeight || 1) / Math.max(span - o, 0.1));
    const half = Math.max(0, length - span);
    const P = (along, across, y) => (alongW ? [along, y, across] : [across, y, along]);
    const e = [P(-length, -span, eave), P(length, -span, eave), P(length, span, eave), P(-length, span, eave)];
    const r0 = P(-half, 0, rise);
    const r1 = P(half, 0, rise);
    // The two long slopes, the two hipped ends.
    const sideOut = (hand) => (alongW ? [0, 1, hand] : [hand, 1, 0]);
    const endOut = (hand) => (alongW ? [hand, 1, 0] : [0, 1, hand]);
    face(orient([e[0], e[1], r1, r0], sideOut(-1)), "roof", sideOut(-1));
    face(orient([e[2], e[3], r0, r1], sideOut(1)), "roof", sideOut(1));
    face(orient([e[1], e[2], r1], endOut(1)), "roof", endOut(1));
    face(orient([e[3], e[0], r0], endOut(-1)), "roof", endOut(-1));
    if (o > 0) face(orient(e, [0, -1, 0]), "under", [0, -1, 0]);
  } else if (roof === "gable") {
    const alongW = block.ridge === "w";
    const span = alongW ? hd : hw;
    const length = alongW ? hw : hd;
    const eave = h - o * ((block.roofHeight || 1) / span);
    const reach = length + o * 0.6;
    const P = (along, across, y) => (alongW ? [along, y, across] : [across, y, along]);
    [-1, 1].forEach((hand) => {
      const out = alongW ? [0, 1, hand] : [hand, 1, 0];
      const slope = [P(-reach, hand * (span + o), eave), P(reach, hand * (span + o), eave), P(reach, 0, rise), P(-reach, 0, rise)];
      face(orient(slope, out), "roof", out);
      if (o > 0) face(orient(slope, [0, -1, 0]), "under", [0, -1, 0]);
      const end = alongW ? [hand, 0, 0] : [0, 0, hand];
      face(orient([P(hand * length, -span, h), P(hand * length, span, h), P(hand * length, 0, rise)], end), "gable", end);
    });
  } else {
    face(orient(rect(hw, hd, h), [0, 1, 0]), "roof", [0, 1, 0]);
  }
}

// The roof shapes this module draws that the older writers had not (the
// realistic look draws the others in detail itself).
const NEW_ROOFS = new Set(["hip", "cone", "pagoda"]);
const hasNewShape = (block) => NEW_ROOFS.has(block.roof) || block.shape === "round";

// Generated surroundings: a typical setting around the model - a settlement,
// fields, a forest - worked out from its metadata alone (what it is, its
// century, its region). Pure: no three.js, no viewer. Two steps:
//
//   suggestSurroundings(facts)   metadata -> parameters { kind, period, year,
//                                season, seed, density }, or why not
//   layoutSurroundings(params)   parameters -> a layout in metres around the
//                                model at the origin: blocks (houses, a
//                                church, towers), walls, roads, fields, trees
//
// editor/surroundings.js draws the layout. The same parameters always give
// the same layout (the seed), so a manifest stores the parameters only.
//
// What is generated is a hypothesis about the kind of place, not about this
// place: nothing here knows where a real road ran. It is drawn schematically
// and marked as generated for that reason.
//
// Covered so far: Europe's regions, Japan and West Africa, 900-2025.
// Other periods and regions get no surroundings rather than wrong ones.

// What the model is: a castle (a settlement beside it), a town's building,
// a church or a house (a village round it), a monastery (its precinct, a
// village beyond), a manor house (its park and farm, a village beyond), a
// manor farm (its yard, the manor house at its head), a shtetl's building
// (a market town of timber houses round its square), a port's building (a
// town on the shore, quays and warehouses).
const SURROUNDINGS_KINDS = ["castle", "town", "church", "village", "monastery", "manor", "manor-farm", "shtetl", "port"];
const SURROUNDINGS_PERIODS = ["early-medieval", "medieval", "early-modern", "industrial", "modern", "postwar", "contemporary"];
// Each period's years: from `start`, up to `end` (the last one with it).
// They are also the milestones of the year's slider (the panel): where the
// look changes most.
const SURROUNDINGS_ERAS = [
  { period: "early-medieval", start: 900, end: 1250 },
  { period: "medieval", start: 1250, end: 1550 },
  { period: "early-modern", start: 1550, end: 1800 },
  { period: "industrial", start: 1800, end: 1914 },
  { period: "modern", start: 1914, end: 1945 },
  { period: "postwar", start: 1945, end: 1990 },
  { period: "contemporary", start: 1990, end: 2025 },
];
// The years covered.
const SURROUNDINGS_YEARS = [SURROUNDINGS_ERAS[0].start, SURROUNDINGS_ERAS[SURROUNDINGS_ERAS.length - 1].end];
// The building traditions: Central Europe (timber, brick and stone, steep
// roofs), the Mediterranean (stone and render, low tiled or flat roofs,
// cypresses and olive groves), the North (timber painted red and ochre,
// turf and later tiles, whitewashed churches, spruce and pine), the British
// Isles (stone and brick, thatch and slate, churches with square towers,
// fields in hedgerows), the East beyond the Bug (log houses under thatch,
// wooden churches with onion domes, birch and pine).
// Beyond Europe: Japan (timber under hipped roofs of tiles or thatch,
// temples and pagodas, rice fields, pines and maples) and West Africa, the
// Sahel (round mud houses under conical thatch, flat-roofed mud towns, mud
// mosques with minarets, the savanna's acacias and baobabs) - the same plan
// as Central Europe's, its buildings those of the region (regionaliseLayout).
const SURROUNDINGS_REGIONS = ["central", "mediterranean", "nordic", "british", "eastern", "japanese", "african"];
// Where it snows in winter (the Sahel's "winter" is its dry season).
const surroundingsSnows = (region) => region !== "african";
const SURROUNDINGS_SEASONS = ["spring", "summer", "autumn", "winter"];
// How they are drawn (editor/surroundings.js): plain pale shapes, or with
// the materials, openings, vegetation and haze of the period. Both are
// marked as generated.
const SURROUNDINGS_STYLES = ["schematic", "realistic"];
// What masonry is built of: brick on the northern lowlands (brick Gothic),
// stone in the uplands and mountains to the south.
const SURROUNDINGS_MASONRY = ["brick", "stone"];
const SURROUNDINGS_DEFAULTS = {
  kind: "castle", period: "medieval", year: 1350, season: "summer", seed: 1, density: 0.6, style: "schematic",
  water: true, terrain: "generated", latitude: null, longitude: null, masonry: "brick", region: "central",
  // On the real terrain: what was made later (reservoirs, quarries, heaps,
  // dams) taken away for the years before (surroundings-past-terrain.js).
  pastTerrain: true,
  // People, carts and cars, boats moving through them (the realistic look;
  // surroundings-life.js).
  life: true,
  // Following the 4D timeline's year (editor/surroundings.js): the period
  // and how far the settlement has grown (`growth`, 0-1, of its houses).
  followTimeline: false, growth: 1,
  // GeoJSON of the water as it was, digitised from an old map
  // (editor/surroundings-map.js): used before any map on the real terrain.
  waterUrl: null,
  // GeoJSON of an old map's roads, fields, buildings and walls (with dates)
  // that take the place of the generated ones (surroundings-map.js).
  layoutUrl: null,
  // An old map's tiles draped over the ground: { url ({z}/{x}/{y}),
  // opacity, attribution } (surroundings-terrain.js, loadMapOverlay).
  mapOverlay: null,
};

// Stone or brick for a place: stone south of the Sudetes and the
// Carpathians' foothills, in Bohemia and Moravia, in southern and western
// Germany; brick on the lowlands to the north (Pomerania, Prussia, Greater
// Poland, Masovia, Silesia, Lesser Poland's brick towns). A rough line, said
// so in the reasons.
function surroundingsMasonry(location) {
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return null;
  const { latitude: lat, longitude: lon } = location;
  const region = surroundingsRegion(location);
  if (region === "mediterranean" || region === "nordic" || region === "british") return "stone";
  if (region === "eastern") return "brick";
  if (region === "japanese" || region === "african") return "stone";
  if (lat < 49.6) return "stone";
  if (lat < 50.9 && lon >= 12 && lon <= 17.2) return "stone";
  if (lat < 50.5 && lon < 12) return "stone";
  return "brick";
}

// How far a settlement has grown by a year (0-1 of its houses): from a
// third at the start of its period to all of them at its end.
function surroundingsGrowth(year) {
  if (!Number.isFinite(year)) return 1;
  const [start, end] = year < 1250 ? [900, 1250] : year < 1550 ? [1250, 1550] : year <= 1800 ? [1550, 1800] : year <= 1914 ? [1800, 1914] : year <= 1945 ? [1914, 1945] : year <= 1990 ? [1945, 1990] : [1990, 2025];
  return Math.round((0.35 + 0.65 * smoothstep(start, end, year)) * 20) / 20;
}

// The era of a year: a period's years from its start up to the next's.
function surroundingsEra(year) {
  if (!Number.isFinite(year)) return null;
  const last = SURROUNDINGS_ERAS.length - 1;
  return SURROUNDINGS_ERAS.find((era, index) => year >= era.start && (year < era.end || (index === last && year <= era.end))) || null;
}

// The year's slider gives each period the same width: a century of the
// early Middle Ages and a decade after 1945 change about as much. Its
// position runs 0 - SLIDER_SPAN, each period SLIDER_STEPS of it.
const SURROUNDINGS_SLIDER_STEPS = 100;
const SURROUNDINGS_SLIDER_SPAN = SURROUNDINGS_ERAS.length * SURROUNDINGS_SLIDER_STEPS;

function surroundingsYearToSlider(year) {
  const value = clamp(Number(year), SURROUNDINGS_YEARS[0], SURROUNDINGS_YEARS[1]);
  const era = surroundingsEra(value);
  const index = SURROUNDINGS_ERAS.indexOf(era);
  return Math.round((index + (value - era.start) / (era.end - era.start)) * SURROUNDINGS_SLIDER_STEPS);
}

function surroundingsSliderToYear(position) {
  const value = clamp(Number(position) || 0, 0, SURROUNDINGS_SLIDER_SPAN);
  const index = Math.min(Math.floor(value / SURROUNDINGS_SLIDER_STEPS), SURROUNDINGS_ERAS.length - 1);
  const era = SURROUNDINGS_ERAS[index];
  return Math.round(era.start + ((value - index * SURROUNDINGS_SLIDER_STEPS) / SURROUNDINGS_SLIDER_STEPS) * (era.end - era.start));
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Stems in text made lower case without diacritics (scene-rules.js,
// normalizeSceneText); `=word` only as a whole word. The first kind found,
// in this order, wins: a castle's text often names its town too.
const KIND_WORDS = {
  castle: ["castle", "zamek", "zamk", "=burg", "burgruine", "fortress", "twierdz", "festung", "stronghold", "=grod", "grodzisk", "burgwall", "=keep", "donjon", "warowni"],
  monastery: ["monaster", "klasztor", "kloster", "abbey", "abtei", "opactw", "convent", "konwent", "priory", "przeor", "cistercian", "cysters", "zisterz", "benedykt", "benedictin", "franciszk", "franciscan", "dominikan", "dominican", "bernardyn", "cloister", "wirydarz"],
  port: ["=port", "harbour", "harbor", "=hafen", "hafenstadt", "przystan", "=quay", "nabrzez", "=kai", "lighthouse", "latarnia morsk", "leuchtturm", "shipyard", "stocznia", "werft", "hanseatic", "hanzeat", "=hanse"],
  shtetl: ["shtetl", "sztetl", "schtetl", "synagog", "boznic", "=shul", "yeshiva", "jesziw", "jeschiwa", "kahal", "miasteczk", "jewish quarter", "dzielnica zydowsk"],
  "manor-farm": ["folwark", "vorwerk", "gutshof", "=grange", "granary", "spichlerz", "spichrz", "speicher", "gorzelni", "distillery", "brennerei", "obora", "cowshed", "kuhstall", "stajni", "=stable"],
  manor: ["manor", "=dwor", "dworek", "gutshaus", "herrenhaus", "country house", "landed estate", "ziemiansk", "szlachecki", "palac", "palace", "schloss", "=villa", "=willa"],
  town: ["=town", "=city", "miasto", "miast", "=stadt", "rynek", "marktplatz", "town hall", "ratusz", "rathaus", "kamienic", "tenement", "burgher", "mieszczan", "stadtmauer", "mury miejskie", "cathedral", "katedr", "kathedral"],
  church: ["church", "kosciol", "kosciel", "kirche", "chapel", "kaplic", "kapelle", "cerkiew", "cerkw", "=chiesa", "=iglesia", "=eglise", "=kyrka", "=kirke", "=kirkko", "tserkv", "=khram", "parish"],
  village: ["village", "=wies", "=wsi", "=dorf", "cottage", "chalup", "chata", "farmstead", "zagrod", "gehoft", "=mill", "mlyn", "muhle", "barn", "stodol", "scheune", "=borgo", "=pueblo", "=by", "=gard", "=selo", "derevn", "=hamlet"],
};
// The order the kinds are looked for in: the most particular first (a
// monastery's text names its church, a shtetl's its town).
const KIND_ORDER = ["castle", "monastery", "port", "shtetl", "manor-farm", "manor", "town", "church", "village"];

const KIND_PATTERNS = Object.fromEntries(Object.entries(KIND_WORDS).map(([kind, words]) => [kind, words.map((entry) => {
  const whole = entry.startsWith("=");
  const word = (whole ? entry.slice(1) : entry).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${word}${whole ? "(?![a-z0-9])" : ""}`);
})]));

function findSurroundingsKind(normalizedText) {
  const text = String(normalizedText || "");
  return KIND_ORDER.find((kind) => KIND_PATTERNS[kind].some((pattern) => pattern.test(text))) || null;
}

function surroundingsPeriod(year) {
  return surroundingsEra(year)?.period || null;
}

// The building tradition of a place: the Mediterranean south of the Alps
// and the Balkans' mountains (Iberia, southern France, Italy below the Po,
// the Adriatic's shore, Greece, Anatolia's west, the Levant); Central
// Europe from the Rhine to the Bug, the Alps to the Baltic. Rough lines.
function surroundingsRegion(location) {
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return null;
  const { latitude: lat, longitude: lon } = location;
  // The British Isles: Ireland to East Anglia, Cornwall to Shetland.
  if (lat >= 49.8 && lat <= 61 && lon >= -10.8 && lon <= 1.9) return "british";
  // The North: Norway, Sweden, Finland, the Baltic's northern shore.
  if (lat >= 57 && lat <= 71 && lon >= 4.5 && lon <= 32) return "nordic";
  if (lat >= 34 && lat < 44.6 && lon >= -10 && lon <= 36) return "mediterranean";
  if (lat >= 44.6 && lat < 45.6 && lon >= -2 && lon <= 8.5) return "mediterranean";
  if (lat >= 45 && lat <= 57 && lon >= 5 && lon <= 30) return "central";
  // The East: beyond the Bug's lands, to the Volga's upper reaches.
  if (lat >= 44.6 && lat <= 60 && lon > 30 && lon <= 45) return "eastern";
  // Japan, Kyushu to Hokkaido.
  if (lat >= 30 && lat <= 46 && lon >= 128.5 && lon <= 146) return "japanese";
  // West Africa, the Sahel and the savanna south of it: Senegal to Lake Chad.
  if (lat >= 4 && lat <= 20 && lon >= -18 && lon <= 16) return "african";
  return null;
}

function inSurroundingsRegion(location) {
  return Boolean(surroundingsRegion(location));
}

// FNV-1a, 32 bits.
function surroundingsSeed(text) {
  let hash = 0x811c9dc5;
  const value = String(text || "");
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * The surroundings for a model's facts: { value, reasons, confidence }.
 * `value.enabled` false with the reason where none can be generated.
 *
 *   normalizedText  the texts, normalised (scene-rules.js)
 *   year            { year, source } or null
 *   location        { latitude, longitude } or null
 *   sizeClass       "object" | "large-object" | "building" | "site" | null
 *   season          a season the texts name, or null
 *   unitSource      where the model's unit came from ("default": unknown)
 */
function suggestSurroundings({ normalizedText = "", year = null, location = null, sizeClass = null, season = null, unitSource = null } = {}) {
  const off = (key, extra = {}) => ({ value: { enabled: false }, reasons: [{ key, ...extra }], confidence: 0.7 });
  if (sizeClass !== "building" && sizeClass !== "site") return off("surroundingsSmall");
  const kind = findSurroundingsKind(normalizedText);
  if (!kind) return off("surroundingsNoType");
  if (!year) return off("surroundingsNoYear");
  const period = surroundingsPeriod(year.year);
  if (!period) return off("surroundingsOtherPeriod", { year: year.year });
  if (location && !inSurroundingsRegion(location)) return off("surroundingsOtherRegion");

  const reasons = [
    { key: "surroundingsType", kind },
    { key: "surroundingsPeriod", period, year: year.year },
    { key: "surroundingsTypical" },
  ];
  let confidence = 0.9;
  if (year.source === "century") confidence *= 0.9;
  if (!location) {
    confidence *= 0.8;
    reasons.push({ key: "surroundingsNoPlace" });
  }
  if (location) reasons.push({ key: "surroundingsTerrainReal" });
  const masonry = surroundingsMasonry(location);
  if (masonry) reasons.push({ key: "surroundingsMasonry", masonry });
  if (year.source === "timeline") reasons.push({ key: "surroundingsTimeline" });
  if (kind === "castle") reasons.push({ key: "surroundingsMoat" });
  const region = surroundingsRegion(location) || "central";
  if (region === "mediterranean") reasons.push({ key: "surroundingsMediterranean" });
  else if (region === "nordic") reasons.push({ key: "surroundingsNordic" });
  else if (region === "british") reasons.push({ key: "surroundingsBritish" });
  else if (region === "eastern") reasons.push({ key: "surroundingsEastern" });
  else if (region === "japanese") reasons.push({ key: "surroundingsJapanese" });
  else if (region === "african") reasons.push({ key: "surroundingsAfrican" });
  // The houses are in metres: against a model of an unknown unit their
  // scale is a guess.
  if (unitSource === "default") {
    confidence *= 0.6;
    reasons.push({ key: "surroundingsUnitUnknown" });
  }
  return {
    value: {
      enabled: true,
      kind,
      period,
      year: year.year,
      season: SURROUNDINGS_SEASONS.includes(season) ? season : "summer",
      seed: surroundingsSeed(`${kind}|${year.year}|${normalizedText.slice(0, 400)}`),
      density: SURROUNDINGS_DEFAULTS.density,
      water: true,
      // The real terrain where the place is known.
      ...(location ? { terrain: "real", latitude: location.latitude, longitude: location.longitude } : { terrain: "generated" }),
      masonry: surroundingsMasonry(location) || SURROUNDINGS_DEFAULTS.masonry,
      region,
      // A year from the timeline: the surroundings follow it.
      followTimeline: year.source === "timeline",
      growth: year.source === "timeline" ? surroundingsGrowth(year.year) : 1,
    },
    reasons,
    confidence,
  };
}

// An old map's tiles: a URL with {z}, {x} and {y}; opacity 0-1 (0.85);
// the attribution its licence asks for. Null if not usable.
function normalizeMapOverlay(overlay) {
  if (!overlay || typeof overlay !== "object" || typeof overlay.url !== "string") return null;
  const url = overlay.url.trim();
  if (!["{z}", "{x}", "{y}"].every((part) => url.includes(part))) return null;
  return {
    url,
    opacity: Number.isFinite(overlay.opacity) ? clamp(overlay.opacity, 0, 1) : 0.85,
    attribution: typeof overlay.attribution === "string" ? overlay.attribution.trim() : "",
  };
}

// Parameters as stored: the known keys, valid, the rest defaulted.
function normalizeSurroundings(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const year = Number.isFinite(source.year) ? Math.round(source.year) : SURROUNDINGS_DEFAULTS.year;
  const placed = Number.isFinite(source.latitude) && Math.abs(source.latitude) <= 85
    && Number.isFinite(source.longitude) && Math.abs(source.longitude) <= 180;
  return {
    kind: SURROUNDINGS_KINDS.includes(source.kind) ? source.kind : SURROUNDINGS_DEFAULTS.kind,
    period: SURROUNDINGS_PERIODS.includes(source.period) ? source.period : surroundingsPeriod(year) || SURROUNDINGS_DEFAULTS.period,
    year,
    season: SURROUNDINGS_SEASONS.includes(source.season) ? source.season : SURROUNDINGS_DEFAULTS.season,
    seed: Number.isFinite(source.seed) ? Math.abs(Math.round(source.seed)) >>> 0 : SURROUNDINGS_DEFAULTS.seed,
    density: Number.isFinite(source.density) ? clamp(source.density, 0, 1) : SURROUNDINGS_DEFAULTS.density,
    style: SURROUNDINGS_STYLES.includes(source.style) ? source.style : SURROUNDINGS_DEFAULTS.style,
    water: typeof source.water === "boolean" ? source.water : SURROUNDINGS_DEFAULTS.water,
    terrain: placed && source.terrain === "real" ? "real" : "generated",
    latitude: placed ? source.latitude : null,
    longitude: placed ? source.longitude : null,
    masonry: SURROUNDINGS_MASONRY.includes(source.masonry) ? source.masonry : SURROUNDINGS_DEFAULTS.masonry,
    region: SURROUNDINGS_REGIONS.includes(source.region) ? source.region : SURROUNDINGS_DEFAULTS.region,
    pastTerrain: source.pastTerrain !== false,
    life: source.life !== false,
    followTimeline: source.followTimeline === true,
    growth: Number.isFinite(source.growth) ? clamp(source.growth, 0, 1) : SURROUNDINGS_DEFAULTS.growth,
    waterUrl: typeof source.waterUrl === "string" && source.waterUrl.trim() ? source.waterUrl.trim() : null,
    layoutUrl: typeof source.layoutUrl === "string" && source.layoutUrl.trim() ? source.layoutUrl.trim() : null,
    mapOverlay: normalizeMapOverlay(source.mapOverlay),
  };
}

// ---- the layout -----------------------------------------------------------------

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Value noise on a lattice, 0 to 1.
function surroundingsNoise(seed, x, z) {
  return latticeNoise(seed, x, z);
}

function latticeNoise(seed, x, z) {
  const corner = (ix, iz) => {
    let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iz, 0x165667b1) ^ seed;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = corner(ix, iz) + (corner(ix + 1, iz) - corner(ix, iz)) * sx;
  const b = corner(ix, iz + 1) + (corner(ix + 1, iz + 1) - corner(ix, iz + 1)) * sx;
  return a + (b - a) * sz;
}

// How deep the water's bed lies under the banks, and the water under them.
const WATER_BED = 1.8;
const WATER_LEVEL = 0.55;

// The signed distance of a place to the water's edge, in metres: negative
// in the water; Infinity without water.
function surroundingsWaterDistance(layout, x, z) {
  const water = layout.water;
  if (!water) return Infinity;
  let best = Infinity;
  if (water.river) {
    const { points, width, box } = water.river;
    // Far from the river's box: no need to measure it.
    const outside = Math.max(box[0] - x, x - box[2], box[1] - z, z - box[3], 0);
    best = outside > 200 ? outside : distanceToPolyline(points, x, z) - width / 2;
  }
  if (water.map) best = Math.min(best, water.map.distance(x, z));
  if (water.coast || water.ponds) best = Math.min(best, generatedWaterDistance(water, x, z));
  if (water.moat) {
    const d = Math.hypot(x, z);
    const { inner, outer } = water.moat;
    best = Math.min(best, d < inner ? inner - d : d > outer ? d - outer : -Math.min(d - inner, outer - d));
  }
  return best;
}

// A pond: { x, z, rx, rz, angle }, an ellipse; roughly its signed distance.
function pondDistance(pond, x, z) {
  const cos = Math.cos(-pond.angle);
  const sin = Math.sin(-pond.angle);
  const lx = (x - pond.x) * cos - (z - pond.z) * sin;
  const lz = (x - pond.x) * sin + (z - pond.z) * cos;
  return (Math.hypot(lx / pond.rx, lz / pond.rz) - 1) * Math.min(pond.rx, pond.rz);
}

// The sea's or a lake's shore past a port: { nx, nz, offset, amplitude,
// wave, phase }: the water beyond `offset` metres towards (nx, nz), the
// shore a gentle wave. Positive on land.
function coastDistance(coast, x, z) {
  const along = x * -coast.nz + z * coast.nx;
  const across = x * coast.nx + z * coast.nz;
  return coast.offset + Math.sin((along / coast.wave) * Math.PI * 2 + coast.phase) * coast.amplitude - across;
}

function generatedWaterDistance(water, x, z) {
  let best = water.coast ? coastDistance(water.coast, x, z) : Infinity;
  (water.ponds || []).forEach((pond) => {
    best = Math.min(best, pondDistance(pond, x, z));
  });
  return best;
}

// Water drawn as cells of a grid (surroundings-realistic.js): the real
// water of a map, a port's shore, ponds. Its signed distance, or Infinity.
function surroundingsGridWaterDistance(layout, x, z) {
  const water = layout.water;
  if (!water) return Infinity;
  const map = water.map ? water.map.distance(x, z) : Infinity;
  return water.coast || water.ponds?.length ? Math.min(map, generatedWaterDistance(water, x, z)) : map;
}

function hasSurroundingsGridWater(layout) {
  const water = layout.water;
  return Boolean(water && (water.map || water.coast || water.ponds?.length));
}

// The ground before the water's bed is cut: the real terrain where its
// elevation is known (layout.heightfield), else low generated hills towards
// the rim, lower along a river's valley.
function surroundingsGroundHeight(layout, x, z) {
  if (typeof layout.heightfield === "function") return layout.heightfield(x, z);
  const distance = Math.hypot(x, z);
  let rise = smoothstep(layout.flat, layout.extent, distance);
  if (rise === 0) return 0;
  // Level towards a port's water: the sea is flat.
  const coast = layout.water?.coast;
  if (coast) rise *= smoothstep(10, 160, coastDistance(coast, x, z));
  const river = layout.water?.river;
  if (river) rise *= smoothstep(river.width / 2 + 10, river.width / 2 + 140, surroundingsWaterDistance(layout, x, z) + river.width / 2);
  const scale = layout.extent / 3;
  const noise = latticeNoise(layout.seed, x / scale, z / scale) * 0.7 + latticeNoise(layout.seed + 7, (x / scale) * 2.3, (z / scale) * 2.3) * 0.3;
  return layout.extent * 0.07 * rise * (noise - 0.25);
}

// The ground's height at a place of a layout: flat where things are built,
// low hills towards the rim (or the real terrain), a bed under the water.
function surroundingsTerrainHeight(layout, x, z) {
  const ground = surroundingsGroundHeight(layout, x, z);
  if (!layout.water || (!layout.water.river && !layout.water.moat && !hasSurroundingsGridWater(layout))) return ground;
  const edge = surroundingsWaterDistance(layout, x, z);
  return edge > 5 ? ground : ground - WATER_BED * (1 - smoothstep(-1.5, 5, edge));
}

// The water's surface at a place: below the banks.
function surroundingsWaterLevel(layout, x, z) {
  return surroundingsGroundHeight(layout, x, z) - WATER_LEVEL;
}

function distanceToPolyline(points, x, z) {
  let best = Infinity;
  for (let index = 0; index < points.length - 1; index += 1) {
    const [ax, az] = points[index];
    const [bx, bz] = points[index + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const length = dx * dx + dz * dz || 1;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / length, 0, 1);
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

function insideField(field, x, z, margin = 0) {
  // An old map's field: its own outline.
  if (field.polygon) {
    let inside = false;
    const ring = field.polygon;
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
      const [ax, az] = ring[index];
      const [bx, bz] = ring[previous];
      if ((az > z) !== (bz > z) && x < ax + ((z - az) * (bx - ax)) / (bz - az)) inside = !inside;
    }
    return inside || (margin > 0 && distanceToPolyline([...ring, ring[0]], x, z) < margin);
  }
  const cos = Math.cos(-field.angle);
  const sin = Math.sin(-field.angle);
  const dx = x - field.x;
  const dz = z - field.z;
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  return Math.abs(lx) <= field.w / 2 + margin && Math.abs(lz) <= field.d / 2 + margin;
}

/**
 * The layout of `params` around a model of footprint radius `site.radius`
 * (metres), the model at the origin, x and z across, in metres:
 *
 *   extent, flat, clear   radii: the whole, the flat middle, kept free
 *   blocks   [{ x, z, w, d, h, angle, roof, roofHeight, ridge, role }]
 *            roof: "gable" | "pyramid" | "onion" | "sawtooth" | "none", and in
 *            Japan and West Africa "hip" | "cone" | "pagoda" (regionaliseLayout;
 *            shape "round", tiers); ridge "w" | "d": the side
 *            the ridge runs along; role: "house" | "church" | "tower"
 *   walls    [{ ax, az, bx, bz, h, t, kind }]  kind: "palisade" | "masonry"
 *   roads    [{ points: [[x, z], ...], width }]
 *   fields   [{ x, z, w, d, angle, tone }]  tone 0-2
 *   trees    [{ x, z, r, h, kind }]  kind: "conifer" | "broadleaf"
 *   water    { river: { points, width, box } | null, moat: { inner, outer } | null,
 *            map: the real water (surroundings-map.js, createMapWater) | null }
 *            a moat round a castle; a river past a town or a village
 *            (by the seed; none on the real terrain, whose rivers are not
 *            known here)
 *   bridges  [{ x, z, angle, length, width }]  where a road crosses water
 *
 * `site.mapWater`: the place's real water (on the real terrain): the
 * settlement beside a castle moves to dry land, and nothing is built in it.
 */
function layoutSurroundings(input = {}, site = {}) {
  const params = normalizeSurroundings(input);
  const rng = mulberry32(params.seed);
  const range = (min, max) => min + (max - min) * rng();
  const early = params.period === "early-medieval";
  const kind = params.kind;
  // A port is a town on the shore.
  const town = kind === "town" || kind === "port";
  const port = kind === "port";
  // A market town of timber houses round its square.
  const shtetl = kind === "shtetl";
  const burgher = town && !early;
  // Stone and render, low roofs, narrow streets, cypresses and olives.
  const med = params.region === "mediterranean";
  const nordic = params.region === "nordic";
  const british = params.region === "british";
  const eastern = params.region === "eastern";
  // A monastery's precinct, a manor's park and farm, a manor farm's yard:
  // round the model, the village beyond them.
  const estate = kind === "monastery" ? 50 : kind === "manor" ? 62 : kind === "manor-farm" ? 48 : 0;
  // 1550-1800: taller town houses, a baroque church, bastions.
  const modern = params.period === "early-modern";
  // 1800-1914: tenements, a boulevard where the walls stood, a railway with
  // its station, factories, a neo-Gothic church.
  // (and 1914-1945, which keeps them, with flat-roofed blocks of flats)
  const contemporary = params.period === "contemporary";
  const industrial = params.period === "industrial" || params.period === "modern" || params.period === "postwar" || contemporary;
  // After 1945: housing estates of prefabricated blocks, collective farms
  // (and after 1990 the same, renovated, with more round them).
  const postwar = params.period === "postwar" || contemporary;
  // The war's ruins, until about 1950; the estates from the late 1950s, the
  // collective farms from about 1950.
  const ruins = params.period === "postwar" && params.year <= 1950;
  const estatesBuilt = postwar && params.year >= 1958;
  const collective = postwar && params.year >= 1950;
  // An old map's roads, fields, buildings and walls (in metres, of the
  // year; surroundings-map.js, readMapLayout): they take the place of the
  // generated ones of their kind.
  const mapLayout = site.mapLayout && params.latitude != null ? site.mapLayout : null;
  const mapped = (key) => Boolean(mapLayout?.[key]?.length);

  const radius = clamp(Number(site.radius) || 20, 6, 5000);
  // Nothing generated stands this close to the model.
  const clear = radius * 1.2 + 8;
  // The settlement: a circle of houses along the roads.
  const zoneRadius = town ? 95 + 40 * params.density : shtetl ? 70 + 30 * params.density : 40 + 30 * params.density;
  let direction = rng() * Math.PI * 2;
  // The real water (the real terrain's map, or an old map read): given by
  // the viewer only where it belongs.
  const mapWater = params.water ? site.mapWater || null : null;
  // A castle's settlement on dry land: the first of eight directions round
  // the castle whose middle is clear of the real water.
  if (mapWater && (params.kind === "castle" || estate)) {
    const distance = (radius * 1.2 + 8) + estate + zoneRadius + 12;
    const dry = [0, 1, -1, 2, -2, 3, -3, 4].map((step) => direction + (step * Math.PI) / 4)
      .find((angle) => mapWater.distance(Math.cos(angle) * distance, Math.sin(angle) * distance) > zoneRadius * 0.4);
    if (dry != null) direction = dry;
  }
  const ux = Math.cos(direction);
  const uz = Math.sin(direction);
  // A castle looks down on its settlement, beside it; a church, a house or a
  // town's building stands in the middle of theirs.
  const beside = params.kind === "castle" || estate > 0;
  const zoneDistance = beside ? clear + estate + zoneRadius + 12 : 0;
  const zone = { x: ux * zoneDistance, z: uz * zoneDistance, r: beside ? zoneRadius : zoneRadius + clear };
  const reach = zoneDistance + zone.r;
  // Room for the fields round the settlement before the hills begin.
  const extent = Math.max(260, (reach + 185) / 0.6);
  const flat = extent * 0.6;
  const layout = { params, seed: params.seed, extent, flat, clear, zone, blocks: [], walls: [], roads: [], fields: [], trees: [], water: { river: null, moat: null, map: mapWater, coast: null, ponds: [] }, bridges: [] };

  // A port's shore: the water on one side of the town, the model near it.
  // Numbers of its own (the rest of a layout stays as it was for a seed);
  // not on the real terrain, whose shore the map gives.
  const coastRng = mulberry32((params.seed ^ 0x68e31da4) >>> 0);
  const coastRange = (min, max) => min + (max - min) * coastRng();
  let coast = null;
  if (port && params.water && params.terrain !== "real" && !mapWater) {
    // On the side away from the streets' hub (where the church goes).
    const angle = direction - Math.PI / 2 + coastRange(-0.4, 0.4);
    coast = { nx: Math.cos(angle), nz: Math.sin(angle), offset: clear + coastRange(30, 46), amplitude: coastRange(3, 7), wave: coastRange(160, 260), phase: coastRange(0, Math.PI * 2) };
    layout.water.coast = coast;
  }

  // ---- roads. The first two reach the rim (a wall opens for them).
  const ray = (fromX, fromZ, angle, length, steps = 4) => {
    const points = [[fromX, fromZ]];
    let heading = angle;
    for (let step = 1; step <= steps; step += 1) {
      heading += range(-0.1, 0.1);
      const [x, z] = points[points.length - 1];
      points.push([x + Math.cos(heading) * (length / steps), z + Math.sin(heading) * (length / steps)]);
    }
    return points;
  };
  // Through a place, `back` behind it and `forward` ahead.
  const line = (x, z, angle, back, forward) => [...ray(x, z, angle + Math.PI, back).reverse(), ...ray(x, z, angle, forward).slice(1)];
  const across = direction + Math.PI / 2;
  const vx = Math.cos(across);
  const vz = Math.sin(across);
  const out = extent * 1.05;
  // Where the roads meet: the settlement's middle; beside the model where
  // the model is the middle.
  const pass = clear + 5;
  const hub = beside ? { x: zone.x, z: zone.z } : { x: vx * pass, z: vz * pass };
  if (beside) {
    // From the castle through the settlement and on; a lane across.
    layout.roads.push({ points: line(hub.x, hub.z, direction, zoneDistance - radius, out), width: 4.5 });
    layout.roads.push({ points: line(hub.x, hub.z, across, zone.r * 0.9, out), width: 3.5 });
    layout.roads.push({ points: line(hub.x + ux * zone.r * 0.5, hub.z + uz * zone.r * 0.5, across, zone.r * 0.7, zone.r * 0.7), width: 3 });
  } else if (town) {
    // Streets past the model on every side, a block apart; narrower in the
    // south.
    const inside = zone.r * 0.9;
    const street = med ? 0.7 : 1;
    const block = med ? 36 : 46;
    layout.roads.push({ points: line(hub.x, hub.z, direction, out, out), width: 6 * street });
    layout.roads.push({ points: line(ux * pass, uz * pass, across, out, out), width: 6 * street });
    layout.roads.push({ points: line(-hub.x, -hub.z, direction, inside, inside), width: 4.5 * street });
    layout.roads.push({ points: line(-ux * pass, -uz * pass, across, inside, inside), width: 4.5 * street });
    [1, -1].forEach((hand) => {
      const offset = (pass + block) * hand;
      if (pass + block > inside - 12) return;
      const half = Math.sqrt(inside * inside - offset * offset);
      layout.roads.push({ points: line(vx * offset, vz * offset, direction, half, half), width: 4 * street });
      layout.roads.push({ points: line(ux * offset, uz * offset, across, half, half), width: 4 * street });
    });
  } else if (shtetl) {
    // The market square round the model: houses along its four sides,
    // facing it; a road out of the town from the middle of each side.
    const half = clear + 12 + 8 * params.density;
    const corner = (a, b) => [(ux * a + vx * b) * half, (uz * a + vz * b) * half];
    const corners = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
    const radials = [];
    corners.forEach((start, index) => {
      const end = corners[(index + 1) % 4];
      const mx = (start[0] + end[0]) / 2;
      const mz = (start[1] + end[1]) / 2;
      const heading = Math.atan2(end[1] - start[1], end[0] - start[0]);
      // The houses on the outer side only: the square is open.
      const side = Math.sign(Math.cos(heading + Math.PI / 2) * mx + Math.sin(heading + Math.PI / 2) * mz) || 1;
      layout.roads.push({ points: [start, end], width: 7, side, market: true });
      radials.push({ points: ray(mx, mz, Math.atan2(mz, mx), out), width: 5 });
    });
    layout.roads.push(...radials);
  } else {
    // A road past the church or the house, and one leaving it.
    layout.roads.push({ points: line(hub.x, hub.z, direction, out, out), width: 4.5 });
    layout.roads.push({ points: ray(hub.x, hub.z, across, out), width: 3.5 });
    layout.roads.push({ points: line(-hub.x, -hub.z, direction, zone.r * 0.8, zone.r * 0.8), width: 3 });
  }
  // After 1800 the walls are gone: a boulevard round the old town.
  if (town && industrial) {
    const ring = [];
    for (let step = 0; step <= 48; step += 1) {
      const angle = (step / 48) * Math.PI * 2;
      ring.push([zone.x + Math.cos(angle) * (zone.r + 8), zone.z + Math.sin(angle) * (zone.r + 8)]);
    }
    layout.roads.push({ points: ring, width: 14, boulevard: true });
  }
  // The old map's roads instead.
  if (mapped("roads")) layout.roads = mapLayout.roads.map((road) => ({ points: road.points, width: road.width }));

  // ---- the railway (after 1800): past the settlement, its station on the
  // settlement's side, a road from the station into it. Its own numbers.
  const railRng = mulberry32((params.seed ^ 0x27d4eb2f) >>> 0);
  const railRange = (min, max) => min + (max - min) * railRng();
  layout.railway = null;
  let station = null;
  if (industrial && !mapped("roads")) {
    const side = coast ? Math.atan2(-coast.nz, -coast.nx) + railRange(-0.6, 0.6) : railRange(0, Math.PI * 2);
    const offset = (beside ? zoneDistance + zone.r : zone.r) + railRange(35, 60);
    const nx = Math.cos(side);
    const nz = Math.sin(side);
    const bend = railRange(-0.08, 0.08);
    const points = [];
    for (let along = -extent * 1.3; along <= extent * 1.3 + 1; along += 20) {
      const lateral = offset + bend * (along * along) / extent;
      points.push([zone.x * 0 + nx * lateral - nz * along, nz * lateral + nx * along]);
    }
    if (points.every(([x, z]) => Math.hypot(x, z) > clear + 12)) {
      layout.railway = { points, width: 8 };
      // The station where the line passes nearest the settlement.
      const centre = beside ? zone : { x: 0, z: 0 };
      const nearest = points.reduce((best, point) => (Math.hypot(point[0] - centre.x, point[1] - centre.z) < Math.hypot(best[0] - centre.x, best[1] - centre.z) ? point : best));
      const heading = Math.atan2(nx, -nz);
      const sx = nearest[0] - nx * 18;
      const sz = nearest[1] - nz * 18;
      station = { x: sx, z: sz, w: 36, d: 12, h: 8, angle: heading, roof: "gable", roofHeight: 4, ridge: "w", role: "station" };
      layout.roads.push({ points: [[sx - nx * 8, sz - nz * 8], [hub.x, hub.z]], width: 7 });
    }
  }
  const railFree = (x, z, margin) => !layout.railway || distanceToPolyline(layout.railway.points, x, z) > layout.railway.width / 2 + margin;

  // ---- water: a random number generator of its own, so the rest of a
  // layout stays as it was for a seed.
  const waterRng = mulberry32((params.seed ^ 0x5bd1e995) >>> 0);
  const waterRange = (min, max) => min + (max - min) * waterRng();
  if (params.water) {
    if (params.kind === "castle" && radius < 150) {
      // A moat round the castle; narrower round an early stronghold.
      const inner = radius * 1.03 + 3;
      layout.water.moat = { inner, outer: inner + (early ? 6 : 9) };
    } else if (params.kind !== "castle" && !port && params.terrain !== "real" && !mapWater && waterRng() < (town ? 0.75 : 0.5)) {
      // A river past the model, meandering, from rim to rim.
      const width = town ? waterRange(16, 26) : waterRange(7, 12);
      const angle = waterRange(0, Math.PI);
      const tx = Math.cos(angle);
      const tz = Math.sin(angle);
      const amplitude = waterRange(8, 24);
      const offset = (waterRng() < 0.5 ? -1 : 1) * (clear + width / 2 + 10 + amplitude + waterRange(0, 30));
      const wave = waterRange(160, 260);
      const phase = waterRange(0, Math.PI * 2);
      const points = [];
      for (let along = -extent * 1.4; along <= extent * 1.4 + 1; along += 12) {
        const lateral = offset + Math.sin((along / wave) * Math.PI * 2 + phase) * amplitude;
        points.push([tx * along - tz * lateral, tz * along + tx * lateral]);
      }
      const xs = points.map(([x]) => x);
      const zs = points.map(([, z]) => z);
      layout.water.river = { points, width, box: [Math.min(...xs) - width, Math.min(...zs) - width, Math.max(...xs) + width, Math.max(...zs) + width] };
    }
  }
  // Ponds: a monastery's fishponds beyond its precinct, a manor's in its
  // park. Their own numbers too.
  if (params.water && estate && kind !== "manor-farm") {
    const pondRng = mulberry32((params.seed ^ 0x1b873593) >>> 0);
    const pondRange = (min, max) => min + (max - min) * pondRng();
    const sites = kind === "monastery"
      ? [-1, 1].map((hand) => ({ a: -(clear + estate + 30), b: hand * pondRange(20, 30), rx: pondRange(18, 26), rz: pondRange(11, 15) }))
      : [{ a: -(clear + estate * 0.55), b: pondRange(-14, 14), rx: pondRange(14, 22), rz: pondRange(8, 12) }];
    sites.forEach((site) => {
      const pond = { x: ux * site.a + vx * site.b, z: uz * site.a + vz * site.b, rx: site.rx, rz: site.rz, angle: direction + pondRange(-0.3, 0.3) };
      if (Math.hypot(pond.x, pond.z) - Math.max(pond.rx, pond.rz) > clear + 4) layout.water.ponds.push(pond);
    });
  }
  const wet = (x, z, margin = 0) => surroundingsWaterDistance(layout, x, z) < margin;
  // Where a road meets the water: a bridge where it crosses, steeply
  // enough; a road that would run along the water ends at its bank instead
  // (split in two).
  const riverHeading = (x, z) => {
    if (mapWater) {
      const heading = mapWater.heading(x, z);
      if (heading != null) return heading;
    }
    const points = layout.water.river?.points;
    if (!points) return null;
    let best = 0;
    let bestDistance = Infinity;
    for (let index = 0; index < points.length - 1; index += 1) {
      const distance = Math.hypot(points[index][0] - x, points[index][1] - z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }
    return Math.atan2(points[best + 1][1] - points[best][1], points[best + 1][0] - points[best][0]);
  };
  const split = [];
  layout.roads.forEach((road) => {
    const samples = road.points.flatMap(([x, z], index) => {
      if (index === road.points.length - 1) return [[x, z]];
      const [nx, nz] = road.points[index + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(nx - x, nz - z) / 2));
      return Array.from({ length: steps }, (_item, step) => [x + ((nx - x) * step) / steps, z + ((nz - z) * step) / steps]);
    });
    // A road that never meets the water stays as it is.
    if (!samples.some(([x, z]) => wet(x, z, 1.5))) {
      split.push(road);
      return;
    }
    let piece = [];
    let start = null;
    const finish = () => {
      if (piece.length >= 2) split.push({ ...road, points: piece.filter((_point, index) => index % 4 === 0 || index === piece.length - 1) });
      piece = [];
    };
    samples.forEach(([x, z], index) => {
      const inWater = wet(x, z, 1.5);
      if (inWater && start == null) start = index;
      if (!inWater && start == null) {
        piece.push([x, z]);
        return;
      }
      if (inWater && index < samples.length - 1) return;
      // Out of the water again (or at the road's end): a crossing?
      const [ax, az] = samples[Math.max(start - 1, 0)];
      const [bx, bz] = samples[index];
      const length = Math.hypot(bx - ax, bz - az);
      const heading = Math.atan2(bz - az, bx - ax);
      const along = riverHeading((ax + bx) / 2, (az + bz) / 2);
      const steep = along == null || Math.abs(Math.sin(heading - along)) > 0.6;
      if (inWater || !steep || length >= 70) {
        finish();
      } else {
        if (length > 1) layout.bridges.push({ x: (ax + bx) / 2, z: (az + bz) / 2, angle: heading, length: length + 4, width: road.width + 1.2 });
        for (let fill = start; fill <= index; fill += 1) piece.push(samples[fill]);
      }
      if (!inWater) piece.push([x, z]);
      start = null;
    });
    finish();
  });
  layout.roads = split;
  // A port's quay: a street along the shore, the warehouses on its land side.
  let quay = null;
  if (coast) {
    const points = [];
    const reach = zone.r * 1.15;
    for (let along = -reach; along <= reach + 1; along += 8) {
      const shore = coast.offset + Math.sin((along / coast.wave) * Math.PI * 2 + coast.phase) * coast.amplitude - 9;
      points.push([-coast.nz * along + coast.nx * shore, coast.nx * along + coast.nz * shore]);
    }
    // Not through the model.
    if (points.every(([x, z]) => Math.hypot(x, z) > clear + 4)) {
      quay = { points, width: 8, quay: true, side: -1 };
      layout.roads.push(quay);
    }
  }

  // ---- buildings: what is taken, as circles
  const taken = [];
  const free = (x, z, r) => Math.hypot(x, z) >= clear + r
    && !wet(x, z, r + 3)
    && railFree(x, z, r + 4)
    && taken.every((circle) => Math.hypot(x - circle.x, z - circle.z) >= r + circle.r);
  const take = (x, z, r) => taken.push({ x, z, r });

  // A long building: free along its length (circles along its long side),
  // off the roads; taken if so.
  const place = (block, margin = 1) => {
    const long = Math.max(block.w, block.d);
    const short = Math.min(block.w, block.d);
    const alongW = block.w >= block.d;
    const ax = alongW ? Math.cos(block.angle) : -Math.sin(block.angle);
    const az = alongW ? Math.sin(block.angle) : Math.cos(block.angle);
    const steps = Math.max(1, Math.ceil(long / short));
    const circles = Array.from({ length: steps }, (_item, index) => {
      const t = ((index + 0.5) / steps - 0.5) * (long - short);
      return { x: block.x + ax * t, z: block.z + az * t, r: short / 2 + margin };
    });
    if (!circles.every((circle) => free(circle.x, circle.z, circle.r))) return false;
    if (layout.roads.some((road) => circles.some((circle) => distanceToPolyline(road.points, circle.x, circle.z) < short / 2 + road.width / 2 + 0.5))) return false;
    circles.forEach((circle) => take(circle.x, circle.z, circle.r));
    layout.blocks.push(block);
    return true;
  };
  // In the frame of the model and its settlement: `a` towards the
  // settlement, `b` across.
  const local = (a, b) => [ux * a + vx * b, uz * a + vz * b];
  const tree = (x, z, h, r, treeKind) => {
    if (!free(x, z, Math.min(r, 2))) return;
    take(x, z, 1.2);
    layout.trees.push({ x, z, h, r, kind: treeKind });
  };

  // A farm's yard: long barns on its sides, a cowshed across its far end, a
  // granary; the manor house at its head where the farm is the model's.
  const farmyard = (cx, cz, angle, hx, hz, withManor) => {
    const fu = [Math.cos(angle), Math.sin(angle)];
    const fv = [-Math.sin(angle), Math.cos(angle)];
    const at = (a, b) => [cx + fu[0] * a + fv[0] * b, cz + fu[1] * a + fv[1] * b];
    const roofOf = (span) => (med ? span * 0.25 : postwar ? span * 0.3 : span * 0.55);
    [-1, 1].forEach((hand) => {
      const length = hx * 2 * (hand < 0 ? range(0.7, 0.85) : range(0.5, 0.6));
      const [x, z] = at(hand < 0 ? 0 : hx * 0.3, hand * (hz + 6));
      place({ x, z, w: length, d: 12, h: 4.6, angle, roof: "gable", roofHeight: roofOf(12), ridge: "w", role: "barn" }, 0.5);
    });
    const [gx, gz] = at(-hx * 0.62, hz + 6.5);
    place({ x: gx, z: gz, w: 13, d: 13, h: 8, angle, roof: "pyramid", roofHeight: med ? 2.5 : 6, ridge: "w", role: "granary" }, 0.5);
    const [cx2, cz2] = at(hx + 6.5, 0);
    place({ x: cx2, z: cz2, w: 12, d: hz * 2 * 0.8, h: 4.4, angle, roof: "gable", roofHeight: roofOf(12), ridge: "d", role: "barn" }, 0.5);
    if (withManor) {
      const [mx, mz] = at(-(hx + 9), 0);
      place({ x: mx, z: mz, w: 14, d: Math.min(hz * 2, 28), h: 5, angle, roof: med ? "gable" : "pyramid", roofHeight: med ? 2.5 : 6.5, ridge: "d", role: "manor" }, 0.5);
    }
    // A distillery with its chimney after 1800.
    if (industrial) {
      const [dx, dz] = at(hx * 0.1, -(hz + 26));
      if (place({ x: dx, z: dz, w: 18, d: 11, h: 7, angle, roof: "gable", roofHeight: 4, ridge: "w", role: "factory-hall" }, 0.5)) {
        const [kx, kz] = at(hx * 0.1 + 12, -(hz + 26));
        if (free(kx, kz, 2)) {
          take(kx, kz, 2.2);
          layout.blocks.push({ x: kx, z: kz, w: 2.6, d: 2.6, h: 24, angle, roof: "none", roofHeight: 0, ridge: "w", role: "chimney" });
        }
      }
    }
  };

  // A monastery: its precinct's wall with a gate tower where the road
  // leaves, the cloister's ranges beside the church (the model, when it is
  // the church alone), a granary and a brewery, an orchard.
  if (kind === "monastery" && !mapped("buildings")) {
    const A = clear + estate * 0.8;
    const B = clear + estate * 0.6;
    const ring = [local(-A, -B), local(A, -B), local(A, B), local(-A, B)];
    let gateTower = false;
    ring.forEach(([ax, az], index) => {
      const [bx, bz] = ring[(index + 1) % 4];
      const pieces = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 12));
      for (let piece = 0; piece < pieces; piece += 1) {
        const px = ax + ((bx - ax) * piece) / pieces;
        const pz = az + ((bz - az) * piece) / pieces;
        const qx = ax + ((bx - ax) * (piece + 1)) / pieces;
        const qz = az + ((bz - az) * (piece + 1)) / pieces;
        const mx = (px + qx) / 2;
        const mz = (pz + qz) / 2;
        const gate = layout.roads.some((road) => distanceToPolyline(road.points, mx, mz) < Math.hypot(qx - px, qz - pz) * 0.55);
        if (wet(mx, mz, 4)) continue;
        if (gate) {
          if (!gateTower) {
            gateTower = true;
            layout.blocks.push({ x: mx, z: mz, w: 7, d: 7, h: 10, angle: Math.atan2(qz - pz, qx - px), roof: med ? "gable" : "pyramid", roofHeight: med ? 2 : 5, ridge: "w", role: "tower" });
            take(mx, mz, 4);
          }
          continue;
        }
        layout.walls.push({ ax: px, az: pz, bx: qx, bz: qz, h: 4.5, t: 1.2, kind: "masonry" });
      }
    });
    if (radius < 35) {
      // The cloister's court on one side of the church, ranges round it.
      const court = 11;
      const [cx, cz] = local(0, -(clear + court + 4));
      const roofHeight = med ? 2.2 : 5;
      [[0, -15.5, court * 2 + 18, 9, "w"], [-15.5, 0, 9, court * 2, "d"], [court + 4.5, 0, 9, court * 2, "d"]].forEach(([a, b, w, d, ridge]) => {
        place({ x: cx + ux * a + vx * b, z: cz + uz * a + vz * b, w, d, h: 9, angle: direction, roof: "gable", roofHeight, ridge, role: "cloister" }, 0.2);
      });
    }
    const [gx, gz] = local(A * 0.45, B - 9);
    place({ x: gx, z: gz, w: 16, d: 12, h: 9, angle: direction, roof: med ? "gable" : "pyramid", roofHeight: med ? 2.5 : 6, ridge: "w", role: "granary" }, 0.5);
    const [bx, bz] = local(-A * 0.35, B - 8);
    place({ x: bx, z: bz, w: 24, d: 10, h: 6, angle: direction, roof: "gable", roofHeight: med ? 2 : 4.5, ridge: "w", role: "cloister" }, 0.5);
    // The orchard: rows of fruit trees (olives in the south).
    for (let a = -A + 6; a < -clear * 0.3; a += 7) {
      for (let b = -B + 6; b < B - 5; b += 7) {
        const [x, z] = local(a + range(-0.6, 0.6), b + range(-0.6, 0.6));
        tree(x, z, med ? range(4, 5.5) : range(5, 7), med ? range(2.2, 2.8) : range(2, 2.6), med ? "olive" : "broadleaf");
      }
    }
  }

  // A manor house (the model): an avenue of limes along the drive, its park
  // behind it, its farm beside it.
  if (kind === "manor" && !mapped("buildings")) {
    const drive = layout.roads[0];
    if (drive) {
      for (let along = clear + 4; along < clear + estate + 8; along += 9) {
        [-1, 1].forEach((hand) => {
          const [x, z] = local(along, hand * (drive.width / 2 + 3.2));
          tree(x, z, med ? 14 : 16, med ? 1.5 : 4.2, med ? "cypress" : "broadleaf");
        });
      }
    }
    const [fx, fz] = local(14, clear + 52);
    farmyard(fx, fz, direction, 26, 17, false);
    for (let index = 0; index < 70; index += 1) {
      const angle = direction + Math.PI + range(-1.9, 1.9);
      const distance = clear + range(6, estate + 10);
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      if (wet(x, z, 3)) continue;
      const conifer = rng() < (med ? 0.25 : 0.2);
      const h = conifer ? range(14, 22) : range(12, 20);
      tree(x, z, h, conifer ? h * 0.2 : h * range(0.3, 0.38), conifer ? (med ? "cypress" : "conifer") : "broadleaf");
    }
  }

  // A manor farm: its yard round the model, the manor house at its head,
  // a few park trees behind that.
  if (kind === "manor-farm" && !mapped("buildings")) {
    farmyard(0, 0, direction, clear + 14, clear + 6, true);
    for (let index = 0; index < 24; index += 1) {
      const [x, z] = local(-(clear + 34 + range(0, 30)), range(-30, 30));
      const h = range(12, 18);
      tree(x, z, h, h * 0.33, "broadleaf");
    }
  }

  // After 1945: a housing estate of prefabricated blocks beyond a town's
  // boulevard; a collective farm's long sheds at a village's edge.
  if (postwar && !mapped("buildings")) {
    if ((town || shtetl) && estatesBuilt) {
      const side = direction + Math.PI * 0.7;
      const [ex, ez] = [zone.x + Math.cos(side) * (zone.r + 95), zone.z + Math.sin(side) * (zone.r + 95)];
      const eu = [Math.cos(side), Math.sin(side)];
      const ev = [-Math.sin(side), Math.cos(side)];
      for (let row = -1; row <= 1; row += 1) {
        for (let column = -1; column <= 1; column += 1) {
          const x = ex + eu[0] * row * 34 + ev[0] * column * 82;
          const z = ez + eu[1] * row * 34 + ev[1] * column * 82;
          const tall = (row + column + 3) % 3 === 0;
          place({ x, z, w: range(58, 74), d: 12, h: tall ? 31 : 15, angle: side + Math.PI / 2, roof: "none", roofHeight: 0, ridge: "w", role: "estate", ...(contemporary ? { renovated: true } : {}) }, 3);
        }
      }
    } else if (!town && !shtetl && collective) {
      // Between the roads (the second runs across).
      const side = direction + Math.PI * 0.75;
      const count = 3 + Math.floor(rng() * 2);
      for (let index = 0; index < count; index += 1) {
        const distance = zone.r + 30 + index * 22;
        const [x, z] = [zone.x + Math.cos(side) * distance, zone.z + Math.sin(side) * distance];
        place({ x, z, w: range(50, 66), d: 13, h: 5, angle: side + Math.PI / 2, roof: "gable", roofHeight: 2.6, ridge: "w", role: "farm" }, 2);
      }
    }
  }

  // A port's warehouses along the quay, gable to it; piers into the water.
  if (quay && !mapped("buildings")) {
    const points = quay.points;
    for (let index = 0; index < points.length - 1; index += 2) {
      const [ax, az] = points[index];
      const [bx, bz] = points[Math.min(index + 2, points.length - 1)];
      const heading = Math.atan2(bz - az, bx - ax);
      const w = range(11, 15);
      const d = range(16, 22);
      const back = 4 + d / 2 + 0.5;
      const x = (ax + bx) / 2 - coast.nx * back;
      const z = (az + bz) / 2 - coast.nz * back;
      if (rng() < 0.25) continue;
      place({ x, z, w, d, h: med ? range(8, 11) : range(11, 16), angle: heading, roof: "gable", roofHeight: med ? 2.5 : w * 0.85, ridge: "d", role: "warehouse" }, 0.3);
    }
    const piers = 3 + Math.floor(rng() * 2);
    for (let index = 0; index < piers; index += 1) {
      const along = ((index + 0.5) / piers - 0.5) * zone.r * 1.6;
      const shore = coast.offset + Math.sin((along / coast.wave) * Math.PI * 2 + coast.phase) * coast.amplitude;
      const length = range(30, 50);
      const mid = shore + length / 2 - 4;
      const x = -coast.nz * along + coast.nx * mid;
      const z = coast.nx * along + coast.nz * mid;
      layout.bridges.push({ x, z, angle: Math.atan2(coast.nz, coast.nx), length, width: 5, pier: true });
    }
  }

  // The old map's buildings, as they stood.
  if (mapped("buildings")) {
    mapLayout.buildings.forEach((building) => {
      if (Math.hypot(building.x, building.z) < clear * 0.8) return;
      take(building.x, building.z, Math.min(building.w, building.d) / 2);
      layout.blocks.push({ ...building });
    });
  }
  // The station, and factories with their chimneys along the line.
  if (station && free(station.x, station.z, 8)) {
    take(station.x, station.z, 10);
    layout.blocks.push(station);
    if (town) {
      const [nx, nz] = [Math.cos(station.angle), Math.sin(station.angle)];
      const toward = [Math.sin(station.angle), -Math.cos(station.angle)];
      const count = 2 + Math.floor(railRng() * 3);
      for (let index = 0; index < count; index += 1) {
        const along = (index % 2 ? 1 : -1) * railRange(70, 200);
        const w = railRange(40, 60);
        const d = railRange(18, 26);
        const fx = station.x + nx * along - toward[0] * railRange(-6, 6) - toward[0] * 14;
        const fz = station.z + nz * along - toward[1] * railRange(-6, 6) - toward[1] * 14;
        const chimney = railRange(28, 40);
        if (!free(fx, fz, d / 2 + 2)) continue;
        take(fx, fz, Math.min(w, d) / 2 + 2);
        layout.blocks.push({ x: fx, z: fz, w, d, h: 9, angle: station.angle, roof: "sawtooth", roofHeight: 3.5, ridge: "w", role: "factory" });
        const cx = fx + nx * (w / 2 + 4);
        const cz = fz + nz * (w / 2 + 4);
        if (free(cx, cz, 2)) {
          take(cx, cz, 2.5);
          layout.blocks.push({ x: cx, z: cz, w: 3.2, d: 3.2, h: chimney, angle: station.angle, roof: "none", roofHeight: 0, ridge: "w", role: "chimney" });
        }
      }
    }
  }

  // A church for the settlement, unless the model is one: by the hub, off
  // the road. Timber and small before the mid 13th century.
  // In the south a low roof, and the bell tower standing beside the nave.
  if (params.kind !== "church" && kind !== "monastery" && !mapped("buildings") && med && !early) {
    const angle = direction + range(-0.2, 0.2);
    const nave = modern ? { w: 11, d: 24, h: 12 } : industrial ? { w: 13, d: 30, h: 15 } : { w: 9, d: 19, h: 8 };
    {
      const r = nave.d / 2 + 8;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const side2 = attempt % 2 ? 1 : -1;
        const distance = 14 + attempt * 4;
        const x = hub.x + vx * distance * side2 + ux * range(8, 24);
        const z = hub.z + vz * distance * side2 + uz * range(8, 24);
        if (!free(x, z, r) || layout.roads.some((road) => distanceToPolyline(road.points, x, z) < nave.w / 2 + road.width)) continue;
        take(x, z, r);
        layout.blocks.push({ x, z, ...nave, angle, roof: "gable", roofHeight: nave.w * 0.28, ridge: "d", role: "church" });
        const bx = x + Math.cos(angle) * (nave.w / 2 + 4) + Math.sin(angle) * (nave.d * 0.25);
        const bz = z + Math.sin(angle) * (nave.w / 2 + 4) - Math.cos(angle) * (nave.d * 0.25);
        layout.blocks.push({ x: bx, z: bz, w: 5.5, d: 5.5, h: modern || industrial ? 30 : 24, angle, roof: "pyramid", roofHeight: 3, ridge: "d", role: "campanile" });
        break;
      }
    }
  }
  if (params.kind !== "church" && kind !== "monastery" && !mapped("buildings") && !(med && !early)) {
    const angle = direction + range(-0.2, 0.2);
    const nave = early ? { w: 6, d: 11, h: 4.5 } : modern ? { w: 11, d: 24, h: 12 } : industrial ? { w: 13, d: 30, h: 15 } : { w: 9, d: 19, h: 8 };
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const side2 = attempt % 2 ? 1 : -1;
      const distance = 14 + attempt * 4;
      const x = hub.x + vx * distance * side2 + ux * range(8, 24);
      const z = hub.z + vz * distance * side2 + uz * range(8, 24);
      const r = nave.d / 2 + 6;
      if (!free(x, z, r) || layout.roads.some((road) => distanceToPolyline(road.points, x, z) < nave.w / 2 + road.width)) continue;
      take(x, z, r);
      layout.blocks.push({ x, z, ...nave, angle, roof: "gable", roofHeight: nave.w * 0.75, ridge: "d", role: "church" });
      if (!early) {
        // The tower at the west end.
        const tx = x + Math.sin(angle) * (nave.d / 2 + 2.5);
        const tz = z - Math.cos(angle) * (nave.d / 2 + 2.5);
        // A baroque tower: taller, under an onion dome.
        // A neo-Gothic one after 1800: a tall, slender spire.
        layout.blocks.push(eastern
          // An Orthodox church: the bell tower under an onion dome.
          ? { x: tx, z: tz, w: 6, d: 6, h: modern || industrial ? 24 : 16, angle, roof: "onion", roofHeight: 9, ridge: "d", role: "church" }
          : nordic
            // A tall, slender spire over a whitewashed tower.
            ? { x: tx, z: tz, w: 6, d: 6, h: industrial ? 24 : 18, angle, roof: "pyramid", roofHeight: 16, ridge: "d", role: "church" }
          : british
            // A square tower, its top flat behind a parapet.
            ? { x: tx, z: tz, w: 6.5, d: 6.5, h: industrial ? 24 : 20, angle, roof: "none", roofHeight: 0, ridge: "d", role: "church" }
            : modern
          ? { x: tx, z: tz, w: 7, d: 7, h: 28, angle, roof: "onion", roofHeight: 12, ridge: "d", role: "church" }
          : industrial
            ? { x: tx, z: tz, w: 7, d: 7, h: 36, angle, roof: "pyramid", roofHeight: 26, ridge: "d", role: "church" }
            : { x: tx, z: tz, w: 5.5, d: 5.5, h: 17, angle, roof: "pyramid", roofHeight: 7, ridge: "d", role: "church" });
      }
      break;
    }
  }

  // Houses along the roads, both sides, thinning towards the zone's edge.
  const candidates = [];
  layout.roads.forEach((road, roadIndex) => {
    const points = road.points;
    for (let index = 0; index < points.length - 1; index += 1) {
      const [ax, az] = points[index];
      const [bx, bz] = points[index + 1];
      const length = Math.hypot(bx - ax, bz - az);
      const heading = Math.atan2(bz - az, bx - ax);
      let at = range(0, 4);
      while (at < length) {
        // A shtetl's square: narrow timber houses side by side.
        const market = road.market === true;
        // Blocks of flats: every lot between the wars; after 1945 some, the
        // old town's tenements standing between them (the estates outside).
        // (none new until the mid-1950s: the ruins first)
        const flats = burgher && (params.period === "modern" || (postwar && rng() < 0.4 && params.year >= 1955));
        // British terraces after 1800: narrow lots, one house against the next.
        const terrace = british && burgher && industrial && !flats;
        const lot = market ? range(8, 10) : town ? (flats ? range(22, 32) : terrace ? range(5.5, 6.5) : industrial ? range(12, 18) : med ? range(5, 8) : range(6, 9)) : shtetl ? range(8, 11) : range(8, 12);
        const px = ax + Math.cos(heading) * (at + lot / 2);
        const pz = az + Math.sin(heading) * (at + lot / 2);
        at += lot;
        const fromZone = Math.hypot(px - zone.x, pz - zone.z) / zone.r;
        if (fromZone > 1) continue;
        // The quay's land side has its warehouses.
        if (road.quay) continue;
        for (const hand of road.side ? [road.side] : [-1, 1]) {
          // All of a house's numbers first, so the same lot gets the same
          // house however many stand (growth: the settlement grows by
          // adding houses, not by moving them).
          const roll = rng();
          const w = town || market ? (terrace ? lot - range(0, 0.1) : lot - range(0.5, 1.5)) : british || nordic ? range(7, 10) : range(5, 8);
          const d = market ? range(10, 13) : burgher ? (flats ? range(12, 14) : terrace ? range(9, 10) : industrial ? range(14, 18) : modern ? range(12, 16) : range(10, 15))
            : med ? range(6, 8) : british ? range(5, 6.5) : nordic ? range(5.5, 7) : eastern ? range(8, 11) : range(7, 11);
          const h = market ? (industrial ? range(5.5, 7.5) : range(3.2, 4.4))
            : burgher ? (flats ? range(15, 21) : terrace ? range(7, 8.5) : industrial ? range(12, 16) : med ? range(7, 11) : nordic ? range(6, 8) : modern ? range(8, 12) : range(5, 8.5))
              : med ? range(3.5, 6.5) : nordic ? range(3.5, 5) : british ? range(2.8, 3.8) : early ? range(2.2, 3) : range(2.6, 4);
          const setback = road.width / 2 + range(1, town || market ? 2 : 5) + d / 2;
          const turn = range(-0.06, 0.06);
          const pitch = range(0.6, 0.85);
          // In the south some roofs are flat terraces.
          const flatRoof = med && rng() < (burgher ? 0.25 : 0.3);
          // Just after the war: a share of the houses burnt-out shells, more
          // in a town (by the place, not the numbers: the rest stays).
          const ruined = ruins && Math.abs(Math.sin(px * 12.9898 + pz * 78.233 + hand) * 43758.5453) % 1 < (town ? 0.45 : 0.2);
          // Fewer towards the edge, fewer on the lesser roads; the share
          // built by the year (growth).
          const chance = (town || market ? 0.95 : shtetl ? 0.85 : 0.6 + 0.4 * params.density) * (market ? 1 : 1 - smoothstep(0.7, 1, fromZone)) * (roadIndex > 1 && !market ? 0.85 : 1);
          // Deep, tall houses gable to the street only in a chartered town.
          const x = px + Math.cos(heading + Math.PI / 2) * setback * hand;
          const z = pz + Math.sin(heading + Math.PI / 2) * setback * hand;
          candidates.push({
            order: roll / Math.max(chance, 1e-6),
            road,
            x, z,
            r: Math.min(w, d) / 2 + (town || market ? 0.2 : 1.5),
            // The front (w) to the road. A town's houses turn their gables
            // to the street; a village's their eaves.
            block: {
              x, z, w, d, h: ruined ? h * 0.65 : h,
              angle: heading + turn,
              // A block of flats after 1914: flat; in the south a terrace.
              roof: flats || flatRoof || ruined ? "none" : "gable",
              // A tenement's low roof along the street; in the south a low
              // tiled roof, its eaves to the street.
              roofHeight: med ? d * 0.14 : terrace ? d * 0.28 : industrial && burgher ? d * 0.18 : market ? w * 0.95 : (burgher ? w : Math.min(w, d)) * pitch,
              // Gable to the street: a chartered town's house, a shtetl's on
              // its square, an eastern village's; eaves to it in the south,
              // the North and a British town.
              ridge: (burgher && !industrial && !med && !nordic && !british) || market || (eastern && !burgher) ? "d" : "w",
              ...(ruined ? { ruin: true } : {}),
              role: "house",
              ...(market ? { market: true } : {}),
            },
          });
        }
      }
    }
  });
  // Built in a fixed order (the lot's own number against its chance), as
  // many as the growth allows: a house standing at a lower growth stands at
  // a higher one too, never pushed out by one built later.
  candidates.sort((a, b) => a.order - b.order);
  candidates.forEach(({ order, road, x, z, r, block }) => {
    if (order > params.growth || mapped("buildings")) return;
    if (!free(x, z, r)) return;
    if (layout.roads.some((other) => other !== road && distanceToPolyline(other.points, x, z) < Math.max(block.w, block.d) / 2 + other.width / 2)) return;
    take(x, z, r);
    layout.blocks.push(block);
  });

  // After 1990: detached houses along the roads beyond the old edge; a shop
  // with its car park out of town, on the main road.
  if (contemporary && !mapped("buildings")) {
    const villaRng = mulberry32((params.seed ^ 0x2545f491) >>> 0);
    const villaRange = (min, max) => min + (max - min) * villaRng();
    layout.roads.forEach((road) => {
      if (road.market || road.quay || road.boulevard) return;
      // Every 20 m along the road (its pieces are short).
      const points = road.points;
      let next = 8;
      let walked = 0;
      for (let index = 0; index < points.length - 1; index += 1) {
        const [ax, az] = points[index];
        const [bx, bz] = points[index + 1];
        const length = Math.hypot(bx - ax, bz - az);
        const heading = Math.atan2(bz - az, bx - ax);
        for (; next < walked + length; next += 20) {
          const at = next - walked;
          const px = ax + Math.cos(heading) * at;
          const pz = az + Math.sin(heading) * at;
          const fromZone = Math.hypot(px - zone.x, pz - zone.z) / zone.r;
          if (fromZone < 1.04 || fromZone > 1.75) continue;
          [-1, 1].forEach((hand) => {
            if (villaRng() > 0.55) return;
            const out = road.width / 2 + 10;
            const x = px + Math.cos(heading + Math.PI / 2) * out * hand;
            const z = pz + Math.sin(heading + Math.PI / 2) * out * hand;
            place({ x, z, w: villaRange(9, 12), d: villaRange(8, 10), h: villaRange(5.5, 7), angle: heading, roof: "pyramid", roofHeight: villaRange(2, 3), ridge: "w", role: "villa" }, 1.5);
          });
        }
        walked += length;
      }
    });
    const main = layout.roads[0]?.points;
    if (main && !shtetl && kind !== "village" && kind !== "church") {
      const wanted = zone.r + 130;
      const spot = main.find(([x, z]) => Math.hypot(x - zone.x, z - zone.z) >= wanted);
      const next = spot && main[main.indexOf(spot) + 1];
      if (spot && next) {
        const heading = Math.atan2(next[1] - spot[1], next[0] - spot[0]);
        const nx = -Math.sin(heading);
        const nz = Math.cos(heading);
        const store = { x: spot[0] + nx * 62, z: spot[1] + nz * 62, w: 72, d: 46, h: 8, angle: heading, roof: "none", roofHeight: 0, ridge: "w", role: "store" };
        if (place(store, 2)) layout.fields.push({ x: spot[0] + nx * 22, z: spot[1] + nz * 22, w: 66, d: 26, angle: heading, tone: 0, parking: true });
      }
    }
  }

  // ---- a wall: a town's ring with towers; a palisade round an early
  // town or the settlement below a stronghold; after 1550 a town's ring of
  // earthen ramparts with bastions. Open where a road or the water passes.
  if (mapped("walls")) {
    mapLayout.walls.forEach((wall) => {
      for (let index = 0; index < wall.points.length - 1; index += 1) {
        const [ax, az] = wall.points[index];
        const [bx, bz] = wall.points[index + 1];
        const kind = wall.kind;
        layout.walls.push({ ax, az, bx, bz, h: kind === "palisade" ? 3.6 : kind === "rampart" ? 6 : 7, t: kind === "palisade" ? 0.5 : kind === "rampart" ? 10 : 1.6, kind });
      }
    });
  } else if (mapped("roads") || mapped("buildings") || industrial) ; else if (town && modern) {
    const ringRadius = zone.r + 26;
    const bastions = 6 + Math.floor(rng() * 2);
    const start = rng() * Math.PI * 2;
    const spread = 0.13;
    const at = (radius, angle) => [zone.x + Math.cos(angle) * radius, zone.z + Math.sin(angle) * radius];
    // Round the ring: each bastion's left shoulder, its point, its right
    // shoulder; the curtain to the next.
    const trace = [];
    for (let index = 0; index < bastions; index += 1) {
      const angle = start + (index / bastions) * Math.PI * 2;
      trace.push(at(ringRadius, angle - spread), at(ringRadius + 22, angle), at(ringRadius, angle + spread));
    }
    trace.forEach(([ax, az], index) => {
      const [bx, bz] = trace[(index + 1) % trace.length];
      const length = Math.hypot(bx - ax, bz - az);
      // Curtains long, with room for a gate; split so a road opens a part.
      const pieces = Math.max(1, Math.round(length / 24));
      for (let piece = 0; piece < pieces; piece += 1) {
        const px = ax + ((bx - ax) * piece) / pieces;
        const pz = az + ((bz - az) * piece) / pieces;
        const qx = ax + ((bx - ax) * (piece + 1)) / pieces;
        const qz = az + ((bz - az) * (piece + 1)) / pieces;
        const mx = (px + qx) / 2;
        const mz = (pz + qz) / 2;
        const gate = layout.roads.slice(0, 2).some((road) => distanceToPolyline(road.points, mx, mz) < (length / pieces) * 0.55);
        if (gate || Math.hypot(mx, mz) < clear || wet(mx, mz, length / pieces / 2 + 4)) continue;
        layout.walls.push({ ax: px, az: pz, bx: qx, bz: qz, h: 6, t: 10, kind: "rampart" });
      }
    });
  } else if (town || (early && kind === "castle")) {
    const masonry = town && !early;
    const ringRadius = zone.r + (masonry ? 14 : 9);
    const segments = 30;
    const start = rng() * Math.PI * 2;
    const ring = Array.from({ length: segments }, (_item, index) => {
      const angle = start + (index / segments) * Math.PI * 2;
      const r = ringRadius * (1 + 0.05 * Math.sin(angle * 3 + start) + range(-0.02, 0.02));
      return [zone.x + Math.cos(angle) * r, zone.z + Math.sin(angle) * r];
    });
    ring.forEach(([ax, az], index) => {
      const [bx, bz] = ring[(index + 1) % segments];
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      const gate = layout.roads.slice(0, 2).some((road) => distanceToPolyline(road.points, mx, mz) < Math.hypot(bx - ax, bz - az) * 0.55);
      // Not through the model; open where the river passes (a water gate).
      if (Math.hypot(mx, mz) < clear || wet(mx, mz, Math.hypot(bx - ax, bz - az) / 2 + 2)) return;
      if (!gate) layout.walls.push({ ax, az, bx, bz, h: masonry ? 7 : 3.6, t: masonry ? 1.6 : 0.5, kind: masonry ? "masonry" : "palisade" });
      if (masonry && (gate || index % 4 === 0)) {
        layout.blocks.push({ x: ax, z: az, w: 6, d: 6, h: gate ? 13 : 10, angle: Math.atan2(bz - az, bx - ax), roof: "pyramid", roofHeight: 4.5, ridge: "d", role: "tower" });
      }
    });
  }

  // ---- fields: bundles of long strips beyond the settlement (or the old
  // map's)
  if (mapped("fields")) mapLayout.fields.forEach((field) => layout.fields.push({ ...field }));
  const bundles = mapped("fields") ? 0 : (nordic ? 2 : 3) + Math.floor(rng() * 3);
  for (let bundle = 0; bundle < bundles; bundle += 1) {
    const angle = direction + ((bundle + range(0.1, 0.9)) / bundles) * Math.PI * 2;
    const length = range(80, 140);
    const distance = zone.r + 15 + length / 2 + range(0, 25);
    const cx = zone.x + Math.cos(angle) * distance;
    const cz = zone.z + Math.sin(angle) * distance;
    const strips = 4 + Math.floor(rng() * 5);
    const stripWidth = range(8, 13);
    // Not over a precinct, a park or a farmyard.
    const nearEstate = (x, z) => estate > 0 && Math.hypot(x, z) < clear + estate + 30;
    // After 1945 the strips are ploughed together: one wide field.
    if (postwar) {
      const along = [-length / 2, 0, length / 2].map((t) => [cx + Math.cos(angle) * t, cz + Math.sin(angle) * t]);
      const wide = strips * stripWidth;
      if (Math.hypot(cx, cz) >= clear + length / 2 && !along.some(([x, z]) => wet(x, z, wide / 2 + 4) || !railFree(x, z, wide / 2 + 3) || nearEstate(x, z))) {
        layout.fields.push({ x: cx, z: cz, w: length * 1.1, d: wide, angle, tone: bundle % 3 });
      }
      continue;
    }
    // The British Isles after the enclosures (about 1750): the strips made
    // into wider fields, hedgerows with trees round them.
    if (british && params.year >= 1750) {
      const wide = stripWidth * 2.6;
      const count = Math.max(1, Math.round((strips * stripWidth) / wide));
      for (let index = 0; index < count; index += 1) {
        const shift = (index - (count - 1) / 2) * wide;
        const x = cx + Math.cos(angle + Math.PI / 2) * shift;
        const z = cz + Math.sin(angle + Math.PI / 2) * shift;
        const ends = [-length / 2, 0, length / 2].map((t) => [x + Math.cos(angle) * t, z + Math.sin(angle) * t]);
        if (Math.hypot(x, z) < clear + length / 2 || ends.some(([ex, ez]) => wet(ex, ez, wide / 2 + 3) || !railFree(ex, ez, wide / 2 + 3) || nearEstate(ex, ez))) continue;
        layout.fields.push({ x, z, w: length, d: wide - 3, angle, tone: (index + bundle) % 3 });
        // The hedge along one long side, with a tree now and then.
        for (let t = -length / 2; t <= length / 2; t += 9) {
          const hx = x + Math.cos(angle) * t + Math.cos(angle + Math.PI / 2) * (wide / 2);
          const hz = z + Math.sin(angle) * t + Math.sin(angle + Math.PI / 2) * (wide / 2);
          if (wet(hx, hz, 3) || taken.some((circle) => Math.hypot(hx - circle.x, hz - circle.z) < circle.r + 2)) continue;
          if (layout.roads.some((road) => distanceToPolyline(road.points, hx, hz) < road.width / 2 + 2)) continue;
          const tall = Math.abs(Math.sin(hx * 3.1 + hz * 7.7)) < 0.25;
          layout.trees.push({ x: hx, z: hz, h: tall ? 11 : 3.2, r: tall ? 3.6 : 2.2, kind: "broadleaf" });
        }
      }
      continue;
    }
    // In the south every other bundle an olive grove: trees in rows.
    if (med && bundle % 2 === 0) {
      for (let row = 0; row < strips * 1.4; row += 1) {
        const shift = (row - (strips * 1.4 - 1) / 2) * 7.5;
        for (let along = -length / 2; along <= length / 2; along += 8) {
          const x = cx + Math.cos(angle) * along + Math.cos(angle + Math.PI / 2) * shift;
          const z = cz + Math.sin(angle) * along + Math.sin(angle + Math.PI / 2) * shift;
          if (Math.hypot(x, z) < clear + 6 || wet(x, z, 4) || !railFree(x, z, 4) || nearEstate(x, z)) continue;
          if (layout.roads.some((road) => distanceToPolyline(road.points, x, z) < road.width / 2 + 3)) continue;
          if (taken.some((circle) => Math.hypot(x - circle.x, z - circle.z) < circle.r + 2)) continue;
          const h = range(3.6, 5.2);
          layout.trees.push({ x, z, h, r: h * range(0.5, 0.62), kind: "olive" });
        }
      }
      continue;
    }
    // The strips run away from the middle, side by side.
    for (let strip = 0; strip < strips; strip += 1) {
      const shift = (strip - (strips - 1) / 2) * stripWidth;
      const x = cx + Math.cos(angle + Math.PI / 2) * shift;
      const z = cz + Math.sin(angle + Math.PI / 2) * shift;
      if (Math.hypot(x, z) < clear + length / 2) continue;
      const half = (length / 2) * 0.95;
      if ([-half, 0, half].some((along) => wet(x + Math.cos(angle) * along, z + Math.sin(angle) * along, stripWidth / 2 + 4))) continue;
      if ([-half, 0, half].some((along) => !railFree(x + Math.cos(angle) * along, z + Math.sin(angle) * along, stripWidth / 2 + 3))) continue;
      if ([-half, 0, half].some((along) => nearEstate(x + Math.cos(angle) * along, z + Math.sin(angle) * along))) continue;
      layout.fields.push({ x, z, w: length * range(0.85, 1), d: stripWidth - 0.6, angle, tone: (strip + bundle) % 3 });
    }
  }

  // ---- trees: a forest in clumps towards the rim, clear of roads and fields
  // More wood in the North, less in the British Isles' farmland.
  const wanted = Math.round(clamp((extent * extent) / 160, 300, 1400) * (nordic ? 1.3 : british ? 0.6 : 1));
  const clumpScale = extent / 4;
  for (let attempt = 0; attempt < wanted * 8 && layout.trees.length < wanted; attempt += 1) {
    const distance = Math.sqrt(range(0.08, 1.2)) * extent;
    const angle = rng() * Math.PI * 2;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const share = distance / extent;
    const clump = latticeNoise(params.seed + 3, x / clumpScale, z / clumpScale);
    if (rng() > smoothstep(0.3, 0.75, share) * smoothstep(0.3, 0.6, clump) + 0.02) continue;
    if (distance < clear + 6 || Math.hypot(x - zone.x, z - zone.z) < zone.r + 16) continue;
    if (layout.roads.some((road) => distanceToPolyline(road.points, x, z) < road.width / 2 + 5)) continue;
    if (layout.fields.some((field) => insideField(field, x, z, 3))) continue;
    if (wet(x, z, 4) || !railFree(x, z, 5)) continue;
    if (estate && Math.hypot(x, z) < clear + estate + 12) continue;
    // In the south a thinner wood: holm oaks, pines, a cypress here and there.
    if (med) {
      if (rng() < 0.35) continue;
      const pick = rng();
      if (pick < 0.15) {
        const h = range(10, 16);
        layout.trees.push({ x, z, h, r: h * range(0.09, 0.12), kind: "cypress" });
      } else {
        const pine = pick < 0.45;
        const h = pine ? range(10, 16) : range(6, 11);
        layout.trees.push({ x, z, h, r: h * (pine ? range(0.3, 0.4) : range(0.34, 0.42)), kind: "broadleaf" });
      }
      continue;
    }
    // Spruce and pine in the North, birch and pine in the East, oak, ash and
    // beech in the British Isles.
    const conifer = rng() < (nordic ? 0.75 : eastern ? 0.45 : british ? 0.12 : 0.35);
    const h = conifer ? range(11, 19) : range(8, 15);
    layout.trees.push({ x, z, h, r: conifer ? h * range(0.16, 0.22) : h * range(0.28, 0.38), kind: conifer ? "conifer" : "broadleaf" });
  }
  // An avenue along the boulevard.
  layout.roads.filter((road) => road.boulevard).forEach((road) => {
    for (let index = 0; index < road.points.length - 1; index += 1) {
      const [ax, az] = road.points[index];
      const [bx, bz] = road.points[index + 1];
      const length = Math.hypot(bx - ax, bz - az) || 1;
      for (let at = 0; at < length; at += 10) {
        const px = ax + ((bx - ax) * at) / length;
        const pz = az + ((bz - az) * at) / length;
        [-1, 1].forEach((hand) => {
          const tx = px - ((bz - az) / length) * (road.width / 2 - 1.2) * hand;
          const tz = pz + ((bx - ax) / length) * (road.width / 2 - 1.2) * hand;
          if (Math.hypot(tx, tz) < clear + 4 || wet(tx, tz, 2)) return;
          if (taken.some((circle) => Math.hypot(tx - circle.x, tz - circle.z) < circle.r + 1)) return;
          layout.trees.push({ x: tx, z: tz, h: 11, r: 3.6, kind: "broadleaf" });
        });
      }
    }
  });
  // Railway bridges where the line crosses water.
  if (layout.railway) {
    const points = layout.railway.points;
    let start = null;
    points.forEach(([x, z], index) => {
      const inWater = wet(x, z, 2);
      if (inWater && start == null) start = Math.max(index - 1, 0);
      if (!inWater && start != null) {
        const [ax, az] = points[start];
        layout.bridges.push({ x: (ax + x) / 2, z: (az + z) / 2, angle: Math.atan2(z - az, x - ax), length: Math.hypot(x - ax, z - az) + 6, width: 9, railway: true });
        start = null;
      }
    });
  }
  // Willows and alders along a river's banks, where there is room.
  const river = layout.water.river;
  if (river) {
    river.points.forEach(([x, z], index) => {
      if (index === river.points.length - 1) return;
      const [nx, nz] = river.points[index + 1];
      const length = Math.hypot(nx - x, nz - z) || 1;
      [-1, 1].forEach((hand) => {
        if (waterRng() > 0.45) return;
        const out = river.width / 2 + waterRange(2.5, 6);
        const tx = x - ((nz - z) / length) * out * hand;
        const tz = z + ((nx - x) / length) * out * hand;
        const distance = Math.hypot(tx, tz);
        if (distance < clear + 6 || distance > extent * 1.1) return;
        if (taken.some((circle) => Math.hypot(tx - circle.x, tz - circle.z) < circle.r + 3)) return;
        if (layout.roads.some((road) => distanceToPolyline(road.points, tx, tz) < road.width / 2 + 3)) return;
        if (layout.fields.some((field) => insideField(field, tx, tz, 2))) return;
        const h = waterRange(7, 11);
        layout.trees.push({ x: tx, z: tz, h, r: h * waterRange(0.32, 0.42), kind: "broadleaf" });
      });
    });
  }
  if (params.region === "japanese" || params.region === "african") regionaliseLayout(layout);
  return layout;
}

// A number 0-1 from a place and a key: the same house is always turned the
// same way, without taking from the layout's random numbers (the other
// regions' layouts stay as they were for a seed).
function placeHash(x, z, key) {
  const value = Math.sin(x * 12.9898 + z * 78.233 + key * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

// Japan and West Africa: the same plan (roads, lots, fields, the wood), its
// buildings and plants those of the region, worked out from each one's
// place. Roof shapes beyond the European ones:
//   "hip"     four slopes, the ridge along the long side (Japan's hipped
//             and hip-and-gable roofs, drawn as hipped)
//   "cone"    a round house's conical roof (`shape: "round"`: round walls,
//             `w` the diameter)
//   "pagoda"  a tower of `tiers` storeys, each under its own wide roof,
//             `roofHeight` the finial
function regionaliseLayout(layout) {
  const params = layout.params;
  const japanese = params.region === "japanese";
  const town = params.kind === "town" || params.kind === "port" || params.kind === "shtetl";
  layout.blocks = layout.blocks.map((block) => {
    const short = Math.min(block.w, block.d);
    const tower = block.role === "church" && block.roof !== "gable";
    if (japanese) {
      if (block.role === "house" && block.roof === "gable") {
        // A town house (machiya): its eaves to the street, a low tiled
        // roof; a farmhouse (minka) under a tall hipped thatch.
        if (town || block.market) return { ...block, ridge: "w", roofHeight: block.d * 0.22, h: Math.min(block.h, 7.5) };
        return { ...block, roof: "hip", roofHeight: short * 0.62, h: Math.min(block.h, 3.2) };
      }
      // The church's tower: a pagoda of three storeys, five when tall.
      if (tower) return { ...block, w: 7, d: 7, h: block.h >= 24 ? 26 : 16, roof: "pagoda", tiers: block.h >= 24 ? 5 : 3, roofHeight: 4, temple: true };
      // The nave: the temple's hall, nearly square, under a wide hipped roof.
      if (block.role === "church") {
        const d = Math.min(block.d, block.w * 1.25);
        return { ...block, d, h: Math.min(block.h, 7), roof: "hip", roofHeight: block.w * 0.42, temple: true };
      }
      // A storehouse (kura): white plaster, a heavy tiled gable.
      if (block.role === "granary" || block.role === "barn") return { ...block, roof: "gable", roofHeight: short * 0.35, kura: true };
      if (["cloister", "manor", "tower", "campanile", "station"].includes(block.role) && block.roof !== "none") {
        return { ...block, roof: "hip", roofHeight: short * 0.4 };
      }
      return block;
    }
    // West Africa, the Sahel: round houses of mud under conical thatch in a
    // village; flat-roofed mud houses in a town; the mosque of mud with its
    // minaret.
    // (round houses in the villages to this day; a village's flat-roofed
    // blocks after 1914 stay as they are)
    if (block.role === "house" && block.roof !== "none" && !(town || block.market)) {
      const w = Math.max(4, Math.min(6.5, short * 0.8));
      return { ...block, shape: "round", w, d: w, h: 2.4, roof: "cone", roofHeight: w * 0.5 };
    }
    if (block.role === "granary") {
      return { ...block, shape: "round", w: 3.2, d: 3.2, h: 3, roof: "cone", roofHeight: 1.8 };
    }
    if (tower) return { ...block, w: 5.5, d: 5.5, h: block.h >= 24 ? 18 : 13, roof: "none", roofHeight: 0, mosque: true };
    if (block.role === "church") return { ...block, h: Math.min(block.h, 8), roof: "none", roofHeight: 0, mosque: true };
    if (block.role === "chimney" || block.role === "factory" || block.role === "store") return block;
    if (block.roof !== "none") return { ...block, roof: "none", roofHeight: 0, h: block.role === "house" ? Math.min(block.h, 7) : block.h, adobe: true };
    return block;
  });
  if (japanese) {
    // Pines and cedars, maples and cherries; the fields mostly rice.
    layout.trees = layout.trees.map((tree) => {
      if (tree.kind === "conifer") return placeHash(tree.x, tree.z, 3) < 0.5 ? { ...tree, kind: "pine", r: tree.h * 0.3 } : tree;
      if (tree.kind === "broadleaf") return { ...tree, kind: placeHash(tree.x, tree.z, 4) < 0.65 ? "maple" : "broadleaf" };
      return tree;
    });
    layout.fields = layout.fields.map((field) => (field.parking || placeHash(field.x, field.z, 5) > 0.8 ? field : { ...field, paddy: true }));
    return;
  }
  // The savanna: a thinner wood of acacias and here and there a baobab, low
  // and wide; the fields millet and sorghum.
  layout.trees = layout.trees
    .filter((tree) => placeHash(tree.x, tree.z, 6) < 0.4)
    .map((tree) => {
      const baobab = placeHash(tree.x, tree.z, 7) < 0.12;
      const h = baobab ? 12 + 6 * placeHash(tree.x, tree.z, 8) : Math.min(tree.h, 9) * 0.8;
      return { ...tree, kind: baobab ? "baobab" : "acacia", h, r: baobab ? h * 0.55 : h * 0.62 };
    });
}

// Life in the generated surroundings (editor/surroundings-life-mesh.js
// draws and moves it): people walking the settlement's streets, carts and
// later cars on its roads, boats on its water. Like the rest, a typical
// picture, not this place's - marked as generated, no part of the model.
//
// Pure: no three.js. The same layout always gives the same life.
//
//   people     [{ path, speed, start, side, colour }]  walking to and fro
//              along a stretch of a street in the settlement
//   vehicles   [{ path, speed, start, side, kind }]  "cart" | "car", to
//              and fro along a road
//   boats      [{ path, speed, start, kind, loop }]  "rowing" | "sail" |
//              "motor", on a river, a moat, a port's water, a pond
//
// A path: { points: [[x, z], ...], lengths (cumulative), length }.

// People's clothes: undyed wool and linen, dyed blue, red, green, brown;
// later darker cloth; after 1945 brighter.
const CLOTHES = {
  early: [0x8a7b62, 0x6f5f4a, 0xa69478, 0x5d6b7a, 0x7a3e33, 0x5f6b45],
  later: [0x3f3a36, 0x5a4a3c, 0x2f3a4a, 0x6b5a48, 0x7a3e33, 0x8a7b62],
  modern: [0x2f4f7a, 0x8a2f2f, 0x3f6f4f, 0xc9a24a, 0x4a4a4a, 0xd8d0c0, 0x6f4a7a],
};

function rngOf(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lifePath(points) {
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    lengths.push(lengths[index - 1] + Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]));
  }
  return { points, lengths, length: lengths[lengths.length - 1] };
}

/**
 * Where along a path at `distance` (to and fro, or round a loop):
 * { x, z, heading } - heading the direction of travel (radians, atan2 of
 * dz, dx).
 */
function lifeAt(path, distance, loop = false) {
  const length = path.length || 1;
  let along = ((distance % (2 * length)) + 2 * length) % (2 * length);
  let back = false;
  if (loop) along %= length;
  else if (along > length) {
    along = 2 * length - along;
    back = true;
  }
  const { points, lengths } = path;
  let index = 1;
  while (index < lengths.length - 1 && lengths[index] < along) index += 1;
  const [ax, az] = points[index - 1];
  const [bx, bz] = points[index];
  const span = lengths[index] - lengths[index - 1] || 1;
  const t = (along - lengths[index - 1]) / span;
  const heading = Math.atan2(bz - az, bx - ax) + (back ? Math.PI : 0);
  return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, heading };
}

// The part of a polyline within `radius` of a place (the longest run).
function clipTo(points, cx, cz, radius) {
  let best = [];
  let run = [];
  points.forEach((point) => {
    if (Math.hypot(point[0] - cx, point[1] - cz) <= radius) run.push(point);
    else {
      if (run.length > best.length) best = run;
      run = [];
    }
  });
  return run.length > best.length ? run : best;
}

/**
 * The life of a layout (surroundings-rules.js, layoutSurroundings).
 *   light   a phone or a weak device: half as much
 */
function planSurroundingsLife(layout, { light = false } = {}) {
  const params = layout.params;
  const rng = rngOf((layout.seed ^ 0x1f123bb5) >>> 0);
  const range = (min, max) => min + (max - min) * rng();
  const zone = layout.zone;
  const period = params.period;
  const winter = params.season === "winter";
  const town = params.kind === "town" || params.kind === "port";
  const share = (light ? 0.5 : 1) * (0.6 + 0.6 * params.density);
  const clothes = period === "postwar" || period === "contemporary" ? CLOTHES.modern : period === "early-medieval" || period === "medieval" ? CLOTHES.early : CLOTHES.later;
  const wet = (x, z) => surroundingsWaterDistance(layout, x, z) < 1.5;
  const people = [];
  const vehicles = [];
  const boats = [];

  // ---- people: a stretch of a street each, in the settlement
  const streets = layout.roads
    .filter((road) => !road.boulevard || town)
    .map((road) => ({ road, points: clipTo(road.points, zone.x, zone.z, zone.r * 1.05) }))
    .filter(({ points }) => points.length >= 2);
  const wantedPeople = Math.round((town ? 70 : params.kind === "shtetl" ? 50 : 24) * share * (winter ? 0.6 : 1));
  for (let index = 0; index < wantedPeople && streets.length; index += 1) {
    const { road, points } = streets[Math.floor(rng() * streets.length)];
    const full = lifePath(points);
    // A stretch of 30-90 m of it.
    const stretch = Math.min(full.length, range(30, 90));
    const from = range(0, Math.max(0, full.length - stretch));
    const picked = [];
    for (let at = from; at <= from + stretch + 0.01; at += 4) {
      const { x, z } = lifeAt(full, Math.min(at, full.length));
      picked.push([x, z]);
    }
    if (picked.length < 2 || picked.some(([x, z]) => wet(x, z))) continue;
    people.push({
      path: lifePath(picked),
      speed: range(0.9, 1.5),
      start: range(0, 200),
      side: (rng() < 0.5 ? -1 : 1) * (road.width / 2 - range(0.4, 1)),
      colour: clothes[Math.floor(rng() * clothes.length)],
    });
  }

  // ---- vehicles on the roads: carts until the cars come
  const cars = { "early-medieval": 0, medieval: 0, "early-modern": 0, industrial: 0, modern: 0.4, postwar: 0.8, contemporary: 1 }[period] ?? 0;
  const count = Math.round(({ "early-medieval": 2, medieval: 4, "early-modern": 5, industrial: 7, modern: 8, postwar: 10, contemporary: 14 }[period] ?? 4) * share * (town ? 1.4 : 1));
  const roads = layout.roads.filter((road) => road.width >= 4.5 && !road.market && road.points.length >= 2)
    .map((road) => clipTo(road.points, 0, 0, layout.extent * 0.95))
    .filter((points) => points.length >= 2);
  for (let index = 0; index < count && roads.length; index += 1) {
    const points = roads[index % roads.length];
    const path = lifePath(points);
    // (across bridges too: the roads stop at the banks elsewhere)
    if (path.length < 40) continue;
    const car = rng() < cars;
    vehicles.push({ path, speed: car ? range(8, 13) : range(1.2, 1.8), start: range(0, path.length * 2), side: (rng() < 0.5 ? -1 : 1) * 1.2, kind: car ? "car" : "cart" });
  }

  // ---- boats: none on the ice
  if (!winter && params.water) {
    const water = layout.water;
    const boatKind = () => (period === "postwar" || period === "contemporary" ? (rng() < 0.6 ? "motor" : "rowing") : rng() < (params.kind === "port" ? 0.6 : 0.15) ? "sail" : "rowing");
    if (water.river) {
      const points = clipTo(water.river.points, 0, 0, layout.extent * 0.9);
      const path = lifePath(points);
      for (let index = 0; index < Math.round(4 * share); index += 1) {
        if (path.length > 60) boats.push({ path, speed: range(1.2, 2.5), start: range(0, path.length * 2), kind: boatKind(), loop: false, side: range(-0.25, 0.25) * water.river.width });
      }
    }
    if (water.moat) {
      const radius = (water.moat.inner + water.moat.outer) / 2;
      const points = Array.from({ length: 49 }, (_item, index) => [Math.cos((index / 48) * Math.PI * 2) * radius, Math.sin((index / 48) * Math.PI * 2) * radius]);
      boats.push({ path: lifePath(points), speed: range(0.8, 1.4), start: range(0, 200), kind: "rowing", loop: true, side: 0 });
    }
    if (water.coast) {
      const { nx, nz, offset } = water.coast;
      for (let index = 0; index < Math.round(6 * share); index += 1) {
        const out = offset + range(25, 140);
        const half = range(80, 220);
        const points = [[-nz * -half + nx * out, nx * -half + nz * out], [-nz * half + nx * out, nx * half + nz * out]];
        boats.push({ path: lifePath(points), speed: range(1.5, 4), start: range(0, half * 4), kind: boatKind(), loop: false, side: 0 });
      }
    }
    (water.ponds || []).forEach((pond) => {
      const points = Array.from({ length: 33 }, (_item, index) => {
        const angle = (index / 32) * Math.PI * 2;
        const lx = Math.cos(angle) * pond.rx * 0.55;
        const lz = Math.sin(angle) * pond.rz * 0.55;
        return [pond.x + lx * Math.cos(pond.angle) - lz * Math.sin(pond.angle), pond.z + lx * Math.sin(pond.angle) + lz * Math.cos(pond.angle)];
      });
      boats.push({ path: lifePath(points), speed: range(0.5, 0.9), start: range(0, 100), kind: "rowing", loop: true, side: 0 });
    });
  }
  return { people, vehicles, boats };
}

// The intro's model and everything that depends on it - the "scene". The
// intro itself (the cloud, the landing, the reveal, the feature tour, the
// sound) is the same for every deployment; a deployment swaps only the
// scene, with viewer.intro.scene in viewer-settings.json (docs/intro.md,
// "Another model"):
//
//   "intro": {
//     "scene": "brand/intro/scene.json"     // a file, or the object itself
//   }
//
// Paths in a scene file resolve against that file, paths in an inline
// object against the intro page. Anything left out keeps a neutral default
// (no pins, the measurement on the bounding box, no time travel); without a
// scene the intro shows the pagoda (DEFAULT_SCENE). The Wołpa Synagogue is
// a scene of its own (scenes/wolpa/scene.json).
//
// The intro page also takes the deployment's branding (the logo and the
// name, ../branding.js) from the same file.

const DEFAULT_SCENE = Object.freeze({
  // E4DP point file (scripts/build-intro-points.mjs) and the model shown
  // after it, in the same coordinates: the pagoda, the project's own model
  // (scripts/build-pagoda-examples.mjs).
  points: 'assets/intro/scenes/pagoda/points.bin',
  model: 'examples/pagoda/Pagoda-progressive.glb',
  // Where "Enter the viewer" leads (same site only).
  next: './?model=./examples/pagoda/Pagoda-progressive.glb',
  // Metres per model unit.
  unitInMeters: 1,
  // The camera's angle around the model at the landing (radians; 0: from +Z).
  front: 0.35,
  // The model's ground (y, model units): sun study compass, snow, section.
  ground: 0,
  // Annotations (model units): "annotation" pins are bright, "poi" pins blue.
  pins: [
    // The front's bracket sets (the finial's label would sit under the
    // chapter's name); the bell at the front's left corner, away from the
    // height line (right).
    { key: 'brackets', at: [0, 4.5, 3.4], lift: 0.3, kind: 'annotation' },
    { key: 'bell', at: [-5.76, 8.6, 5.76], lift: 0.35, kind: 'poi' },
  ],
  // The height measurement: a vertical line at (x, z) from y = from to to.
  measure: { x: 7.0, z: 0, from: 0, to: 20.5 },
  // The sun study's place and day (local time = UTC + utcOffset; north: the
  // model's north from -Z, degrees clockwise). The pagoda stands nowhere;
  // the sun is Nara's.
  site: { latitude: 34.68, longitude: 135.83, utcOffset: 9, north: 0, month: 6, day: 21 },
  // The 4D time travel: a folder with time.json and the stages' textures
  // (scripts/build-pagoda-examples.mjs); false leaves the chapter out.
  time: 'assets/intro/scenes/pagoda/time/',
  // The surroundings through time (intro-surroundings.js): the viewer's
  // generated surroundings (docs/surroundings.md) of this kind of place and
  // region through these years (as the viewer covers them), then other kinds
  // of place in other regions (`showcase`, in colour, with their life);
  // false leaves the chapter out.
  surroundings: Object.freeze({
    // The pagoda's own: a temple's precinct in Japan.
    kind: 'monastery', region: 'japanese', masonry: 'stone', seed: 7, years: Object.freeze([900, 2025]),
    showcase: Object.freeze([
      Object.freeze({ kind: 'town', region: 'japanese', year: 1850 }),
      Object.freeze({ kind: 'village', region: 'african', year: 1920 }),
      Object.freeze({ kind: 'town', region: 'central', year: 1880 }),
      Object.freeze({ kind: 'port', region: 'mediterranean', year: 1700 }),
    ]),
  }),
  // Texts per language over the intro's own (intro.js TEXTS):
  // tagline, hint, hintTouch, tour.sunDate, tour.labels.<pin key>,
  // tour.timeNotes.<year>.
  texts: null,
});

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Same origin only (the intro fetches and draws them), else null.
function sameOriginUrl(value, base) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim(), base);
    return url.origin === window.location.origin ? url.href : null;
  } catch {
    return null;
  }
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function vector(value) {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const out = value.map(Number);
  return out.every(Number.isFinite) ? out : null;
}

// A scene from the settings, checked and completed. base: the URL its
// relative paths resolve against.
function normalizeScene(input, base) {
  const scene = isObject(input) ? input : {};
  const points = sameOriginUrl(scene.points, base);
  const model = sameOriginUrl(scene.model, base);
  if (!points) return null; // without points there is no intro of it
  const pins = (Array.isArray(scene.pins) ? scene.pins : [])
    .map((pin, index) => {
      const at = vector(pin?.at);
      if (!at) return null;
      const key = typeof pin.key === 'string' && /^[\w-]+$/.test(pin.key) ? pin.key : `pin${index + 1}`;
      return {
        key,
        at,
        lift: finite(pin.lift, 0.3),
        kind: pin.kind === 'poi' ? 'poi' : 'annotation',
        label: pin.label ?? null,
      };
    })
    .filter(Boolean);
  const measure = isObject(scene.measure)
    && [scene.measure.x, scene.measure.z, scene.measure.from, scene.measure.to].every((v) => Number.isFinite(Number(v)))
    ? { x: +scene.measure.x, z: +scene.measure.z, from: +scene.measure.from, to: +scene.measure.to }
    : null;
  const site = isObject(scene.site) && Number.isFinite(Number(scene.site.latitude)) && Number.isFinite(Number(scene.site.longitude))
    ? {
      latitude: +scene.site.latitude,
      longitude: +scene.site.longitude,
      utcOffset: finite(scene.site.utcOffset, Math.round(+scene.site.longitude / 15)),
      north: finite(scene.site.north, 0),
      month: finite(scene.site.month, 6),
      day: finite(scene.site.day, 21),
    }
    : null;
  // The surroundings: a kind of place and the years, at least.
  const years = Array.isArray(scene.surroundings?.years) ? scene.surroundings.years.map(Number) : null;
  const surroundings = isObject(scene.surroundings) && typeof scene.surroundings.kind === 'string'
    && years?.length === 2 && years.every(Number.isFinite) && years[1] > years[0]
    ? {
      kind: scene.surroundings.kind,
      region: typeof scene.surroundings.region === 'string' ? scene.surroundings.region : 'central',
      masonry: typeof scene.surroundings.masonry === 'string' ? scene.surroundings.masonry : 'brick',
      seed: finite(scene.surroundings.seed, 1),
      density: finite(scene.surroundings.density, 0.6),
      years: [Math.round(years[0]), Math.round(years[1])],
      // Other places after it: [{ kind, region, year }].
      showcase: (Array.isArray(scene.surroundings.showcase) ? scene.surroundings.showcase : [])
        .filter((v) => isObject(v) && typeof v.kind === 'string' && Number.isFinite(Number(v.year)))
        .slice(0, 6)
        .map((v) => ({ kind: v.kind, region: typeof v.region === 'string' ? v.region : 'central', year: Math.round(Number(v.year)) })),
    }
    : false;
  let time = false;
  if (typeof scene.time === 'string') {
    const url = sameOriginUrl(scene.time, base);
    if (url) time = url.endsWith('/') ? url : `${url}/`;
  }
  return {
    custom: true,
    points,
    // Without a model the intro ends with the points.
    model,
    next: typeof scene.next === 'string' && scene.next.trim()
      ? scene.next.trim()
      : model ? `./?model=${encodeURIComponent(new URL(model).pathname)}` : './',
    unitInMeters: finite(scene.unitInMeters, 1),
    front: finite(scene.front, 0),
    ground: Number.isFinite(Number(scene.ground)) ? Number(scene.ground) : null, // null: the bounding box's bottom
    pins,
    measure,
    site,
    time,
    surroundings,
    texts: isObject(scene.texts) ? scene.texts : null,
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

// { scene, branding }: the deployment's scene (or DEFAULT_SCENE) and its
// branding, from viewer-settings.json next to the intro page. Any failure
// keeps the defaults - the intro never waits on a broken setting.
async function loadIntroScene() {
  const fallback = { scene: { ...DEFAULT_SCENE, custom: false }, branding: {} };
  let settings;
  try {
    settings = await fetchJson(new URL('viewer-settings.json', document.baseURI).href);
  } catch {
    return fallback;
  }
  const branding = isObject(settings?.branding) ? settings.branding : {};
  const value = settings?.viewer?.intro?.scene;
  if (!value) return { ...fallback, branding };
  try {
    if (typeof value === 'string') {
      const url = sameOriginUrl(value, document.baseURI);
      if (!url) throw new Error(`viewer.intro.scene: not a same-site URL: ${value}`);
      const scene = normalizeScene(await fetchJson(url), url);
      if (scene) return { scene, branding };
    } else {
      const scene = normalizeScene(value, document.baseURI);
      if (scene) return { scene, branding };
    }
    console.warn('[intro] viewer.intro.scene has no usable "points"; showing the default intro.');
  } catch (error) {
    console.warn('[intro] viewer.intro.scene could not be read; showing the default intro.', error);
  }
  return { ...fallback, branding };
}

function deepMerge(target, source) {
  if (!isObject(source)) return target;
  const out = { ...target };
  for (const [key, value] of Object.entries(source)) {
    out[key] = isObject(value) && isObject(target?.[key]) ? deepMerge(target[key], value) : value;
  }
  return out;
}

// A text from the settings: a string, or { pl, en, de } (falling back to
// English, then any).
function pickText(value, lang) {
  if (typeof value === 'string') return value;
  if (!isObject(value)) return null;
  return value[lang] ?? value.en ?? Object.values(value).find((v) => typeof v === 'string') ?? null;
}

// The intro's texts for this scene: the built-in ones name the pagoda,
// so a custom scene starts from neutral ones (`generic`), then takes its own.
function sceneTexts(texts, generic, scene, lang) {
  if (!scene.custom) return texts;
  let out = deepMerge(texts, generic);
  const labels = {};
  for (const pin of scene.pins) {
    const label = pickText(pin.label, lang);
    if (label) labels[pin.key] = label;
  }
  // The pagoda's stage notes do not fit another model's years.
  out = { ...out, tour: { ...out.tour, labels: { ...out.tour.labels, ...labels }, timeNotes: {} } };
  // The sun study's day (without a site it runs at the default place).
  const site = scene.site ?? DEFAULT_SCENE.site;
  const date = new Date(Date.UTC(2001, site.month - 1, site.day));
  out.tour.sunDate = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
  const own = scene.texts?.[lang] ?? scene.texts?.en ?? null;
  return deepMerge(out, own);
}

export { SURROUNDINGS_SLIDER_SPAN as A, SURROUNDINGS_SEASONS as B, SURROUNDINGS_STYLES as C, DEFAULT_SCENE as D, SURROUNDINGS_REGIONS as E, SURROUNDINGS_KINDS as F, SURROUNDINGS_DEFAULTS as G, HORIZON as H, normalizeSurroundings as I, surroundingsGrowth as J, suggestSurroundings as K, estimateBytesUsed as L, OrbitControls as O, RAD as R, SURROUNDINGS_ERAS as S, surroundingsWaterDistance as a, lifeAt as b, surroundingsYearToSlider as c, SURROUNDINGS_SLIDER_STEPS as d, sunriseSunset as e, formatSunTime as f, solarPosition as g, hasNewShape as h, sunTimestamp as i, loadIntroScene as j, sceneTexts as k, layoutSurroundings as l, mergeGeometries as m, pickText as n, surroundingsGroundHeight as o, planSurroundingsLife as p, surroundingsTerrainHeight as q, surroundingsSnows as r, surroundingsSliderToYear as s, toTrianglesDrawMode as t, surroundingsNoise as u, hasSurroundingsGridWater as v, writeBlockShape as w, surroundingsGridWaterDistance as x, surroundingsWaterLevel as y, surroundingsPeriod as z };
//# sourceMappingURL=intro-scene-hh2bLFxY.js.map
