import { b6 as Loader, b7 as FileLoader, fG as TextureLoader, f1 as Points, eJ as LineSegments, h as Mesh, V as Vector3, ba as PointsMaterial, aV as LineBasicMaterial, a_ as MeshPhongMaterial, f as BackSide, ai as DoubleSide, bd as FrontSide, Q as Vector2, bb as SRGBColorSpace, C as Color, bk as AddOperation, aO as EquirectangularRefractionMapping, aN as EquirectangularReflectionMapping, al as ClampToEdgeWrapping, bw as MirroredRepeatWrapping, bv as RepeatWrapping, a$ as MeshPhysicalMaterial, b0 as MeshStandardMaterial, am as BufferGeometry, an as Float32BufferAttribute } from './three-DQIwNvhE.js';

class LWO2Parser {

	constructor( IFFParser ) {

		this.IFF = IFFParser;

	}

	parseBlock() {

		this.IFF.debugger.offset = this.IFF.reader.offset;
		this.IFF.debugger.closeForms();

		const blockID = this.IFF.reader.getIDTag();
		let length = this.IFF.reader.getUint32(); // size of data in bytes
		if ( length > this.IFF.reader.dv.byteLength - this.IFF.reader.offset ) {

			this.IFF.reader.offset -= 4;
			length = this.IFF.reader.getUint16();

		}

		this.IFF.debugger.dataOffset = this.IFF.reader.offset;
		this.IFF.debugger.length = length;

		// Data types may be found in either LWO2 OR LWO3 spec
		switch ( blockID ) {

			case 'FORM': // form blocks may consist of sub -chunks or sub-forms
				this.IFF.parseForm( length );
				break;

			// SKIPPED CHUNKS
			// if break; is called directly, the position in the lwoTree is not created
			// any sub chunks and forms are added to the parent form instead
			// MISC skipped
			case 'ICON': // Thumbnail Icon Image
			case 'VMPA': // Vertex Map Parameter
			case 'BBOX': // bounding box
			// case 'VMMD':
			// case 'VTYP':

			// normal maps can be specified, normally on models imported from other applications. Currently ignored
			case 'NORM':

			// ENVL FORM skipped
			case 'PRE ':
			case 'POST':
			case 'KEY ':
			case 'SPAN':

			// CLIP FORM skipped
			case 'TIME':
			case 'CLRS':
			case 'CLRA':
			case 'FILT':
			case 'DITH':
			case 'CONT':
			case 'BRIT':
			case 'SATR':
			case 'HUE ':
			case 'GAMM':
			case 'NEGA':
			case 'IFLT':
			case 'PFLT':

			// Image Map Layer skipped
			case 'PROJ':
			case 'AXIS':
			case 'AAST':
			case 'PIXB':
			case 'AUVO':
			case 'STCK':

			// Procedural Textures skipped
			case 'PROC':
			case 'VALU':
			case 'FUNC':

			// Gradient Textures skipped
			case 'PNAM':
			case 'INAM':
			case 'GRST':
			case 'GREN':
			case 'GRPT':
			case 'FKEY':
			case 'IKEY':

			// Texture Mapping Form skipped
			case 'CSYS':

			// Surface CHUNKs skipped
			case 'OPAQ': // top level 'opacity' checkbox
			case 'CMAP': // clip map

			// Surface node CHUNKS skipped
			// These mainly specify the node editor setup in LW
			case 'NLOC':
			case 'NZOM':
			case 'NVER':
			case 'NSRV':
			case 'NVSK': // unknown
			case 'NCRD':
			case 'WRPW': // image wrap w ( for cylindrical and spherical projections)
			case 'WRPH': // image wrap h
			case 'NMOD':
			case 'NSEL':
			case 'NPRW':
			case 'NPLA':
			case 'NODS':
			case 'VERS':
			case 'ENUM':
			case 'TAG ':
			case 'OPAC':

			// Car Material CHUNKS
			case 'CGMD':
			case 'CGTY':
			case 'CGST':
			case 'CGEN':
			case 'CGTS':
			case 'CGTE':
			case 'OSMP':
			case 'OMDE':
			case 'OUTR':
			case 'FLAG':

			case 'TRNL':
			case 'GLOW':
			case 'GVAL': // glow intensity
			case 'SHRP':
			case 'RFOP':
			case 'RSAN':
			case 'TROP':
			case 'RBLR':
			case 'TBLR':
			case 'CLRH':
			case 'CLRF':
			case 'ADTR':
			case 'LINE':
			case 'ALPH':
			case 'VCOL':
			case 'ENAB':
				this.IFF.debugger.skipped = true;
				this.IFF.reader.skip( length );
				break;

			case 'SURF':
				this.IFF.parseSurfaceLwo2( length );
				break;

			case 'CLIP':
				this.IFF.parseClipLwo2( length );
				break;

			// Texture node chunks (not in spec)
			case 'IPIX': // usePixelBlending
			case 'IMIP': // useMipMaps
			case 'IMOD': // imageBlendingMode
			case 'AMOD': // unknown
			case 'IINV': // imageInvertAlpha
			case 'INCR': // imageInvertColor
			case 'IAXS': // imageAxis ( for non-UV maps)
			case 'IFOT': // imageFallofType
			case 'ITIM': // timing for animated textures
			case 'IWRL':
			case 'IUTI':
			case 'IINX':
			case 'IINY':
			case 'IINZ':
			case 'IREF': // possibly a VX for reused texture nodes
				if ( length === 4 ) this.IFF.currentNode[ blockID ] = this.IFF.reader.getInt32();
				else this.IFF.reader.skip( length );
				break;

			case 'OTAG':
				this.IFF.parseObjectTag();
				break;

			case 'LAYR':
				this.IFF.parseLayer( length );
				break;

			case 'PNTS':
				this.IFF.parsePoints( length );
				break;

			case 'VMAP':
				this.IFF.parseVertexMapping( length );
				break;

			case 'AUVU':
			case 'AUVN':
				this.IFF.reader.skip( length - 1 );
				this.IFF.reader.getVariableLengthIndex(); // VX
				break;

			case 'POLS':
				this.IFF.parsePolygonList( length );
				break;

			case 'TAGS':
				this.IFF.parseTagStrings( length );
				break;

			case 'PTAG':
				this.IFF.parsePolygonTagMapping( length );
				break;

			case 'VMAD':
				this.IFF.parseVertexMapping( length, true );
				break;

			// Misc CHUNKS
			case 'DESC': // Description Line
				this.IFF.currentForm.description = this.IFF.reader.getString();
				break;

			case 'TEXT':
			case 'CMNT':
			case 'NCOM':
				this.IFF.currentForm.comment = this.IFF.reader.getString();
				break;

			// Envelope Form
			case 'NAME':
				this.IFF.currentForm.channelName = this.IFF.reader.getString();
				break;

			// Image Map Layer
			case 'WRAP':
				this.IFF.currentForm.wrap = { w: this.IFF.reader.getUint16(), h: this.IFF.reader.getUint16() };
				break;

			case 'IMAG':
				const index = this.IFF.reader.getVariableLengthIndex();
				this.IFF.currentForm.imageIndex = index;
				break;

			// Texture Mapping Form
			case 'OREF':
				this.IFF.currentForm.referenceObject = this.IFF.reader.getString();
				break;

			case 'ROID':
				this.IFF.currentForm.referenceObjectID = this.IFF.reader.getUint32();
				break;

			// Surface Blocks
			case 'SSHN':
				this.IFF.currentSurface.surfaceShaderName = this.IFF.reader.getString();
				break;

			case 'AOVN':
				this.IFF.currentSurface.surfaceCustomAOVName = this.IFF.reader.getString();
				break;

			// Nodal Blocks
			case 'NSTA':
				this.IFF.currentForm.disabled = this.IFF.reader.getUint16();
				break;

			case 'NRNM':
				this.IFF.currentForm.realName = this.IFF.reader.getString();
				break;

			case 'NNME':
				this.IFF.currentForm.refName = this.IFF.reader.getString();
				this.IFF.currentSurface.nodes[ this.IFF.currentForm.refName ] = this.IFF.currentForm;
				break;

			// Nodal Blocks : connections
			case 'INME':
				if ( ! this.IFF.currentForm.nodeName ) this.IFF.currentForm.nodeName = [];
				this.IFF.currentForm.nodeName.push( this.IFF.reader.getString() );
				break;

			case 'IINN':
				if ( ! this.IFF.currentForm.inputNodeName ) this.IFF.currentForm.inputNodeName = [];
				this.IFF.currentForm.inputNodeName.push( this.IFF.reader.getString() );
				break;

			case 'IINM':
				if ( ! this.IFF.currentForm.inputName ) this.IFF.currentForm.inputName = [];
				this.IFF.currentForm.inputName.push( this.IFF.reader.getString() );
				break;

			case 'IONM':
				if ( ! this.IFF.currentForm.inputOutputName ) this.IFF.currentForm.inputOutputName = [];
				this.IFF.currentForm.inputOutputName.push( this.IFF.reader.getString() );
				break;

			case 'FNAM':
				this.IFF.currentForm.fileName = this.IFF.reader.getString();
				break;

			case 'CHAN': // NOTE: ENVL Forms may also have CHAN chunk, however ENVL is currently ignored
				if ( length === 4 ) this.IFF.currentForm.textureChannel = this.IFF.reader.getIDTag();
				else this.IFF.reader.skip( length );
				break;

			// LWO2 Spec chunks: these are needed since the SURF FORMs are often in LWO2 format
			case 'SMAN':
				const maxSmoothingAngle = this.IFF.reader.getFloat32();
				this.IFF.currentSurface.attributes.smooth = ( maxSmoothingAngle < 0 ) ? false : true;
				break;

			// LWO2: Basic Surface Parameters
			case 'COLR':
				this.IFF.currentSurface.attributes.Color = { value: this.IFF.reader.getFloat32Array( 3 ) };
				this.IFF.reader.skip( 2 ); // VX: envelope
				break;

			case 'LUMI':
				this.IFF.currentSurface.attributes.Luminosity = { value: this.IFF.reader.getFloat32() };
				this.IFF.reader.skip( 2 );
				break;

			case 'SPEC':
				this.IFF.currentSurface.attributes.Specular = { value: this.IFF.reader.getFloat32() };
				this.IFF.reader.skip( 2 );
				break;

			case 'DIFF':
				this.IFF.currentSurface.attributes.Diffuse = { value: this.IFF.reader.getFloat32() };
				this.IFF.reader.skip( 2 );
				break;

			case 'REFL':
				this.IFF.currentSurface.attributes.Reflection = { value: this.IFF.reader.getFloat32() };
				this.IFF.reader.skip( 2 );
				break;

			case 'GLOS':
				this.IFF.currentSurface.attributes.Glossiness = { value: this.IFF.reader.getFloat32() };
				this.IFF.reader.skip( 2 );
				break;

			case 'TRAN':
				this.IFF.currentSurface.attributes.opacity = this.IFF.reader.getFloat32();
				this.IFF.reader.skip( 2 );
				break;

			case 'BUMP':
				this.IFF.currentSurface.attributes.bumpStrength = this.IFF.reader.getFloat32();
				this.IFF.reader.skip( 2 );
				break;

			case 'SIDE':
				this.IFF.currentSurface.attributes.side = this.IFF.reader.getUint16();
				break;

			case 'RIMG':
				this.IFF.currentSurface.attributes.reflectionMap = this.IFF.reader.getVariableLengthIndex();
				break;

			case 'RIND':
				this.IFF.currentSurface.attributes.refractiveIndex = this.IFF.reader.getFloat32();
				this.IFF.reader.skip( 2 );
				break;

			case 'TIMG':
				this.IFF.currentSurface.attributes.refractionMap = this.IFF.reader.getVariableLengthIndex();
				break;

			case 'IMAP':
				this.IFF.reader.skip( 2 );
				break;

			case 'TMAP':
				this.IFF.debugger.skipped = true;
				this.IFF.reader.skip( length ); // needs implementing
				break;

			case 'IUVI': // uv channel name
				this.IFF.currentNode.UVChannel = this.IFF.reader.getString( length );
				break;

			case 'IUTL': // widthWrappingMode: 0 = Reset, 1 = Repeat, 2 = Mirror, 3 = Edge
				this.IFF.currentNode.widthWrappingMode = this.IFF.reader.getUint32();
				break;
			case 'IVTL': // heightWrappingMode
				this.IFF.currentNode.heightWrappingMode = this.IFF.reader.getUint32();
				break;

			// LWO2 USE
			case 'BLOK':
				// skip
				break;

			default:
				this.IFF.parseUnknownCHUNK( blockID, length );

		}

		if ( blockID != 'FORM' ) {

			this.IFF.debugger.node = 1;
			this.IFF.debugger.nodeID = blockID;
			this.IFF.debugger.log();

		}

		if ( this.IFF.reader.offset >= this.IFF.currentFormEnd ) {

			this.IFF.currentForm = this.IFF.parentForm;

		}

	}

}

