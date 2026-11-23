import { h as Mesh, fj as ShaderMaterial, f as BackSide, g5 as UniformsUtils, B as BoxGeometry, V as Vector3, Q as Vector2, f_ as WebGLRenderTarget, K as DepthTexture, aW as MeshBasicMaterial, C as Color, eS as MathUtils, du as Box3, ea as FogExp2, ao as Object3D, d2 as DirectionalLight, aM as Group, am as BufferGeometry, a9 as BufferAttribute, ai as DoubleSide, c8 as AdditiveBlending, R as RenderTarget, J as HalfFloatType, a2 as OrthographicCamera, b0 as MeshStandardMaterial, dB as CanvasTexture, dE as CircleGeometry, f1 as Points, dW as Data3DTexture, aw as RedFormat, aP as UnsignedByteType, j as LinearFilter, bv as RepeatWrapping, g6 as UniformsLib } from './three-DQIwNvhE.js';
import { W as WEATHER_DEFAULTS, g as WEATHER_TYPES, h as refreshToolPanelChrome, a as core, j as WEATHER_SEASONS, k as attachToolPanelChrome, P as PANEL_ICONS, l as getViewerSideStack, s as sunDirection, m as isPostProcessingActive, n as getRenderingSettings } from './main-CbOnnKVx.js';
import { t } from './feature-icons-DdmKTgW2.js';
import './model-extension-BDXGpmfH.js';
import './intro-scene-D_WhMe6N.js';
import './room-acoustics-Bwk-VQOn.js';
import './_commonjsHelpers-1n8l_yFW.js';
import './slice-stack-HPsHxT3J.js';
import './image-slices-reader-BDYkC6Bg.js';
import './volume-voxels-CI6ldnye.js';

/**
 * Represents a skydome for scene backgrounds. Based on [A Practical Analytic Model for Daylight](https://www.researchgate.net/publication/220720443_A_Practical_Analytic_Model_for_Daylight)
 * aka The Preetham Model, the de facto standard for analytical skydomes.
 *
 * Note that this class can only be used with {@link WebGLRenderer}.
 * When using {@link WebGPURenderer}, use {@link SkyMesh}.
 *
 * More references:
 *
 * - {@link http://simonwallner.at/project/atmospheric-scattering/}
 * - {@link http://blenderartists.org/forum/showthread.php?245954-preethams-sky-impementation-HDR}
 *
 *
 * ```js
 * const sky = new Sky();
 * sky.scale.setScalar( 10000 );
 * scene.add( sky );
 * ```
 *
 * It can be useful to hide the sun disc when generating an environment map to avoid artifacts
 *
 * ```js
 * // disable before rendering environment map
 * sky.material.uniforms.showSunDisc.value = false;
 * // ...
 * // re-enable before scene sky box rendering
 * sky.material.uniforms.showSunDisc.value = true;
 * ```
 *
 * @augments Mesh
 * @three_import import { Sky } from 'three/addons/objects/Sky.js';
 */
class Sky extends Mesh {

	/**
	 * Constructs a new skydome.
	 */
	constructor() {

		const shader = Sky.SkyShader;

		const material = new ShaderMaterial( {
			name: shader.name,
			uniforms: UniformsUtils.clone( shader.uniforms ),
			vertexShader: shader.vertexShader,
			fragmentShader: shader.fragmentShader,
			side: BackSide,
			depthWrite: false
		} );

		super( new BoxGeometry( 1, 1, 1 ), material );

		/**
		 * This flag can be used for type testing.
		 *
		 * @type {boolean}
		 * @readonly
		 * @default true
		 */
		this.isSky = true;

	}

}

Sky.SkyShader = {

	name: 'SkyShader',

	uniforms: {
		'turbidity': { value: 2 },
		'rayleigh': { value: 1 },
		'mieCoefficient': { value: 0.005 },
		'mieDirectionalG': { value: 0.8 },
		'sunPosition': { value: new Vector3() },
		'cloudScale': { value: 0.0002 },
		'cloudSpeed': { value: 0.00002 },
		'cloudCoverage': { value: 0.4 },
		'cloudDensity': { value: 0.4 },
		'cloudElevation': { value: 0.5 },
		'showSunDisc': { value: 1 },
		'time': { value: 0.0 }
	},

	vertexShader: /* glsl */`
		uniform vec3 sunPosition;
		uniform float rayleigh;
		uniform float turbidity;
		uniform float mieCoefficient;

		varying vec3 vWorldPosition;
		varying vec3 vSunDirection;
		varying float vSunfade;
		varying vec3 vBetaR;
		varying vec3 vBetaM;
		varying float vSunE;

		// constants for atmospheric scattering
		const float e = 2.71828182845904523536028747135266249775724709369995957;
		const float pi = 3.141592653589793238462643383279502884197169;

		// wavelength of used primaries, according to preetham
		const vec3 lambda = vec3( 680E-9, 550E-9, 450E-9 );
		// this pre-calculation replaces older TotalRayleigh(vec3 lambda) function:
		// (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn))
		const vec3 totalRayleigh = vec3( 5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5 );

		// mie stuff
		// K coefficient for the primaries
		const float v = 4.0;
		const vec3 K = vec3( 0.686, 0.678, 0.666 );
		// MieConst = pi * pow( ( 2.0 * pi ) / lambda, vec3( v - 2.0 ) ) * K
		const vec3 MieConst = vec3( 1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14 );

		// earth shadow hack
		// cutoffAngle = pi / 1.95;
		const float cutoffAngle = 1.6110731556870734;
		const float steepness = 1.5;
		const float EE = 1000.0;

		float sunIntensity( float zenithAngleCos ) {
			zenithAngleCos = clamp( zenithAngleCos, -1.0, 1.0 );
			return EE * max( 0.0, 1.0 - pow( e, -( ( cutoffAngle - acos( zenithAngleCos ) ) / steepness ) ) );
		}

		vec3 totalMie( float T ) {
			float c = ( 0.2 * T ) * 10E-18;
			return 0.434 * c * MieConst;
		}

		void main() {

			vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
			vWorldPosition = worldPosition.xyz;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			gl_Position.z = gl_Position.w; // set z to camera.far

			vSunDirection = normalize( sunPosition );

			vSunE = sunIntensity( vSunDirection.y );

			vSunfade = 1.0 - clamp( 1.0 - exp( ( sunPosition.y / 450000.0 ) ), 0.0, 1.0 );

			float rayleighCoefficient = rayleigh - ( 1.0 * ( 1.0 - vSunfade ) );

			// extinction (absorption + out scattering)
			// rayleigh coefficients
			vBetaR = totalRayleigh * rayleighCoefficient;

			// mie coefficients
			vBetaM = totalMie( turbidity ) * mieCoefficient;

		}`,

	fragmentShader: /* glsl */`
		varying vec3 vWorldPosition;
		varying vec3 vSunDirection;
		varying vec3 vBetaR;
		varying vec3 vBetaM;
		varying float vSunE;

		uniform float mieDirectionalG;
		uniform float cloudScale;
		uniform float cloudSpeed;
		uniform float cloudCoverage;
		uniform float cloudDensity;
		uniform float cloudElevation;
		uniform float showSunDisc;
		uniform float time;

		// gradient at a lattice corner; sinless hash so every GPU produces the same clouds
		vec2 gradient( vec2 i ) {
			vec3 p = fract( i.xyx * vec3( 0.1031, 0.1030, 0.0973 ) );
			p += dot( p, p.yzx + 33.33 );
			return fract( ( p.xx + p.yz ) * p.zy ) * 2.0 - 1.0;
		}

		// 2D gradient noise: isotropic lobes like Perlin at value-noise cost
		float noise( vec2 p ) {
			vec2 i = floor( p );
			vec2 f = fract( p );
			vec2 u = f * f * f * ( f * ( f * 6.0 - 15.0 ) + 10.0 ); // quintic fade
			float a = dot( gradient( i ), f );
			float b = dot( gradient( i + vec2( 1.0, 0.0 ) ), f - vec2( 1.0, 0.0 ) );
			float c = dot( gradient( i + vec2( 0.0, 1.0 ) ), f - vec2( 0.0, 1.0 ) );
			float d = dot( gradient( i + vec2( 1.0, 1.0 ) ), f - vec2( 1.0, 1.0 ) );
			return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y ) * 1.6; // ~[-1,1]
		}

		// fbm; per-octave drift makes clouds billow instead of scrolling as a rigid stamp
		float fbm( vec2 p, float drift ) {
			float result = 0.0;
			float amplitude = 1.0;
			for ( int i = 0; i < 4; i ++ ) {
				result += amplitude * noise( p );
				amplitude *= 0.5;
				p = p * 2.0 + drift;
			}
			return result;
		}

		// constants for atmospheric scattering
		const float pi = 3.141592653589793238462643383279502884197169;

		const float n = 1.0003; // refractive index of air
		const float N = 2.545E25; // number of molecules per unit volume for air at 288.15K and 1013mb (sea level -45 celsius)

		// optical length at zenith for molecules
		const float rayleighZenithLength = 8.4E3;
		const float mieZenithLength = 1.25E3;
		// 66 arc seconds -> degrees, and the cosine of that
		const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;

		// 3.0 / ( 16.0 * pi )
		const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
		// 1.0 / ( 4.0 * pi )
		const float ONE_OVER_FOURPI = 0.07957747154594767;

		float rayleighPhase( float cosTheta ) {
			return THREE_OVER_SIXTEENPI * ( 1.0 + pow( cosTheta, 2.0 ) );
		}

		float hgPhase( float cosTheta, float g ) {
			float g2 = pow( g, 2.0 );
			float inverse = 1.0 / pow( 1.0 - 2.0 * g * cosTheta + g2, 1.5 );
			return ONE_OVER_FOURPI * ( ( 1.0 - g2 ) * inverse );
		}

		void main() {

			vec3 direction = normalize( vWorldPosition - cameraPosition );

			// optical length
			// cutoff angle at 90 to avoid singularity in next formula.
			float zenithAngle = acos( max( 0.0, direction.y ) );
			float inverse = 1.0 / ( cos( zenithAngle ) + 0.15 * pow( 93.885 - ( ( zenithAngle * 180.0 ) / pi ), -1.253 ) );
			float sR = rayleighZenithLength * inverse;
			float sM = mieZenithLength * inverse;

			// combined extinction factor
			vec3 Fex = exp( -( vBetaR * sR + vBetaM * sM ) );

			// in scattering
			float cosTheta = dot( direction, vSunDirection );

			float rPhase = rayleighPhase( cosTheta * 0.5 + 0.5 );
			vec3 betaRTheta = vBetaR * rPhase;

			float mPhase = hgPhase( cosTheta, mieDirectionalG );
			vec3 betaMTheta = vBetaM * mPhase;

			vec3 Lin = pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * ( 1.0 - Fex ), vec3( 1.5 ) );
			Lin *= mix( vec3( 1.0 ), pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * Fex, vec3( 1.0 / 2.0 ) ), clamp( pow( 1.0 - vSunDirection.y, 5.0 ), 0.0, 1.0 ) );

			// nightsky
			float theta = acos( direction.y ); // elevation --> y-axis, [-pi/2, pi/2]
			float phi = atan( direction.z, direction.x ); // azimuth --> x-axis [-pi/2, pi/2]
			vec2 uv = vec2( phi, theta ) / vec2( 2.0 * pi, pi ) + vec2( 0.5, 0.0 );
			vec3 L0 = vec3( 0.1 ) * Fex;

			// composition + solar disc
			float sundisc = clamp( ( cosTheta - sunAngularDiameterCos ) * 50000.0, 0.0, 1.0 ) * showSunDisc;
			vec3 sundiscColor = ( 760.0 * sundisc ) * min( vSunE * Fex, 80.0 );

			vec3 texColor = ( Lin + L0 ) * 0.04 + sundiscColor + vec3( 0.0, 0.0003, 0.00075 );

			// Clouds
			if ( direction.y > 0.0 && cloudCoverage > 0.0 ) {

				// Project to cloud plane (higher elevation = clouds appear lower/closer)
				float elevation = mix( 1.0, 0.1, cloudElevation );
				vec2 cloudUV = direction.xz / ( direction.y * elevation );
				cloudUV *= cloudScale;
				cloudUV += time * cloudSpeed;

				// Cloud density field
				float evolve = time * cloudSpeed * 300.0;
				float cloudNoise = clamp( fbm( cloudUV * 1000.0, evolve ) * 0.7 + 0.5, 0.0, 1.0 );

				// Large-scale coverage variation: clear gaps next to dense banks
				float region = noise( cloudUV * 300.0 ) * 0.37 + 0.5;
				float cov = clamp( cloudCoverage + ( region - 0.5 ) * 0.6, 0.0, 1.0 );

				// Carve clouds where noise rises above the coverage level
				float threshold = 1.0 - cov;
				float cloudMask = smoothstep( threshold, threshold + 0.3, cloudNoise );

				// Fade clouds near horizon (adjusted by elevation)
				float horizonFade = smoothstep( 0.0, 0.03 + 0.06 * cloudElevation, direction.y );
				cloudMask *= horizonFade;

				// Cloud lighting from the sky's own radiance
				float dayFactor = smoothstep( -0.08, 0.3, vSunDirection.y );
				vec3 sunColor = vSunE * Fex * 0.22 * 0.04; // 0.22 ~ albedo/pi, 0.04 = exposure; the aerial composite adds the eye-leg extinction
				vec3 skyAmbient = Lin * 0.04 + vec3( 0.0, 0.0003, 0.00075 );

				// Beer-powder self-shadow from the sampled density
				float depth = max( 0.0, cloudNoise - threshold );
				float beer = exp( depth * -4.0 );
				float powder = 1.0 - beer * beer; // beer*beer == exp(-8*depth)
				float shade = mix( 0.45, 1.0, clamp( beer * powder * 2.6, 0.0, 1.0 ) ); // 2.6 = 1/0.385, normalizes beer*powder peak to 1

				// Henyey-Greenstein forward lobe ( g = 0.7 ): silver lining on rims toward the sun
				float silver = clamp( 0.51 / pow( 1.49 - cosTheta * 1.4, 1.5 ), 0.0, 3.0 ); // 0.51=1-g^2, 1.49=1+g^2, 1.4=2g
				float edge = cloudMask * ( 1.0 - cloudMask ) * 4.0;

				vec3 cloudColor = skyAmbient + sunColor * shade;
				cloudColor += sunColor * silver * edge * 0.6;
				cloudColor *= max( dayFactor, 0.03 );

				// Cloud opacity via Beer's law: density sets how solid the clouds get
				float alpha = ( 1.0 - exp( depth * cloudDensity * -12.0 ) ) * horizonFade;

				// Occlude the sun disc/glow behind opaque cloud
				texColor -= L0 * 0.04 * alpha;

				// Composite through the atmosphere so distant clouds dissolve into haze
				vec3 cloudAerial = mix( texColor, cloudColor, Fex );
				texColor = mix( texColor, cloudAerial, alpha );

			}

			gl_FragColor = vec4( texColor, 1.0 );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>

		}`

};