class LWO3Parser {

	constructor( IFFParser ) {

		this.IFF = IFFParser;

	}

	parseBlock() {

		this.IFF.debugger.offset = this.IFF.reader.offset;
		this.IFF.debugger.closeForms();

		const blockID = this.IFF.reader.getIDTag();
		const length = this.IFF.reader.getUint32(); // size of data in bytes

		this.IFF.debugger.dataOffset = this.IFF.reader.offset;
		this.IFF.debugger.length = length;

		// Data types may be found in either LWO2 OR LWO3 spec
		switch ( blockID ) {

			case 'FORM': // form blocks may consist of sub -chunks or sub-forms
				this.IFF.parseForm( length );
				break;

			// SKIPPED CHUNKS
			// MISC skipped
			case 'ICON': // Thumbnail Icon Image
			case 'VMPA': // Vertex Map Parameter
			case 'BBOX': // bounding box
			// case 'VMMD':
			// case 'VTYP':

			// normal maps can be specified, normally on models imported from other applications. Currently ignored
			case 'NORM':

			// ENVL FORM skipped
			case 'PRE ': // Pre-loop behavior for the keyframe
			case 'POST': // Post-loop behavior for the keyframe
			case 'KEY ':
			case 'SPAN':

			// CLIP FORM skipped
			case 'TIME':
			case 'CLRS':
			case 'CLRA':
			case 'FILT':
			case 'DITH':
			case 'CONT':
			case 'BRIT':
			case 'SATR':
			case 'HUE ':
			case 'GAMM':
			case 'NEGA':
			case 'IFLT':
			case 'PFLT':

			// Image Map Layer skipped
			case 'PROJ':
			case 'AXIS':
			case 'AAST':
			case 'PIXB':
			case 'STCK':

			// Procedural Textures skipped
			case 'VALU':

			// Gradient Textures skipped
			case 'PNAM':
			case 'INAM':
			case 'GRST':
			case 'GREN':
			case 'GRPT':
			case 'FKEY':
			case 'IKEY':

			// Texture Mapping Form skipped
			case 'CSYS':

				// Surface CHUNKs skipped
			case 'OPAQ': // top level 'opacity' checkbox
			case 'CMAP': // clip map

			// Surface node CHUNKS skipped
			// These mainly specify the node editor setup in LW
			case 'NLOC':
			case 'NZOM':
			case 'NVER':
			case 'NSRV':
			case 'NCRD':
			case 'NMOD':
			case 'NSEL':
			case 'NPRW':
			case 'NPLA':
			case 'VERS':
			case 'ENUM':
			case 'TAG ':

			// Car Material CHUNKS
			case 'CGMD':
			case 'CGTY':
			case 'CGST':
			case 'CGEN':
			case 'CGTS':
			case 'CGTE':
			case 'OSMP':
			case 'OMDE':
			case 'OUTR':
			case 'FLAG':

			case 'TRNL':
			case 'SHRP':
			case 'RFOP':
			case 'RSAN':
			case 'TROP':
			case 'RBLR':
			case 'TBLR':
			case 'CLRH':
			case 'CLRF':
			case 'ADTR':
			case 'GLOW':
			case 'LINE':
			case 'ALPH':
			case 'VCOL':
			case 'ENAB':
				this.IFF.debugger.skipped = true;
				this.IFF.reader.skip( length );
				break;

			// Texture node chunks (not in spec)
			case 'IPIX': // usePixelBlending
			case 'IMIP': // useMipMaps
			case 'IMOD': // imageBlendingMode
			case 'AMOD': // unknown
			case 'IINV': // imageInvertAlpha
			case 'INCR': // imageInvertColor
			case 'IAXS': // imageAxis ( for non-UV maps)
			case 'IFOT': // imageFallofType
			case 'ITIM': // timing for animated textures
			case 'IWRL':
			case 'IUTI':
			case 'IINX':
			case 'IINY':
			case 'IINZ':
			case 'IREF': // possibly a VX for reused texture nodes
				if ( length === 4 ) this.IFF.currentNode[ blockID ] = this.IFF.reader.getInt32();
				else this.IFF.reader.skip( length );
				break;

			case 'OTAG':
				this.IFF.parseObjectTag();
				break;

			case 'LAYR':
				this.IFF.parseLayer( length );
				break;

			case 'PNTS':
				this.IFF.parsePoints( length );
				break;

			case 'VMAP':
				this.IFF.parseVertexMapping( length );
				break;

			case 'POLS':
				this.IFF.parsePolygonList( length );
				break;

			case 'TAGS':
				this.IFF.parseTagStrings( length );
				break;

			case 'PTAG':
				this.IFF.parsePolygonTagMapping( length );
				break;

			case 'VMAD':
				this.IFF.parseVertexMapping( length, true );
				break;

			// Misc CHUNKS
			case 'DESC': // Description Line
				this.IFF.currentForm.description = this.IFF.reader.getString();
				break;

			case 'TEXT':
			case 'CMNT':
			case 'NCOM':
				this.IFF.currentForm.comment = this.IFF.reader.getString();
				break;

			// Envelope Form
			case 'NAME':
				this.IFF.currentForm.channelName = this.IFF.reader.getString();
				break;

			// Image Map Layer
			case 'WRAP':
				this.IFF.currentForm.wrap = { w: this.IFF.reader.getUint16(), h: this.IFF.reader.getUint16() };
				break;

			case 'IMAG':
				const index = this.IFF.reader.getVariableLengthIndex();
				this.IFF.currentForm.imageIndex = index;
				break;

			// Texture Mapping Form
			case 'OREF':
				this.IFF.currentForm.referenceObject = this.IFF.reader.getString();
				break;

			case 'ROID':
				this.IFF.currentForm.referenceObjectID = this.IFF.reader.getUint32();
				break;

			// Surface Blocks
			case 'SSHN':
				this.IFF.currentSurface.surfaceShaderName = this.IFF.reader.getString();
				break;

			case 'AOVN':
				this.IFF.currentSurface.surfaceCustomAOVName = this.IFF.reader.getString();
				break;

			// Nodal Blocks
			case 'NSTA':
				this.IFF.currentForm.disabled = this.IFF.reader.getUint16();
				break;

			case 'NRNM':
				this.IFF.currentForm.realName = this.IFF.reader.getString();
				break;

			case 'NNME':
				this.IFF.currentForm.refName = this.IFF.reader.getString();
				this.IFF.currentSurface.nodes[ this.IFF.currentForm.refName ] = this.IFF.currentForm;
				break;

			// Nodal Blocks : connections
			case 'INME':
				if ( ! this.IFF.currentForm.nodeName ) this.IFF.currentForm.nodeName = [];
				this.IFF.currentForm.nodeName.push( this.IFF.reader.getString() );
				break;

			case 'IINN':
				if ( ! this.IFF.currentForm.inputNodeName ) this.IFF.currentForm.inputNodeName = [];
				this.IFF.currentForm.inputNodeName.push( this.IFF.reader.getString() );
				break;

			case 'IINM':
				if ( ! this.IFF.currentForm.inputName ) this.IFF.currentForm.inputName = [];
				this.IFF.currentForm.inputName.push( this.IFF.reader.getString() );
				break;

			case 'IONM':
				if ( ! this.IFF.currentForm.inputOutputName ) this.IFF.currentForm.inputOutputName = [];
				this.IFF.currentForm.inputOutputName.push( this.IFF.reader.getString() );
				break;

			case 'FNAM':
				this.IFF.currentForm.fileName = this.IFF.reader.getString();
				break;

			case 'CHAN': // NOTE: ENVL Forms may also have CHAN chunk, however ENVL is currently ignored
				if ( length === 4 ) this.IFF.currentForm.textureChannel = this.IFF.reader.getIDTag();
				else this.IFF.reader.skip( length );
				break;

			// LWO2 Spec chunks: these are needed since the SURF FORMs are often in LWO2 format
			case 'SMAN':
				const maxSmoothingAngle = this.IFF.reader.getFloat32();
				this.IFF.currentSurface.attributes.smooth = ( maxSmoothingAngle < 0 ) ? false : true;
				break;

			// LWO2: Basic Surface Parameters
			case 'COLR':
				this.IFF.currentSurface.attributes.Color = { value: this.IFF.reader.getFloat32Array( 3 ) };
				this.IFF.reader.skip( 2 ); // VX: envelope
				break;

			case 'LUMI':
				this.IFF.currentSurface.attributes.Luminosity = { value: this.IFF.reader.getFloat32() };
				this.IFF.reader.skip( 2 );
				break;

			case 'SPEC':
				this.IFF.currentSurface.attributes.Specular = { value: this.IFF.reader.getFloat32() };
				this.IFF.reader.skip( 2 );
				break;

			case 'DIFF':
				this.IFF.currentSurface.attributes.Diffuse = { value: this.IFF.reader.getFloat32() };
				this.IFF.reader.skip( 2 );
				break;

			case 'REFL':
				this.IFF.currentSurface.attributes.Reflection = { value: this.IFF.reader.getFloat32() };
				this.IFF.reader.skip( 2 );
				break;

			case 'GLOS':
				this.IFF.currentSurface.attributes.Glossiness = { value: this.IFF.reader.getFloat32() };
				this.IFF.reader.skip( 2 );
				break;

			case 'TRAN':
				this.IFF.currentSurface.attributes.opacity = this.IFF.reader.getFloat32();
				this.IFF.reader.skip( 2 );
				break;

			case 'BUMP':
				this.IFF.currentSurface.attributes.bumpStrength = this.IFF.reader.getFloat32();
				this.IFF.reader.skip( 2 );
				break;

			case 'SIDE':
				this.IFF.currentSurface.attributes.side = this.IFF.reader.getUint16();
				break;

			case 'RIMG':
				this.IFF.currentSurface.attributes.reflectionMap = this.IFF.reader.getVariableLengthIndex();
				break;

			case 'RIND':
				this.IFF.currentSurface.attributes.refractiveIndex = this.IFF.reader.getFloat32();
				this.IFF.reader.skip( 2 );
				break;

			case 'TIMG':
				this.IFF.currentSurface.attributes.refractionMap = this.IFF.reader.getVariableLengthIndex();
				break;

			case 'IMAP':
				this.IFF.currentSurface.attributes.imageMapIndex = this.IFF.reader.getUint32();
				break;

			case 'IUVI': // uv channel name
				this.IFF.currentNode.UVChannel = this.IFF.reader.getString( length );
				break;

			case 'IUTL': // widthWrappingMode: 0 = Reset, 1 = Repeat, 2 = Mirror, 3 = Edge
				this.IFF.currentNode.widthWrappingMode = this.IFF.reader.getUint32();
				break;
			case 'IVTL': // heightWrappingMode
				this.IFF.currentNode.heightWrappingMode = this.IFF.reader.getUint32();
				break;

			default:
				this.IFF.parseUnknownCHUNK( blockID, length );

		}

		if ( blockID != 'FORM' ) {

			this.IFF.debugger.node = 1;
			this.IFF.debugger.nodeID = blockID;
			this.IFF.debugger.log();

		}

		if ( this.IFF.reader.offset >= this.IFF.currentFormEnd ) {

			this.IFF.currentForm = this.IFF.parentForm;

		}

	}

}

/**
 * === IFFParser ===
 * - Parses data from the IFF buffer.
 * - LWO3 files are in IFF format and can contain the following data types, referred to by shorthand codes
 *
 * ATOMIC DATA TYPES
 *  ID Tag - 4x 7 bit uppercase ASCII chars: ID4
 *  signed integer, 1, 2, or 4 byte length: I1, I2, I4
 *  unsigned integer, 1, 2, or 4 byte length: U1, U2, U4
 *  float, 4 byte length: F4
 *  string, series of ASCII chars followed by null byte (If the length of the string including the null terminating byte is odd, an extra null is added so that the data that follows will begin on an even byte boundary): S0
 *
 * COMPOUND DATA TYPES
 *  Variable-length Index (index into an array or collection): U2 or U4 : VX
 *  Color (RGB): F4 + F4 + F4: COL12
 *  Coordinate (x, y, z): F4 + F4 + F4: VEC12
 *  Percentage F4 data type from 0->1 with 1 = 100%: FP4
 *  Angle in radian F4: ANG4
 *  Filename (string) S0: FNAM0
 *  XValue F4 + index (VX) + optional envelope( ENVL ): XVAL
 *  XValue vector VEC12 + index (VX) + optional envelope( ENVL ): XVAL3
 *
 *  The IFF file is arranged in chunks:
 *  CHUNK = ID4 + length (U4) + length X bytes of data + optional 0 pad byte
 *  optional 0 pad byte is there to ensure chunk ends on even boundary, not counted in size
 *
 * COMPOUND DATA TYPES
 * - Chunks are combined in Forms (collections of chunks)
 * - FORM = string 'FORM' (ID4) + length (U4) + type (ID4) + optional ( CHUNK | FORM )
 * - CHUNKS and FORMS are collectively referred to as blocks
 * - The entire file is contained in one top level FORM
 *
 **/


class IFFParser {

	constructor() {

		this.debugger = new Debugger();
		// this.debugger.enable(); // un-comment to log IFF hierarchy.

	}

	parse( buffer ) {

		this.reader = new DataViewReader( buffer );

		this.tree = {
			materials: {},
			layers: [],
			tags: [],
			textures: [],
		};

		// start out at the top level to add any data before first layer is encountered
		this.currentLayer = this.tree;
		this.currentForm = this.tree;

		this.parseTopForm();

		if ( this.tree.format === undefined ) return;

		if ( this.tree.format === 'LWO2' ) {

			this.parser = new LWO2Parser( this );
			while ( ! this.reader.endOfFile() ) this.parser.parseBlock();

		} else if ( this.tree.format === 'LWO3' ) {

			this.parser = new LWO3Parser( this );
			while ( ! this.reader.endOfFile() ) this.parser.parseBlock();

		}

		this.debugger.offset = this.reader.offset;
		this.debugger.closeForms();

		return this.tree;

	}

	parseTopForm() {

		this.debugger.offset = this.reader.offset;

		const topForm = this.reader.getIDTag();

		if ( topForm !== 'FORM' ) {

			console.warn( 'LWOLoader: Top-level FORM missing.' );
			return;

		}

		const length = this.reader.getUint32();

		this.debugger.dataOffset = this.reader.offset;
		this.debugger.length = length;

		const type = this.reader.getIDTag();

		if ( type === 'LWO2' ) {

			this.tree.format = type;

		} else if ( type === 'LWO3' ) {

			this.tree.format = type;

		}

		this.debugger.node = 0;
		this.debugger.nodeID = type;
		this.debugger.log();

		return;

	}


	///
	// FORM PARSING METHODS
	///