// The seasons, as the intro has them (viewer/intro/feature-tour.js SEASONS):
// grade multiplies the surfaces' colours (linear, so about twice the
// intro's, which grades its own sRGB textures) and saturation scales their
// colourfulness (below 1 greyer); what falls - its share of
// LEAF_MAX, its fall, sway and size against the snow's, its two colours,
// flat (petals, leaves: turning ellipses) or round (pollen), its opacity.
// weather: the weather the season brings.
const SEASONS = {
  spring: { weather: "clear", grade: [0.97, 1.13, 0.93], saturation: 1.18, amount: 0.5, fall: 0.75, sway: 2, size: 1.3, colors: [0xffc6d9, 0xfff0f4], flat: 1, opacity: 0.85 },
  summer: { weather: "clear", grade: [1.28, 1.1, 0.74], saturation: 1.15, amount: 0.55, fall: 0.2, sway: 1.2, size: 0.7, colors: [0xffe9a8, 0xfff6d6], flat: 0, opacity: 0.5 },
  autumn: { weather: "clear", grade: [1.24, 0.9, 0.62], saturation: 1.25, amount: 0.6, fall: 1.35, sway: 2.5, size: 1.6, colors: [0xd9662b, 0xf0b13c], flat: 1, opacity: 0.95 },
  winter: { weather: "snow", grade: [0.82, 0.93, 1.2], saturation: 0.62, amount: 0, fall: 1, sway: 1, size: 1, colors: [0xffffff, 0xe6f0ff], flat: 0, opacity: 0.9 },
};
const NO_GRADE = [1, 1, 1];

// What each weather is at full intensity. fog: the density of the fog in
// model sizes; clouds: the sky's cover; light: the exposure kept; sky: the
// sky's brightness; wind: the least wind it brings.
const PRESETS = {
  clear: { fog: 0.05, mist: 0, rain: 0, snow: 0, clouds: 0.25, light: 1, sky: 1, wind: 0, lightning: 0 },
  fog: { fog: 0.2, mist: 1, rain: 0, snow: 0, clouds: 0.6, light: 0.9, sky: 0.8, wind: 0, lightning: 0 },
  rain: { fog: 0.26, mist: 0.15, rain: 1, snow: 0, clouds: 0.95, light: 0.7, sky: 0.55, wind: 0, lightning: 0 },
  snow: { fog: 0.42, mist: 0.15, rain: 0, snow: 1, clouds: 0.9, light: 0.92, sky: 0.8, wind: 0, lightning: 0 },
  storm: { fog: 0.3, mist: 0.18, rain: 1.3, snow: 0, clouds: 1, light: 0.5, sky: 0.32, wind: 0.55, lightning: 1 },
};
const BLEND_KEYS = ["fog", "mist", "rain", "snow", "clouds", "light", "sky", "wind", "lightning"];
// Seconds to blend from one weather to another.
const BLEND_TIME = 1.6;
// Seconds to get wet, to dry, for snow to settle, to melt.
const WET_TIME = 6;
const DRY_TIME = 30;
const SETTLE_TIME = 25;
const MELT_TIME = 12;

const PHONE = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;
const RAIN_MAX = PHONE ? 10000 : 40000;
const SPLASH_MAX = PHONE ? 1500 : 5000;
// The height map of the model, texels a side.
const HEIGHT_MAP_SIZE = PHONE ? 256 : 512;
// The render layer the model is drawn on for it.
const HEIGHT_LAYER = 31;
// Seconds between redrawing it while it rains or snows (streamed models
// fill in).
const HEIGHT_REFRESH = 3;
const SNOW_MAX = PHONE ? 6000 : 18000;
// The seasons' petals, pollen and leaves.
const LEAF_MAX = PHONE ? 2000 : 6000;
// Steps of the mist's raymarch.
const MIST_STEPS = PHONE ? 14 : 28;

// Fog colours (sRGB) of a clear day, of fog, of rain and of a storm.
const FOG_COLORS = {
  clear: new Color(0xc5d2de),
  fog: new Color(0xc9ccd0),
  rain: new Color(0x8a939c),
  snow: new Color(0xd6dbe2),
  storm: new Color(0x4d555e),
};
// The haze in the light of a low sun.
const SUNLIT_HAZE = new Color(0xf2c48f);
const WHITE = new Color(0xffffff);
const WET_GROUND = new Color(0x2c2f33);
const SNOW_GROUND = new Color(0xf0f3f8);

// ---- shaders -----------------------------------------------------------------

// The viewer's WebGL renderer has a logarithmic depth buffer (main.js): the
// shaders write their depth as three's own materials do (logdepthbuf_*),
// or the model and the ground would cover them where they should not.

// Rain and snow fall through a cube that goes with the camera (uBoxMin,
// uBoxSize; updateWeather): as large as the view is deep, so they are as
// dense close up as from afar. Each drop or flake starts from its seed and
// is wherever time has taken it, wrapped into the cube - in the world, so
// they stay put as the camera moves, leaving one side, coming back at the
// other. Faded at the cube's faces and right in front of the camera.
const FALLING_PARS = /* glsl */`
  uniform vec3 uBoxMin;
  uniform float uBoxSize;
  uniform float uTime;
  uniform float uFall;
  uniform vec2 uWind;
  vec3 fallen( vec4 seed, float fall, vec2 drift ) {
    vec3 travel = vec3( uWind.x * uTime + drift.x, -fall * uTime, uWind.y * uTime + drift.y );
    return uBoxMin + mod( seed.xyz * uBoxSize + travel - uBoxMin, uBoxSize );
  }
  float boxFade( vec3 p, float width ) {
    vec3 f = ( p - uBoxMin ) / uBoxSize;
    vec3 e = min( f, 1.0 - f );
    return smoothstep( 0.0, width, min( min( e.x, e.y ), e.z ) );
  }
`;

// The model's top (or the ground) under a place, in the world: its height
// map (renderWeatherHeight) covers the model's surroundings (uMapOrigin,
// uMapSize); outside it, the ground.
const SURFACE_PARS = /* glsl */`
  uniform sampler2D uHeight;
  uniform vec3 uMapOrigin;
  uniform vec3 uMapSize;
  float surfaceAt( vec2 xz ) {
    vec2 uv = ( xz - uMapOrigin.xz ) / uMapSize.xz;
    float inside = step( 0.0, uv.x ) * step( uv.x, 1.0 ) * step( 0.0, uv.y ) * step( uv.y, 1.0 );
    return uMapOrigin.y + texture2D( uHeight, vec2( uv.x, 1.0 - uv.y ) ).r * uMapSize.y * inside;
  }
`;

// A streak is at least `uMinPixels` wide and long on screen; gone once it
// has reached a roof or the ground.
const RAIN_VERTEX = /* glsl */`
  uniform float uLength;
  uniform float uWidth;
  uniform vec2 uMinPixels;
  uniform float uViewportHeight;
  attribute vec4 aSeed;
  varying vec2 vCorner;
  varying float vAlpha;
  ${FALLING_PARS}
  ${SURFACE_PARS}
  #include <common>
  #include <fog_pars_vertex>
  #include <logdepthbuf_pars_vertex>

  void main() {
    float fall = uFall * ( 0.85 + 0.3 * aSeed.w );
    vec3 head = fallen( aSeed, fall, vec2( 0.0 ) );
    vec3 axis = normalize( vec3( uWind.x, -fall, uWind.y ) );
    vec3 toCamera = cameraPosition - head;
    float range = length( toCamera );
    vec3 side = normalize( cross( axis, toCamera / max( range, 1e-6 ) ) );
    // The size of a pixel there.
    float pixel = 2.0 / ( projectionMatrix[ 1 ][ 1 ] * uViewportHeight ) * ( isOrthographic ? 1.0 : range );
    float width = max( uWidth, pixel * uMinPixels.x );
    float streak = max( uLength, pixel * uMinPixels.y );
    vec3 transformed = head - axis * position.y * streak + side * position.x * width;
    vCorner = position.xy;
    float sheltered = step( head.y, surfaceAt( head.xz ) );
    float near = smoothstep( uBoxSize * 0.015, uBoxSize * 0.05, range );
    vAlpha = boxFade( head, 0.12 ) * near * ( 1.0 - sheltered );
    vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
    gl_Position = projectionMatrix * mvPosition;
    #include <logdepthbuf_vertex>
    #include <fog_vertex>
  }
`;

const RAIN_FRAGMENT = /* glsl */`
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vCorner;
  varying float vAlpha;
  #include <fog_pars_fragment>
  #include <logdepthbuf_pars_fragment>

  void main() {
    #include <logdepthbuf_fragment>
    float alpha = uOpacity * vAlpha * ( 1.0 - abs( vCorner.x ) ) * ( 1.0 - vCorner.y * 0.7 );
    if ( alpha < 0.004 ) discard;
    gl_FragColor = vec4( uColor, alpha );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

// Where a drop of the rain went below a roof or the ground (the same seeds
// and formulas) and the seconds since; negative while it has not.
const LANDING_PARS = /* glsl */`
  vec3 landing( vec4 seed, out float since ) {
    float fall = uFall * ( 0.85 + 0.3 * seed.w );
    vec3 p = fallen( seed, fall, vec2( 0.0 ) );
    float surface = surfaceAt( p.xz );
    since = ( surface - p.y ) / fall;
    return vec3( p.x, surface, p.z );
  }
`;

// A short ring where a drop landed.
const SPLASH_VERTEX = /* glsl */`
  uniform float uPointSize;
  uniform float uViewportHeight;
  uniform float uDuration;
  attribute vec4 aSeed;
  varying float vProgress;
  varying float vFade;
  ${FALLING_PARS}
  ${SURFACE_PARS}
  ${LANDING_PARS}
  #include <common>
  #include <fog_pars_vertex>
  #include <logdepthbuf_pars_vertex>

  void main() {
    float since;
    vec3 transformed = landing( aSeed, since );
    vProgress = since >= 0.0 ? since / uDuration : 2.0;
    vFade = boxFade( transformed, 0.12 );
    vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
    gl_Position = projectionMatrix * mvPosition;
    #include <logdepthbuf_vertex>
    float scale = isOrthographic ? projectionMatrix[ 1 ][ 1 ] : projectionMatrix[ 1 ][ 1 ] / -mvPosition.z;
    gl_PointSize = vProgress < 1.0 ? max( uPointSize * scale * uViewportHeight * 0.5 * ( 0.35 + vProgress ), 1.5 ) : 0.0;
    #include <fog_vertex>
  }