	// Forms are organisational and can contain any number of sub chunks and sub forms
	// FORM ::= 'FORM'[ID4], length[U4], type[ID4], ( chunk[CHUNK] | form[FORM] ) * }
	parseForm( length ) {

		const type = this.reader.getIDTag();

		switch ( type ) {

			// SKIPPED FORMS
			// if skipForm( length ) is called, the entire form and any sub forms and chunks are skipped

			case 'ISEQ': // Image sequence
			case 'ANIM': // plug in animation
			case 'STCC': // Color-cycling Still
			case 'VPVL':
			case 'VPRM':
			case 'NROT':
			case 'WRPW': // image wrap w ( for cylindrical and spherical projections)
			case 'WRPH': // image wrap h
			case 'FUNC':
			case 'FALL':
			case 'OPAC':
			case 'GRAD': // gradient texture
			case 'ENVS':
			case 'VMOP':
			case 'VMBG':

			// Car Material FORMS
			case 'OMAX':
			case 'STEX':
			case 'CKBG':
			case 'CKEY':
			case 'VMLA':
			case 'VMLB':
				this.debugger.skipped = true;
				this.skipForm( length ); // not currently supported
				break;

			// if break; is called directly, the position in the lwoTree is not created
			// any sub chunks and forms are added to the parent form instead
			case 'META':
			case 'NNDS':
			case 'NODS':
			case 'NDTA':
			case 'ADAT':
			case 'AOVS':
			case 'BLOK':

			// used by texture nodes
			case 'IBGC': // imageBackgroundColor
			case 'IOPC': // imageOpacity
			case 'IIMG': // hold reference to image path
			case 'TXTR':
				// this.setupForm( type, length );
				this.debugger.length = 4;
				this.debugger.skipped = true;
				break;

			case 'IFAL': // imageFallof
			case 'ISCL': // imageScale
			case 'IPOS': // imagePosition
			case 'IROT': // imageRotation
			case 'IBMP':
			case 'IUTD':
			case 'IVTD':
				this.parseTextureNodeAttribute( type );
				break;

			case 'ENVL':
				this.parseEnvelope( length );
				break;

				// CLIP FORM AND SUB FORMS

			case 'CLIP':
				if ( this.tree.format === 'LWO2' ) {

					this.parseForm( length );

				} else {

					this.parseClip( length );

				}

				break;

			case 'STIL':
				this.parseImage();
				break;

			case 'XREF': // clone of another STIL
				this.reader.skip( 8 ); // unknown
				this.currentForm.referenceTexture = {
					index: this.reader.getUint32(),
					refName: this.reader.getString() // internal unique ref
				};
				break;

				// Not in spec, used by texture nodes

			case 'IMST':
				this.parseImageStateForm( length );
				break;

				// SURF FORM AND SUB FORMS

			case 'SURF':
				this.parseSurfaceForm( length );
				break;

			case 'VALU': // Not in spec
				this.parseValueForm( length );
				break;

			case 'NTAG':
				this.parseSubNode( length );
				break;

			case 'ATTR': // BSDF Node Attributes
			case 'SATR': // Standard Node Attributes
				this.setupForm( 'attributes', length );
				break;

			case 'NCON':
				this.parseConnections( length );
				break;

			case 'SSHA':
				this.parentForm = this.currentForm;
				this.currentForm = this.currentSurface;
				this.setupForm( 'surfaceShader', length );
				break;

			case 'SSHD':
				this.setupForm( 'surfaceShaderData', length );
				break;

			case 'ENTR': // Not in spec
				this.parseEntryForm( length );
				break;

				// Image Map Layer

			case 'IMAP':
				this.parseImageMap( length );
				break;

			case 'TAMP':
				this.parseXVAL( 'amplitude', length );
				break;

				//Texture Mapping Form

			case 'TMAP':
				this.setupForm( 'textureMap', length );
				break;

			case 'CNTR':
				this.parseXVAL3( 'center', length );
				break;

			case 'SIZE':
				this.parseXVAL3( 'scale', length );
				break;

			case 'ROTA':
				this.parseXVAL3( 'rotation', length );
				break;

			default:
				this.parseUnknownForm( type, length );

		}

		this.debugger.node = 0;
		this.debugger.nodeID = type;
		this.debugger.log();

	}

	setupForm( type, length ) {

		if ( ! this.currentForm ) this.currentForm = this.currentNode;

		this.currentFormEnd = this.reader.offset + length;
		this.parentForm = this.currentForm;

		if ( ! this.currentForm[ type ] ) {

			this.currentForm[ type ] = {};
			this.currentForm = this.currentForm[ type ];


		} else {

			// should never see this unless there's a bug in the reader
			console.warn( 'LWOLoader: form already exists on parent: ', type, this.currentForm );

			this.currentForm = this.currentForm[ type ];

		}


	}

	skipForm( length ) {

		this.reader.skip( length - 4 );

	}

	parseUnknownForm( type, length ) {

		console.warn( 'LWOLoader: unknown FORM encountered: ' + type, length );

		printBuffer( this.reader.dv.buffer, this.reader.offset, length - 4 );
		this.reader.skip( length - 4 );

	}

	parseSurfaceForm( length ) {

		this.reader.skip( 8 ); // unknown Uint32 x2

		const name = this.reader.getString();

		const surface = {
			attributes: {}, // LWO2 style non-node attributes will go here
			connections: {},
			name: name,
			inputName: name,
			nodes: {},
			source: this.reader.getString(),
		};

		this.tree.materials[ name ] = surface;
		this.currentSurface = surface;

		this.parentForm = this.tree.materials;
		this.currentForm = surface;
		this.currentFormEnd = this.reader.offset + length;

	}

	parseSurfaceLwo2( length ) {

		const name = this.reader.getString();

		const surface = {
			attributes: {}, // LWO2 style non-node attributes will go here
			connections: {},
			name: name,
			nodes: {},
			source: this.reader.getString(),
		};

		this.tree.materials[ name ] = surface;
		this.currentSurface = surface;

		this.parentForm = this.tree.materials;
		this.currentForm = surface;
		this.currentFormEnd = this.reader.offset + length;

	}

	parseSubNode( length ) {

		// parse the NRNM CHUNK of the subnode FORM to get
		// a meaningful name for the subNode
		// some subnodes can be renamed, but Input and Surface cannot

		this.reader.skip( 8 ); // NRNM + length
		const name = this.reader.getString();

		const node = {
			name: name
		};
		this.currentForm = node;
		this.currentNode = node;

		this.currentFormEnd = this.reader.offset + length;


	}

	// collect attributes from all nodes at the top level of a surface
	parseConnections( length ) {

		this.currentFormEnd = this.reader.offset + length;
		this.parentForm = this.currentForm;

		this.currentForm = this.currentSurface.connections;

	}

	// surface node attribute data, e.g. specular, roughness etc
	parseEntryForm( length ) {

		this.reader.skip( 8 ); // NAME + length
		const name = this.reader.getString();
		this.currentForm = this.currentNode.attributes;

		this.setupForm( name, length );

	}

	// parse values from material - doesn't match up to other LWO3 data types
	// sub form of entry form
	parseValueForm() {

		this.reader.skip( 8 ); // unknown + length

		const valueType = this.reader.getString();

		if ( valueType === 'double' ) {

			this.currentForm.value = this.reader.getUint64();

		} else if ( valueType === 'int' ) {

			this.currentForm.value = this.reader.getUint32();

		} else if ( valueType === 'vparam' ) {

			this.reader.skip( 24 );
			this.currentForm.value = this.reader.getFloat64();

		} else if ( valueType === 'vparam3' ) {

			this.reader.skip( 24 );
			this.currentForm.value = this.reader.getFloat64Array( 3 );

		}

	}

	// holds various data about texture node image state
	// Data other than mipMapLevel unknown
	parseImageStateForm() {

		this.reader.skip( 8 ); // unknown

		this.currentForm.mipMapLevel = this.reader.getFloat32();

	}

	// LWO2 style image data node OR LWO3 textures defined at top level in editor (not as SURF node)
	parseImageMap( length ) {

		this.currentFormEnd = this.reader.offset + length;
		this.parentForm = this.currentForm;

		if ( ! this.currentForm.maps ) this.currentForm.maps = [];

		const map = {};
		this.currentForm.maps.push( map );
		this.currentForm = map;

		this.reader.skip( 10 ); // unknown, could be an issue if it contains a VX

	}

	parseTextureNodeAttribute( type ) {

		this.reader.skip( 28 ); // FORM + length + VPRM + unknown + Uint32 x2 + float32

		this.reader.skip( 20 ); // FORM + length + VPVL + float32 + Uint32

		switch ( type ) {

			case 'ISCL':
				this.currentNode.scale = this.reader.getFloat32Array( 3 );
				break;
			case 'IPOS':
				this.currentNode.position = this.reader.getFloat32Array( 3 );
				break;
			case 'IROT':
				this.currentNode.rotation = this.reader.getFloat32Array( 3 );
				break;
			case 'IFAL':
				this.currentNode.falloff = this.reader.getFloat32Array( 3 );
				break;

			case 'IBMP':
				this.currentNode.amplitude = this.reader.getFloat32();
				break;
			case 'IUTD':
				this.currentNode.uTiles = this.reader.getFloat32();
				break;
			case 'IVTD':
				this.currentNode.vTiles = this.reader.getFloat32();
				break;

		}

		this.reader.skip( 2 ); // unknown


	}

	// ENVL forms are currently ignored
	parseEnvelope( length ) {

		this.reader.skip( length - 4 ); // skipping  entirely for now

	}

	///
	// CHUNK PARSING METHODS
	///

	// clips can either be defined inside a surface node, or at the top
	// level and they have a different format in each case
	parseClip( length ) {

		const tag = this.reader.getIDTag();

		// inside surface node
		if ( tag === 'FORM' ) {

			this.reader.skip( 16 );

			this.currentNode.fileName = this.reader.getString();

			return;

		}

		// otherwise top level
		this.reader.setOffset( this.reader.offset - 4 );

		this.currentFormEnd = this.reader.offset + length;
		this.parentForm = this.currentForm;

		this.reader.skip( 8 ); // unknown

		const texture = {
			index: this.reader.getUint32()
		};
		this.tree.textures.push( texture );
		this.currentForm = texture;

	}

	parseClipLwo2( length ) {

		const texture = {
			index: this.reader.getUint32(),
			fileName: ''
		};

		// search STIL block
		while ( true ) {

			const tag = this.reader.getIDTag();
			const n_length = this.reader.getUint16();
			if ( tag === 'STIL' ) {

				texture.fileName = this.reader.getString();
				break;

			}

			if ( n_length >= length ) {

				break;

			}

		}

		this.tree.textures.push( texture );
		this.currentForm = texture;

	}

	parseImage() {

		this.reader.skip( 8 ); // unknown
		this.currentForm.fileName = this.reader.getString();

	}

	parseXVAL( type, length ) {

		const endOffset = this.reader.offset + length - 4;
		this.reader.skip( 8 );

		this.currentForm[ type ] = this.reader.getFloat32();

		this.reader.setOffset( endOffset ); // set end offset directly to skip optional envelope

	}

	parseXVAL3( type, length ) {

		const endOffset = this.reader.offset + length - 4;
		this.reader.skip( 8 );

		this.currentForm[ type ] = {
			x: this.reader.getFloat32(),
			y: this.reader.getFloat32(),
			z: this.reader.getFloat32(),
		};

		this.reader.setOffset( endOffset );

	}

	// Tags associated with an object
	// OTAG { type[ID4], tag-string[S0] }
	parseObjectTag() {

		if ( ! this.tree.objectTags ) this.tree.objectTags = {};

		this.tree.objectTags[ this.reader.getIDTag() ] = {
			tagString: this.reader.getString()
		};

	}