`;

const SPLASH_FRAGMENT = /* glsl */`
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vProgress;
  varying float vFade;
  #include <fog_pars_fragment>
  #include <logdepthbuf_pars_fragment>

  void main() {
    #include <logdepthbuf_fragment>
    if ( vProgress >= 1.0 ) discard;
    // Seen from the side: flattened.
    vec2 point = ( gl_PointCoord - 0.5 ) * vec2( 2.0, 6.0 );
    float d = length( point );
    float ring = smoothstep( 0.35, 0.0, abs( d - vProgress ) ) * ( 1.0 - vProgress );
    float alpha = uOpacity * ring * vFade;
    if ( alpha < 0.004 ) discard;
    gl_FragColor = vec4( uColor, alpha );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

// Drops bouncing off where the rain lands (the splashes' seeds): thrown up
// and out, falling back within uDuration.
const SPRAY_VERTEX = /* glsl */`
  uniform float uPointSize;
  uniform float uViewportHeight;
  uniform float uDuration;
  uniform float uSpeed;
  attribute vec4 aSeed;
  varying float vAlive;
  ${FALLING_PARS}
  ${SURFACE_PARS}
  ${LANDING_PARS}
  #include <common>
  #include <fog_pars_vertex>
  #include <logdepthbuf_pars_vertex>

  void main() {
    float since;
    vec3 ground = landing( aSeed, since );
    float angle = fract( aSeed.x * 7.13 + aSeed.z * 3.7 ) * 6.2832;
    vec2 spread = vec2( cos( angle ), sin( angle ) ) * uSpeed * ( 0.2 + 0.5 * aSeed.w );
    float rise = uSpeed * ( 0.8 + 0.5 * aSeed.z );
    // Back down at uDuration.
    float gravity = 2.0 * rise / uDuration;
    float t = max( since, 0.0 );
    vec3 transformed = ground + vec3( spread.x * t, rise * t - 0.5 * gravity * t * t, spread.y * t );
    vAlive = since >= 0.0 && since < uDuration ? ( 1.0 - since / uDuration ) * boxFade( ground, 0.12 ) : 0.0;
    vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
    gl_Position = projectionMatrix * mvPosition;
    #include <logdepthbuf_vertex>
    float scale = isOrthographic ? projectionMatrix[ 1 ][ 1 ] : projectionMatrix[ 1 ][ 1 ] / -mvPosition.z;
    gl_PointSize = vAlive > 0.0 ? max( uPointSize * scale * uViewportHeight * 0.5, 1.5 ) : 0.0;
    #include <fog_vertex>
  }
`;

const SPRAY_FRAGMENT = /* glsl */`
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlive;
  #include <fog_pars_fragment>
  #include <logdepthbuf_pars_fragment>

  void main() {
    #include <logdepthbuf_fragment>
    float alpha = uOpacity * vAlive * smoothstep( 1.0, 0.3, length( gl_PointCoord - 0.5 ) * 2.0 );
    if ( alpha < 0.004 ) discard;
    gl_FragColor = vec4( uColor, alpha );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

// The height map: the model seen from above, its height over the ground in
// the map's box (0..1).
const HEIGHT_VERTEX = /* glsl */`
  uniform float uGround;
  uniform float uTop;
  varying float vHeight;

  void main() {
    vec4 local = vec4( position, 1.0 );
    #ifdef USE_INSTANCING
      local = instanceMatrix * local;
    #endif
    vec4 world = modelMatrix * local;
    vHeight = ( world.y - uGround ) / ( uTop - uGround );
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const HEIGHT_FRAGMENT = /* glsl */`
  varying float vHeight;

  void main() {
    gl_FragColor = vec4( clamp( vHeight, 0.0, 1.0 ), 0.0, 0.0, 1.0 );
  }
`;

// Swaying as they fall; settled once on a roof or the ground.
const SNOW_VERTEX = /* glsl */`
  uniform float uPointSize;
  uniform float uViewportHeight;
  uniform float uSway;
  attribute vec4 aSeed;
  varying float vAlpha;
  ${FALLING_PARS}
  ${SURFACE_PARS}
  #include <common>
  #include <fog_pars_vertex>
  #include <logdepthbuf_pars_vertex>

  void main() {
    float fall = uFall * ( 0.7 + 0.6 * aSeed.w );
    float t = uTime * ( 0.6 + aSeed.w ) + aSeed.x * 40.0;
    vec2 sway = vec2( sin( t ), cos( t * 0.8 + aSeed.z * 9.0 ) ) * uSway;
    vec3 transformed = fallen( aSeed, fall, sway );
    float settled = step( transformed.y, surfaceAt( transformed.xz ) );
    vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
    float near = smoothstep( uBoxSize * 0.01, uBoxSize * 0.04, -mvPosition.z );
    vAlpha = boxFade( transformed, 0.12 ) * near * ( 1.0 - settled );
    gl_Position = projectionMatrix * mvPosition;
    #include <logdepthbuf_vertex>
    float scale = isOrthographic ? projectionMatrix[ 1 ][ 1 ] : projectionMatrix[ 1 ][ 1 ] / -mvPosition.z;
    gl_PointSize = max( uPointSize * ( 0.6 + 0.8 * aSeed.w ) * scale * uViewportHeight * 0.5, 2.0 );
    #include <fog_vertex>
  }
`;

const SNOW_FRAGMENT = /* glsl */`
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  #include <fog_pars_fragment>
  #include <logdepthbuf_pars_fragment>

  void main() {
    #include <logdepthbuf_fragment>
    float d = length( gl_PointCoord - 0.5 ) * 2.0;
    float alpha = uOpacity * vAlpha * smoothstep( 1.0, 0.25, d );
    if ( alpha < 0.004 ) discard;
    gl_FragColor = vec4( uColor, alpha );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

// The seasons' petals, pollen and leaves: falling as the snow does, each
// turning as it goes - a flat ellipse (uFlat 1) or a soft round grain (0),
// in a colour between uColor and uColorB (the intro's flakes).
const LEAF_VERTEX = SNOW_VERTEX
  .replace("varying float vAlpha;", "varying float vAlpha;\n  varying vec4 vSeed;")
  .replace("vAlpha = boxFade(", "vSeed = aSeed;\n    vAlpha = boxFade(");

const LEAF_FRAGMENT = /* glsl */`
  uniform vec3 uColor;
  uniform vec3 uColorB;
  uniform float uOpacity;
  uniform float uFlat;
  uniform float uTime;
  varying float vAlpha;
  varying vec4 vSeed;
  #include <fog_pars_fragment>
  #include <logdepthbuf_pars_fragment>

  void main() {
    #include <logdepthbuf_fragment>
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float a = uTime * ( 1.0 + vSeed.x * 2.0 ) + vSeed.y * 6.28;
    vec2 r = mat2( cos( a ), -sin( a ), sin( a ), cos( a ) ) * uv;
    r.y *= mix( 1.0, 2.2, uFlat );
    float d = dot( r, r );
    if ( d > 1.0 ) discard;
    float shape = mix( exp( -d * 2.5 ), 1.0 - smoothstep( 0.7, 1.0, d ), uFlat );
    float alpha = uOpacity * vAlpha * shape;
    if ( alpha < 0.004 ) discard;
    gl_FragColor = vec4( mix( uColor, uColorB, vSeed.z ), alpha );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

// Mist: raymarched through the box it fills (drawn by its back faces, so
// from inside it too), up to the scene's depth. Density: a 3D noise (two
// octaves, drifting) less the coverage and less again the higher up - so
// the thicker a clump, the higher it rises. Each step's light: the fog
// colour, lighter higher up, and the sun's, through one step of the mist
// towards it and brighter looking towards it.
const MIST_VERTEX = /* glsl */`
  varying vec3 vWorld;

  void main() {
    vec4 world = modelMatrix * vec4( position, 1.0 );
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const MIST_FRAGMENT = /* glsl */`
  #include <packing>
  uniform sampler3D uNoise;
  uniform sampler2D uDepth;
  uniform vec2 uResolution;
  uniform float uNear;
  uniform float uFar;
  uniform float uLogDepth;
  uniform float uOrthographic;
  uniform vec3 uCameraForward;
  uniform vec3 uBoxMin;
  uniform vec3 uBoxMax;
  uniform float uScale;
  uniform vec3 uDrift;
  uniform float uDensity;
  uniform float uCoverage;
  uniform float uSpread;
  uniform float uSigma;
  uniform float uShadowReach;
  uniform float uMaxMarch;
  uniform vec3 uFogColor;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  varying vec3 vWorld;

  float mistDensity( vec3 p, bool fine ) {
    vec3 q = p * uScale;
    float n = texture( uNoise, q + uDrift ).r;
    if ( fine ) n = n * 0.65 + texture( uNoise, q * 2.7 - uDrift * 1.6 ).r * 0.35;
    float h = ( p.y - uBoxMin.y ) / ( uBoxMax.y - uBoxMin.y );
    vec2 center = ( uBoxMin.xz + uBoxMax.xz ) * 0.5;
    float r = length( p.xz - center ) / ( ( uBoxMax.x - uBoxMin.x ) * 0.5 );
    // Clumps: the noise above the coverage, less with height; a blanket:
    // densest on the ground, thinning upwards, the noise only shading it.
    float clumps = clamp( ( n - ( 1.0 - uCoverage ) - h * 0.55 ) * 4.0, 0.0, 1.0 );
    float blanket = ( 0.25 + 0.75 * n ) * exp( -h * 3.5 ) * ( 1.0 - smoothstep( 0.75, 1.0, h ) );
    float d = mix( clumps, blanket * 0.3, uSpread );
    return d * smoothstep( 0.0, 0.04, h ) * ( 1.0 - smoothstep( 0.6, 1.0, r ) );
  }

  void main() {
    vec3 origin = cameraPosition;
    vec3 direction = normalize( vWorld - cameraPosition );
    if ( uOrthographic > 0.5 ) {
      direction = uCameraForward;
      origin = vWorld - direction * dot( vWorld - cameraPosition, direction );
    }
    vec3 inverse = 1.0 / direction;
    vec3 t0 = ( uBoxMin - origin ) * inverse;
    vec3 t1 = ( uBoxMax - origin ) * inverse;
    vec3 tMin = min( t0, t1 );
    vec3 tMax = max( t0, t1 );
    float tNear = max( max( tMin.x, tMin.y ), max( tMin.z, 0.0 ) );
    float tFar = min( min( tMax.x, tMax.y ), tMax.z );

    // The scene in front: its depth, as far along the ray.
    float depth = texture2D( uDepth, gl_FragCoord.xy / uResolution ).x;
    float viewDepth = uOrthographic > 0.5 ? -orthographicDepthToViewZ( depth, uNear, uFar )
      : uLogDepth > 0.5 ? exp2( depth * log2( uFar + 1.0 ) ) - 1.0
      : -perspectiveDepthToViewZ( depth, uNear, uFar );
    if ( depth < 1.0 ) tFar = min( tFar, viewDepth / max( dot( direction, uCameraForward ), 1e-4 ) );
    tFar = min( tFar, tNear + uMaxMarch );
    if ( tFar <= tNear ) discard;

    float stepLength = ( tFar - tNear ) / float( STEPS );
    // Interleaved gradient noise: the steps start a fraction apart from
    // pixel to pixel, finer grained than random.
    float jitter = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
    float forward = 0.25 + 1.3 * pow( max( dot( direction, uSunDir ), 0.0 ), 6.0 );
    float transmittance = 1.0;
    vec3 light = vec3( 0.0 );
    for ( int i = 0; i < STEPS; i ++ ) {
      vec3 p = origin + direction * ( tNear + ( float( i ) + jitter ) * stepLength );
      float d = mistDensity( p, true ) * uDensity;
      if ( d > 0.001 ) {
        float shade = exp( -mistDensity( p + uSunDir * uShadowReach, false ) * uDensity * 2.5 );
        float h = ( p.y - uBoxMin.y ) / ( uBoxMax.y - uBoxMin.y );
        vec3 lit = uFogColor * ( 0.72 + 0.35 * h ) + uSunColor * shade * forward;
        float a = 1.0 - exp( -d * uSigma * stepLength );
        light += transmittance * a * lit;
        transmittance *= 1.0 - a;
        if ( transmittance < 0.02 ) break;
      }
    }
    float alpha = 1.0 - transmittance;
    if ( alpha < 0.003 ) discard;
    gl_FragColor = vec4( light / alpha, alpha );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// Added to the model's materials while the weather is on; `normal` is in
// view space, so up is the view matrix's.
const SURFACE_UNIFORMS = "uniform float weatherWet;\nuniform float weatherSnow;\nuniform vec3 weatherGrade;\nuniform float weatherSaturation;\n";
function surfaceChunk(physical) {
  return /* glsl */`
    float weatherLuma = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
    diffuseColor.rgb = max( mix( vec3( weatherLuma ), diffuseColor.rgb, weatherSaturation ), 0.0 ) * weatherGrade;
    float weatherUp = dot( normal, normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ) );
    float weatherCover = weatherSnow * smoothstep( 0.3, 0.75, weatherUp );
    float weatherWetness = weatherWet * ( 0.55 + 0.45 * clamp( weatherUp, 0.0, 1.0 ) ) * ( 1.0 - weatherCover );
    diffuseColor.rgb *= 1.0 - 0.45 * weatherWetness;
    diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.93, 0.95, 1.0 ), weatherCover );
    ${physical ? `
    roughnessFactor = mix( roughnessFactor, 0.12, weatherWetness * 0.85 );
    roughnessFactor = mix( roughnessFactor, 0.85, weatherCover );
    metalnessFactor = mix( metalnessFactor, 0.0, weatherCover );` : ""}
  `;
}

// Line icons of the seasons' window (24 units, drawn in the text colour).
const SEASON_ICONS = {
  off: '<path d="M12 4v7"/><path d="M7.5 7a6.5 6.5 0 1 0 9 0"/>',
  spring: '<path d="M12 21v-8"/><path d="M12 16c-3.5 0-5.5-2-5.5-5 3 0 5.5 2 5.5 5z"/><path d="M12 13c0-3.5 2-6 5.5-6 0 3.5-2 6-5.5 6z"/>',
  summer: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  autumn: '<path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14z"/><path d="M5 19l8-8"/>',
  winter: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5"/>',
};
const seasonIcon = (key) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SEASON_ICONS[key]}</svg>`;

// ---- building blocks ---------------------------------------------------------

function random4(count) {
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < seeds.length; i += 1) seeds[i] = Math.random();
  return seeds;
}

// The TSL side (editor/weather-webgpu.js) under the WebGPU renderer, else null.
function webgpu() {
  return core.rendererBackend === "webgpu" ? core.weatherWebGPU || null : null;
}

// Uniforms with these first values, GLSL ({ value }, with the fog's) or TSL
// nodes; kept as object.userData.uniforms either way.
function createUniforms(spec) {
  const gpu = webgpu();
  if (gpu) return gpu.createUniforms(spec);
  return UniformsUtils.merge([
    UniformsLib.fog,
    Object.fromEntries(Object.entries(spec).map(([key, value]) => [key, { value }])),
  ]);
}

function precipitationUniforms(extra = {}) {
  return createUniforms({
    uTime: 0,
    uBoxMin: new Vector3(),
    uBoxSize: 1,
    uMapOrigin: new Vector3(),
    uMapSize: new Vector3(1, 1, 1),
    uFall: 1,
    uWind: new Vector2(),
    uColor: new Color(),
    uOpacity: 1,
    uViewportHeight: 1,
    uOrthographic: 0,
    ...extra,
  });
}

function weatherMaterial(vertexShader, fragmentShader, uniforms) {
  return new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    // The rain's quads turn either way to the camera.
    side: DoubleSide,
    fog: true,
  });
}

// Not part of the model: no picking, no culling against a box that is not theirs.
function asOverlay(object, name) {
  object.name = name;
  object.frustumCulled = false;
  object.raycast = () => {};
  object.userData.isWeather = true;
  return object;
}

// A precipitation drawn as quads: four corners per seed, from `shape`.
// `perItem` is what the draw range counts per drop or flake.
function createQuads(seeds, shape, material, uniforms, name) {
  const count = seeds.length / 4;
  const corners = new Float32Array(count * 4 * 3);
  const vertexSeeds = new Float32Array(count * 4 * 4);
  const index = count * 4 > 65535 ? new Uint32Array(count * 6) : new Uint16Array(count * 6);
  for (let i = 0; i < count; i += 1) {
    for (let corner = 0; corner < 4; corner += 1) {
      const v = i * 4 + corner;
      corners[v * 3] = shape[corner * 2];
      corners[v * 3 + 1] = shape[corner * 2 + 1];
      vertexSeeds.set(seeds.subarray(i * 4, i * 4 + 4), v * 4);
    }
    index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(corners, 3));
  geometry.setAttribute("aSeed", new BufferAttribute(vertexSeeds, 4));
  geometry.setIndex(new BufferAttribute(index, 1));
  geometry.setDrawRange(0, 0);
  const mesh = asOverlay(new Mesh(geometry, material), name);
  Object.assign(mesh.userData, { uniforms, perItem: 6 });
  return mesh;
}

// Corners: x across (-1..1), y along the streak (0 head, 1 tail).
const STREAK = [-1, 0, 1, 0, 1, 1, -1, 1];
const SQUARE = [-1, -1, 1, -1, 1, 1, -1, 1];

// `height`: the height map's texture (createHeightMap).
function createRain(seeds, height) {
  const uniforms = precipitationUniforms({
    uLength: 0.04,
    uWidth: 0.001,
    uMinPixels: new Vector2(1.6, 18),
  });
  const gpu = webgpu();
  if (!gpu) uniforms.uHeight = { value: height };
  const material = gpu ? gpu.rainMaterial(uniforms, height) : weatherMaterial(RAIN_VERTEX, RAIN_FRAGMENT, uniforms);
  return createQuads(seeds, STREAK, material, uniforms, "weather-rain");
}

// Points with WebGL; with WebGPU (one pixel points) quads, from `gpuMaterial`.
function createPoints(seeds, vertexShader, fragmentShader, gpuMaterial, extra, name, height) {
  const uniforms = precipitationUniforms({ uPointSize: 0.01, uRight: new Vector3(1, 0, 0), uUp: new Vector3(0, 1, 0), ...extra });
  const gpu = webgpu();
  if (gpu) return createQuads(seeds, SQUARE, gpu[gpuMaterial](uniforms, height), uniforms, name);
  uniforms.uHeight = { value: height };
  const geometry = new BufferGeometry();
  // The position is not read; three wants one to count the points.
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(seeds.length / 4 * 3), 3));
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 4));
  geometry.setDrawRange(0, 0);
  const points = asOverlay(new Points(geometry, weatherMaterial(vertexShader, fragmentShader, uniforms)), name);
  Object.assign(points.userData, { uniforms, perItem: 1 });
  return points;
}

// The height map's target, the camera that looks down at the box and the
// material the model is drawn with (renderWeatherHeight).
function createHeightMap() {
  const gpu = webgpu();
  const options = { type: HalfFloatType, depthBuffer: true };
  const target = gpu
    ? new RenderTarget(HEIGHT_MAP_SIZE, HEIGHT_MAP_SIZE, options)
    : new WebGLRenderTarget(HEIGHT_MAP_SIZE, HEIGHT_MAP_SIZE, options);
  const uniforms = createUniforms({ uGround: 0, uTop: 1 });
  const material = gpu
    ? gpu.heightMaterial(uniforms)
    : new ShaderMaterial({ uniforms, vertexShader: HEIGHT_VERTEX, fragmentShader: HEIGHT_FRAGMENT, side: DoubleSide });
  const camera = new OrthographicCamera();
  camera.layers.set(HEIGHT_LAYER);
  // North (-Z) up in the map: its v runs from +Z to -Z.
  camera.up.set(0, 0, -1);
  return { target, material, uniforms, camera, key: "", age: Infinity };
}

// A tiling 3D value noise, 64 voxels a side, four octaves, stretched (summed
// noise gathers round 0.5). Made once: it takes a moment.
let mistNoise = null;
function getMistNoise(size = 64) {
  if (mistNoise) return mistNoise;
  const values = new Float32Array(size * size * size);
  let amplitude = 1;
  let total = 0;
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let octave = 0; octave < 4; octave += 1) {
    const cells = 4 << octave;
    const lattice = Float32Array.from({ length: cells * cells * cells }, () => Math.random());
    const at = (x, y, z) => lattice[((z % cells) * cells + (y % cells)) * cells + (x % cells)];
    const cell = size / cells;
    let i = 0;
    for (let z = 0; z < size; z += 1) {
      const z0 = Math.floor(z / cell);
      const tz = smooth((z / cell) % 1);
      for (let y = 0; y < size; y += 1) {
        const y0 = Math.floor(y / cell);
        const ty = smooth((y / cell) % 1);
        for (let x = 0; x < size; x += 1, i += 1) {
          const x0 = Math.floor(x / cell);
          const tx = smooth((x / cell) % 1);
          const lerp = (a, b, t) => a + (b - a) * t;
          const front = lerp(lerp(at(x0, y0, z0), at(x0 + 1, y0, z0), tx), lerp(at(x0, y0 + 1, z0), at(x0 + 1, y0 + 1, z0), tx), ty);
          const back = lerp(lerp(at(x0, y0, z0 + 1), at(x0 + 1, y0, z0 + 1), tx), lerp(at(x0, y0 + 1, z0 + 1), at(x0 + 1, y0 + 1, z0 + 1), tx), ty);
          values[i] += amplitude * lerp(front, back, tz);
        }
      }
    }
    total += amplitude;
    amplitude *= 0.5;
  }
  const data = new Uint8Array(values.length);
  values.forEach((value, i) => {
    data[i] = Math.round(clamp01((value / total - 0.5) * 2 + 0.5) * 255);
  });
  const texture = new Data3DTexture(data, size, size, size);
  texture.format = RedFormat;
  texture.type = UnsignedByteType;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.wrapR = RepeatWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  mistNoise = texture;
  return texture;
}

// The mist's box (a unit cube, placed and scaled in updateWeatherBounds).
function createMist(noise) {
  const uniforms = createUniforms({
    uResolution: new Vector2(1, 1),
    uNear: 0.1,
    uFar: 1000,
    uLogDepth: 0,
    uOrthographic: 0,
    uCameraForward: new Vector3(0, 0, -1),
    uBoxMin: new Vector3(),
    uBoxMax: new Vector3(1, 1, 1),
    uScale: 1,
    uDrift: new Vector3(),
    uDensity: 0,
    uCoverage: 0.5,
    uSpread: 0.6,
    uSigma: 1,
    uShadowReach: 1,
    uMaxMarch: 1,
    uFogColor: new Color(),
    uSunColor: new Color(),
    uSunDir: new Vector3(0, 1, 0),
  });
  const gpu = webgpu();
  let material;
  if (gpu) {
    material = gpu.mistMaterial(uniforms, noise, MIST_STEPS);
  } else {
    uniforms.uNoise = { value: noise };
    uniforms.uDepth = { value: null };
    material = new ShaderMaterial({
      uniforms,
      vertexShader: MIST_VERTEX,
      fragmentShader: MIST_FRAGMENT,
      defines: { STEPS: MIST_STEPS },
      transparent: true,
      depthWrite: false,
      // The scene's depth is read instead (it stops the ray).
      depthTest: false,
      side: BackSide,
    });
  }
  const mesh = asOverlay(new Mesh(new BoxGeometry(1, 1, 1), material), "weather-mist");
  mesh.userData.uniforms = uniforms;
  // After the rest of the scene.
  mesh.renderOrder = 10;
  return mesh;
}

// A disc on the ground that turns wet or white, fading out at its rim.
function createGround() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "#fff");
  gradient.addColorStop(0.6, "#fff");
  gradient.addColorStop(1, "#000");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const material = new MeshStandardMaterial({
    color: WET_GROUND,
    roughness: 0.2,
    metalness: 0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    alphaMap: new CanvasTexture(canvas),
  });
  const ground = new Mesh(new CircleGeometry(0.5, 64), material);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.renderOrder = -1;
  return asOverlay(ground, "weather-ground");
}

// The sky, hazed towards (and below) the horizon in the fog colour, mixed
// in after the colour space conversion as three's fog is.
function createSky() {
  const gpu = webgpu();
  if (gpu) {
    const sky = gpu.createSky();
    sky.renderOrder = -2;
    return asOverlay(sky, "weather-sky");
  }
  const sky = new Sky();
  const material = sky.material;
  material.uniforms.weatherHaze = { value: 0 };
  material.uniforms.weatherHazeColor = { value: new Color() };
  material.uniforms.weatherSkyGain = { value: 1 };
  material.fragmentShader = material.fragmentShader
    .replace("void main() {", "uniform float weatherHaze;\nuniform vec3 weatherHazeColor;\nuniform float weatherSkyGain;\n\nvoid main() {")
    .replace("gl_FragColor = vec4( texColor, 1.0 );", "gl_FragColor = vec4( texColor * weatherSkyGain, 1.0 );")
    .replace("#include <colorspace_fragment>", `#include <colorspace_fragment>
      float weatherHorizon = direction.y < 0.0 ? max( weatherHaze, 0.85 ) : weatherHaze * ( 1.0 - smoothstep( 0.0, 0.5, direction.y ) );
      gl_FragColor.rgb = mix( gl_FragColor.rgb, weatherHazeColor, weatherHorizon );`);
  material.uniforms.cloudScale.value = 0.0003;
  sky.userData.uniforms = material.uniforms;
  sky.renderOrder = -2;
  return asOverlay(sky, "weather-sky");
}

// A lightning bolt from `from` down to `to`: midpoint displacement, with
// branches; returned as segments [a, b, width] for the ribbons.
function boltSegments(from, to, scale) {
  const segments = [];
  const split = (a, b, width, depth, branchChance) => {
    if (depth === 0) {
      segments.push([a, b, width]);
      return;
    }
    const length = a.distanceTo(b);
    const middle = a.clone().lerp(b, 0.5 + (Math.random() - 0.5) * 0.2);
    middle.x += (Math.random() - 0.5) * length * 0.32;
    middle.z += (Math.random() - 0.5) * length * 0.32;
    split(a, middle, width, depth - 1, branchChance);
    split(middle, b, width, depth - 1, branchChance);
    if (Math.random() < branchChance) {
      const end = middle.clone().add(new Vector3(
        (Math.random() - 0.5) * length * 0.9,
        -length * (0.3 + Math.random() * 0.4),
        (Math.random() - 0.5) * length * 0.9,
      ));
      split(middle, end, width * 0.5, Math.max(depth - 2, 1), branchChance * 0.5);
    }
  };
  split(from, to, scale, 7, 0.22);
  return segments;
}

// The ribbons face the camera where it stands when the bolt strikes (it
// lasts a fraction of a second); at least `minPixels` wide on screen.
function createBolt(segments, camera, viewportHeight, minPixels) {
  const pixelAngle = camera.isPerspectiveCamera
    ? 2 * Math.tan(MathUtils.degToRad(camera.fov) / 2) / viewportHeight
    : 0;
  const positions = new Float32Array(segments.length * 6 * 3);
  const along = new Vector3();
  const toCamera = new Vector3();
  const side = new Vector3();
  segments.forEach(([a, b, width], i) => {
    along.subVectors(b, a);
    toCamera.subVectors(camera.position, a);
    const w = Math.max(width, toCamera.length() * pixelAngle * minPixels) * 0.5;
    side.crossVectors(along, toCamera).normalize().multiplyScalar(w);
    const quad = [
      a.x - side.x, a.y - side.y, a.z - side.z,
      a.x + side.x, a.y + side.y, a.z + side.z,
      b.x + side.x, b.y + side.y, b.z + side.z,
      a.x - side.x, a.y - side.y, a.z - side.z,
      b.x + side.x, b.y + side.y, b.z + side.z,
      b.x - side.x, b.y - side.y, b.z - side.z,
    ];
    positions.set(quad, i * 18);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  const material = new MeshBasicMaterial({
    color: 0xe8eeff,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    fog: false,
    toneMapped: false,
  });
  return asOverlay(new Mesh(geometry, material), "weather-lightning");
}

// The flicker of a strike over its lifetime (0..1): flashes and a return stroke.
function strikeBrightness(t) {
  if (t >= 1) return 0;
  const pulses = [[0, 0.12, 1], [0.22, 0.32, 0.55], [0.4, 0.62, 0.9]];
  return pulses.reduce((value, [start, end, peak]) => {
    if (t < start || t > end) return value;
    return Math.max(value, peak * (1 - (t - start) / (end - start)));
  }, 0);
}

// ---- sound -------------------------------------------------------------------

function noiseBuffer(context, seconds, brown = false) {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

function createSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0.8;
  master.connect(context.destination);
  const loop = (buffer, filters, gain) => {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    let node = source;
    filters.forEach((filter) => {
      node.connect(filter);
      node = filter;
    });
    node.connect(gain);
    gain.gain.value = 0;
    gain.connect(master);
    source.start();
    return source;
  };
  const filter = (type, frequency, Q = 0.7) => {
    const node = context.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = Q;
    return node;
  };
  const rainGain = context.createGain();
  loop(noiseBuffer(context, 2), [filter("highpass", 900), filter("lowpass", 7000)], rainGain);
  const windGain = context.createGain();
  const windFilter = filter("bandpass", 380, 1.8);
  loop(noiseBuffer(context, 3, true), [windFilter], windGain);
  return { context, master, rainGain, windGain, windFilter, brown: noiseBuffer(context, 6, true) };
}

// A clap and a long rumble; further away is softer and duller.
function playThunder(sound, distance) {
  const { context } = sound;
  const now = context.currentTime;
  const source = context.createBufferSource();
  source.buffer = sound.brown;
  const lowpass = context.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(900 - 500 * distance, now);
  lowpass.frequency.exponentialRampToValueAtTime(120, now + 4);
  const gain = context.createGain();
  const peak = 1.4 - 0.8 * distance;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.04 + 0.3 * distance);
  gain.gain.exponentialRampToValueAtTime(peak * 0.35, now + 0.9);
  gain.gain.exponentialRampToValueAtTime(peak * 0.5, now + 1.4);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 5.5);
  source.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(sound.master);
  source.start(now, Math.random() * 0.5, 6);
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function finite(value, fallback = null) {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : fallback;
}

const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
// Eases `current` towards `target` at `rate` (per second).
const approach = (current, target, step) => (current < target ? Math.min(current + step, target) : Math.max(current - step, target));

function attachWeather(Viewer) {
  const urlType = (() => {
    try {
      return new URL(window.location.href).searchParams.get("weather");
    } catch (_error) {
      return null;
    }
  })();

  Object.assign(Viewer, {
    weather: {
      enabled: false,
      ...WEATHER_DEFAULTS,
      // ?weather=rain: once the first model is there.
      pending: WEATHER_TYPES.includes(urlType) ? urlType : null,
    },
    weatherObjects: null,

    // With WebGPU, once its TSL side is loaded (renderer-backend.js).
    isWeatherAvailable() {
      return core.rendererBackend !== "webgpu" || Boolean(core.weatherWebGPU);
    },

    setWeather(enabled) {
      const on = enabled === true && Viewer.isWeatherAvailable();
      if (on === Viewer.weather.enabled) return on;
      if (on) Viewer.enableWeather();
      else Viewer.disableWeather();
      Viewer.syncWeatherPanel();
      Viewer.updateEditorToolbarState?.();
      return on;
    },

    // Any of type, intensity, wind, windDirection, sky, surfaces, sound.
    setWeatherOptions(options = {}) {
      const state = Viewer.weather;
      if (WEATHER_TYPES.includes(options.type)) state.type = options.type;
      const intensity = finite(options.intensity);
      if (intensity != null) state.intensity = clamp01(intensity);
      const wind = finite(options.wind);
      if (wind != null) state.wind = clamp01(wind);
      const direction = finite(options.windDirection);
      if (direction != null) state.windDirection = ((direction % 360) + 360) % 360;
      ["mistHeight", "mistDensity", "mistSpread"].forEach((key) => {
        const value = finite(options[key]);
        if (value != null) state[key] = clamp01(value);
      });
      ["sky", "surfaces", "sound"].forEach((key) => {
        if (typeof options[key] === "boolean") state[key] = options[key];
      });
      if (WEATHER_SEASONS.includes(options.season) || options.season === null) state.season = options.season;
      if (WEATHER_TYPES.includes(options.type) && !state.enabled) Viewer.setWeather(true);
      Viewer.applyWeatherToggles();
      Viewer.syncWeatherPanel();
      Viewer.syncSeasonsPanel();
    },

    // A season (WEATHER_SEASONS) with the weather it brings, or none (null):
    // then its weather goes too, unless another was chosen since.
    setWeatherSeason(season) {
      const state = Viewer.weather;
      if (!WEATHER_SEASONS.includes(season)) {
        const own = state.enabled && state.seasonType === state.type;
        state.season = null;
        state.seasonType = null;
        if (own) Viewer.setWeather(false);
        else Viewer.setWeatherOptions({ season: null });
        Viewer.updateEditorToolbarState?.();
        return;
      }
      const type = SEASONS[season].weather;
      state.seasonType = type;
      Viewer.setWeatherOptions({ type, season });
      Viewer.updateEditorToolbarState?.();
    },

    enableWeather() {
      if (!core.scene) return;
      const rainSeeds = random4(RAIN_MAX);
      const heightMap = createHeightMap();
      const heightTexture = heightMap.target.texture;
      const objects = {
        group: asOverlay(new Group(), "weather"),
        sky: createSky(),
        heightMap,
        rain: createRain(rainSeeds, heightTexture),
        splashes: createPoints(rainSeeds.slice(0, SPLASH_MAX * 4), SPLASH_VERTEX, SPLASH_FRAGMENT, "splashMaterial", { uDuration: 0.22 }, "weather-splashes", heightTexture),
        spray: createPoints(rainSeeds.slice(0, SPLASH_MAX * 4), SPRAY_VERTEX, SPRAY_FRAGMENT, "sprayMaterial", { uDuration: 0.32, uSpeed: 0.1 }, "weather-spray", heightTexture),
        snow: createPoints(random4(SNOW_MAX), SNOW_VERTEX, SNOW_FRAGMENT, "snowMaterial", { uSway: 0.01 }, "weather-snow", heightTexture),
        leaves: createPoints(random4(LEAF_MAX), LEAF_VERTEX, LEAF_FRAGMENT, "leafMaterial", { uSway: 0.01, uColorB: new Color(), uFlat: 0 }, "weather-leaves", heightTexture),
        mist: null,
        // The scene's depth for the mist (WebGL).
        mistDepth: null,
        ground: createGround(),
        flashLight: new DirectionalLight(0xdfe6ff, 0),
        flashTarget: new Object3D(),
        bolt: null,
        strike: null,
        nextStrike: 2 + Math.random() * 3,
        fog: new FogExp2(0xffffff, 0),
        previousFog: core.scene.fog,
        // What the weather is now, blending towards the chosen one.
        current: { ...PRESETS.clear, light: 1, sky: 1, fog: 0, clouds: 0 },
        fogColor: FOG_COLORS.clear.clone(),
        wet: 0,
        snowCover: 0,
        // The season now, blending towards the chosen one: its grade, how
        // much falls, and what (SEASONS).
        season: { grade: [...NO_GRADE], saturation: 1, leaves: 0, flat: 0, fall: 1, sway: 1, size: 1, opacity: 0, colorA: new Color(0xffffff), colorB: new Color(0xffffff) },
        time: 0,
        // With WebGPU the node materials' own (weather-webgpu.js).
        surfaceUniforms: webgpu()?.surfaceUniforms || { weatherWet: { value: 0 }, weatherSnow: { value: 0 }, weatherGrade: { value: new Color(1, 1, 1) }, weatherSaturation: { value: 1 } },
        patched: new Map(),
        patchScan: 0,
        bounds: null,
        boundsKey: "",
        sound: null,
      };
      objects.flashLight.name = "weather-flash";
      objects.flashLight.target = objects.flashTarget;
      objects.splashes.userData.uniforms.uColor.value.set(0xc8d2dc);
      objects.spray.userData.uniforms.uColor.value.set(0xd6dee6);
      objects.snow.userData.uniforms.uColor.value.set(0xffffff);
      objects.rain.userData.uniforms.uColor.value.set(0xb4c0cc);
      objects.mist = createMist(getMistNoise());
      objects.group.add(objects.sky, objects.ground, objects.mist, objects.rain, objects.splashes, objects.spray, objects.snow, objects.leaves, objects.flashLight, objects.flashTarget);
      core.scene.add(objects.group);
      core.scene.fog = objects.fog;
      Viewer.weatherObjects = objects;
      Viewer.weather.enabled = true;
      Viewer.applyWeatherToggles();
      Viewer.updateWeather(0);
    },

    disableWeather() {
      const objects = Viewer.weatherObjects;
      Viewer.weather.enabled = false;
      Viewer.weatherObjects = null;
      // The season goes with its weather.
      Viewer.weather.season = null;
      Viewer.weather.seasonType = null;
      Viewer.syncSeasonsPanel?.();
      if (!objects) return;
      Viewer.unpatchWeatherSurfaces(objects);
      objects.surfaceUniforms.weatherWet.value = 0;
      objects.surfaceUniforms.weatherSnow.value = 0;
      objects.surfaceUniforms.weatherGrade.value.setRGB(1, 1, 1);
      objects.surfaceUniforms.weatherSaturation.value = 1;
      objects.bolt?.removeFromParent();
      objects.group.removeFromParent();
      objects.group.traverse((object) => {
        // Sprites share one geometry of three's.
        if (!object.isSprite) object.geometry?.dispose();
        object.material?.alphaMap?.dispose();
        object.material?.dispose();
      });
      objects.bolt?.geometry.dispose();
      objects.bolt?.material.dispose();
      // The noise stays made (its GPU copy goes).
      mistNoise?.dispose();
      objects.mistDepth?.target.dispose();
      objects.heightMap.target.dispose();
      objects.heightMap.material.dispose();
      objects.mistDepth?.material.dispose();
      if (core.scene && core.scene.fog === objects.fog) core.scene.fog = objects.previousFog ?? null;
      if (core.renderer) core.renderer.toneMappingExposure = getRenderingSettings().exposure;
      objects.sound?.context.close();
    },

    // The sky shown or not, the sound started or stopped: from the state.
    applyWeatherToggles() {
      const objects = Viewer.weatherObjects;
      const state = Viewer.weather;
      if (!objects) return;
      objects.sky.visible = state.sky;
      if (state.sound && !objects.sound) objects.sound = createSound();
      if (objects.sound) {
        if (state.sound) objects.sound.context.resume();
        else objects.sound.context.suspend();
      }
      // The grade of a season needs the patch still (updateWeatherSurfaces).
      if (!state.surfaces && !state.season) Viewer.unpatchWeatherSurfaces(objects);
    },

    getWeatherModelRoots() {
      const slots = Array.isArray(core.mainObject) ? core.mainObject : [core.mainObject];
      return slots.flat().filter((item) => item?.isObject3D && !item.userData?.isWeather);
    },

    // The box the weather fills: the model's footprint and some, from the
    // ground to well above it. The ground is the viewer's grid and shadow
    // plane (viewer-utils.js), which a model may reach below; else the
    // model's base.
    updateWeatherBounds(objects) {
      const box = new Box3();
      Viewer.getWeatherModelRoots().forEach((root) => box.expandByObject(root));
      const size = core.gridSize || (box.isEmpty() ? 1 : box.getSize(new Vector3()).length()) || 1;
      if (box.isEmpty()) box.setFromCenterAndSize(new Vector3(), new Vector3(size, size, size));
      const ground = core.basicGrid?.isObject3D ? core.basicGrid.getWorldPosition(new Vector3()).y : box.min.y;
      const key = [box.min.toArray(), box.max.toArray(), size, ground].join("|");
      if (key === objects.boundsKey) return objects.bounds;
      objects.boundsKey = key;
      const center = box.getCenter(new Vector3());
      const half = size * 2.6;
      const height = Math.max(box.max.y - ground, 0) + size * 3;
      const origin = new Vector3(center.x - half, ground, center.z - half);
      const volume = new Vector3(half * 2, height, half * 2);
      objects.bounds = { box, center, size, origin, volume, ground };
      // The height map covers the model's surroundings (`origin`, `volume`).
      [objects.rain, objects.splashes, objects.spray, objects.snow, objects.leaves].forEach((mesh) => {
        mesh.userData.uniforms.uMapOrigin.value.copy(origin);
        mesh.userData.uniforms.uMapSize.value.copy(volume);
      });
      // The model moved or changed: its height map again.
      objects.heightMap.age = Infinity;
      // Just under the shadow plane, so the shadows lie on it.
      objects.ground.position.set(center.x, ground - size * 0.0005, center.z);
      objects.ground.scale.setScalar(size * 3.2);
      // The mist: its clumps a fraction of the model across; marched no
      // further than three model sizes (the fog is beyond). Its box: in
      // updateWeather (its height is a setting).
      const mist = objects.mist.userData.uniforms;
      mist.uScale.value = 1 / (size * 1.6);
      mist.uSigma.value = 14 / size;
      mist.uShadowReach.value = size * 0.08;
      mist.uMaxMarch.value = size * 3;
      objects.flashTarget.position.copy(center);
      return objects.bounds;
    },

    // Every frame (main.js animate).
    updateWeather(delta = 0) {
      const state = Viewer.weather;
      if (state.pending && !state.enabled && core.scene && Viewer.getWeatherModelRoots().length) {
        const type = state.pending;
        state.pending = null;
        Viewer.setWeatherOptions({ type });
      }
      const objects = Viewer.weatherObjects;
      if (!objects || !core.scene || !core.camera) return;
      const dt = Math.min(delta, 0.1);
      objects.time += dt;
      const bounds = Viewer.updateWeatherBounds(objects);
      const size = bounds.size;

      // Blend towards the chosen weather at its intensity.
      const preset = PRESETS[state.type] || PRESETS.clear;
      const amount = 0.25 + 0.75 * state.intensity;
      // A downpour hides the distance, hazes the ground and darkens the day.
      const pour = clamp01(preset.rain * state.intensity) ** 2;
      const target = {
        fog: preset.fog * (state.type === "fog" ? 0.35 + 0.65 * state.intensity : amount) + pour * 0.18,
        mist: preset.mist * amount + pour * 0.06,
        rain: preset.rain * state.intensity,
        snow: preset.snow * state.intensity,
        clouds: PRESETS.clear.clouds + (preset.clouds - PRESETS.clear.clouds) * amount,
        light: (1 + (preset.light - 1) * amount) * (1 - pour * 0.25),
        sky: (1 + (preset.sky - 1) * amount) * (1 - pour * 0.3),
        wind: Math.max(state.wind, preset.wind * amount),
        lightning: preset.lightning * state.intensity,
      };
      const step = dt / BLEND_TIME;
      BLEND_KEYS.forEach((key) => {
        objects.current[key] += (target[key] - objects.current[key]) * Math.min(step * 3, 1);
      });
      const current = objects.current;

      // The sun: how much of it comes through the clouds, how low (warm) it is.
      const sunDir = Viewer.getWeatherSunDirection();
      const sunlight = MathUtils.smoothstep(sunDir.y, -0.05, 0.15) * (1 - current.clouds * 0.55);
      const warm = 1 - clamp01(sunDir.y / 0.5);
      // A low sun gilds the haze.
      const fogTarget = (FOG_COLORS[state.type] || FOG_COLORS.clear).clone().lerp(SUNLIT_HAZE, warm * sunlight * 0.55);
      objects.fogColor.lerp(fogTarget, Math.min(step * 3, 1));

      // The surfaces: wet while it rains, snow settling while it snows.
      if (state.surfaces) {
        objects.wet = current.rain > 0.05
          ? approach(objects.wet, Math.min(current.rain * 1.4, 1), dt / WET_TIME)
          : approach(objects.wet, 0, dt / DRY_TIME);
        objects.snowCover = current.snow > 0.05
          ? approach(objects.snowCover, Math.min(0.35 + current.snow, 1), dt / SETTLE_TIME)
          : approach(objects.snowCover, 0, dt * (current.rain > 0.05 ? 3 : 1) / MELT_TIME);
      } else {
        objects.wet = 0;
        objects.snowCover = 0;
      }
      Viewer.updateWeatherSurfaces(objects, dt);

      // Wind: blowing towards `windDirection` (degrees clockwise from -Z,
      // seen from above, as the sun study's north).
      const bearing = MathUtils.degToRad(state.windDirection);
      const windX = Math.sin(bearing);
      const windZ = -Math.cos(bearing);

      // Fog. Without post-processing three's WebGL materials mix it in after
      // converting to sRGB: given in sRGB there, so it looks the same with
      // either pipeline and with WebGPU (the sky's haze takes it too).
      objects.fog.color.copy(objects.fogColor);
      if (!webgpu() && !isPostProcessingActive()) objects.fog.color.convertLinearToSRGB();
      objects.fog.density = current.fog / size;
      if (core.scene.fog !== objects.fog) core.scene.fog = objects.fog;

      // Rain and its splashes.
      const viewportHeight = core.renderer?.getDrawingBufferSize(new Vector2()).y || 1;
      const orthographic = core.camera.isOrthographicCamera ? 1 : 0;
      // Which way the camera's right and up point: the WebGPU flakes face it.
      const right = new Vector3().setFromMatrixColumn(core.camera.matrixWorld, 0);
      const up = new Vector3().setFromMatrixColumn(core.camera.matrixWorld, 1);
      [objects.rain, objects.splashes, objects.spray, objects.snow, objects.leaves].forEach((mesh) => {
        const uniforms = mesh.userData.uniforms;
        uniforms.uTime.value = objects.time;
        uniforms.uViewportHeight.value = viewportHeight;
        uniforms.uOrthographic.value = orthographic;
        uniforms.uRight?.value.copy(right);
        uniforms.uUp?.value.copy(up);
      });
      const setCount = (mesh, count) => {
        mesh.geometry.setDrawRange(0, count * mesh.userData.perItem);
        mesh.visible = count > 0;
      };

      // The cube the rain and the snow fall through: as large as the view
      // is deep (in steps of √2, so it keeps still while the camera moves a
      // little), mostly ahead of the camera. Everything in it is measured
      // in its size, so they look the same close up and from afar.
      const camera = core.camera;
      const viewDepth = camera.isOrthographicCamera
        ? (camera.top - camera.bottom) / camera.zoom
        : camera.position.distanceTo(core.controls?.target || bounds.center);
      const cube = 2 ** (Math.round(Math.log2(Math.max(viewDepth * 1.5, size * 0.02)) * 2) / 2);
      // The sizes below: in the view's depth, which the cube follows.
      const reach = cube / 1.5;
      const ahead = camera.getWorldDirection(new Vector3()).multiplyScalar(cube * 0.3);
      const boxMin = camera.position.clone().add(ahead).subScalar(cube / 2);
      [objects.rain, objects.splashes, objects.spray, objects.snow, objects.leaves].forEach((mesh) => {
        mesh.userData.uniforms.uBoxMin.value.copy(boxMin);
        mesh.userData.uniforms.uBoxSize.value = cube;
      });
      // How hard it rains (0..1); the drops grow with its square, so the
      // middle stays a rain and the top is a downpour.
      const rainAmount = clamp01(current.rain);
      const rain = objects.rain.userData.uniforms;
      setCount(objects.rain, Math.round(RAIN_MAX * rainAmount * rainAmount));
      // A drop: a few hundredths of the view's depth long, falling nearly
      // two of them a second; splashes and bounces to scale.
      [rain, objects.splashes.userData.uniforms, objects.spray.userData.uniforms].forEach((uniforms) => {
        uniforms.uFall.value = reach * 1.75;
        uniforms.uWind.value.set(windX, windZ).multiplyScalar(current.wind * reach * 0.9);
      });
      rain.uOpacity.value = 0.16 + 0.24 * rainAmount;
      rain.uLength.value = reach * 0.024 * (1 + 0.9 * rainAmount);
      rain.uWidth.value = reach * 0.0009 * (1 + 0.6 * rainAmount);
      objects.splashes.userData.uniforms.uPointSize.value = reach * 0.015;
      objects.spray.userData.uniforms.uSpeed.value = reach * 0.05;
      objects.spray.userData.uniforms.uPointSize.value = reach * 0.0018;
      rain.uColor.value.copy(objects.fogColor).lerp(new Color(0xdde6ee), 0.6);
      setCount(objects.splashes, Math.round(SPLASH_MAX * rainAmount));
      objects.splashes.userData.uniforms.uOpacity.value = 0.55;
      setCount(objects.spray, Math.round(SPLASH_MAX * rainAmount));
      objects.spray.userData.uniforms.uOpacity.value = 0.7;

      // The model's height map: when it moved, and now and then while
      // something falls on it.
      objects.heightMap.age += dt;
      if ((objects.rain.visible || objects.snow.visible || objects.leaves.visible) && objects.heightMap.age > HEIGHT_REFRESH) {
        objects.heightMap.age = 0;
        Viewer.renderWeatherHeight(objects, bounds);
      }

      // Snow: like the rain, more of it and in bigger flakes as it thickens.
      const snowAmount = clamp01(current.snow);
      const snow = objects.snow.userData.uniforms;
      setCount(objects.snow, Math.round(SNOW_MAX * snowAmount ** 1.5));
      snow.uFall.value = reach * 0.11;
      snow.uWind.value.set(windX, windZ).multiplyScalar(current.wind * reach * 0.33);
      snow.uPointSize.value = reach * 0.0048 * (0.8 + 0.5 * snowAmount);
      snow.uSway.value = reach * 0.015;
      snow.uOpacity.value = 0.9;

      // The season: its grade and what falls, blending over as the weather
      // does; the colours of what falls turn while it thins out.
      const season = SEASONS[state.season] || null;
      const seasonNow = objects.season;
      const blend = Math.min(step * 3, 1);
      const grade = season ? season.grade : NO_GRADE;
      for (let k = 0; k < 3; k += 1) seasonNow.grade[k] += (grade[k] - seasonNow.grade[k]) * blend;
      seasonNow.saturation += ((season ? season.saturation : 1) - seasonNow.saturation) * blend;
      seasonNow.leaves += ((season ? season.amount : 0) - seasonNow.leaves) * blend;
      if (season && season.amount > 0) {
        seasonNow.colorA.lerp(new Color(season.colors[0]), blend);
        seasonNow.colorB.lerp(new Color(season.colors[1]), blend);
        ["flat", "fall", "sway", "size", "opacity"].forEach((key) => {
          seasonNow[key] += (season[key] - seasonNow[key]) * blend;
        });
      }
      const leaves = objects.leaves.userData.uniforms;
      setCount(objects.leaves, Math.round(LEAF_MAX * clamp01(seasonNow.leaves)));
      leaves.uFall.value = reach * 0.11 * seasonNow.fall;
      leaves.uWind.value.set(windX, windZ).multiplyScalar(current.wind * reach * 0.4);
      leaves.uPointSize.value = reach * 0.0048 * seasonNow.size;
      leaves.uSway.value = reach * 0.015 * seasonNow.sway;
      leaves.uOpacity.value = seasonNow.opacity;
      leaves.uFlat.value = seasonNow.flat;
      leaves.uColor.value.copy(seasonNow.colorA);
      leaves.uColorB.value.copy(seasonNow.colorB);

      // Mist: drifting with the wind (in noise tiles), lit by the sun - warm
      // when it is low, little of it through thick clouds.
      const mist = objects.mist.userData.uniforms;
      objects.mist.visible = current.mist > 0.005 && !core.renderer?.xr?.isPresenting;
      mist.uDensity.value = current.mist * (0.2 + 1.6 * state.mistDensity);
      // Rain's haze stays even.
      mist.uSpread.value = state.type === "fog" ? state.mistSpread : 1;
      // Its box: out to where the fog takes over, as high as set.
      const mistRadius = size * 3.5;
      const mistHeight = size * (0.15 + state.mistHeight);
      objects.mist.position.set(bounds.center.x, bounds.ground + mistHeight / 2, bounds.center.z);
      objects.mist.scale.set(mistRadius * 2, mistHeight, mistRadius * 2);
      mist.uBoxMin.value.set(bounds.center.x - mistRadius, bounds.ground, bounds.center.z - mistRadius);
      mist.uBoxMax.value.set(bounds.center.x + mistRadius, bounds.ground + mistHeight, bounds.center.z + mistRadius);
      // Rain's haze: lighter than its grey air, and even rather than in clumps.
      mist.uCoverage.value = 0.3 + 0.25 * clamp01(current.mist) + 0.25 * rainAmount;
      // In noise tiles: drifting with the wind, slowly churning upwards.
      objects.mistDrift = (objects.mistDrift || 0) + dt * (0.008 + current.wind * 0.05);
      mist.uDrift.value.set(windX * objects.mistDrift, objects.time * 0.004, windZ * objects.mistDrift);
      mist.uNear.value = camera.near;
      mist.uFar.value = camera.far;
      mist.uLogDepth.value = core.renderer?.logarithmicDepthBuffer || core.renderer?.capabilities?.logarithmicDepthBuffer ? 1 : 0;
      mist.uOrthographic.value = orthographic;
      camera.getWorldDirection(mist.uCameraForward.value);
      core.renderer?.getDrawingBufferSize(mist.uResolution.value);
      if (objects.mist.visible && !webgpu()) Viewer.renderWeatherMistDepth(objects);
      mist.uFogColor.value.copy(objects.fogColor).lerp(WHITE, 0.35 * rainAmount);
      mist.uSunDir.value.copy(sunDir);
      mist.uSunColor.value.setRGB(1, 0.86 - 0.22 * warm, 0.7 - 0.4 * warm).multiplyScalar(sunlight * 0.9);

      // The ground: wet, then white.
      const groundMaterial = objects.ground.material;
      groundMaterial.color.copy(WET_GROUND).lerp(SNOW_GROUND, objects.snowCover);
      groundMaterial.roughness = MathUtils.lerp(0.15, 0.9, objects.snowCover);
      groundMaterial.opacity = Math.max(objects.wet * 0.45 * (1 - objects.snowCover), objects.snowCover * 0.95);
      objects.ground.visible = groundMaterial.opacity > 0.002;

      // Lightning.
      const flash = Viewer.updateWeatherLightning(objects, dt, bounds);

      // The sky.
      const sky = objects.sky;
      if (sky.visible) {
        const far = core.camera.far || size * 100;
        sky.scale.setScalar(far * 1.1);
        sky.position.copy(core.camera.position);
        const uniforms = sky.userData.uniforms;
        uniforms.sunPosition.value.copy(sunDir);
        uniforms.cloudCoverage.value = current.clouds;
        uniforms.cloudDensity.value = 0.35 + 0.6 * current.clouds;
        uniforms.cloudSpeed.value = 0.00002 * (1 + current.wind * 6);
        uniforms.time.value = objects.time;
        uniforms.turbidity.value = 2 + 8 * current.clouds;
        uniforms.rayleigh.value = 1 + current.clouds;
        uniforms.showSunDisc.value = current.clouds < 0.7 ? 1 : 0;
        uniforms.weatherHaze.value = clamp01(0.2 + current.fog * 0.9);
        uniforms.weatherHazeColor.value.copy(objects.fog.color);
        uniforms.weatherSkyGain.value = current.sky * (1 + flash * 3);
      }

      // Darker under clouds, brighter in a flash; the setting stays.
      if (core.renderer) core.renderer.toneMappingExposure = getRenderingSettings().exposure * current.light * (1 + flash * 1.2);

      Viewer.updateWeatherSound(objects, current);
    },

    // The model seen from above into its height map: only the model (on a
    // layer of its own for this), its height in the precipitation's box;
    // the ground (cleared to 0) where there is none.
    renderWeatherHeight(objects, bounds) {
      const renderer = core.renderer;
      const scene = core.scene;
      if (!renderer || !scene) return;
      const { origin, volume, size } = bounds;
      const map = objects.heightMap;
      const camera = map.camera;
      camera.left = -volume.x / 2;
      camera.right = volume.x / 2;
      camera.top = volume.z / 2;
      camera.bottom = -volume.z / 2;
      camera.near = 0;
      camera.far = volume.y + size;
      camera.position.set(origin.x + volume.x / 2, origin.y + volume.y + size * 0.5, origin.z + volume.z / 2);
      camera.lookAt(origin.x + volume.x / 2, origin.y, origin.z + volume.z / 2);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      map.uniforms.uGround.value = origin.y;
      map.uniforms.uTop.value = origin.y + volume.y;
      const roots = Viewer.getWeatherModelRoots();
      roots.forEach((root) => root.traverse((object) => object.layers.enable(HEIGHT_LAYER)));
      const previous = {
        target: renderer.getRenderTarget(),
        override: scene.overrideMaterial,
        shadows: renderer.shadowMap.autoUpdate,
        clearColor: renderer.getClearColor(new Color()),
        clearAlpha: renderer.getClearAlpha(),
      };
      scene.overrideMaterial = map.material;
      renderer.shadowMap.autoUpdate = false;
      try {
        renderer.setRenderTarget(map.target);
        renderer.setClearColor(0x000000, 1);
        renderer.clear();
        renderer.render(scene, camera);
      } finally {
        renderer.setRenderTarget(previous.target);
        renderer.setClearColor(previous.clearColor, previous.clearAlpha);
        scene.overrideMaterial = previous.override;
        renderer.shadowMap.autoUpdate = previous.shadows;
        roots.forEach((root) => root.traverse((object) => object.layers.disable(HEIGHT_LAYER)));
      }
    },

    // The scene's depth for the mist, at half size (WebGL; WebGPU reads the
    // viewport's): the scene drawn once more with a material that writes
    // depth only - without the weather, the sky and the shadow maps.
    renderWeatherMistDepth(objects) {
      const renderer = core.renderer;
      const scene = core.scene;
      if (!renderer || !scene || !core.camera) return;
      const full = renderer.getDrawingBufferSize(new Vector2());
      const width = Math.max(1, Math.ceil(full.x / 2));
      const height = Math.max(1, Math.ceil(full.y / 2));
      if (!objects.mistDepth) {
        const target = new WebGLRenderTarget(width, height, { depthBuffer: true });
        target.depthTexture = new DepthTexture(width, height);
        objects.mistDepth = { target, material: new MeshBasicMaterial({ colorWrite: false }) };
        objects.mist.userData.uniforms.uDepth.value = target.depthTexture;
      } else if (objects.mistDepth.target.width !== width || objects.mistDepth.target.height !== height) {
        objects.mistDepth.target.setSize(width, height);
      }
      const previous = {
        target: renderer.getRenderTarget(),
        override: scene.overrideMaterial,
        shadows: renderer.shadowMap.autoUpdate,
      };
      objects.group.visible = false;
      scene.overrideMaterial = objects.mistDepth.material;
      renderer.shadowMap.autoUpdate = false;
      try {
        renderer.setRenderTarget(objects.mistDepth.target);
        renderer.clear();
        renderer.render(scene, core.camera);
      } finally {
        renderer.setRenderTarget(previous.target);
        scene.overrideMaterial = previous.override;
        renderer.shadowMap.autoUpdate = previous.shadows;
        objects.group.visible = true;
      }
    },

    // Where the sky's sun is: the sun study's, else where the key light
    // comes from (not below 12°).
    getWeatherSunDirection() {
      const direction = new Vector3(0.4, 0.55, 0.7);
      if (Viewer.sunStudy?.enabled) {
        sunDirection(Viewer.getSunPosition(), Viewer.sunStudy.north, direction);
        return direction;
      }
      const light = core.dirLight;
      if (light?.isDirectionalLight) {
        direction.subVectors(light.position, light.target?.position || new Vector3());
        if (direction.lengthSq() < 1e-12) direction.set(0.4, 0.55, 0.7);
      }
      direction.normalize();
      const minimum = Math.sin(MathUtils.degToRad(12));
      if (direction.y < minimum) {
        const horizontal = Math.hypot(direction.x, direction.z) || 1;
        const scale = Math.sqrt(1 - minimum * minimum) / horizontal;
        direction.set(direction.x * scale, minimum, direction.z * scale);
      }
      return direction;
    },

    // A strike now and then while it storms; its brightness this frame (0..1).
    updateWeatherLightning(objects, dt, bounds) {
      const strength = objects.current.lightning;
      let strike = objects.strike;
      if (!strike && strength > 0.05) {
        objects.nextStrike -= dt * strength;
        if (objects.nextStrike <= 0) {
          objects.nextStrike = 3 + Math.random() * 8;
          strike = Viewer.startWeatherStrike(objects, bounds);
        }
      }
      if (!strike) {
        objects.flashLight.intensity = 0;
        return 0;
      }
      strike.age += dt;
      const brightness = strikeBrightness(strike.age / strike.duration) * strike.strength;
      objects.flashLight.intensity = brightness * 6;
      if (objects.bolt) objects.bolt.material.opacity = Math.min(brightness * 1.6, 1);
      if (!strike.thundered && objects.sound && Viewer.weather.sound && strike.age >= strike.thunderDelay) {
        strike.thundered = true;
        playThunder(objects.sound, strike.distance);
      }
      if (strike.age >= Math.max(strike.duration, strike.thunderDelay + 0.05)) {
        objects.strike = null;
        if (objects.bolt) {
          objects.bolt.removeFromParent();
          objects.bolt.geometry.dispose();
          objects.bolt.material.dispose();
          objects.bolt = null;
        }
      }
      return brightness;
    },

    // A bolt somewhere around the model (or only its flash, from inside the
    // clouds); the thunder follows later the further away it struck.
    startWeatherStrike(objects, bounds) {
      const size = bounds.size;
      const angle = Math.random() * Math.PI * 2;
      // 0 near, 1 far.
      const distance = Math.random();
      const reach = size * (1.3 + distance * 2.2);
      const ground = new Vector3(bounds.center.x + Math.cos(angle) * reach, bounds.ground, bounds.center.z + Math.sin(angle) * reach);
      const top = ground.clone().add(new Vector3((Math.random() - 0.5) * size, bounds.volume.y + size * 1.5, (Math.random() - 0.5) * size));
      const visible = Math.random() < 0.7;
      if (visible) {
        const viewportHeight = core.renderer?.getDrawingBufferSize(new Vector2()).y || 1;
        objects.bolt = createBolt(boltSegments(top, ground, size * 0.004), core.camera, viewportHeight, 2.5);
        objects.group.add(objects.bolt);
      }
      objects.flashLight.position.copy(top);
      objects.strike = {
        age: 0,
        duration: 0.55 + Math.random() * 0.3,
        strength: (visible ? 1 : 0.55) * (1 - distance * 0.5),
        distance,
        thunderDelay: 0.3 + distance * 2.5,
        thundered: false,
      };
      return objects.strike;
    },

    updateWeatherSound(objects, current) {
      const sound = objects.sound;
      if (!sound || !Viewer.weather.sound) return;
      const now = sound.context.currentTime;
      const rainAmount = clamp01(current.rain);
      sound.rainGain.gain.setTargetAtTime(rainAmount * (0.1 + 0.3 * rainAmount), now, 0.3);
      sound.windGain.gain.setTargetAtTime(current.wind * current.wind * 0.6, now, 0.5);
      // Gusts.
      sound.windFilter.frequency.setTargetAtTime(300 + 260 * (0.5 + 0.5 * Math.sin(objects.time * 0.7) * Math.sin(objects.time * 0.23)), now, 0.4);
    },

    // ---- window ---------------------------------------------------------------

    isWeatherPanelOpen() {
      return Boolean(Viewer.weatherPanel);
    },

    toggleWeatherPanel(open = !Viewer.weatherPanel) {
      if (open) Viewer.createWeatherPanel();
      else Viewer.removeWeatherPanel();
      Viewer.updateEditorToolbarState?.();
    },

    createWeatherPanel() {
      if (Viewer.weatherPanel || !core.container || Viewer.urlOptions?.hideUi === true) return;
      const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
      };
      const panel = el("section", "viewer-weather");
      panel.id = "viewerWeather";
      panel.setAttribute("role", "group");
      const header = el("div", "viewer-weather_header");
      const title = el("span", "viewer-weather_title");
      const closeButton = el("button", "viewer-weather_icon", "×");
      closeButton.type = "button";
      header.append(title, closeButton);

      // The weathers, and off.
      const chips = el("div", "viewer-weather_types");
      const typeButtons = {};
      [["off", "⏻"], ["clear", "☀️"], ["fog", "🌫️"], ["rain", "🌧️"], ["snow", "🌨️"], ["storm", "⛈️"]].forEach(([type, icon]) => {
        const button = el("button", "viewer-weather_type");
        button.type = "button";
        button.dataset.weather = type;
        const glyph = el("span", "viewer-weather_type-icon", icon);
        glyph.setAttribute("aria-hidden", "true");
        const label = el("span", "viewer-weather_type-label");
        button.append(glyph, label);
        button.addEventListener("click", () => {
          if (type === "off") Viewer.setWeather(false);
          else Viewer.setWeatherOptions({ type });
        });
        chips.append(button);
        typeButtons[type] = { button, label };
      });

      // Sliders: 0..1 shown in per cent, the direction in degrees.
      const sliders = {};
      const slider = (key, max = 1, step = 0.01) => {
        const row = el("label", "viewer-weather_slider");
        const text = el("span", "viewer-weather_slider-label");
        const value = el("output", "viewer-weather_slider-value");
        const input = el("input");
        input.type = "range";
        input.min = "0";
        input.max = String(max);
        input.step = String(step);
        input.addEventListener("input", () => Viewer.setWeatherOptions({ [key]: Number(input.value) }));
        row.append(text, input, value);
        sliders[key] = { row, text, value, input, max };
        return row;
      };
      const settings = el("div", "viewer-weather_settings");
      settings.append(
        slider("intensity"),
        slider("wind"),
        slider("windDirection", 359, 1),
        slider("mistHeight"),
        slider("mistDensity"),
        slider("mistSpread"),
      );

      const checks = {};
      const toggles = el("div", "viewer-weather_checks");
      ["sky", "surfaces", "sound"].forEach((key) => {
        const row = el("label", "viewer-weather_check");
        const input = el("input");
        input.type = "checkbox";
        input.addEventListener("change", () => Viewer.setWeatherOptions({ [key]: input.checked }));
        const text = el("span");
        row.append(input, text);
        toggles.append(row);
        checks[key] = { row, input, text };
      });

      panel.append(header, chips, settings, toggles);
      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        panel.addEventListener(type, (event) => event.stopPropagation());
      });
      closeButton.addEventListener("click", () => Viewer.toggleWeatherPanel(false));
      attachToolPanelChrome(panel, header, {
        before: closeButton,
        icon: PANEL_ICONS.weather,
        label: () => t("weather.title", "Weather"),
      });
      getViewerSideStack()?.append(panel);
      Viewer.weatherPanel = { panel, title, closeButton, typeButtons, sliders, checks };
      Viewer.updateWeatherLabels();
    },

    removeWeatherPanel() {
      Viewer.weatherPanel?.panel.remove();
      Viewer.weatherPanel = null;
    },

    // ---- the seasons' window (Look > Seasons) ---------------------------------

    isSeasonsPanelOpen() {
      return Boolean(Viewer.seasonsPanel);
    },

    toggleSeasonsPanel(open = !Viewer.seasonsPanel) {
      if (open) Viewer.createSeasonsPanel();
      else Viewer.removeSeasonsPanel();
      Viewer.updateEditorToolbarState?.();
    },

    createSeasonsPanel() {
      if (Viewer.seasonsPanel || !core.container || Viewer.urlOptions?.hideUi === true) return;
      const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
      };
      const panel = el("section", "viewer-weather viewer-seasons");
      panel.id = "viewerSeasons";
      panel.setAttribute("role", "group");
      const header = el("div", "viewer-weather_header");
      const title = el("span", "viewer-weather_title");
      const closeButton = el("button", "viewer-weather_icon", "×");
      closeButton.type = "button";
      header.append(title, closeButton);

      // The seasons, and none.
      const chips = el("div", "viewer-weather_types viewer-weather_types--seasons");
      const buttons = {};
      ["off", ...WEATHER_SEASONS].forEach((key) => {
        const button = el("button", "viewer-weather_type");
        button.type = "button";
        button.dataset.season = key;
        const glyph = el("span", "viewer-weather_type-icon");
        glyph.innerHTML = seasonIcon(key);
        const label = el("span", "viewer-weather_type-label");
        button.append(glyph, label);
        button.addEventListener("click", () => Viewer.setWeatherSeason(key === "off" ? null : key));
        chips.append(button);
        buttons[key] = { button, label };
      });

      panel.append(header, chips);
      ["pointerdown", "pointerup", "wheel", "keydown"].forEach((type) => {
        panel.addEventListener(type, (event) => event.stopPropagation());
      });
      closeButton.addEventListener("click", () => Viewer.toggleSeasonsPanel(false));
      attachToolPanelChrome(panel, header, {
        before: closeButton,
        icon: PANEL_ICONS.seasons,
        label: () => t("seasons.title", "Seasons"),
      });
      getViewerSideStack()?.append(panel);
      Viewer.seasonsPanel = { panel, title, closeButton, buttons };
      Viewer.updateSeasonsLabels();
    },

    removeSeasonsPanel() {
      Viewer.seasonsPanel?.panel.remove();
      Viewer.seasonsPanel = null;
    },

    updateSeasonsLabels() {
      const ui = Viewer.seasonsPanel;
      if (!ui) return;
      const name = t("seasons.title", "Seasons");
      ui.panel.setAttribute("aria-label", name);
      ui.title.textContent = name;
      refreshToolPanelChrome(ui.panel);
      ui.closeButton.title = t("weather.close", "Close");
      ui.closeButton.setAttribute("aria-label", ui.closeButton.title);
      const names = {
        off: t("seasons.off", "None"),
        spring: t("seasons.spring", "Spring"),
        summer: t("seasons.summer", "Summer"),
        autumn: t("seasons.autumn", "Autumn"),
        winter: t("seasons.winter", "Winter"),
      };
      Object.entries(ui.buttons).forEach(([key, { button, label }]) => {
        label.textContent = names[key];
        button.title = names[key];
      });
      Viewer.syncSeasonsPanel();
    },

    syncSeasonsPanel() {
      const ui = Viewer.seasonsPanel;
      if (!ui) return;
      const state = Viewer.weather;
      const current = state.enabled && state.season ? state.season : "off";
      Object.entries(ui.buttons).forEach(([key, { button }]) => {
        const active = key === current;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
    },

    updateWeatherLabels() {
      Viewer.updateSeasonsLabels();
      const ui = Viewer.weatherPanel;
      if (!ui) return;
      const name = t("weather.title", "Weather");
      ui.panel.setAttribute("aria-label", name);
      ui.title.textContent = name;
      refreshToolPanelChrome(ui.panel);
      ui.closeButton.title = t("weather.close", "Close");
      ui.closeButton.setAttribute("aria-label", ui.closeButton.title);
      const typeNames = {
        off: t("weather.off", "Off"),
        clear: t("weather.clear", "Clear sky"),
        fog: t("weather.fog", "Fog"),
        rain: t("weather.rain", "Rain"),
        snow: t("weather.snow", "Snow"),
        storm: t("weather.storm", "Thunderstorm"),
      };
      Object.entries(ui.typeButtons).forEach(([type, { button, label }]) => {
        label.textContent = typeNames[type];
        button.title = typeNames[type];
      });
      const sliderNames = {
        intensity: t("weather.intensity", "Intensity"),
        wind: t("weather.wind", "Wind"),
        windDirection: t("weather.windDirection", "Wind direction"),
        mistHeight: t("weather.mistHeight", "Mist height"),
        mistDensity: t("weather.mistDensity", "Mist density"),
        mistSpread: t("weather.mistSpread", "Mist spread"),
      };
      Object.entries(ui.sliders).forEach(([key, { text }]) => {
        text.textContent = sliderNames[key];
      });
      const checkNames = {
        sky: t("weather.sky", "Sky"),
        surfaces: t("weather.surfaces", "Wet surfaces and snow cover"),
        sound: t("weather.sound", "Sound"),
      };
      Object.entries(ui.checks).forEach(([key, { text }]) => {
        text.textContent = checkNames[key];
      });
      Viewer.syncWeatherPanel();
    },

    // The window shows the state: the weather chosen, and only the settings
    // it has - the wet and the snow where something falls, the mist's with
    // fog, the wind's direction once there is wind.
    syncWeatherPanel() {
      const ui = Viewer.weatherPanel;
      if (!ui) return;
      const state = Viewer.weather;
      const on = state.enabled;
      const current = on ? state.type : "off";
      Object.entries(ui.typeButtons).forEach(([type, { button }]) => {
        const active = type === current;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      const fog = on && state.type === "fog";
      const shown = {
        intensity: on,
        wind: on,
        windDirection: on && (state.wind > 0 || state.type === "storm"),
        mistHeight: fog,
        mistDensity: fog,
        mistSpread: fog,
      };
      Object.entries(ui.sliders).forEach(([key, { row, input, value, max }]) => {
        row.hidden = !shown[key];
        const number = key === "windDirection" ? Math.round(state[key]) : state[key];
        if (document.activeElement !== input) input.value = String(number);
        value.textContent = max > 1 ? `${Math.round(number)}°` : `${Math.round(number * 100)}%`;
      });
      const checksShown = { sky: on, surfaces: on && ["rain", "snow", "storm"].includes(state.type), sound: on };
      Object.entries(ui.checks).forEach(([key, { row, input }]) => {
        row.hidden = !checksShown[key];
        input.checked = state[key] === true;
      });
    },

    // ---- surfaces -------------------------------------------------------------

    // The materials of the model take the wet and the snow (patched as they
    // turn up: a streamed model brings new ones), and give them back when
    // both are gone.
    updateWeatherSurfaces(objects, dt) {
      const uniforms = objects.surfaceUniforms;
      uniforms.weatherWet.value = objects.wet;
      uniforms.weatherSnow.value = objects.snowCover;
      const [r, g, b] = objects.season.grade;
      uniforms.weatherGrade.value.setRGB(r, g, b);
      uniforms.weatherSaturation.value = objects.season.saturation;
      // The node materials have it built in (renderer-backend.js).
      if (webgpu()) return;
      const graded = Math.abs(r - 1) + Math.abs(g - 1) + Math.abs(b - 1) + Math.abs(objects.season.saturation - 1) > 0.002;
      const needed = graded || (Viewer.weather.surfaces && (objects.wet > 0.001 || objects.snowCover > 0.001));
      if (!needed) {
        if (objects.patched.size) Viewer.unpatchWeatherSurfaces(objects);
        return;
      }
      objects.patchScan -= dt;
      if (objects.patchScan > 0) return;
      objects.patchScan = 1;
      Viewer.getWeatherModelRoots().forEach((root) => root.traverse((object) => {
        if (!object.isMesh || object.userData?.isWeather) return;
        (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => {
          Viewer.patchWeatherSurface(objects, material);
        });
      }));
    },

    patchWeatherSurface(objects, material) {
      if (!material || objects.patched.has(material)) return;
      const kind = material.isMeshStandardMaterial ? "physical"
        : material.isMeshPhongMaterial ? "phong"
          : material.isMeshLambertMaterial ? "lambert"
            : null;
      if (!kind) return;
      const own = (key) => Object.prototype.hasOwnProperty.call(material, key);
      const previous = {
        onBeforeCompile: own("onBeforeCompile") ? material.onBeforeCompile : undefined,
        customProgramCacheKey: own("customProgramCacheKey") ? material.customProgramCacheKey : undefined,
      };
      const baseCompile = material.onBeforeCompile;
      const baseKey = material.customProgramCacheKey;
      const chunk = surfaceChunk(kind === "physical");
      const include = `#include <lights_${kind}_fragment>`;
      const uniforms = objects.surfaceUniforms;
      material.onBeforeCompile = function (shader, renderer) {
        baseCompile.call(this, shader, renderer);
        if (!shader.fragmentShader.includes(include)) return;
        shader.uniforms.weatherWet = uniforms.weatherWet;
        shader.uniforms.weatherSnow = uniforms.weatherSnow;
        shader.uniforms.weatherGrade = uniforms.weatherGrade;
        shader.uniforms.weatherSaturation = uniforms.weatherSaturation;
        shader.fragmentShader = SURFACE_UNIFORMS + shader.fragmentShader.replace(include, `${chunk}\n${include}`);
      };
      material.customProgramCacheKey = function () {
        return `${baseKey.call(this)}|weather`;
      };
      material.needsUpdate = true;
      objects.patched.set(material, previous);
    },

    unpatchWeatherSurfaces(objects) {
      objects.patched.forEach((previous, material) => {
        ["onBeforeCompile", "customProgramCacheKey"].forEach((key) => {
          if (previous[key]) material[key] = previous[key];
          else delete material[key];
        });
        material.needsUpdate = true;
      });
      objects.patched.clear();
      objects.patchScan = 0;
    },

    // ---- manifests ------------------------------------------------------------

    // AIM3DViewer.weather of an exported manifest: only while it is on.
    getWeatherForExport() {
      const state = Viewer.weather;
      if (!state.enabled) return undefined;
      return {
        type: state.type,
        intensity: Math.round(state.intensity * 100) / 100,
        wind: Math.round(state.wind * 100) / 100,
        windDirection: Math.round(state.windDirection),
        ...(state.sky ? {} : { sky: false }),
        ...(state.surfaces ? {} : { surfaces: false }),
        mistHeight: Math.round(state.mistHeight * 100) / 100,
        mistDensity: Math.round(state.mistDensity * 100) / 100,
        mistSpread: Math.round(state.mistSpread * 100) / 100,
        ...(state.season ? { season: state.season } : {}),
      };
    },

    // A manifest's weather (absent: none).
    apply3IFManifestWeather(weather) {
      if (!isPlainObject(weather) || !WEATHER_TYPES.includes(weather.type)) {
        Viewer.setWeather(false);
        return false;
      }
      const season = WEATHER_SEASONS.includes(weather.season) ? weather.season : null;
      Viewer.setWeatherOptions({ ...weather, season, sound: false });
      if (season) Viewer.weather.seasonType = weather.type;
      return true;
    },

    // Before a new model: the weather goes with the old one, as the sun does.
    disposeWeather() {
      Viewer.setWeather(false);
    },
  });
}

export { WEATHER_DEFAULTS, WEATHER_SEASONS, WEATHER_TYPES, attachWeather };
//# sourceMappingURL=weather-D6dHWr_Y.js.map