	// Signals the start of a new layer. All the data chunks which follow will be included in this layer until another layer chunk is encountered.
	// LAYR: number[U2], flags[U2], pivot[VEC12], name[S0], parent[U2]
	parseLayer( length ) {

		const number = this.reader.getUint16();
		const flags = this.reader.getUint16(); // If the least significant bit of flags is set, the layer is hidden.
		const pivot = this.reader.getFloat32Array( 3 ); // Note: this seems to be superfluous, as the geometry is translated when pivot is present
		const layer = {
			number: number,
			flags: flags, // If the least significant bit of flags is set, the layer is hidden.
			pivot: [ - pivot[ 0 ], pivot[ 1 ], pivot[ 2 ] ], // Note: this seems to be superfluous, as the geometry is translated when pivot is present
			name: this.reader.getString(),
		};

		this.tree.layers.push( layer );
		this.currentLayer = layer;

		const parsedLength = 16 + stringOffset( this.currentLayer.name ); // index ( 2 ) + flags( 2 ) + pivot( 12 ) + stringlength

		// if we have not reached then end of the layer block, there must be a parent defined
		this.currentLayer.parent = ( parsedLength < length ) ? this.reader.getUint16() : -1; // omitted or -1 for no parent

	}

	// VEC12 * ( F4 + F4 + F4 ) array of x,y,z vectors
	// Converting from left to right handed coordinate system:
	// x -> -x and switch material FrontSide -> BackSide
	parsePoints( length ) {

		this.currentPoints = [];
		for ( let i = 0; i < length / 4; i += 3 ) {

			// x -> -x to match three.js right handed coords
			this.currentPoints.push( - this.reader.getFloat32(), this.reader.getFloat32(), this.reader.getFloat32() );

		}

	}

	// parse VMAP or VMAD
	// Associates a set of floating-point vectors with a set of points.
	// VMAP: { type[ID4], dimension[U2], name[S0], ( vert[VX], value[F4] # dimension ) * }

	// VMAD Associates a set of floating-point vectors with the vertices of specific polygons.
	// Similar to VMAP UVs, but associates with polygon vertices rather than points
	// to solve to problem of UV seams:  VMAD chunks are paired with VMAPs of the same name,
	// if they exist. The vector values in the VMAD will then replace those in the
	// corresponding VMAP, but only for calculations involving the specified polygons.
	// VMAD { type[ID4], dimension[U2], name[S0], ( vert[VX], poly[VX], value[F4] # dimension ) * }
	parseVertexMapping( length, discontinuous ) {

		const finalOffset = this.reader.offset + length;

		const channelName = this.reader.getString();

		if ( this.reader.offset === finalOffset ) {

			// then we are in a texture node and the VMAP chunk is just a reference to a UV channel name
			this.currentForm.UVChannel = channelName;
			return;

		}

		// otherwise reset to initial length and parse normal VMAP CHUNK
		this.reader.setOffset( this.reader.offset - stringOffset( channelName ) );

		const type = this.reader.getIDTag();

		this.reader.getUint16(); // dimension
		const name = this.reader.getString();

		const remainingLength = length - 6 - stringOffset( name );

		switch ( type ) {

			case 'TXUV':
				this.parseUVMapping( name, finalOffset, discontinuous );
				break;
			case 'MORF':
			case 'SPOT':
				this.parseMorphTargets( name, finalOffset, type ); // can't be discontinuous
				break;
			// unsupported VMAPs
			case 'APSL':
			case 'NORM':
			case 'WGHT':
			case 'MNVW':
			case 'PICK':
			case 'RGB ':
			case 'RGBA':
				this.reader.skip( remainingLength );
				break;
			default:
				console.warn( 'LWOLoader: unknown vertex map type: ' + type );
				this.reader.skip( remainingLength );

		}

	}

	parseUVMapping( name, finalOffset, discontinuous ) {

		const uvIndices = [];
		const polyIndices = [];
		const uvs = [];

		while ( this.reader.offset < finalOffset ) {

			uvIndices.push( this.reader.getVariableLengthIndex() );

			if ( discontinuous ) polyIndices.push( this.reader.getVariableLengthIndex() );

			uvs.push( this.reader.getFloat32(), this.reader.getFloat32() );

		}

		if ( discontinuous ) {

			if ( ! this.currentLayer.discontinuousUVs ) this.currentLayer.discontinuousUVs = {};

			this.currentLayer.discontinuousUVs[ name ] = {
				uvIndices: uvIndices,
				polyIndices: polyIndices,
				uvs: uvs,
			};

		} else {

			if ( ! this.currentLayer.uvs ) this.currentLayer.uvs = {};

			this.currentLayer.uvs[ name ] = {
				uvIndices: uvIndices,
				uvs: uvs,
			};

		}

	}

	parseMorphTargets( name, finalOffset, type ) {

		const indices = [];
		const points = [];

		type = ( type === 'MORF' ) ? 'relative' : 'absolute';

		while ( this.reader.offset < finalOffset ) {

			indices.push( this.reader.getVariableLengthIndex() );
			// z -> -z to match three.js right handed coords
			points.push( this.reader.getFloat32(), this.reader.getFloat32(), - this.reader.getFloat32() );

		}

		if ( ! this.currentLayer.morphTargets ) this.currentLayer.morphTargets = {};

		this.currentLayer.morphTargets[ name ] = {
			indices: indices,
			points: points,
			type: type,
		};

	}

	// A list of polygons for the current layer.
	// POLS { type[ID4], ( numvert+flags[U2], vert[VX] # numvert ) * }
	parsePolygonList( length ) {

		const finalOffset = this.reader.offset + length;
		const type = this.reader.getIDTag();

		const indices = [];

		// hold a list of polygon sizes, to be split up later
		const polygonDimensions = [];

		while ( this.reader.offset < finalOffset ) {

			let numverts = this.reader.getUint16();

			//const flags = numverts & 64512; // 6 high order bits are flags - ignoring for now
			numverts = numverts & 1023; // remaining ten low order bits are vertex num
			polygonDimensions.push( numverts );

			for ( let j = 0; j < numverts; j ++ ) indices.push( this.reader.getVariableLengthIndex() );

		}

		const geometryData = {
			type: type,
			vertexIndices: indices,
			polygonDimensions: polygonDimensions,
			points: this.currentPoints
		};

		// Note: assuming that all polys will be lines or points if the first is
		if ( polygonDimensions[ 0 ] === 1 ) geometryData.type = 'points';
		else if ( polygonDimensions[ 0 ] === 2 ) geometryData.type = 'lines';

		this.currentLayer.geometry = geometryData;

	}

	// Lists the tag strings that can be associated with polygons by the PTAG chunk.
	// TAGS { tag-string[S0] * }
	parseTagStrings( length ) {

		this.tree.tags = this.reader.getStringArray( length );

	}

	// Associates tags of a given type with polygons in the most recent POLS chunk.
	// PTAG { type[ID4], ( poly[VX], tag[U2] ) * }
	parsePolygonTagMapping( length ) {

		const finalOffset = this.reader.offset + length;
		const type = this.reader.getIDTag();
		if ( type === 'SURF' ) this.parseMaterialIndices( finalOffset );
		else { //PART, SMGP, COLR not supported

			this.reader.skip( length - 4 );

		}

	}

	parseMaterialIndices( finalOffset ) {

		// array holds polygon index followed by material index
		this.currentLayer.geometry.materialIndices = [];

		while ( this.reader.offset < finalOffset ) {

			const polygonIndex = this.reader.getVariableLengthIndex();
			const materialIndex = this.reader.getUint16();

			this.currentLayer.geometry.materialIndices.push( polygonIndex, materialIndex );

		}

	}

	parseUnknownCHUNK( blockID, length ) {

		console.warn( 'LWOLoader: unknown chunk type: ' + blockID + ' length: ' + length );

		// print the chunk plus some bytes padding either side
		// printBuffer( this.reader.dv.buffer, this.reader.offset - 20, length + 40 );

		const data = this.reader.getString( length );

		this.currentForm[ blockID ] = data;

	}

}


class DataViewReader {

	constructor( buffer ) {

		this.dv = new DataView( buffer );
		this.offset = 0;
		this._textDecoder = new TextDecoder();
		this._bytes = new Uint8Array( buffer );

	}

	size() {

		return this.dv.buffer.byteLength;

	}

	setOffset( offset ) {

		if ( offset > 0 && offset < this.dv.buffer.byteLength ) {

			this.offset = offset;

		} else {

			console.error( 'LWOLoader: invalid buffer offset' );

		}

	}

	endOfFile() {

		if ( this.offset >= this.size() ) return true;
		return false;

	}

	skip( length ) {

		this.offset += length;

	}

	getUint8() {

		const value = this.dv.getUint8( this.offset );
		this.offset += 1;
		return value;

	}

	getUint16() {

		const value = this.dv.getUint16( this.offset );
		this.offset += 2;
		return value;

	}

	getInt32() {

		const value = this.dv.getInt32( this.offset, false );
		this.offset += 4;
		return value;

	}

	getUint32() {

		const value = this.dv.getUint32( this.offset, false );
		this.offset += 4;
		return value;

	}

	getUint64() {

		const low = this.getUint32();
		const high = this.getUint32();
		return high * 0x100000000 + low;

	}

	getFloat32() {

		const value = this.dv.getFloat32( this.offset, false );
		this.offset += 4;
		return value;

	}

	getFloat32Array( size ) {

		const a = [];

		for ( let i = 0; i < size; i ++ ) {

			a.push( this.getFloat32() );

		}

		return a;

	}

	getFloat64() {

		const value = this.dv.getFloat64( this.offset );
		this.offset += 8;
		return value;

	}

	getFloat64Array( size ) {

		const a = [];

		for ( let i = 0; i < size; i ++ ) {

			a.push( this.getFloat64() );

		}

		return a;

	}

	// get variable-length index data type
	// VX ::= index[U2] | (index + 0xFF000000)[U4]
	// If the index value is less than 65,280 (0xFF00),then VX === U2
	// otherwise VX === U4 with bits 24-31 set
	// When reading an index, if the first byte encountered is 255 (0xFF), then
	// the four-byte form is being used and the first byte should be discarded or masked out.
	getVariableLengthIndex() {

		const firstByte = this.getUint8();

		if ( firstByte === 255 ) {

			return this.getUint8() * 65536 + this.getUint8() * 256 + this.getUint8();

		}

		return firstByte * 256 + this.getUint8();

	}

	// An ID tag is a sequence of 4 bytes containing 7-bit ASCII values
	getIDTag() {

		return this.getString( 4 );

	}

	getString( size ) {

		if ( size === 0 ) return;

		const start = this.offset;

		let result;
		let length;

		if ( size ) {

			length = size;
			result = this._textDecoder.decode( new Uint8Array( this.dv.buffer, start, size ) );

		} else {

			// use 1:1 mapping of buffer to avoid redundant new array creation.
			length = this._bytes.indexOf( 0, start ) - start;

			result = this._textDecoder.decode( new Uint8Array( this.dv.buffer, start, length ) );

			// account for null byte in length
			length ++;

			// if string with terminating nullbyte is uneven, extra nullbyte is added, skip that too
			length += length % 2;

		}

		this.skip( length );

		return result;

	}

	getStringArray( size ) {

		let a = this.getString( size );
		a = a.split( '\0' );

		return a.filter( Boolean ); // return array with any empty strings removed

	}

}


// ************** DEBUGGER  **************

class Debugger {

	constructor() {

		this.active = false;
		this.depth = 0;
		this.formList = [];
		this.offset = 0;

		this.node = 0; // 0 = FORM, 1 = CHUNK, 2 = SUBNODE
		this.nodeID = 'FORM';

		this.dataOffset = 0;
		this.length = 0;
		this.skipped = false;

	}

	enable() {

		this.active = true;

	}

	log() {

		if ( ! this.active ) return;

		let nodeType;

		switch ( this.node ) {

			case 0:
				nodeType = 'FORM';
				break;

			case 1:
				nodeType = 'CHK';
				break;

			case 2:
				nodeType = 'S-CHK';
				break;

		}

		console.log(
			'| '.repeat( this.depth ) +
			nodeType,
			this.nodeID,
			`( ${this.offset} ) -> ( ${this.dataOffset + this.length} )`,
			( ( this.node == 0 ) ? ' {' : '' ),
			( ( this.skipped ) ? 'SKIPPED' : '' ),
			( ( this.node == 0 && this.skipped ) ? '}' : '' )
		);

		if ( this.node == 0 && ! this.skipped ) {

			this.depth += 1;
			this.formList.push( this.dataOffset + this.length );

		}

		this.skipped = false;

	}

	closeForms() {

		if ( ! this.active ) return;

		for ( let i = this.formList.length - 1; i >= 0; i -- ) {

			if ( this.offset >= this.formList[ i ] ) {

				this.depth -= 1;
				console.log( '| '.repeat( this.depth ) + '}' );
				this.formList.splice( -1, 1 );

			}

		}

	}

}

// ************** UTILITY FUNCTIONS **************

// calculate the length of the string in the buffer
// this will be string.length + nullbyte + optional padbyte to make the length even
function stringOffset( string ) {

	return string.length + 1 + ( ( string.length + 1 ) % 2 );

}

// for testing purposes, dump buffer to console
// printBuffer( this.reader.dv.buffer, this.reader.offset, length );
function printBuffer( buffer, from, to ) {

	console.log( new TextDecoder().decode( new Uint8Array( buffer, from, to ) ) );

}

let _lwoTree;

/**
 * A loader for the LWO format.
 *
 * LWO3 and LWO2 formats are supported.
 *
 * References:
 * - [LWO3 format specification](https://static.lightwave3d.com/sdk/2019/html/filefmts/lwo3.html)
 * - [LWO2 format specification](https://static.lightwave3d.com/sdk/2019/html/filefmts/lwo2.html)
 *
 * ```js
 * const loader = new LWOLoader();
 * const lwoData = await loader.loadAsync( 'models/lwo/Objects/LWO3/Demo.lwo' );
 *
 * const mesh = object.meshes[ 0 ];
 * scene.add( mesh );
 * ```
 *
 * @augments Loader
 * @three_import import { LWOLoader } from 'three/addons/loaders/LWOLoader.js';
 * @deprecated since r185.
 */
class LWOLoader extends Loader {

	/**
	 * Constructs a new LWO loader.
	 *
	 * @param {LoadingManager} [manager] - The loading manager.
	 * @deprecated since r185.
	 */
	constructor( manager ) {

		super( manager );

		console.warn( 'THREE.LWOLoader: The loader has been deprecated and will be removed with r195. Export your LWO files to glTF before using them on the web.' ); // @deprecated, r185

	}

	/**
	 * Starts loading from the given URL and passes the loaded LWO asset
	 * to the `onLoad()` callback.
	 *
	 * @param {string} url - The path/URL of the file to be loaded. This can also be a data URI.
	 * @param {function({meshes:Array<Mesh>,materials:Array<Material>})} onLoad - Executed when the loading process has been finished.
	 * @param {onProgressCallback} onProgress - Executed while the loading is in progress.
	 * @param {onErrorCallback} onError - Executed when errors occur.
	 */
	load( url, onLoad, onProgress, onError ) {

		const scope = this;

		const path = ( scope.path === '' ) ? extractParentUrl( url, 'Objects' ) : scope.path;

		// give the mesh a default name based on the filename
		const modelName = url.split( path ).pop().split( '.' )[ 0 ];

		const loader = new FileLoader( this.manager );
		loader.setPriority( this.priority );
		loader.setCache( this.cache );
		loader.setRequestHeader( this.requestHeader );
		loader.setWithCredentials( this.withCredentials );
		loader.setPath( scope.path );
		loader.setResponseType( 'arraybuffer' );

		loader.load( url, function ( buffer ) {

			// console.time( 'Total parsing: ' );

			try {

				onLoad( scope.parse( buffer, path, modelName ) );

			} catch ( e ) {

				if ( onError ) {

					onError( e );

				} else {

					console.error( e );

				}

				scope.manager.itemError( url );

			}

			// console.timeEnd( 'Total parsing: ' );

		}, onProgress, onError );

	}

	/**
	 * Parses the given LWO data and returns the resulting meshes and materials.
	 *
	 * @param {ArrayBuffer} iffBuffer - The raw LWO data as an array buffer.
	 * @param {string} path - The URL base path.
	 * @param {string} modelName - The model name.
	 * @return {{meshes:Array<Mesh>,materials:Array<Material>}} An object holding the parse meshes and materials.
	 */
	parse( iffBuffer, path, modelName ) {

		_lwoTree = new IFFParser().parse( iffBuffer );

		// console.log( 'lwoTree', lwoTree );

		const textureLoader = new TextureLoader( this.manager ).setPath( this.resourcePath || path ).setCrossOrigin( this.crossOrigin );
		textureLoader.setPriority( this.priority );
		textureLoader.setCache( this.cache );

		return new LWOTreeParser( textureLoader ).parse( modelName );

	}

}

// Parse the lwoTree object
class LWOTreeParser {

	constructor( textureLoader ) {

		this.textureLoader = textureLoader;

	}

	parse( modelName ) {

		this.materials = new MaterialParser( this.textureLoader ).parse();
		this.defaultLayerName = modelName;

		this.meshes = this.parseLayers();

		return {
			materials: this.materials,
			meshes: this.meshes,
		};

	}

	parseLayers() {

		// array of all meshes for building hierarchy
		const meshes = [];

		// final array containing meshes with scene graph hierarchy set up
		const finalMeshes = [];

		const geometryParser = new GeometryParser();

		const scope = this;
		_lwoTree.layers.forEach( function ( layer ) {

			const geometry = geometryParser.parse( layer.geometry, layer );

			const mesh = scope.parseMesh( geometry, layer );

			meshes[ layer.number ] = mesh;

			if ( layer.parent === -1 ) finalMeshes.push( mesh );
			else meshes[ layer.parent ].add( mesh );


		} );

		return finalMeshes;

	}

	parseMesh( geometry, layer ) {

		let mesh;

		const materials = this.getMaterials( geometry.userData.matNames, layer.geometry.type );

		if ( layer.geometry.type === 'points' ) mesh = new Points( geometry, materials );
		else if ( layer.geometry.type === 'lines' ) mesh = new LineSegments( geometry, materials );
		else mesh = new Mesh( geometry, materials );

		if ( layer.name ) mesh.name = layer.name;
		else mesh.name = this.defaultLayerName + '_layer_' + layer.number;

		const pivot = layer.pivot;
		if ( pivot[ 0 ] !== 0 || pivot[ 1 ] !== 0 || pivot[ 2 ] !== 0 ) {

			mesh.pivot = new Vector3( pivot[ 0 ], pivot[ 1 ], pivot[ 2 ] );

		}

		return mesh;

	}

	getMaterials( namesArray, type ) {

		const materials = [];

		const scope = this;

		namesArray.forEach( function ( name, i ) {

			materials[ i ] = scope.getMaterialByName( name );

		} );

		// convert materials to line or point mats if required
		if ( type === 'points' || type === 'lines' ) {

			materials.forEach( function ( mat, i ) {

				const spec = {
					color: mat.color,
				};

				if ( type === 'points' ) {

					spec.size = 0.1;
					spec.map = mat.map;
					materials[ i ] = new PointsMaterial( spec );

				} else if ( type === 'lines' ) {

					materials[ i ] = new LineBasicMaterial( spec );

				}

			} );

		}

		// if there is only one material, return that directly instead of array
		const filtered = materials.filter( Boolean );
		if ( filtered.length === 1 ) return filtered[ 0 ];

		return materials;

	}

	getMaterialByName( name ) {

		return this.materials.filter( function ( m ) {

			return m.name === name;

		} )[ 0 ];

	}

}

class MaterialParser {

	constructor( textureLoader ) {

		this.textureLoader = textureLoader;

	}

	parse() {

		const materials = [];
		this.textures = {};

		for ( const name in _lwoTree.materials ) {

			if ( _lwoTree.format === 'LWO3' ) {

				materials.push( this.parseMaterial( _lwoTree.materials[ name ], name, _lwoTree.textures ) );

			} else if ( _lwoTree.format === 'LWO2' ) {

				materials.push( this.parseMaterialLwo2( _lwoTree.materials[ name ], name, _lwoTree.textures ) );

			}

		}

		return materials;

	}

	parseMaterial( materialData, name, textures ) {

		let params = {
			name: name,
			side: this.getSide( materialData.attributes ),
			flatShading: this.getSmooth( materialData.attributes ),
		};

		const connections = this.parseConnections( materialData.connections, materialData.nodes );

		const maps = this.parseTextureNodes( connections.maps );

		this.parseAttributeImageMaps( connections.attributes, textures, maps );

		const attributes = this.parseAttributes( connections.attributes, maps );

		this.parseEnvMap( connections, maps, attributes );

		params = Object.assign( maps, params );
		params = Object.assign( params, attributes );

		const materialType = this.getMaterialType( connections.attributes );

		if ( materialType !== MeshPhongMaterial ) delete params.refractionRatio; // PBR materials do not support "refractionRatio"

		return new materialType( params );

	}

	parseMaterialLwo2( materialData, name/*, textures*/ ) {

		let params = {
			name: name,
			side: this.getSide( materialData.attributes ),
			flatShading: this.getSmooth( materialData.attributes ),
		};

		const attributes = this.parseAttributes( materialData.attributes, {} );
		params = Object.assign( params, attributes );
		return new MeshPhongMaterial( params );

	}

	// Note: converting from left to right handed coords by switching x -> -x in vertices, and
	// then switching mat FrontSide -> BackSide
	// NB: this means that FrontSide and BackSide have been switched!
	getSide( attributes ) {

		if ( ! attributes.side ) return BackSide;

		switch ( attributes.side ) {

			case 0:
			case 1:
				return BackSide;
			case 2: return FrontSide;
			case 3: return DoubleSide;

		}

	}

	getSmooth( attributes ) {

		if ( ! attributes.smooth ) return true;
		return ! attributes.smooth;

	}

	parseConnections( connections, nodes ) {

		const materialConnections = {
			maps: {}
		};

		const inputName = connections.inputName;
		const inputNodeName = connections.inputNodeName;
		const nodeName = connections.nodeName;

		const scope = this;
		inputName.forEach( function ( name, index ) {

			if ( name === 'Material' ) {

				const matNode = scope.getNodeByRefName( inputNodeName[ index ], nodes );
				materialConnections.attributes = matNode.attributes;
				materialConnections.envMap = matNode.fileName;
				materialConnections.name = inputNodeName[ index ];

			}

		} );

		nodeName.forEach( function ( name, index ) {

			if ( name === materialConnections.name ) {

				materialConnections.maps[ inputName[ index ] ] = scope.getNodeByRefName( inputNodeName[ index ], nodes );

			}

		} );

		return materialConnections;

	}

	getNodeByRefName( refName, nodes ) {

		for ( const name in nodes ) {

			if ( nodes[ name ].refName === refName ) return nodes[ name ];

		}

	}

	parseTextureNodes( textureNodes ) {

		const maps = {};

		for ( const name in textureNodes ) {

			const node = textureNodes[ name ];
			const path = node.fileName;

			if ( ! path ) return;

			const texture = this.loadTexture( path );

			if ( node.widthWrappingMode !== undefined ) texture.wrapS = this.getWrappingType( node.widthWrappingMode );
			if ( node.heightWrappingMode !== undefined ) texture.wrapT = this.getWrappingType( node.heightWrappingMode );

			switch ( name ) {

				case 'Color':
					maps.map = texture;
					maps.map.colorSpace = SRGBColorSpace;
					break;
				case 'Roughness':
					maps.roughnessMap = texture;
					maps.roughness = 1;
					break;
				case 'Specular':
					maps.specularMap = texture;
					maps.specularMap.colorSpace = SRGBColorSpace;
					maps.specular = 0xffffff;
					break;
				case 'Luminous':
					maps.emissiveMap = texture;
					maps.emissiveMap.colorSpace = SRGBColorSpace;
					maps.emissive = 0x808080;
					break;
				case 'Luminous Color':
					maps.emissive = 0x808080;
					break;
				case 'Metallic':
					maps.metalnessMap = texture;
					maps.metalness = 1;
					break;
				case 'Transparency':
				case 'Alpha':
					maps.alphaMap = texture;
					maps.transparent = true;
					break;
				case 'Normal':
					maps.normalMap = texture;
					if ( node.amplitude !== undefined ) maps.normalScale = new Vector2( node.amplitude, node.amplitude );
					break;
				case 'Bump':
					maps.bumpMap = texture;
					break;

			}

		}

		// LWO BSDF materials can have both spec and rough, but this is not valid in three
		if ( maps.roughnessMap && maps.specularMap ) delete maps.specularMap;

		return maps;

	}

	// maps can also be defined on individual material attributes, parse those here
	// This occurs on Standard (Phong) surfaces
	parseAttributeImageMaps( attributes, textures, maps ) {

		for ( const name in attributes ) {

			const attribute = attributes[ name ];

			if ( attribute.maps ) {

				const mapData = attribute.maps[ 0 ];

				const path = this.getTexturePathByIndex( mapData.imageIndex );
				if ( ! path ) return;

				const texture = this.loadTexture( path );

				if ( mapData.wrap !== undefined ) texture.wrapS = this.getWrappingType( mapData.wrap.w );
				if ( mapData.wrap !== undefined ) texture.wrapT = this.getWrappingType( mapData.wrap.h );

				switch ( name ) {

					case 'Color':
						maps.map = texture;
						maps.map.colorSpace = SRGBColorSpace;
						break;
					case 'Diffuse':
						maps.aoMap = texture;
						break;
					case 'Roughness':
						maps.roughnessMap = texture;
						maps.roughness = 1;
						break;
					case 'Specular':
						maps.specularMap = texture;
						maps.specularMap.colorSpace = SRGBColorSpace;
						maps.specular = 0xffffff;
						break;
					case 'Luminosity':
						maps.emissiveMap = texture;
						maps.emissiveMap.colorSpace = SRGBColorSpace;
						maps.emissive = 0x808080;
						break;
					case 'Metallic':
						maps.metalnessMap = texture;
						maps.metalness = 1;
						break;
					case 'Transparency':
					case 'Alpha':
						maps.alphaMap = texture;
						maps.transparent = true;
						break;
					case 'Normal':
						maps.normalMap = texture;
						break;
					case 'Bump':
						maps.bumpMap = texture;
						break;

				}

			}

		}

	}

	parseAttributes( attributes, maps ) {

		const params = {};

		// don't use color data if color map is present
		if ( attributes.Color && ! maps.map ) {

			params.color = new Color().fromArray( attributes.Color.value );

		} else {

			params.color = new Color();

		}


		if ( attributes.Transparency && attributes.Transparency.value !== 0 ) {

			params.opacity = 1 - attributes.Transparency.value;
			params.transparent = true;

		}

		if ( attributes[ 'Bump Height' ] ) params.bumpScale = attributes[ 'Bump Height' ].value * 0.1;

		this.parsePhysicalAttributes( params, attributes, maps );
		this.parseStandardAttributes( params, attributes, maps );
		this.parsePhongAttributes( params, attributes, maps );

		return params;

	}

	parsePhysicalAttributes( params, attributes/*, maps*/ ) {

		if ( attributes.Clearcoat && attributes.Clearcoat.value > 0 ) {

			params.clearcoat = attributes.Clearcoat.value;

			if ( attributes[ 'Clearcoat Gloss' ] ) {

				params.clearcoatRoughness = 0.5 * ( 1 - attributes[ 'Clearcoat Gloss' ].value );

			}

		}

	}

	parseStandardAttributes( params, attributes, maps ) {


		if ( attributes.Luminous ) {

			params.emissiveIntensity = attributes.Luminous.value;

			if ( attributes[ 'Luminous Color' ] && ! maps.emissive ) {

				params.emissive = new Color().fromArray( attributes[ 'Luminous Color' ].value );

			} else {

				params.emissive = new Color( 0x808080 );

			}

		}

		if ( attributes.Roughness && ! maps.roughnessMap ) params.roughness = attributes.Roughness.value;
		if ( attributes.Metallic && ! maps.metalnessMap ) params.metalness = attributes.Metallic.value;

	}

	parsePhongAttributes( params, attributes, maps ) {

		if ( attributes[ 'Refraction Index' ] ) params.refractionRatio = 0.98 / attributes[ 'Refraction Index' ].value;

		if ( attributes.Diffuse ) params.color.multiplyScalar( attributes.Diffuse.value );

		if ( attributes.Reflection ) {

			params.reflectivity = attributes.Reflection.value;
			params.combine = AddOperation;

		}

		if ( attributes.Luminosity ) {

			params.emissiveIntensity = attributes.Luminosity.value;

			if ( ! maps.emissiveMap && ! maps.map ) {

				params.emissive = params.color;

			} else {

				params.emissive = new Color( 0x808080 );

			}

		}

		// parse specular if there is no roughness - we will interpret the material as 'Phong' in this case
		if ( ! attributes.Roughness && attributes.Specular && ! maps.specularMap ) {

			if ( attributes[ 'Color Highlight' ] ) {

				params.specular = new Color().setScalar( attributes.Specular.value ).lerp( params.color.clone().multiplyScalar( attributes.Specular.value ), attributes[ 'Color Highlight' ].value );

			} else {

				params.specular = new Color().setScalar( attributes.Specular.value );

			}

		}

		if ( params.specular && attributes.Glossiness ) params.shininess = 7 + Math.pow( 2, attributes.Glossiness.value * 12 + 2 );

	}

	parseEnvMap( connections, maps, attributes ) {

		if ( connections.envMap ) {

			const envMap = this.loadTexture( connections.envMap );

			if ( attributes.transparent && attributes.opacity < 0.999 ) {

				envMap.mapping = EquirectangularRefractionMapping;

				// Reflectivity and refraction mapping don't work well together in Phong materials
				if ( attributes.reflectivity !== undefined ) {

					delete attributes.reflectivity;
					delete attributes.combine;

				}

				if ( attributes.metalness !== undefined ) {

					attributes.metalness = 1; // For most transparent materials metalness should be set to 1 if not otherwise defined. If set to 0 no refraction will be visible

				}

				attributes.opacity = 1; // transparency fades out refraction, forcing opacity to 1 ensures a closer visual match to the material in Lightwave.

			} else envMap.mapping = EquirectangularReflectionMapping;

			maps.envMap = envMap;

		}

	}

	// get texture defined at top level by its index
	getTexturePathByIndex( index ) {

		let fileName = '';

		if ( ! _lwoTree.textures ) return fileName;

		_lwoTree.textures.forEach( function ( texture ) {

			if ( texture.index === index ) fileName = texture.fileName;

		} );

		return fileName;

	}

	loadTexture( path ) {

		if ( ! path ) return null;

		const texture = this.textureLoader.load(
			path,
			undefined,
			undefined,
			function () {

				console.warn( 'LWOLoader: non-standard resource hierarchy. Use \`resourcePath\` parameter to specify root content directory.' );

			}
		);

		return texture;

	}

	// 0 = Reset, 1 = Repeat, 2 = Mirror, 3 = Edge
	getWrappingType( num ) {

		switch ( num ) {

			case 0:
				console.warn( 'LWOLoader: "Reset" texture wrapping type is not supported in three.js' );
				return ClampToEdgeWrapping;
			case 1: return RepeatWrapping;
			case 2: return MirroredRepeatWrapping;
			case 3: return ClampToEdgeWrapping;

		}

	}

	getMaterialType( nodeData ) {

		if ( nodeData.Clearcoat && nodeData.Clearcoat.value > 0 ) return MeshPhysicalMaterial;
		if ( nodeData.Roughness ) return MeshStandardMaterial;
		return MeshPhongMaterial;

	}

}

class GeometryParser {

	parse( geoData, layer ) {

		const geometry = new BufferGeometry();

		geometry.setAttribute( 'position', new Float32BufferAttribute( geoData.points, 3 ) );

		const indices = this.splitIndices( geoData.vertexIndices, geoData.polygonDimensions );
		geometry.setIndex( indices );

		this.parseGroups( geometry, geoData );

		geometry.computeVertexNormals();

		this.parseUVs( geometry, layer );
		this.parseMorphTargets( geometry, layer );

		return geometry;

	}

	// split quads into tris
	splitIndices( indices, polygonDimensions ) {

		const remappedIndices = [];

		let i = 0;
		polygonDimensions.forEach( function ( dim ) {

			if ( dim < 4 ) {

				for ( let k = 0; k < dim; k ++ ) remappedIndices.push( indices[ i + k ] );

			} else if ( dim === 4 ) {

				remappedIndices.push(
					indices[ i ],
					indices[ i + 1 ],
					indices[ i + 2 ],

					indices[ i ],
					indices[ i + 2 ],
					indices[ i + 3 ]

				);

			} else if ( dim > 4 ) {

				for ( let k = 1; k < dim - 1; k ++ ) {

					remappedIndices.push( indices[ i ], indices[ i + k ], indices[ i + k + 1 ] );

				}

				console.warn( 'LWOLoader: polygons with greater than 4 sides are not supported' );

			}

			i += dim;

		} );

		return remappedIndices;

	}

	// NOTE: currently ignoring poly indices and assuming that they are intelligently ordered
	parseGroups( geometry, geoData ) {

		const tags = _lwoTree.tags;
		const matNames = [];

		let elemSize = 3;
		if ( geoData.type === 'lines' ) elemSize = 2;
		if ( geoData.type === 'points' ) elemSize = 1;

		const remappedIndices = this.splitMaterialIndices( geoData.polygonDimensions, geoData.materialIndices );

		let indexNum = 0; // create new indices in numerical order
		const indexPairs = {}; // original indices mapped to numerical indices

		let prevMaterialIndex;
		let materialIndex;

		let prevStart = 0;
		let currentCount = 0;

		for ( let i = 0; i < remappedIndices.length; i += 2 ) {

			materialIndex = remappedIndices[ i + 1 ];

			if ( i === 0 ) matNames[ indexNum ] = tags[ materialIndex ];

			if ( prevMaterialIndex === undefined ) prevMaterialIndex = materialIndex;

			if ( materialIndex !== prevMaterialIndex ) {

				let currentIndex;
				if ( indexPairs[ tags[ prevMaterialIndex ] ] ) {

					currentIndex = indexPairs[ tags[ prevMaterialIndex ] ];

				} else {

					currentIndex = indexNum;
					indexPairs[ tags[ prevMaterialIndex ] ] = indexNum;
					matNames[ indexNum ] = tags[ prevMaterialIndex ];
					indexNum ++;

				}

				geometry.addGroup( prevStart, currentCount, currentIndex );

				prevStart += currentCount;

				prevMaterialIndex = materialIndex;
				currentCount = 0;

			}

			currentCount += elemSize;

		}

		// the loop above doesn't add the last group, do that here.
		if ( geometry.groups.length > 0 ) {

			let currentIndex;
			if ( indexPairs[ tags[ materialIndex ] ] ) {

				currentIndex = indexPairs[ tags[ materialIndex ] ];

			} else {

				currentIndex = indexNum;
				indexPairs[ tags[ materialIndex ] ] = indexNum;
				matNames[ indexNum ] = tags[ materialIndex ];

			}

			geometry.addGroup( prevStart, currentCount, currentIndex );

		}

		// Mat names from TAGS chunk, used to build up an array of materials for this geometry
		geometry.userData.matNames = matNames;

	}

	splitMaterialIndices( polygonDimensions, indices ) {

		const remappedIndices = [];

		polygonDimensions.forEach( function ( dim, i ) {

			if ( dim <= 3 ) {

				remappedIndices.push( indices[ i * 2 ], indices[ i * 2 + 1 ] );

			} else if ( dim === 4 ) {

				remappedIndices.push( indices[ i * 2 ], indices[ i * 2 + 1 ], indices[ i * 2 ], indices[ i * 2 + 1 ] );

			} else {

				 // ignore > 4 for now
				for ( let k = 0; k < dim - 2; k ++ ) {

					remappedIndices.push( indices[ i * 2 ], indices[ i * 2 + 1 ] );

				}

			}

		} );

		return remappedIndices;

	}

	// UV maps:
	// 1: are defined via index into an array of points, not into a geometry
	// - the geometry is also defined by an index into this array, but the indexes may not match
	// 2: there can be any number of UV maps for a single geometry. Here these are combined,
	// 	with preference given to the first map encountered
	// 3: UV maps can be partial - that is, defined for only a part of the geometry
	// 4: UV maps can be VMAP or VMAD (discontinuous, to allow for seams). In practice, most
	// UV maps are defined as partially VMAP and partially VMAD
	// VMADs are currently not supported
	parseUVs( geometry, layer ) {

		// start by creating a UV map set to zero for the whole geometry
		const remappedUVs = Array.from( Array( geometry.attributes.position.count * 2 ), function () {

			return 0;

		} );

		for ( const name in layer.uvs ) {

			const uvs = layer.uvs[ name ].uvs;
			const uvIndices = layer.uvs[ name ].uvIndices;

			uvIndices.forEach( function ( i, j ) {

				remappedUVs[ i * 2 ] = uvs[ j * 2 ];
				remappedUVs[ i * 2 + 1 ] = uvs[ j * 2 + 1 ];

			} );

		}

		geometry.setAttribute( 'uv', new Float32BufferAttribute( remappedUVs, 2 ) );

	}

	parseMorphTargets( geometry, layer ) {

		let num = 0;
		for ( const name in layer.morphTargets ) {

			const remappedPoints = geometry.attributes.position.array.slice();

			if ( ! geometry.morphAttributes.position ) geometry.morphAttributes.position = [];

			const morphPoints = layer.morphTargets[ name ].points;
			const morphIndices = layer.morphTargets[ name ].indices;
			const type = layer.morphTargets[ name ].type;

			morphIndices.forEach( function ( i, j ) {

				if ( type === 'relative' ) {

					remappedPoints[ i * 3 ] += morphPoints[ j * 3 ];
					remappedPoints[ i * 3 + 1 ] += morphPoints[ j * 3 + 1 ];
					remappedPoints[ i * 3 + 2 ] += morphPoints[ j * 3 + 2 ];

				} else {

					remappedPoints[ i * 3 ] = morphPoints[ j * 3 ];
					remappedPoints[ i * 3 + 1 ] = morphPoints[ j * 3 + 1 ];
					remappedPoints[ i * 3 + 2 ] = morphPoints[ j * 3 + 2 ];

				}

			} );

			geometry.morphAttributes.position[ num ] = new Float32BufferAttribute( remappedPoints, 3 );
			geometry.morphAttributes.position[ num ].name = name;

			num ++;

		}

		geometry.morphTargetsRelative = false;

	}

}


// ************** UTILITY FUNCTIONS **************

function extractParentUrl( url, dir ) {

	const index = url.indexOf( dir );

	if ( index === -1 ) return './';

	return url.slice( 0, index );

}

export { LWOLoader };
//# sourceMappingURL=LWOLoader-033KicQX.js.map
