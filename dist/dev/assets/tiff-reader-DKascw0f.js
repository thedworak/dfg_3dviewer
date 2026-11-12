import { f as fs } from './_node-resolve_empty-BPaRBzhC.js';
import { r as runVolumeWorker, c as cellCounts, f as finishChannel } from './volume-voxels-CI6ldnye.js';
import { a as slicesNextTo, s as skyscanPixelSize } from './slice-stack-HPsHxT3J.js';

/* eslint-disable no-restricted-globals, no-restricted-syntax */
/* global SharedArrayBuffer */


/** @type {<T extends (...args: any) => any>(target: T) => (thisArg: ThisType<T>, ...args: any[]) => any} */
function uncurryThis(target) {
  return (thisArg, ...args) => {
    return ReflectApply(target, thisArg, args);
  };
}

/** @type {(target: any, key: string | symbol) => (thisArg: any, ...args: any[]) => any} */
function uncurryThisGetter(target, key) {
  return uncurryThis(
    ReflectGetOwnPropertyDescriptor(
      target,
      key
    ).get
  );
}

// Reflect
const {
  apply: ReflectApply,
  getOwnPropertyDescriptor: ReflectGetOwnPropertyDescriptor,
  getPrototypeOf: ReflectGetPrototypeOf,
  ownKeys: ReflectOwnKeys} = Reflect;

// Symbol
const {
  iterator: SymbolIterator,
  toStringTag: SymbolToStringTag} = Symbol;

// Object
const NativeObject = Object;
const {
  create: ObjectCreate,
  defineProperty: ObjectDefineProperty} = NativeObject;

// Array
const NativeArray = Array;
const ArrayPrototype = NativeArray.prototype;
const NativeArrayPrototypeSymbolIterator = ArrayPrototype[SymbolIterator];
/** @type {<T>(array: T[]) => IterableIterator<T>} */
const ArrayPrototypeSymbolIterator = uncurryThis(NativeArrayPrototypeSymbolIterator);

// ArrayBuffer
const NativeArrayBuffer = ArrayBuffer;
const ArrayBufferPrototype = NativeArrayBuffer.prototype;
/** @type {(buffer: ArrayBuffer) => ArrayBuffer} */
uncurryThisGetter(ArrayBufferPrototype, "byteLength");

// SharedArrayBuffer
const NativeSharedArrayBuffer = typeof SharedArrayBuffer !== "undefined" ? SharedArrayBuffer : null;
/** @type {(buffer: SharedArrayBuffer) => SharedArrayBuffer} */
NativeSharedArrayBuffer
  && uncurryThisGetter(NativeSharedArrayBuffer.prototype, "byteLength");

// TypedArray
/** @typedef {Uint8Array|Uint8ClampedArray|Uint16Array|Uint32Array|Int8Array|Int16Array|Int32Array|Float32Array|Float64Array|BigUint64Array|BigInt64Array} TypedArray */
/** @type {any} */
const TypedArray = ReflectGetPrototypeOf(Uint8Array);
const TypedArrayPrototype = TypedArray.prototype;
/** @type {((typedArray: TypedArray) => ArrayBuffer)} */
uncurryThisGetter(
  TypedArrayPrototype,
  "buffer"
);
/** @type {((typedArray: TypedArray) => number)} */
uncurryThisGetter(
  TypedArrayPrototype,
  "byteOffset"
);
/** @type {((typedArray: TypedArray) => number)} */
uncurryThisGetter(
  TypedArrayPrototype,
  "length"
);
/** @type {(target: unknown) => string} */
uncurryThisGetter(
  TypedArrayPrototype,
  SymbolToStringTag
);

// Uint8Array
const NativeUint8Array = Uint8Array;

// Uint16Array
const NativeUint16Array = Uint16Array;

// Uint32Array
const NativeUint32Array = Uint32Array;

// Float32Array
const NativeFloat32Array = Float32Array;

// ArrayIterator
/** @type {any} */
const ArrayIteratorPrototype = ReflectGetPrototypeOf([][SymbolIterator]());
/** @type {<T>(arrayIterator: IterableIterator<T>) => IteratorResult<T>} */
const ArrayIteratorPrototypeNext = uncurryThis(ArrayIteratorPrototype.next);

// Generator
/** @type {<T = unknown, TReturn = any, TNext = unknown>(generator: Generator<T, TReturn, TNext>, value?: TNext) => T} */
const GeneratorPrototypeNext = uncurryThis((function* () {})().next);

// Iterator
const IteratorPrototype = ReflectGetPrototypeOf(ArrayIteratorPrototype);

// DataView
const DataViewPrototype = DataView.prototype;
/** @type {(dataView: DataView, byteOffset: number, littleEndian?: boolean) => number} */
const DataViewPrototypeGetUint16 = uncurryThis(
  DataViewPrototype.getUint16
);

// WeakMap
/**
 * Do not construct with arguments to avoid calling the "set" method
 * @type {{new <K extends {}, V>(): WeakMap<K, V>}}
 */
const NativeWeakMap = WeakMap;
const WeakMapPrototype = NativeWeakMap.prototype;
/** @type {<K extends {}, V>(weakMap: WeakMap<K, V>, key: K) => V} */
const WeakMapPrototypeGet = uncurryThis(WeakMapPrototype.get);
/** @type {<K extends {}, V>(weakMap: WeakMap<K, V>, key: K, value: V) => WeakMap} */
const WeakMapPrototypeSet = uncurryThis(WeakMapPrototype.set);

/** @type {WeakMap<{}, IterableIterator<any>>} */
const arrayIterators = new NativeWeakMap();

const SafeIteratorPrototype = ObjectCreate(null, {
  next: {
    value: function next() {
      const arrayIterator = WeakMapPrototypeGet(arrayIterators, this);
      return ArrayIteratorPrototypeNext(arrayIterator);
    },
  },

  [SymbolIterator]: {
    value: function values() {
      return this;
    },
  },
});

/**
 * Wrap the Array around the SafeIterator If Array.prototype [@@iterator] has been modified
 * @type {<T>(array: T[]) => Iterable<T>}
 */
function safeIfNeeded(array) {
  if (
    array[SymbolIterator] === NativeArrayPrototypeSymbolIterator &&
    ArrayIteratorPrototype.next === ArrayIteratorPrototypeNext
  ) {
    return array;
  }

  const safe = ObjectCreate(SafeIteratorPrototype);
  WeakMapPrototypeSet(arrayIterators, safe, ArrayPrototypeSymbolIterator(array));
  return safe;
}

/** @type {WeakMap<{}, Generator<any>>} */
const generators = new NativeWeakMap();

/** @see https://tc39.es/ecma262/#sec-%arrayiteratorprototype%-object */
const DummyArrayIteratorPrototype = ObjectCreate(IteratorPrototype, {
  next: {
    value: function next() {
      const generator = WeakMapPrototypeGet(generators, this);
      return GeneratorPrototypeNext(generator);
    },
    writable: true,
    configurable: true,
  },
});

for (const key of ReflectOwnKeys(ArrayIteratorPrototype)) {
  // next method has already defined
  if (key === "next") {
    continue;
  }

  // Copy ArrayIteratorPrototype descriptors to DummyArrayIteratorPrototype
  ObjectDefineProperty(DummyArrayIteratorPrototype, key, ReflectGetOwnPropertyDescriptor(ArrayIteratorPrototype, key));
}

// base algorithm: http://fox-toolkit.org/ftp/fasthalffloatconversion.pdf

const buffer = new NativeArrayBuffer(4);
const floatView = new NativeFloat32Array(buffer);
const uint32View = new NativeUint32Array(buffer);

const baseTable = new NativeUint16Array(512);
const shiftTable = new NativeUint8Array(512);

for (let i = 0; i < 256; ++i) {
  const e = i - 127;

  // very small number (0, -0)
  if (e < -24) {
    baseTable[i]         = 0x0000;
    baseTable[i | 0x100] = 0x8000;
    shiftTable[i]         = 24;
    shiftTable[i | 0x100] = 24;

  // small number (denorm)
  } else if (e < -14) {
    baseTable[i]         =  0x0400 >> (-e - 14);
    baseTable[i | 0x100] = (0x0400 >> (-e - 14)) | 0x8000;
    shiftTable[i]         = -e - 1;
    shiftTable[i | 0x100] = -e - 1;

  // normal number
  } else if (e <= 15) {
    baseTable[i]         =  (e + 15) << 10;
    baseTable[i | 0x100] = ((e + 15) << 10) | 0x8000;
    shiftTable[i]         = 13;
    shiftTable[i | 0x100] = 13;

  // large number (Infinity, -Infinity)
  } else if (e < 128) {
    baseTable[i]         = 0x7c00;
    baseTable[i | 0x100] = 0xfc00;
    shiftTable[i]         = 24;
    shiftTable[i | 0x100] = 24;

  // stay (NaN, Infinity, -Infinity)
  } else {
    baseTable[i]         = 0x7c00;
    baseTable[i | 0x100] = 0xfc00;
    shiftTable[i]         = 13;
    shiftTable[i | 0x100] = 13;
  }
}

const mantissaTable = new NativeUint32Array(2048);
for (let i = 1; i < 1024; ++i) {
  let m = i << 13; // zero pad mantissa bits
  let e = 0; // zero exponent

  // normalized
  while ((m & 0x00800000) === 0) {
    m <<= 1;
    e -= 0x00800000; // decrement exponent
  }

  m &= -8388609; // clear leading 1 bit
  e += 0x38800000; // adjust bias

  mantissaTable[i] = m | e;
}
for (let i = 1024; i < 2048; ++i) {
  mantissaTable[i] = 0x38000000 + ((i - 1024) << 13);
}

const exponentTable = new NativeUint32Array(64);
for (let i = 1; i < 31; ++i) {
  exponentTable[i] = i << 23;
}
exponentTable[31] = 0x47800000;
exponentTable[32] = 0x80000000;
for (let i = 33; i < 63; ++i) {
  exponentTable[i] = 0x80000000 + ((i - 32) << 23);
}
exponentTable[63] = 0xc7800000;

const offsetTable = new NativeUint16Array(64);
for (let i = 1; i < 64; ++i) {
  if (i !== 32) {
    offsetTable[i] = 1024;
  }
}

/**
 * convert a half float number bits to a number
 * @param {number} float16bits - half float number bits
 * @returns {number} double float
 */
function convertToNumber(float16bits) {
  const i = float16bits >> 10;
  uint32View[0] = mantissaTable[offsetTable[i] + (float16bits & 0x3ff)] + exponentTable[i];
  return floatView[0];
}

/**
 * returns an unsigned 16-bit float at the specified byte offset from the start of the DataView
 * @param {DataView} dataView
 * @param {number} byteOffset
 * @param {[boolean]} opts
 * @returns {number}
 */
function getFloat16(dataView, byteOffset, ...opts) {
  return convertToNumber(
    DataViewPrototypeGetUint16(dataView, byteOffset, ...safeIfNeeded(opts))
  );
}

function getAttribute(tag, attributeName, options) {

  const xml = typeof tag === "object" ? tag.outer : tag;

  // only search for attributes in the opening tag
  const opening = xml.slice(0, xml.indexOf(">") + 1);

  const quotechars = ['"', "'"];
  for (let i = 0; i < quotechars.length; i++) {
    const char = quotechars[i];
    const pattern = attributeName + "\\=" + char + "([^" + char + "]*)" + char;

    const re = new RegExp(pattern);
    const match = re.exec(opening);
    if (match) return match[1];
  }
}

function indexOfMatch(xml, pattern, startIndex) {
  const re = new RegExp(pattern);
  const match = re.exec(xml.slice(startIndex));
  if (match) return startIndex + match.index;
  else return -1;
}

function indexOfMatchEnd(xml, pattern, startIndex) {
  const re = new RegExp(pattern);
  const match = re.exec(xml.slice(startIndex));
  if (match) return startIndex + match.index + match[0].length - 1;
  else return -1;
}

function countSubstring(string, substring) {
  const pattern = new RegExp(substring, "g");
  const match = string.match(pattern);
  return match ? match.length : 0;
}

function findTagByName(xml, tagName, options) {
  const debug = (options && options.debug) || false;
  const nested = !(options && typeof options.nested === false);

  const startIndex = (options && options.startIndex) || 0;

  if (debug) console.log("[xml-utils] starting findTagByName with", tagName, " and ", options);

  const start = indexOfMatch(xml, `\<${tagName}[ \n\>\/]`, startIndex);
  if (debug) console.log("[xml-utils] start:", start);
  if (start === -1) return undefined;

  const afterStart = xml.slice(start + tagName.length);

  let relativeEnd = indexOfMatchEnd(afterStart, "^[^<]*[ /]>", 0);

  const selfClosing = relativeEnd !== -1 && afterStart[relativeEnd - 1] === "/";
  if (debug) console.log("[xml-utils] selfClosing:", selfClosing);

  if (selfClosing === false) {
    // check if tag has subtags with the same name
    if (nested) {
      let startIndex = 0;
      let openings = 1;
      let closings = 0;
      while ((relativeEnd = indexOfMatchEnd(afterStart, "[ /]" + tagName + ">", startIndex)) !== -1) {
        const clip = afterStart.substring(startIndex, relativeEnd + 1);
        openings += countSubstring(clip, "<" + tagName + "[ \n\t>]");
        closings += countSubstring(clip, "</" + tagName + ">");
        // we can't have more openings than closings
        if (closings >= openings) break;
        startIndex = relativeEnd;
      }
    } else {
      relativeEnd = indexOfMatchEnd(afterStart, "[ /]" + tagName + ">", 0);
    }
  }

  const end = start + tagName.length + relativeEnd + 1;
  if (debug) console.log("[xml-utils] end:", end);
  if (end === -1) return undefined;

  const outer = xml.slice(start, end);
  // tag is like <gml:identifier codeSpace="OGP">urn:ogc:def:crs:EPSG::32617</gml:identifier>

  let inner;
  if (selfClosing) {
    inner = null;
  } else {
    inner = outer.slice(outer.indexOf(">") + 1, outer.lastIndexOf("<"));
  }

  return { inner, outer, start, end };
}

function findTagsByName(xml, tagName, options) {
  const tags = [];
  const debug = false;
  let startIndex = 0;
  let tag;
  while ((tag = findTagByName(xml, tagName, { debug, startIndex }))) {
    {
      startIndex = tag.start + 1 + tagName.length;
    }
    tags.push(tag);
  }
  return tags;
}

/** @import {TypedArray} from './geotiff.js' */
const fieldTypes = {
    BYTE: /** @type {1} */ (0x0001),
    ASCII: /** @type {2} */ (0x0002),
    SHORT: /** @type {3} */ (0x0003),
    LONG: /** @type {4} */ (0x0004),
    RATIONAL: /** @type {5} */ (0x0005),
    SBYTE: /** @type {6} */ (0x0006),
    UNDEFINED: /** @type {7} */ (0x0007),
    SSHORT: /** @type {8} */ (0x0008),
    SLONG: /** @type {9} */ (0x0009),
    SRATIONAL: /** @type {10} */ (0x000a),
    FLOAT: /** @type {11} */ (0x000b),
    DOUBLE: /** @type {12} */ (0x000c),
    // IFD offset, suggested by https://owl.phy.queensu.ca/~phil/exiftool/standards.html
    IFD: /** @type {13} */ (0x000d),
    // introduced by BigTIFF
    LONG8: /** @type {16} */ (0x0010),
    SLONG8: /** @type {17} */ (0x0011),
    IFD8: /** @type {18} */ (0x0012),
};
/** @typedef {keyof fieldTypes} FieldTypeName */
/** @typedef {fieldTypes[keyof typeof fieldTypes]} FieldType */
/** @typedef {Record<FieldTypeName, number>} FieldTypeSizes */
const fieldTypeSizes = /** @type {const} */ ({
    [fieldTypes.BYTE]: 1,
    [fieldTypes.ASCII]: 1,
    [fieldTypes.SBYTE]: 1,
    [fieldTypes.UNDEFINED]: 1,
    [fieldTypes.SHORT]: 2,
    [fieldTypes.SSHORT]: 2,
    [fieldTypes.LONG]: 4,
    [fieldTypes.SLONG]: 4,
    [fieldTypes.FLOAT]: 4,
    [fieldTypes.IFD]: 4,
    [fieldTypes.RATIONAL]: 8,
    [fieldTypes.SRATIONAL]: 8,
    [fieldTypes.DOUBLE]: 8,
    [fieldTypes.LONG8]: 8,
    [fieldTypes.SLONG8]: 8,
    [fieldTypes.IFD8]: 8,
});
/** @typedef {fieldTypeSizes[keyof typeof fieldTypeSizes]} FieldTypeSize */
/**
 * Get the byte size for a given field type.
 * @param {FieldType} fieldType The TIFF field type constant
 * @returns {number} The size in bytes
 * @throws {RangeError} If the field type is invalid
 */
function getFieldTypeSize(fieldType) {
    const size = fieldTypeSizes[fieldType];
    if (size === undefined) {
        throw new RangeError(`Invalid field type: ${fieldType}`);
    }
    return size;
}
/**
 * @typedef {Object} TagDictionaryEntry
 * @property {number} tag
 * @property {string} [name]
 * @property {number} [type]
 * @property {boolean} [isArray]
 * @property {boolean} [eager]
 */
const tagDictionary = /** @type {const} */ ({
    NewSubfileType: { tag: 254, type: fieldTypes.LONG, eager: true },
    SubfileType: { tag: 255, type: fieldTypes.SHORT, eager: true },
    ImageWidth: { tag: 256, type: fieldTypes.SHORT, eager: true },
    ImageLength: { tag: 257, type: fieldTypes.SHORT, eager: true },
    BitsPerSample: { tag: 258, type: fieldTypes.SHORT, isArray: true, eager: true },
    Compression: { tag: 259, type: fieldTypes.SHORT, eager: true },
    PhotometricInterpretation: { tag: 262, type: fieldTypes.SHORT, eager: true },
    Threshholding: { tag: 263, type: fieldTypes.SHORT },
    CellWidth: { tag: 264, type: fieldTypes.SHORT },
    CellLength: { tag: 265, type: fieldTypes.SHORT },
    FillOrder: { tag: 266, type: fieldTypes.SHORT },
    DocumentName: { tag: 269, type: fieldTypes.ASCII },
    ImageDescription: { tag: 270, type: fieldTypes.ASCII },
    Make: { tag: 271, type: fieldTypes.ASCII },
    Model: { tag: 272, type: fieldTypes.ASCII },
    StripOffsets: { tag: 273, type: fieldTypes.SHORT, isArray: true },
    Orientation: { tag: 274, type: fieldTypes.SHORT },
    SamplesPerPixel: { tag: 277, type: fieldTypes.SHORT, eager: true },
    RowsPerStrip: { tag: 278, type: fieldTypes.SHORT, eager: true },
    StripByteCounts: { tag: 279, type: fieldTypes.LONG, isArray: true },
    MinSampleValue: { tag: 280, type: fieldTypes.SHORT, isArray: true },
    MaxSampleValue: { tag: 281, type: fieldTypes.SHORT, isArray: true },
    XResolution: { tag: 282, type: fieldTypes.RATIONAL },
    YResolution: { tag: 283, type: fieldTypes.RATIONAL },
    PlanarConfiguration: { tag: 284, type: fieldTypes.SHORT, eager: true },
    PageName: { tag: 285, type: fieldTypes.ASCII },
    XPosition: { tag: 286, type: fieldTypes.RATIONAL },
    YPosition: { tag: 287, type: fieldTypes.RATIONAL },
    FreeOffsets: { tag: 288, type: fieldTypes.LONG },
    FreeByteCounts: { tag: 289, type: fieldTypes.LONG },
    GrayResponseUnit: { tag: 290, type: fieldTypes.SHORT },
    GrayResponseCurve: { tag: 291, type: fieldTypes.SHORT, isArray: true },
    T4Options: { tag: 292, type: fieldTypes.LONG },
    T6Options: { tag: 293, type: fieldTypes.LONG },
    ResolutionUnit: { tag: 296, type: fieldTypes.SHORT },
    PageNumber: { tag: 297, type: fieldTypes.SHORT, isArray: true },
    TransferFunction: { tag: 301, type: fieldTypes.SHORT, isArray: true },
    Software: { tag: 305, type: fieldTypes.ASCII },
    DateTime: { tag: 306, type: fieldTypes.ASCII },
    Artist: { tag: 315, type: fieldTypes.ASCII },
    HostComputer: { tag: 316, type: fieldTypes.ASCII },
    Predictor: { tag: 317, type: fieldTypes.SHORT },
    WhitePoint: { tag: 318, type: fieldTypes.RATIONAL, isArray: true },
    PrimaryChromaticities: { tag: 319, type: fieldTypes.RATIONAL, isArray: true },
    ColorMap: { tag: 320, type: fieldTypes.SHORT, isArray: true },
    HalftoneHints: { tag: 321, type: fieldTypes.SHORT, isArray: true },
    TileWidth: { tag: 322, type: fieldTypes.SHORT, eager: true },
    TileLength: { tag: 323, type: fieldTypes.SHORT, eager: true },
    TileOffsets: { tag: 324, type: fieldTypes.LONG, isArray: true },
    TileByteCounts: { tag: 325, type: fieldTypes.SHORT, isArray: true },
    InkSet: { tag: 332, type: fieldTypes.SHORT },
    InkNames: { tag: 333, type: fieldTypes.ASCII },
    NumberOfInks: { tag: 334, type: fieldTypes.SHORT },
    DotRange: { tag: 336, type: fieldTypes.BYTE, isArray: true },
    TargetPrinter: { tag: 337, type: fieldTypes.ASCII },
    ExtraSamples: { tag: 338, type: fieldTypes.BYTE, isArray: true, eager: true },
    SampleFormat: { tag: 339, type: fieldTypes.SHORT, isArray: true, eager: true },
    SMinSampleValue: { tag: 340, isArray: true },
    SMaxSampleValue: { tag: 341, isArray: true },
    TransferRange: { tag: 342, type: fieldTypes.SHORT, isArray: true },
    JPEGProc: { tag: 512, type: fieldTypes.SHORT },
    JPEGInterchangeFormat: { tag: 513, type: fieldTypes.LONG },
    JPEGInterchangeFormatLngth: { tag: 514, type: fieldTypes.LONG },
    JPEGRestartInterval: { tag: 515, type: fieldTypes.SHORT },
    JPEGLosslessPredictors: { tag: 517, type: fieldTypes.SHORT, isArray: true },
    JPEGPointTransforms: { tag: 518, type: fieldTypes.SHORT, isArray: true },
    JPEGQTables: { tag: 519, type: fieldTypes.LONG, isArray: true },
    JPEGDCTables: { tag: 520, type: fieldTypes.LONG, isArray: true },
    JPEGACTables: { tag: 521, type: fieldTypes.LONG, isArray: true },
    YCbCrCoefficients: { tag: 529, type: fieldTypes.RATIONAL, isArray: true },
    YCbCrSubSampling: { tag: 530, type: fieldTypes.SHORT, isArray: true },
    YCbCrPositioning: { tag: 531, type: fieldTypes.SHORT },
    ReferenceBlackWhite: { tag: 532, type: fieldTypes.LONG, isArray: true },
    Copyright: { tag: 33432, type: fieldTypes.ASCII },
    BadFaxLines: { tag: 326 },
    CleanFaxData: { tag: 327 },
    ClipPath: { tag: 343 },
    ConsecutiveBadFaxLines: { tag: 328 },
    Decode: { tag: 433 },
    DefaultImageColor: { tag: 434 },
    Indexed: { tag: 346 },
    JPEGTables: { tag: 347, isArray: true, eager: true },
    StripRowCounts: { tag: 559, isArray: true },
    SubIFDs: { tag: 330, isArray: true },
    XClipPathUnits: { tag: 344 },
    YClipPathUnits: { tag: 345 },
    ApertureValue: { tag: 37378 },
    ColorSpace: { tag: 40961 },
    DateTimeDigitized: { tag: 36868 },
    DateTimeOriginal: { tag: 36867 },
    ExifIFD: { tag: 34665, name: 'Exif IFD', type: fieldTypes.LONG },
    ExifVersion: { tag: 36864 },
    ExposureTime: { tag: 33434 },
    FileSource: { tag: 41728 },
    Flash: { tag: 37385 },
    FlashpixVersion: { tag: 40960 },
    FNumber: { tag: 33437 },
    ImageUniqueID: { tag: 42016 },
    LightSource: { tag: 37384 },
    MakerNote: { tag: 37500 },
    ShutterSpeedValue: { tag: 37377 },
    UserComment: { tag: 37510 },
    IPTC: { tag: 33723 },
    CZ_LSMINFO: { tag: 34412 },
    ICCProfile: { tag: 34675, name: 'ICC Profile' },
    XMP: { tag: 700 },
    GDAL_METADATA: { tag: 42112 },
    GDAL_NODATA: { tag: 42113, type: fieldTypes.ASCII, eager: true },
    Photoshop: { tag: 34377 },
    ModelPixelScale: { tag: 33550, type: fieldTypes.DOUBLE, isArray: true, eager: true },
    ModelTiepoint: { tag: 33922, type: fieldTypes.DOUBLE, isArray: true, eager: true },
    ModelTransformation: { tag: 34264, type: fieldTypes.DOUBLE, isArray: true, eager: true },
    GeoKeyDirectory: { tag: 34735, type: fieldTypes.SHORT, isArray: true, eager: true },
    GeoDoubleParams: { tag: 34736, type: fieldTypes.DOUBLE, isArray: true, eager: true },
    GeoAsciiParams: { tag: 34737, type: fieldTypes.ASCII, eager: true },
    LercParameters: { tag: 50674, eager: true },
});
/** @typedef {keyof typeof tagDictionary} TagName */
/** @typedef {typeof tagDictionary[keyof typeof tagDictionary]['tag']} Tag */
/**
 * @typedef {Extract<keyof typeof tagDictionary,
 *   { [K in keyof typeof tagDictionary]: (typeof tagDictionary)[K] extends { eager: true }
 *   ? K : never }[keyof typeof tagDictionary]>} EagerTagName
 */
/**
 * @typedef {Extract<Tag, { [K in keyof typeof tagDictionary]: (typeof tagDictionary)[K] extends { eager: true }
 *   ? (typeof tagDictionary)[K]['tag'] : never }[keyof typeof tagDictionary]>} EagerTag
 */
/** @typedef {Extract<typeof tagDictionary[keyof typeof tagDictionary], {type: any}>['type']} TagType */
/**
 * @template {number} T
 * @typedef {T extends 2 ? string : number} GeoTiffPrimitive
 */
/**
 * @template {TagName} T
 * @typedef {typeof tagDictionary[T]} TagDef
 */
/**
 * @typedef {{
 *   1: number;
 *   2: string;
 *   3: number;
 *   4: number;
 *   5: number;
 *   6: number;
 *   7: ArrayBuffer;
 *   8: number;
 *   9: number;
 *   10: number;
 *   11: number;
 *   12: number;
 *   16: number;
 *   17: number;
 *   18: number;
 * }} FieldTypeMap
 */
/**
 * @template {TagName} T
 * @typedef {TagDef<T> extends { isArray: true }
 *   ? (TagDef<T> extends { type: typeof fieldTypes.DOUBLE } ? number[] :
 *      TagDef<T> extends { type: typeof fieldTypes.ASCII } ? string[] :
 *      TagDef<T> extends { type: typeof fieldTypes.BYTE | typeof fieldTypes.SBYTE | typeof fieldTypes.UNDEFINED }
 *        ? Uint8Array | Int8Array :
 *      (number[] | TypedArray))
 *   : (TagDef<T> extends { type: keyof FieldTypeMap } ? FieldTypeMap[TagDef<T>['type']] : any)} TagValue
 */
/**
 * Maps tag names to their numeric values
 * @type {Record<string, number>}
 */
const tags = {};
/**
 * Maps tag numbers to their definitions
 * @type {Record<number, { tag: number, name: string, type: string|number|undefined, isArray: boolean, eager: boolean }>}
 */
const tagDefinitions = {};
/**
 * Registers a new field tag
 * @param {number} tag the numeric tiff tag
 * @param {string} name the name of the tag that will be reported in the IFD
 * @param {keyof fieldTypes|number|undefined} type the tags data type
 * @param {Boolean} isArray whether the tag is an array
 * @param {boolean} [eager=false] whether to eagerly fetch deferred fields.
 *                                 When false (default), tags are loaded lazily on-demand.
 *                                 When true, all tags are loaded immediately during parsing.
 */
function registerTag(tag, name, type, isArray = false, eager = false) {
    tags[name] = tag;
    tagDefinitions[tag] = { tag, name, type: typeof type === 'string' ? fieldTypes[type] : type, isArray, eager };
}
for (const [key, value] of Object.entries(tagDictionary)) {
    const entry = /** @type {TagDictionaryEntry} */ (value);
    registerTag(entry.tag, entry.name || key, entry.type, entry.isArray, entry.eager);
}
/**
 * @param {number|string} tagIdentifier The field tag ID or name
 * @returns {number} the resolved tag ID
 */
function resolveTag(tagIdentifier) {
    if (typeof tagIdentifier === 'number') {
        return tagIdentifier;
    }
    return tags[tagIdentifier];
}
const photometricInterpretations = {
    WhiteIsZero: 0,
    BlackIsZero: 1,
    RGB: 2,
    Palette: 3,
    CMYK: 5,
    YCbCr: 6,
    CIELab: 8};
const ExtraSamplesValues = {
    Unspecified: 0};
const LercParameters = {
    AddCompression: 1,
};
const LercAddCompression = {
    None: 0,
    Deflate: 1,
    Zstandard: 2,
};
const geoKeyNames = /** @type {const} */ ({
    1024: 'GTModelTypeGeoKey',
    1025: 'GTRasterTypeGeoKey',
    1026: 'GTCitationGeoKey',
    2048: 'GeographicTypeGeoKey',
    2049: 'GeogCitationGeoKey',
    2050: 'GeogGeodeticDatumGeoKey',
    2051: 'GeogPrimeMeridianGeoKey',
    2052: 'GeogLinearUnitsGeoKey',
    2053: 'GeogLinearUnitSizeGeoKey',
    2054: 'GeogAngularUnitsGeoKey',
    2055: 'GeogAngularUnitSizeGeoKey',
    2056: 'GeogEllipsoidGeoKey',
    2057: 'GeogSemiMajorAxisGeoKey',
    2058: 'GeogSemiMinorAxisGeoKey',
    2059: 'GeogInvFlatteningGeoKey',
    2060: 'GeogAzimuthUnitsGeoKey',
    2061: 'GeogPrimeMeridianLongGeoKey',
    2062: 'GeogTOWGS84GeoKey',
    3072: 'ProjectedCSTypeGeoKey',
    3073: 'PCSCitationGeoKey',
    3074: 'ProjectionGeoKey',
    3075: 'ProjCoordTransGeoKey',
    3076: 'ProjLinearUnitsGeoKey',
    3077: 'ProjLinearUnitSizeGeoKey',
    3078: 'ProjStdParallel1GeoKey',
    3079: 'ProjStdParallel2GeoKey',
    3080: 'ProjNatOriginLongGeoKey',
    3081: 'ProjNatOriginLatGeoKey',
    3082: 'ProjFalseEastingGeoKey',
    3083: 'ProjFalseNorthingGeoKey',
    3084: 'ProjFalseOriginLongGeoKey',
    3085: 'ProjFalseOriginLatGeoKey',
    3086: 'ProjFalseOriginEastingGeoKey',
    3087: 'ProjFalseOriginNorthingGeoKey',
    3088: 'ProjCenterLongGeoKey',
    3089: 'ProjCenterLatGeoKey',
    3090: 'ProjCenterEastingGeoKey',
    3091: 'ProjCenterNorthingGeoKey',
    3092: 'ProjScaleAtNatOriginGeoKey',
    3093: 'ProjScaleAtCenterGeoKey',
    3094: 'ProjAzimuthAngleGeoKey',
    3095: 'ProjStraightVertPoleLongGeoKey',
    3096: 'ProjRectifiedGridAngleGeoKey',
    4096: 'VerticalCSTypeGeoKey',
    4097: 'VerticalCitationGeoKey',
    4098: 'VerticalDatumGeoKey',
    4099: 'VerticalUnitsGeoKey',
});
for (const [key, name] of Object.entries(geoKeyNames)) {
}

function fromWhiteIsZero(raster, max) {
    const { width, height } = raster;
    const rgbRaster = new Uint8Array(width * height * 3);
    let value;
    for (let i = 0, j = 0; i < raster.length; ++i, j += 3) {
        value = 256 - (raster[i] / max) * 256;
        rgbRaster[j] = value;
        rgbRaster[j + 1] = value;
        rgbRaster[j + 2] = value;
    }
    return rgbRaster;
}
function fromBlackIsZero(raster, max) {
    const { width, height } = raster;
    const rgbRaster = new Uint8Array(width * height * 3);
    let value;
    for (let i = 0, j = 0; i < raster.length; ++i, j += 3) {
        value = (raster[i] / max) * 256;
        rgbRaster[j] = value;
        rgbRaster[j + 1] = value;
        rgbRaster[j + 2] = value;
    }
    return rgbRaster;
}
function fromPalette(raster, colorMap) {
    const { width, height } = raster;
    const rgbRaster = new Uint8Array(width * height * 3);
    const greenOffset = colorMap.length / 3;
    const blueOffset = (colorMap.length / 3) * 2;
    for (let i = 0, j = 0; i < raster.length; ++i, j += 3) {
        const mapIndex = raster[i];
        rgbRaster[j] = (colorMap[mapIndex] / 65536) * 256;
        rgbRaster[j + 1] = (colorMap[mapIndex + greenOffset] / 65536) * 256;
        rgbRaster[j + 2] = (colorMap[mapIndex + blueOffset] / 65536) * 256;
    }
    return rgbRaster;
}
function fromCMYK(cmykRaster) {
    const { width, height } = cmykRaster;
    const rgbRaster = new Uint8Array(width * height * 3);
    for (let i = 0, j = 0; i < cmykRaster.length; i += 4, j += 3) {
        const c = cmykRaster[i];
        const m = cmykRaster[i + 1];
        const y = cmykRaster[i + 2];
        const k = cmykRaster[i + 3];
        rgbRaster[j] = 255 * ((255 - c) / 256) * ((255 - k) / 256);
        rgbRaster[j + 1] = 255 * ((255 - m) / 256) * ((255 - k) / 256);
        rgbRaster[j + 2] = 255 * ((255 - y) / 256) * ((255 - k) / 256);
    }
    return rgbRaster;
}
function fromYCbCr(yCbCrRaster) {
    const { width, height } = yCbCrRaster;
    const rgbRaster = new Uint8ClampedArray(width * height * 3);
    for (let i = 0, j = 0; i < yCbCrRaster.length; i += 3, j += 3) {
        const y = yCbCrRaster[i];
        const cb = yCbCrRaster[i + 1];
        const cr = yCbCrRaster[i + 2];
        rgbRaster[j] = y + 1.402 * (cr - 0x80);
        rgbRaster[j + 1] = y - 0.34414 * (cb - 0x80) - 0.71414 * (cr - 0x80);
        rgbRaster[j + 2] = y + 1.772 * (cb - 0x80);
    }
    return rgbRaster;
}
const Xn = 0.95047;
const Yn = 1.0;
const Zn = 1.08883;
// from https://github.com/antimatter15/rgb-lab/blob/master/color.js
function fromCIELab(cieLabRaster) {
    const { width, height } = cieLabRaster;
    const rgbRaster = new Uint8Array(width * height * 3);
    for (let i = 0, j = 0; i < cieLabRaster.length; i += 3, j += 3) {
        const L = cieLabRaster[i + 0];
        const a_ = (cieLabRaster[i + 1] << 24) >> 24; // conversion from uint8 to int8
        const b_ = (cieLabRaster[i + 2] << 24) >> 24; // same
        let y = (L + 16) / 116;
        let x = a_ / 500 + y;
        let z = y - b_ / 200;
        let r;
        let g;
        let b;
        x = Xn * (x * x * x > 0.008856 ? x * x * x : (x - 16 / 116) / 7.787);
        y = Yn * (y * y * y > 0.008856 ? y * y * y : (y - 16 / 116) / 7.787);
        z = Zn * (z * z * z > 0.008856 ? z * z * z : (z - 16 / 116) / 7.787);
        r = x * 3.2406 + y * -1.5372 + z * -0.4986;
        g = x * -0.9689 + y * 1.8758 + z * 0.0415;
        b = x * 0.0557 + y * -0.204 + z * 1.057;
        r = r > 0.0031308 ? 1.055 * r ** (1 / 2.4) - 0.055 : 12.92 * r;
        g = g > 0.0031308 ? 1.055 * g ** (1 / 2.4) - 0.055 : 12.92 * g;
        b = b > 0.0031308 ? 1.055 * b ** (1 / 2.4) - 0.055 : 12.92 * b;
        rgbRaster[j] = Math.max(0, Math.min(1, r)) * 255;
        rgbRaster[j + 1] = Math.max(0, Math.min(1, g)) * 255;
        rgbRaster[j + 2] = Math.max(0, Math.min(1, b)) * 255;
    }
    return rgbRaster;
}

/** @import BaseDecoder, {BaseDecoderParameters} from "./basedecoder.js" */
/**
 * @typedef {Object} RegistryEntry
 * @property {function():Promise<typeof BaseDecoder>} importFn
 * @property {function(import("../imagefiledirectory.js").ImageFileDirectory):Promise<BaseDecoderParameters>} decoderParameterFn
 * @property {boolean} preferWorker
 */
/** @type {Map<number | undefined, RegistryEntry>} */
const registry = new Map();
/**
 * Default decoder parameter retrieval function
 * @param {import("../imagefiledirectory.js").ImageFileDirectory} fileDirectory
 * @returns {Promise<BaseDecoderParameters>}
 */
async function defaultDecoderParameterFn(fileDirectory) {
    const isTiled = !fileDirectory.hasTag('StripOffsets');
    return /** @type {BaseDecoderParameters} */ ({
        tileWidth: isTiled
            ? await fileDirectory.loadValue('TileWidth')
            : await fileDirectory.loadValue('ImageWidth'),
        tileHeight: isTiled
            ? await fileDirectory.loadValue('TileLength')
            : (await fileDirectory.loadValue('RowsPerStrip')
                || await fileDirectory.loadValue('ImageLength')),
        planarConfiguration: await fileDirectory.loadValue('PlanarConfiguration'),
        bitsPerSample: await fileDirectory.loadValue('BitsPerSample'),
        predictor: await fileDirectory.loadValue('Predictor') || 1,
    });
}
/**
 * Register a decoder for a specific compression method or a range of compressions
 * @param {(number|undefined|(number|undefined)[])} cases ids of the compression methods to register for
 * @param {function():Promise<typeof BaseDecoder>} importFn the function to import the decoder
 * @param {function(import("../imagefiledirectory.js").ImageFileDirectory):Promise<BaseDecoderParameters>} decoderParameterFn
 * @param {boolean} preferWorker_ Whether to prefer running the decoder in a worker
 */
function addDecoder(cases, importFn, decoderParameterFn = defaultDecoderParameterFn, preferWorker_ = true) {
    if (!Array.isArray(cases)) {
        cases = [cases]; // eslint-disable-line no-param-reassign
    }
    cases.forEach((c) => {
        registry.set(c, { importFn, decoderParameterFn, preferWorker: preferWorker_ });
    });
}
/**
 * Get the required decoder parameters for a specific compression method
 * @param {number|undefined} compression
 * @param {import('../imagefiledirectory.js').ImageFileDirectory} fileDirectory
 */
async function getDecoderParameters(compression, fileDirectory) {
    if (!registry.has(compression)) {
        throw new Error(`Unknown compression method identifier: ${compression}`);
    }
    const { decoderParameterFn } = /** @type {RegistryEntry} */ (registry.get(compression));
    return decoderParameterFn(fileDirectory);
}
/**
 * Get a decoder for a specific compression and parameters
 * @param {number} compression the compression method identifier
 * @param {BaseDecoderParameters} decoderParameters the parameters for the decoder
 * @returns {Promise<import('./basedecoder.js').default>}
 */
async function getDecoder(compression, decoderParameters) {
    if (!registry.has(compression)) {
        throw new Error(`Unknown compression method identifier: ${compression}`);
    }
    const { importFn } = /** @type {RegistryEntry} */ (registry.get(compression));
    const Decoder = await importFn();
    return new Decoder(decoderParameters);
}
const defaultDecoderDefinitions = [
    // No compression
    {
        cases: [undefined, 1],
        importFn: () => import('./raw-leEX69A2.js').then((m) => m.default),
        preferWorker: false,
    },
    // LZW
    {
        cases: 5,
        importFn: () => import('./lzw-BmK1TR1y.js').then((m) => m.default),
    },
    // Old-style JPEG
    {
        cases: 6,
        importFn: () => {
            throw new Error('old style JPEG compression is not supported.');
        },
    },
    // JPEG
    {
        cases: 7,
        importFn: () => import('./jpeg-CO1QTfu_.js').then((m) => m.default),
        /**
         * @param {import("../imagefiledirectory.js").ImageFileDirectory} fileDirectory
         */
        decoderParameterFn: async (fileDirectory) => {
            return {
                ...await defaultDecoderParameterFn(fileDirectory),
                JPEGTables: await fileDirectory.loadValue('JPEGTables'),
            };
        },
    },
    // Deflate / Adobe Deflate
    {
        cases: [8, 32946],
        importFn: () => import('./deflate-DA5aImbY.js').then((m) => m.default),
    },
    // PackBits
    {
        cases: 32773,
        importFn: () => import('./packbits-CiOZQsws.js').then((m) => m.default),
    },
    // LERC
    {
        cases: 34887,
        importFn: () => import('./lerc-Bl-YfzNH.js')
            .then(async (m) => {
            await m.zstd.init();
            return m;
        })
            .then((m) => m.default),
        /**
         * @param {import("../imagefiledirectory.js").ImageFileDirectory} fileDirectory
         */
        decoderParameterFn: async (fileDirectory) => {
            return {
                ...await defaultDecoderParameterFn(fileDirectory),
                LercParameters: await fileDirectory.loadValue('LercParameters'),
            };
        },
    },
    // zstd
    {
        cases: 50000,
        importFn: () => import('./zstd-Csx5Vch4.js')
            .then(async (m) => {
            await m.zstd.init();
            return m;
        })
            .then((m) => m.default),
    },
    // WebP Images
    {
        cases: 50001,
        importFn: () => import('./webimage-CTjNIE7G.js').then((m) => m.default),
        /**
         * @param {import("../imagefiledirectory.js").ImageFileDirectory} fileDirectory
         */
        decoderParameterFn: async (fileDirectory) => {
            return {
                ...await defaultDecoderParameterFn(fileDirectory),
                samplesPerPixel: Number(await fileDirectory.loadValue('SamplesPerPixel')) || 4,
            };
        },
        preferWorker: false,
    },
];
// Add default decoders to registry (end-user may override with other implementations)
for (const decoderDefinition of defaultDecoderDefinitions) {
    const { cases, importFn, decoderParameterFn, preferWorker: preferWorker_ } = decoderDefinition;
    addDecoder(cases, importFn, decoderParameterFn, preferWorker_);
}

/**
 * @module resample
 */
/**
 * @param {import("./geotiff.js").TypedArray} array
 * @param {number} width
 * @param {number} height
 * @param {number} [samplesPerPixel=1]
 */
function copyNewSize(array, width, height, samplesPerPixel = 1) {
    return new (Object.getPrototypeOf(array).constructor)(width * height * samplesPerPixel);
}
/**
 * Resample the input arrays using nearest neighbor value selection.
 * @param {import("./geotiff.js").TypedArray[]} valueArrays The input arrays to resample
 * @param {number} inWidth The width of the input rasters
 * @param {number} inHeight The height of the input rasters
 * @param {number} outWidth The desired width of the output rasters
 * @param {number} outHeight The desired height of the output rasters
 * @returns {import("./geotiff.js").TypedArray[]} The resampled rasters
 */
function resampleNearest(valueArrays, inWidth, inHeight, outWidth, outHeight) {
    const relX = inWidth / outWidth;
    const relY = inHeight / outHeight;
    return valueArrays.map((array) => {
        const newArray = copyNewSize(array, outWidth, outHeight);
        for (let y = 0; y < outHeight; ++y) {
            const cy = Math.min(Math.round(relY * y), inHeight - 1);
            for (let x = 0; x < outWidth; ++x) {
                const cx = Math.min(Math.round(relX * x), inWidth - 1);
                const value = array[(cy * inWidth) + cx];
                newArray[(y * outWidth) + x] = value;
            }
        }
        return newArray;
    });
}
// simple linear interpolation, code from:
// https://en.wikipedia.org/wiki/Linear_interpolation#Programming_language_support
/**
 * @param {number} v0
 * @param {number} v1
 * @param {number} t
 */
function lerp(v0, v1, t) {
    return ((1 - t) * v0) + (t * v1);
}
/**
 * Resample the input arrays using bilinear interpolation.
 * @param {import("./geotiff.js").TypedArray[]} valueArrays The input arrays to resample
 * @param {number} inWidth The width of the input rasters
 * @param {number} inHeight The height of the input rasters
 * @param {number} outWidth The desired width of the output rasters
 * @param {number} outHeight The desired height of the output rasters
 * @returns {import("./geotiff.js").TypedArray[]} The resampled rasters
 */
function resampleBilinear(valueArrays, inWidth, inHeight, outWidth, outHeight) {
    const relX = inWidth / outWidth;
    const relY = inHeight / outHeight;
    return valueArrays.map((array) => {
        const newArray = copyNewSize(array, outWidth, outHeight);
        for (let y = 0; y < outHeight; ++y) {
            const rawY = relY * y;
            const yl = Math.floor(rawY);
            const yh = Math.min(Math.ceil(rawY), (inHeight - 1));
            for (let x = 0; x < outWidth; ++x) {
                const rawX = relX * x;
                const tx = rawX % 1;
                const xl = Math.floor(rawX);
                const xh = Math.min(Math.ceil(rawX), (inWidth - 1));
                const ll = array[(yl * inWidth) + xl];
                const hl = array[(yl * inWidth) + xh];
                const lh = array[(yh * inWidth) + xl];
                const hh = array[(yh * inWidth) + xh];
                const value = lerp(lerp(ll, hl, tx), lerp(lh, hh, tx), rawY % 1);
                newArray[(y * outWidth) + x] = value;
            }
        }
        return newArray;
    });
}
/**
 * Resample the input arrays using the selected resampling method.
 * @param {import("./geotiff.js").TypedArray[]} valueArrays The input arrays to resample
 * @param {number} inWidth The width of the input rasters
 * @param {number} inHeight The height of the input rasters
 * @param {number} outWidth The desired width of the output rasters
 * @param {number} outHeight The desired height of the output rasters
 * @param {string} [method = 'nearest'] The desired resampling method
 * @returns {import("./geotiff.js").TypedArray[]} The resampled rasters
 */
function resample(valueArrays, inWidth, inHeight, outWidth, outHeight, method = 'nearest') {
    switch (method.toLowerCase()) {
        case 'nearest':
            return resampleNearest(valueArrays, inWidth, inHeight, outWidth, outHeight);
        case 'bilinear':
        case 'linear':
            return resampleBilinear(valueArrays, inWidth, inHeight, outWidth, outHeight);
        default:
            throw new Error(`Unsupported resampling method: '${method}'`);
    }
}
/**
 * Resample the pixel interleaved input array using nearest neighbor value selection.
 * @param {import("./geotiff.js").TypedArray} valueArray The input array to resample
 * @param {number} inWidth The width of the input rasters
 * @param {number} inHeight The height of the input rasters
 * @param {number} outWidth The desired width of the output rasters
 * @param {number} outHeight The desired height of the output rasters
 * @param {number} samples The number of samples per pixel for pixel
 *                         interleaved data
 * @returns {import("./geotiff.js").TypedArray} The resampled raster
 */
function resampleNearestInterleaved(valueArray, inWidth, inHeight, outWidth, outHeight, samples) {
    const relX = inWidth / outWidth;
    const relY = inHeight / outHeight;
    const newArray = copyNewSize(valueArray, outWidth, outHeight, samples);
    for (let y = 0; y < outHeight; ++y) {
        const cy = Math.min(Math.round(relY * y), inHeight - 1);
        for (let x = 0; x < outWidth; ++x) {
            const cx = Math.min(Math.round(relX * x), inWidth - 1);
            for (let i = 0; i < samples; ++i) {
                const value = valueArray[(cy * inWidth * samples) + (cx * samples) + i];
                newArray[(y * outWidth * samples) + (x * samples) + i] = value;
            }
        }
    }
    return newArray;
}
/**
 * Resample the pixel interleaved input array using bilinear interpolation.
 * @param {import("./geotiff.js").TypedArray} valueArray The input array to resample
 * @param {number} inWidth The width of the input rasters
 * @param {number} inHeight The height of the input rasters
 * @param {number} outWidth The desired width of the output rasters
 * @param {number} outHeight The desired height of the output rasters
 * @param {number} samples The number of samples per pixel for pixel
 *                         interleaved data
 * @returns {import("./geotiff.js").TypedArray} The resampled raster
 */
function resampleBilinearInterleaved(valueArray, inWidth, inHeight, outWidth, outHeight, samples) {
    const relX = inWidth / outWidth;
    const relY = inHeight / outHeight;
    const newArray = copyNewSize(valueArray, outWidth, outHeight, samples);
    for (let y = 0; y < outHeight; ++y) {
        const rawY = relY * y;
        const yl = Math.floor(rawY);
        const yh = Math.min(Math.ceil(rawY), (inHeight - 1));
        for (let x = 0; x < outWidth; ++x) {
            const rawX = relX * x;
            const tx = rawX % 1;
            const xl = Math.floor(rawX);
            const xh = Math.min(Math.ceil(rawX), (inWidth - 1));
            for (let i = 0; i < samples; ++i) {
                const ll = valueArray[(yl * inWidth * samples) + (xl * samples) + i];
                const hl = valueArray[(yl * inWidth * samples) + (xh * samples) + i];
                const lh = valueArray[(yh * inWidth * samples) + (xl * samples) + i];
                const hh = valueArray[(yh * inWidth * samples) + (xh * samples) + i];
                const value = lerp(lerp(ll, hl, tx), lerp(lh, hh, tx), rawY % 1);
                newArray[(y * outWidth * samples) + (x * samples) + i] = value;
            }
        }
    }
    return newArray;
}
/**
 * Resample the pixel interleaved input array using the selected resampling method.
 * @param {import("./geotiff.js").TypedArray} valueArray The input array to resample
 * @param {number} inWidth The width of the input rasters
 * @param {number} inHeight The height of the input rasters
 * @param {number} outWidth The desired width of the output rasters
 * @param {number} outHeight The desired height of the output rasters
 * @param {number} samples The number of samples per pixel for pixel
 *                                 interleaved data
 * @param {string} [method = 'nearest'] The desired resampling method
 * @returns {import("./geotiff.js").TypedArray} The resampled rasters
 */
function resampleInterleaved(valueArray, inWidth, inHeight, outWidth, outHeight, samples, method = 'nearest') {
    switch (method.toLowerCase()) {
        case 'nearest':
            return resampleNearestInterleaved(valueArray, inWidth, inHeight, outWidth, outHeight, samples);
        case 'bilinear':
        case 'linear':
            return resampleBilinearInterleaved(valueArray, inWidth, inHeight, outWidth, outHeight, samples);
        default:
            throw new Error(`Unsupported resampling method: '${method}'`);
    }
}

/** @module geotiffimage */
/** @import {DecoderWorker, TypedArray} from "./geotiff.js" */
/** @import {ReadRasterResult} from "./geotiff.js" */
/** @import {ReadRastersOptions} from "./geotiff.js" */
/** @import {ReadRGBOptions} from "./geotiff.js" */
/**
 * @param {Array<number>|TypedArray} array
 * @param {number} start
 * @param {number} end
 * @returns {number}
 */
function sum(array, start, end) {
    let s = 0;
    for (let i = start; i < end; ++i) {
        s += array[i];
    }
    return s;
}
/**
 * @param {1|2|3} format
 * @param {number} bitsPerSample
 * @param {number|ArrayBufferLike} sizeOrData
 * @returns {TypedArray}
 */
function arrayForType(format, bitsPerSample, sizeOrData) {
    let TypedArrayConstructor;
    switch (format) {
        case 1: // unsigned integer data
            if (bitsPerSample <= 8) {
                TypedArrayConstructor = Uint8Array;
            }
            else if (bitsPerSample <= 16) {
                TypedArrayConstructor = Uint16Array;
            }
            else if (bitsPerSample <= 32) {
                TypedArrayConstructor = Uint32Array;
            }
            break;
        case 2: // twos complement signed integer data
            if (bitsPerSample === 8) {
                TypedArrayConstructor = Int8Array;
            }
            else if (bitsPerSample === 16) {
                TypedArrayConstructor = Int16Array;
            }
            else if (bitsPerSample === 32) {
                TypedArrayConstructor = Int32Array;
            }
            break;
        case 3: // floating point data
            switch (bitsPerSample) {
                case 16:
                case 32:
                    TypedArrayConstructor = Float32Array;
                    break;
                case 64:
                    TypedArrayConstructor = Float64Array;
                    break;
            }
            break;
    }
    if (TypedArrayConstructor) {
        if (typeof sizeOrData === 'number') {
            return new TypedArrayConstructor(sizeOrData);
        }
        else if (sizeOrData instanceof ArrayBuffer) {
            return new TypedArrayConstructor(sizeOrData);
        }
    }
    throw Error('Unsupported data format/bitsPerSample');
}
/**
 * @param {1|2|3} format
 * @param {number} bitsPerSample
 * @returns {boolean}
 */
function needsNormalization(format, bitsPerSample) {
    if ((format === 1 || format === 2) && bitsPerSample <= 32 && bitsPerSample % 8 === 0) {
        return false;
    }
    else if (format === 3 && (bitsPerSample === 16 || bitsPerSample === 32 || bitsPerSample === 64)) {
        return false;
    }
    return true;
}
/**
 * @param {ArrayBufferLike} inBuffer
 * @param {1|2|3} format
 * @param {1|2} planarConfiguration
 * @param {number} samplesPerPixel
 * @param {number} bitsPerSample
 * @param {number} tileWidth
 * @param {number} tileHeight
 * @returns {ArrayBufferLike}
 */
function normalizeArray(inBuffer, format, planarConfiguration, samplesPerPixel, bitsPerSample, tileWidth, tileHeight) {
    // const inByteArray = new Uint8Array(inBuffer);
    const view = new DataView(inBuffer);
    const outSize = planarConfiguration === 2
        ? tileHeight * tileWidth
        : tileHeight * tileWidth * samplesPerPixel;
    const samplesToTransfer = planarConfiguration === 2
        ? 1 : samplesPerPixel;
    const outArray = arrayForType(format, bitsPerSample, outSize);
    // let pixel = 0;
    const bitMask = parseInt('1'.repeat(bitsPerSample), 2);
    if (format === 1) { // unsigned integer
        // translation of https://github.com/OSGeo/gdal/blob/master/gdal/frmts/gtiff/geotiff.cpp#L7337
        let pixelBitSkip;
        // let sampleBitOffset = 0;
        if (planarConfiguration === 1) {
            pixelBitSkip = samplesPerPixel * bitsPerSample;
            // sampleBitOffset = (samplesPerPixel - 1) * bitsPerSample;
        }
        else {
            pixelBitSkip = bitsPerSample;
        }
        // Bits per line rounds up to next byte boundary.
        let bitsPerLine = tileWidth * pixelBitSkip;
        if ((bitsPerLine & 7) !== 0) {
            bitsPerLine = (bitsPerLine + 7) & (-8);
        }
        for (let y = 0; y < tileHeight; ++y) {
            const lineBitOffset = y * bitsPerLine;
            for (let x = 0; x < tileWidth; ++x) {
                const pixelBitOffset = lineBitOffset + (x * samplesToTransfer * bitsPerSample);
                for (let i = 0; i < samplesToTransfer; ++i) {
                    const bitOffset = pixelBitOffset + (i * bitsPerSample);
                    const outIndex = (((y * tileWidth) + x) * samplesToTransfer) + i;
                    const byteOffset = Math.floor(bitOffset / 8);
                    const innerBitOffset = bitOffset % 8;
                    if (innerBitOffset + bitsPerSample <= 8) {
                        outArray[outIndex] = (view.getUint8(byteOffset) >> (8 - bitsPerSample) - innerBitOffset) & bitMask;
                    }
                    else if (innerBitOffset + bitsPerSample <= 16) {
                        outArray[outIndex] = (view.getUint16(byteOffset) >> (16 - bitsPerSample) - innerBitOffset) & bitMask;
                    }
                    else if (innerBitOffset + bitsPerSample <= 24) {
                        const raw = (view.getUint16(byteOffset) << 8) | (view.getUint8(byteOffset + 2));
                        outArray[outIndex] = (raw >> (24 - bitsPerSample) - innerBitOffset) & bitMask;
                    }
                    else {
                        outArray[outIndex] = (view.getUint32(byteOffset) >> (32 - bitsPerSample) - innerBitOffset) & bitMask;
                    }
                    // let outWord = 0;
                    // for (let bit = 0; bit < bitsPerSample; ++bit) {
                    //   if (inByteArray[bitOffset >> 3]
                    //     & (0x80 >> (bitOffset & 7))) {
                    //     outWord |= (1 << (bitsPerSample - 1 - bit));
                    //   }
                    //   ++bitOffset;
                    // }
                    // outArray[outIndex] = outWord;
                    // outArray[pixel] = outWord;
                    // pixel += 1;
                }
                // bitOffset = bitOffset + pixelBitSkip - bitsPerSample;
            }
        }
    }
    return outArray.buffer;
}
/**
 * GeoTIFF sub-file image.
 */
class GeoTIFFImage {
    /**
     * @constructor
     * @param {import("./imagefiledirectory.js").ImageFileDirectory} fileDirectory The parsed file directory
     * @param {Boolean} littleEndian Whether the file is encoded in little or big endian
     * @param {Boolean} cache Whether or not decoded tiles shall be cached
     * @param {import('./source/basesource.js').BaseSource} source The datasource to read from
     */
    constructor(fileDirectory, littleEndian, cache, source) {
        this.fileDirectory = fileDirectory;
        this.littleEndian = littleEndian;
        /** @type {Array<Promise<ArrayBufferLike>>|null} */
        this.tiles = cache ? [] : null;
        this.isTiled = !fileDirectory.hasTag('StripOffsets');
        const planarConfiguration = fileDirectory.getValue('PlanarConfiguration') ?? 1;
        if (planarConfiguration !== 1 && planarConfiguration !== 2) {
            throw new Error('Invalid planar configuration.');
        }
        /** @type {1 | 2} */
        this.planarConfiguration = planarConfiguration;
        this.source = source;
    }
    /**
     * Returns the associated parsed file directory.
     * @returns {import("./imagefiledirectory.js").ImageFileDirectory} the parsed file directory
     */
    getFileDirectory() {
        return this.fileDirectory;
    }
    /**
     * Returns the associated parsed geo keys.
     * @returns {Partial<Record<import('./globals.js').GeoKeyName, *>>|null} the parsed geo keys
     */
    getGeoKeys() {
        return this.fileDirectory.parseGeoKeyDirectory();
    }
    /**
     * Returns the width of the image.
     * @returns {Number} the width of the image
     */
    getWidth() {
        return this.fileDirectory.getValue('ImageWidth') || 0;
    }
    /**
     * Returns the height of the image.
     * @returns {Number} the height of the image
     */
    getHeight() {
        return this.fileDirectory.getValue('ImageLength') || 0;
    }
    /**
     * Returns the number of samples per pixel.
     * @returns {number} the number of samples per pixel
     */
    getSamplesPerPixel() {
        return this.fileDirectory.getValue('SamplesPerPixel') ?? 1;
    }
    /**
     * Returns the width of each tile.
     * @returns {number} the width of each tile
     */
    getTileWidth() {
        return this.isTiled ? (this.fileDirectory.getValue('TileWidth') || 0) : this.getWidth();
    }
    /**
     * Returns the height of each tile.
     * @returns {number} the height of each tile
     */
    getTileHeight() {
        if (this.isTiled) {
            return this.fileDirectory.getValue('TileLength') || 0;
        }
        const rowsPerStrip = this.fileDirectory.hasTag('RowsPerStrip') && this.fileDirectory.getValue('RowsPerStrip');
        if (rowsPerStrip) {
            return Math.min(rowsPerStrip, this.getHeight());
        }
        return this.getHeight();
    }
    getBlockWidth() {
        return this.getTileWidth();
    }
    /**
     * @param {number} y
     * @returns {number}
     */
    getBlockHeight(y) {
        if (this.isTiled || (y + 1) * this.getTileHeight() <= this.getHeight()) {
            return this.getTileHeight();
        }
        else {
            return this.getHeight() - (y * this.getTileHeight());
        }
    }
    /**
     * Calculates the number of bytes for each pixel across all samples. Only full
     * bytes are supported, an exception is thrown when this is not the case.
     * @returns {Number} the bytes per pixel
     */
    getBytesPerPixel() {
        let bytes = 0;
        // this is a short list, so we assume this is already loaded
        const bitsPerSample = this.fileDirectory.getValue('BitsPerSample') || [];
        for (let i = 0; i < bitsPerSample.length; ++i) {
            bytes += this.getSampleByteSize(i);
        }
        return bytes;
    }
    /**
     * @param {number} i
     * @returns {number}
     */
    getSampleByteSize(i) {
        const bitsPerSample = this.fileDirectory.getValue('BitsPerSample') || [];
        if (i >= bitsPerSample.length) {
            throw new RangeError(`Sample index ${i} is out of range.`);
        }
        return Math.ceil(bitsPerSample[i] / 8);
    }
    /**
     * @param {number} sampleIndex
     * @returns {(this: DataView, byteOffset: number, littleEndian: boolean) => number}
     */
    getReaderForSample(sampleIndex) {
        const sampleFormat = this.fileDirectory.getValue('SampleFormat');
        const format = sampleFormat
            ? sampleFormat[sampleIndex] : 1;
        const bitsPerSample = (this.fileDirectory.getValue('BitsPerSample') || [])[sampleIndex];
        switch (format) {
            case 1: // unsigned integer data
                if (bitsPerSample <= 8) {
                    return DataView.prototype.getUint8;
                }
                else if (bitsPerSample <= 16) {
                    return DataView.prototype.getUint16;
                }
                else if (bitsPerSample <= 32) {
                    return DataView.prototype.getUint32;
                }
                break;
            case 2: // twos complement signed integer data
                if (bitsPerSample <= 8) {
                    return DataView.prototype.getInt8;
                }
                else if (bitsPerSample <= 16) {
                    return DataView.prototype.getInt16;
                }
                else if (bitsPerSample <= 32) {
                    return DataView.prototype.getInt32;
                }
                break;
            case 3:
                switch (bitsPerSample) {
                    case 16:
                        return function (offset, littleEndian) {
                            return getFloat16(this, offset, littleEndian);
                        };
                    case 32:
                        return DataView.prototype.getFloat32;
                    case 64:
                        return DataView.prototype.getFloat64;
                }
                break;
        }
        throw Error('Unsupported data format/bitsPerSample');
    }
    getSampleFormat(sampleIndex = 0) {
        const sampleFormat = this.fileDirectory.getValue('SampleFormat');
        return sampleFormat ? sampleFormat[sampleIndex] : 1;
    }
    getBitsPerSample(sampleIndex = 0) {
        const bitsPerSample = this.fileDirectory.getValue('BitsPerSample');
        return bitsPerSample ? bitsPerSample[sampleIndex] : 0;
    }
    /**
     * @param {number} sampleIndex
     * @param {number|ArrayBufferLike} sizeOrData
     * @returns {TypedArray}
     */
    getArrayForSample(sampleIndex, sizeOrData) {
        const format = /** @type {1|2|3} */ (this.getSampleFormat(sampleIndex));
        const bitsPerSample = this.getBitsPerSample(sampleIndex);
        return arrayForType(format, bitsPerSample, sizeOrData);
    }
    /**
     * Returns the decoded strip or tile.
     * @param {Number} x the strip or tile x-offset
     * @param {Number} y the tile y-offset (0 for stripped images)
     * @param {Number} sample the sample to get for separated samples
     * @param {DecoderWorker|import("./geotiff.js").BaseDecoder} poolOrDecoder the decoder or decoder pool
     * @param {AbortSignal} [signal] An AbortSignal that may be signalled if the request is
     *                               to be aborted
     * @returns {Promise.<{x: number, y: number, sample: number, data: ArrayBufferLike}>} the decoded strip or tile
     */
    async getTileOrStrip(x, y, sample, poolOrDecoder, signal) {
        const numTilesPerRow = Math.ceil(this.getWidth() / this.getTileWidth());
        const numTilesPerCol = Math.ceil(this.getHeight() / this.getTileHeight());
        let index;
        const { tiles } = this;
        if (this.planarConfiguration === 1) {
            index = (y * numTilesPerRow) + x;
        }
        else if (this.planarConfiguration === 2) {
            index = (sample * numTilesPerRow * numTilesPerCol) + (y * numTilesPerRow) + x;
        }
        if (index === undefined) {
            throw new Error('Could not determine tile or strip index.');
        }
        let offset;
        let byteCount;
        if (this.isTiled) {
            offset = Number(await this.fileDirectory.loadValueIndexed('TileOffsets', index));
            byteCount = Number(await this.fileDirectory.loadValueIndexed('TileByteCounts', index));
        }
        else {
            offset = Number(await this.fileDirectory.loadValueIndexed('StripOffsets', index));
            byteCount = Number(await this.fileDirectory.loadValueIndexed('StripByteCounts', index));
        }
        if (byteCount === 0) {
            const nPixels = this.getBlockHeight(y) * this.getTileWidth();
            const bytesPerPixel = (this.planarConfiguration === 2) ? this.getSampleByteSize(sample) : this.getBytesPerPixel();
            const data = new ArrayBuffer(nPixels * bytesPerPixel);
            const view = this.getArrayForSample(sample, data);
            view.fill(this.getGDALNoData() || 0);
            return { x, y, sample, data };
        }
        const slice = (await this.source.fetch([{ offset, length: byteCount }], signal))[0];
        let request;
        if (tiles === null || !tiles[index]) {
            // resolve each request by potentially applying array normalization
            request = (async () => {
                let data = await poolOrDecoder.decode(slice);
                const sampleFormat = /** @type {1|2|3} */ (this.getSampleFormat());
                const bitsPerSample = this.getBitsPerSample();
                if (needsNormalization(sampleFormat, bitsPerSample)) {
                    data = normalizeArray(data, sampleFormat, this.planarConfiguration, this.getSamplesPerPixel(), bitsPerSample, this.getTileWidth(), this.getBlockHeight(y));
                }
                return data;
            })();
            // set the cache
            if (tiles !== null) {
                tiles[index] = request;
            }
        }
        else {
            // get from the cache
            request = tiles[index];
        }
        // cache the tile request
        return { x, y, sample, data: await request };
    }
    /**
     * Internal read function.
     * @private
     * @param {Array<number>} imageWindow The image window in pixel coordinates
     * @param {Array<number>} samples The selected samples (0-based indices)
     * @param {TypedArray|TypedArray[]} valueArrays The array(s) to write into
     * @param {boolean|undefined} interleave Whether or not to write in an interleaved manner
     * @param {DecoderWorker|import("./geotiff.js").BaseDecoder} poolOrDecoder the decoder or decoder pool
     * @param {number} [width] the width of window to be read into
     * @param {number} [height] the height of window to be read into
     * @param {string} [resampleMethod] the resampling method to be used when interpolating
     * @param {AbortSignal} [signal] An AbortSignal that may be signalled if the request is
     *                               to be aborted
     * @returns {Promise<ReadRasterResult>}
     */
    async _readRaster(imageWindow, samples, valueArrays, interleave, poolOrDecoder, width, height, resampleMethod, signal) {
        const tileWidth = this.getTileWidth();
        const tileHeight = this.getTileHeight();
        const imageWidth = this.getWidth();
        const imageHeight = this.getHeight();
        const minXTile = Math.max(Math.floor(imageWindow[0] / tileWidth), 0);
        const maxXTile = Math.min(Math.ceil(imageWindow[2] / tileWidth), Math.ceil(imageWidth / tileWidth));
        const minYTile = Math.max(Math.floor(imageWindow[1] / tileHeight), 0);
        const maxYTile = Math.min(Math.ceil(imageWindow[3] / tileHeight), Math.ceil(imageHeight / tileHeight));
        const windowWidth = imageWindow[2] - imageWindow[0];
        let bytesPerPixel = this.getBytesPerPixel();
        /** @type {Array<number>} */
        const srcSampleOffsets = [];
        /** @type {Array<(this: DataView, byteOffset: number, littleEndian: boolean) => number>} */
        const sampleReaders = [];
        for (let i = 0; i < samples.length; ++i) {
            if (this.planarConfiguration === 1) {
                const bitsPerSample = await this.fileDirectory.loadValue('BitsPerSample');
                if (typeof bitsPerSample !== 'object') {
                    throw new Error('Expected BitsPerSample to be an array or typed array.');
                }
                srcSampleOffsets.push(sum(bitsPerSample, 0, samples[i]) / 8);
            }
            else {
                srcSampleOffsets.push(0);
            }
            sampleReaders.push(this.getReaderForSample(samples[i]));
        }
        const promises = [];
        const { littleEndian } = this;
        for (let yTile = minYTile; yTile < maxYTile; ++yTile) {
            for (let xTile = minXTile; xTile < maxXTile; ++xTile) {
                let getPromise;
                if (this.planarConfiguration === 1) {
                    getPromise = this.getTileOrStrip(xTile, yTile, 0, poolOrDecoder, signal);
                }
                for (let sampleIndex = 0; sampleIndex < samples.length; ++sampleIndex) {
                    const si = sampleIndex;
                    const sample = samples[sampleIndex];
                    if (this.planarConfiguration === 2) {
                        bytesPerPixel = this.getSampleByteSize(sample);
                        getPromise = this.getTileOrStrip(xTile, yTile, sample, poolOrDecoder, signal);
                    }
                    if (!getPromise) {
                        throw new Error('Could not get tile or strip data.');
                    }
                    const promise = getPromise.then((tile) => {
                        const buffer = tile.data;
                        const dataView = new DataView(buffer);
                        const blockHeight = this.getBlockHeight(tile.y);
                        const firstLine = tile.y * tileHeight;
                        const firstCol = tile.x * tileWidth;
                        const lastLine = firstLine + blockHeight;
                        const lastCol = (tile.x + 1) * tileWidth;
                        const reader = sampleReaders[si];
                        const ymax = Math.min(blockHeight, blockHeight - (lastLine - imageWindow[3]), imageHeight - firstLine);
                        const xmax = Math.min(tileWidth, tileWidth - (lastCol - imageWindow[2]), imageWidth - firstCol);
                        for (let y = Math.max(0, imageWindow[1] - firstLine); y < ymax; ++y) {
                            for (let x = Math.max(0, imageWindow[0] - firstCol); x < xmax; ++x) {
                                const pixelOffset = ((y * tileWidth) + x) * bytesPerPixel;
                                const value = reader.call(dataView, pixelOffset + srcSampleOffsets[si], littleEndian);
                                let windowCoordinate;
                                if (interleave) {
                                    windowCoordinate = ((y + firstLine - imageWindow[1]) * windowWidth * samples.length)
                                        + ((x + firstCol - imageWindow[0]) * samples.length)
                                        + si;
                                    valueArrays[windowCoordinate] = value;
                                }
                                else {
                                    windowCoordinate = ((y + firstLine - imageWindow[1]) * windowWidth) + x + firstCol - imageWindow[0];
                                    /** @type {TypedArray} */ (valueArrays[si])[windowCoordinate] = value;
                                }
                            }
                        }
                    });
                    promises.push(promise);
                }
            }
        }
        await Promise.all(promises);
        if ((width && (imageWindow[2] - imageWindow[0]) !== width)
            || (height && (imageWindow[3] - imageWindow[1]) !== height)) {
            let resampled;
            if (interleave) {
                resampled = resampleInterleaved(
                /** @type {TypedArray} */ (valueArrays), imageWindow[2] - imageWindow[0], imageWindow[3] - imageWindow[1], 
                /** @type {number} */ (width), /** @type {number} */ (height), samples.length, resampleMethod);
            }
            else {
                resampled = resample(
                /** @type {TypedArray[]} */ (valueArrays), imageWindow[2] - imageWindow[0], imageWindow[3] - imageWindow[1], 
                /** @type {number} */ (width), /** @type {number} */ (height), resampleMethod);
            }
            const resampledWithDimensions = /** @type {ReadRasterResult} */ (resampled);
            resampledWithDimensions.width = width ?? imageWindow[2] - imageWindow[0];
            resampledWithDimensions.height = height ?? imageWindow[3] - imageWindow[1];
            return resampledWithDimensions;
        }
        const valueArraysWithDimensions = /** @type {ReadRasterResult} */ (valueArrays);
        valueArraysWithDimensions.width = width || imageWindow[2] - imageWindow[0];
        valueArraysWithDimensions.height = height || imageWindow[3] - imageWindow[1];
        return valueArraysWithDimensions;
    }
    /**
     * @overload
     * @param {ReadRastersOptions & {interleave: true}} options optional parameters
     * @returns {Promise<import("./geotiff.js").TypedArrayWithDimensions>} the decoded arrays as a promise
     */
    /**
     * @overload
     * @param {ReadRastersOptions & {interleave: false}} options optional parameters
     * @returns {Promise<import("./geotiff.js").TypedArrayArrayWithDimensions>} the decoded arrays as a promise
     */
    /**
     * @overload
     * @param {ReadRastersOptions & {interleave: boolean}} options optional parameters
     * @returns {Promise<ReadRasterResult>} the decoded arrays as a promise
     */
    /**
     * @overload
     * @param {ReadRastersOptions} [options={}] optional parameters
     * @returns {Promise<import("./geotiff.js").TypedArrayArrayWithDimensions>} the decoded arrays as a promise
     */
    /**
     * Reads raster data from the image. This function reads all selected samples
     * into separate arrays of the correct type for that sample or into a single
     * combined array when `interleave` is set. When provided, only a subset
     * of the raster is read for each sample.
     *
     * @param {ReadRastersOptions} [options={}] optional parameters
     * @returns {Promise<ReadRasterResult>} the decoded arrays as a promise
     */
    async readRasters(options = {}) {
        const { window: wnd, samples = [], pool = null, width, height, resampleMethod, fillValue, signal, } = options;
        const interleave = 'interleave' in options && options.interleave;
        const imageWindow = wnd || [0, 0, this.getWidth(), this.getHeight()];
        // check parameters
        if (imageWindow[0] > imageWindow[2] || imageWindow[1] > imageWindow[3]) {
            throw new Error('Invalid subsets');
        }
        const imageWindowWidth = imageWindow[2] - imageWindow[0];
        const imageWindowHeight = imageWindow[3] - imageWindow[1];
        const numPixels = imageWindowWidth * imageWindowHeight;
        const samplesPerPixel = this.getSamplesPerPixel();
        if (!samples || !samples.length) {
            for (let i = 0; i < samplesPerPixel; ++i) {
                samples.push(i);
            }
        }
        else {
            for (let i = 0; i < samples.length; ++i) {
                if (samples[i] >= samplesPerPixel) {
                    return Promise.reject(new RangeError(`Invalid sample index '${samples[i]}'.`));
                }
            }
        }
        /** @type {TypedArray|TypedArray[]} */
        let valueArrays;
        if (interleave) {
            const { fileDirectory } = this;
            const sampleFormat = fileDirectory.getValue('SampleFormat');
            const format = sampleFormat
                ? Math.max.apply(null, Array.from(sampleFormat)) : 1;
            if (format !== 1 && format !== 2 && format !== 3) {
                throw new Error('Unsupported sample format for interleaved data. Must be 1, 2, or 3.');
            }
            const bitsPerSample_ = fileDirectory.getValue('BitsPerSample');
            const bitsPerSample = bitsPerSample_
                ? Math.max.apply(null, Array.from(bitsPerSample_)) : 8;
            valueArrays = arrayForType(format, bitsPerSample, numPixels * samples.length);
            if (fillValue) {
                if (Array.isArray(fillValue)) {
                    throw new Error('When reading interleaved data, fillValue must be a single number.');
                }
                valueArrays.fill(fillValue);
            }
        }
        else {
            valueArrays = [];
            for (let i = 0; i < samples.length; ++i) {
                const valueArray = this.getArrayForSample(samples[i], numPixels);
                if (Array.isArray(fillValue) && i < fillValue.length) {
                    valueArray.fill(fillValue[i]);
                }
                else if (fillValue && !Array.isArray(fillValue)) {
                    valueArray.fill(fillValue);
                }
                valueArrays.push(valueArray);
            }
        }
        const compression = this.fileDirectory.getValue('Compression') || 1;
        const decoderParameters = await getDecoderParameters(compression, this.fileDirectory);
        const poolOrDecoder = pool
            ? pool.bindParameters(compression, decoderParameters)
            : await getDecoder(compression, decoderParameters);
        const result = await this._readRaster(imageWindow, samples, valueArrays, interleave, poolOrDecoder, width, height, resampleMethod, signal);
        return result;
    }
    /**
     * @overload
     * @param {ReadRGBOptions & {interleave: true}} options optional parameters
     * @returns {Promise<import("./geotiff.js").TypedArrayWithDimensions>} the RGB array as a Promise
     */
    /**
     * @overload
     * @param {ReadRGBOptions & {interleave: false}} options optional parameters
     * @returns {Promise<import("./geotiff.js").TypedArrayArrayWithDimensions>} the RGB array as a Promise
     */
    /**
     * @overload
     * @param {ReadRGBOptions & {interleave: boolean}} options optional parameters
     * @returns {Promise<ReadRasterResult>} the RGB array as a Promise
     */
    /**
     * @overload
     * @param {ReadRGBOptions} [options={}] optional parameters
     * @returns {Promise<import("./geotiff.js").TypedArrayArrayWithDimensions>} the RGB array as a Promise
     */
    /**
     * Reads raster data from the image as RGB.
     * Colorspaces other than RGB will be transformed to RGB, color maps expanded.
     * When no other method is applicable, the first sample is used to produce a
     * grayscale image.
     * When provided, only a subset of the raster is read for each sample.
     *
     * @param {ReadRGBOptions} [options] optional parameters
     * @returns {Promise<ReadRasterResult>} the RGB array as a Promise
     */
    async readRGB(options = {}) {
        const { window, pool = null, width, height, resampleMethod, enableAlpha = false, signal } = options;
        const interleave = ('interleave' in options && options.interleave) ?? false;
        const imageWindow = window || [0, 0, this.getWidth(), this.getHeight()];
        // check parameters
        if (imageWindow[0] > imageWindow[2] || imageWindow[1] > imageWindow[3]) {
            throw new Error('Invalid subsets');
        }
        const pi = this.fileDirectory.getValue('PhotometricInterpretation');
        if (pi === photometricInterpretations.RGB) {
            let s = [0, 1, 2];
            const extraSamples = this.fileDirectory.getValue('ExtraSamples');
            if (extraSamples && extraSamples[0] !== ExtraSamplesValues.Unspecified && enableAlpha) {
                s = [];
                const bitsPerSample = this.fileDirectory.getValue('BitsPerSample') || [];
                for (let i = 0; i < bitsPerSample.length; i += 1) {
                    s.push(i);
                }
            }
            return this.readRasters({
                window,
                interleave,
                samples: s,
                pool,
                width,
                height,
                resampleMethod,
                signal,
            });
        }
        let samples;
        switch (pi) {
            case photometricInterpretations.WhiteIsZero:
            case photometricInterpretations.BlackIsZero:
            case photometricInterpretations.Palette:
                samples = [0];
                break;
            case photometricInterpretations.CMYK:
                samples = [0, 1, 2, 3];
                break;
            case photometricInterpretations.YCbCr:
            case photometricInterpretations.CIELab:
                samples = [0, 1, 2];
                break;
            default:
                throw new Error('Invalid or unsupported photometric interpretation.');
        }
        const subOptions = {
            window: imageWindow,
            /** @type {true} */
            interleave: true,
            samples,
            pool,
            width,
            height,
            resampleMethod,
            signal,
        };
        const { fileDirectory } = this;
        const raster = await this.readRasters(subOptions);
        const max = 2 ** this.getBitsPerSample(0);
        let data;
        switch (pi) {
            case photometricInterpretations.WhiteIsZero:
                data = fromWhiteIsZero(raster, max);
                break;
            case photometricInterpretations.BlackIsZero:
                data = fromBlackIsZero(raster, max);
                break;
            case photometricInterpretations.Palette:
                data = fromPalette(raster, /** @type {Uint16Array} */ (await fileDirectory.loadValue('ColorMap')));
                break;
            case photometricInterpretations.CMYK:
                data = fromCMYK(raster);
                break;
            case photometricInterpretations.YCbCr:
                data = fromYCbCr(raster);
                break;
            case photometricInterpretations.CIELab:
                data = fromCIELab(raster);
                break;
            default:
                throw new Error('Unsupported photometric interpretation.');
        }
        // if non-interleaved data is requested, we must split the channels
        // into their respective arrays
        if (!interleave) {
            const red = new Uint8Array(data.length / 3);
            const green = new Uint8Array(data.length / 3);
            const blue = new Uint8Array(data.length / 3);
            for (let i = 0, j = 0; i < data.length; i += 3, ++j) {
                red[j] = data[i];
                green[j] = data[i + 1];
                blue[j] = data[i + 2];
            }
            data = [red, green, blue];
        }
        const dataWithDimensions = /** @type {import("./geotiff.js").ReadRasterResult} */ (data);
        dataWithDimensions.width = raster.width;
        dataWithDimensions.height = raster.height;
        return dataWithDimensions;
    }
    /**
     * Returns an array of tiepoints.
     * @returns {Promise<Array<{i: number, j: number, k: number, x: number, y: number, z: number}>>} the tiepoints
     */
    async getTiePoints() {
        if (!this.fileDirectory.hasTag('ModelTiepoint')) {
            return [];
        }
        const modelTiePoint = await this.fileDirectory.loadValue('ModelTiepoint');
        if (typeof modelTiePoint !== 'object') {
            throw new Error('Expected ModelTiepoint to be an array or typed array.');
        }
        const tiePoints = [];
        for (let i = 0; i < modelTiePoint.length; i += 6) {
            tiePoints.push({
                i: modelTiePoint[i],
                j: modelTiePoint[i + 1],
                k: modelTiePoint[i + 2],
                x: modelTiePoint[i + 3],
                y: modelTiePoint[i + 4],
                z: modelTiePoint[i + 5],
            });
        }
        return tiePoints;
    }
    /**
     * Returns the parsed GDAL metadata items.
     *
     * If sample is passed to null, dataset-level metadata will be returned.
     * Otherwise only metadata specific to the provided sample will be returned.
     *
     * @param {number|null} [sample=null] The sample index.
     * @returns {Promise<Record<string, unknown>|null>} The GDAL metadata items
     */
    async getGDALMetadata(sample = null) {
        /** @type {Record<string, unknown>} */
        const metadata = {};
        if (!this.fileDirectory.hasTag('GDAL_METADATA')) {
            return null;
        }
        const string = await this.fileDirectory.loadValue('GDAL_METADATA');
        /** @type {Array<{inner: unknown}>} */
        let items = findTagsByName(string, 'Item');
        if (sample === null) {
            items = items.filter((item) => getAttribute(item, 'sample') === undefined);
        }
        else {
            items = items.filter((item) => Number(getAttribute(item, 'sample')) === sample);
        }
        for (let i = 0; i < items.length; ++i) {
            const item = items[i];
            metadata[getAttribute(item, 'name')] = item.inner;
        }
        return metadata;
    }
    /**
     * Returns the GDAL nodata value
     * @returns {number|null}
     */
    getGDALNoData() {
        const string = this.fileDirectory.hasTag('GDAL_NODATA') && this.fileDirectory.getValue('GDAL_NODATA');
        if (!string) {
            return null;
        }
        return Number(string.substring(0, string.length - 1));
    }
    /**
     * Returns the image origin as a XYZ-vector. When the image has no affine
     * transformation, then an exception is thrown.
     * @returns {Array<number>} The origin as a vector
     */
    getOrigin() {
        const tiePoints = this.fileDirectory.getValue('ModelTiepoint');
        const modelTransformation = this.fileDirectory.getValue('ModelTransformation');
        if (tiePoints && tiePoints.length === 6) {
            return [
                tiePoints[3],
                tiePoints[4],
                tiePoints[5],
            ];
        }
        if (modelTransformation) {
            return [
                modelTransformation[3],
                modelTransformation[7],
                modelTransformation[11],
            ];
        }
        throw new Error('The image does not have an affine transformation.');
    }
    /**
     * Returns the image resolution as a XYZ-vector. When the image has no affine
     * transformation, then an exception is thrown.
     * @param {GeoTIFFImage|null} [referenceImage=null] A reference image to calculate the resolution from
     *                                             in cases when the current image does not have the
     *                                             required tags on its own.
     * @returns {Array<number>} The resolution as a vector
     */
    getResolution(referenceImage = null) {
        const modelPixelScale = this.fileDirectory.getValue('ModelPixelScale');
        const modelTransformation = this.fileDirectory.getValue('ModelTransformation');
        if (modelPixelScale) {
            return [
                modelPixelScale[0],
                -modelPixelScale[1],
                modelPixelScale[2],
            ];
        }
        if (modelTransformation) {
            if (modelTransformation[1] === 0 && modelTransformation[4] === 0) {
                return [
                    modelTransformation[0],
                    -modelTransformation[5],
                    modelTransformation[10],
                ];
            }
            return [
                Math.sqrt((modelTransformation[0] * modelTransformation[0])
                    + (modelTransformation[4] * modelTransformation[4])),
                -Math.sqrt((modelTransformation[1] * modelTransformation[1])
                    + (modelTransformation[5] * modelTransformation[5])),
                modelTransformation[10]
            ];
        }
        if (referenceImage) {
            const [refResX, refResY, refResZ] = referenceImage.getResolution();
            return [
                refResX * referenceImage.getWidth() / this.getWidth(),
                refResY * referenceImage.getHeight() / this.getHeight(),
                refResZ * referenceImage.getWidth() / this.getWidth(),
            ];
        }
        throw new Error('The image does not have an affine transformation.');
    }
    /**
     * Returns whether or not the pixels of the image depict an area (or point).
     * @returns {Boolean} Whether the pixels are a point
     */
    pixelIsArea() {
        return this.getGeoKeys()?.GTRasterTypeGeoKey === 1;
    }
    /**
     * Returns the image bounding box as an array of 4 values: min-x, min-y,
     * max-x and max-y. When the image has no affine transformation, then an
     * exception is thrown.
     * @param {boolean} [tilegrid=false] If true return extent for a tilegrid
     *                                   without adjustment for ModelTransformation.
     * @returns {Array<number>} The bounding box
     */
    getBoundingBox(tilegrid = false) {
        const height = this.getHeight();
        const width = this.getWidth();
        const modelTransformation = this.fileDirectory.getValue('ModelTransformation');
        if (modelTransformation && !tilegrid) {
            const [a, b, , d, e, f, , h] = modelTransformation;
            const corners = [
                [0, 0],
                [0, height],
                [width, 0],
                [width, height],
            ];
            const projected = corners.map(([I, J]) => [
                d + (a * I) + (b * J),
                h + (e * I) + (f * J),
            ]);
            const xs = projected.map((pt) => pt[0]);
            const ys = projected.map((pt) => pt[1]);
            return [
                Math.min(...xs),
                Math.min(...ys),
                Math.max(...xs),
                Math.max(...ys),
            ];
        }
        else {
            const origin = this.getOrigin();
            const resolution = this.getResolution();
            const x1 = origin[0];
            const y1 = origin[1];
            const x2 = x1 + (resolution[0] * width);
            const y2 = y1 + (resolution[1] * height);
            return [
                Math.min(x1, x2),
                Math.min(y1, y2),
                Math.max(x1, x2),
                Math.max(y1, y2),
            ];
        }
    }
}

class DataView64 {
    /**
     * @param {ArrayBufferLike} arrayBuffer
     */
    constructor(arrayBuffer) {
        this._dataView = new DataView(arrayBuffer);
    }
    get buffer() {
        return this._dataView.buffer;
    }
    /**
     * @param {number} offset
     * @param {boolean} littleEndian
     * @returns {number}
     */
    getUint64(offset, littleEndian) {
        const left = this.getUint32(offset, littleEndian);
        const right = this.getUint32(offset + 4, littleEndian);
        let combined;
        if (littleEndian) {
            combined = left + ((2 ** 32) * right);
            if (!Number.isSafeInteger(combined)) {
                throw new Error(`${combined} exceeds MAX_SAFE_INTEGER. `
                    + 'Precision may be lost. Please report if you get this message to https://github.com/geotiffjs/geotiff.js/issues');
            }
            return combined;
        }
        combined = ((2 ** 32) * left) + right;
        if (!Number.isSafeInteger(combined)) {
            throw new Error(`${combined} exceeds MAX_SAFE_INTEGER. `
                + 'Precision may be lost. Please report if you get this message to https://github.com/geotiffjs/geotiff.js/issues');
        }
        return combined;
    }
    /**
     * Adapted from https://stackoverflow.com/a/55338384/8060591
     * @param {number} offset
     * @param {boolean} littleEndian
     * @returns {number}
     */
    getInt64(offset, littleEndian) {
        let value = 0;
        const isNegative = (this._dataView.getUint8(offset + (littleEndian ? 7 : 0)) & 0x80) > 0;
        let carrying = true;
        for (let i = 0; i < 8; i++) {
            let byte = this._dataView.getUint8(offset + (littleEndian ? i : 7 - i));
            if (isNegative) {
                if (carrying) {
                    if (byte !== 0x00) {
                        byte = ~(byte - 1) & 0xff;
                        carrying = false;
                    }
                }
                else {
                    byte = ~byte & 0xff;
                }
            }
            value += byte * (256 ** i);
        }
        if (isNegative) {
            value = -value;
        }
        return value;
    }
    /**
     * @param {number} offset
     * @returns {number}
     */
    getUint8(offset) {
        return this._dataView.getUint8(offset);
    }
    /**
     * @param {number} offset
     * @returns {number}
     */
    getInt8(offset) {
        return this._dataView.getInt8(offset);
    }
    /**
     * @param {number} offset
     * @param {boolean} littleEndian
     * @returns {number}
     */
    getUint16(offset, littleEndian) {
        return this._dataView.getUint16(offset, littleEndian);
    }
    /**
     * @param {number} offset
     * @param {boolean} littleEndian
     * @returns {number}
     */
    getInt16(offset, littleEndian) {
        return this._dataView.getInt16(offset, littleEndian);
    }
    /**
     * @param {number} offset
     * @param {boolean} littleEndian
     * @returns {number}
     */
    getUint32(offset, littleEndian) {
        return this._dataView.getUint32(offset, littleEndian);
    }
    /**
     * @param {number} offset
     * @param {boolean} littleEndian
     * @returns {number}
     */
    getInt32(offset, littleEndian) {
        return this._dataView.getInt32(offset, littleEndian);
    }
    /**
     * @param {number} offset
     * @param {boolean} littleEndian
     * @returns {number}
     */
    getFloat16(offset, littleEndian) {
        return getFloat16(this._dataView, offset, littleEndian);
    }
    /**
     * @param {number} offset
     * @param {boolean} littleEndian
     * @returns {number}
     */
    getFloat32(offset, littleEndian) {
        return this._dataView.getFloat32(offset, littleEndian);
    }
    /**
     * @param {number} offset
     * @param {boolean} littleEndian
     * @returns {number}
     */
    getFloat64(offset, littleEndian) {
        return this._dataView.getFloat64(offset, littleEndian);
    }
}

class DataSlice {
    /**
     * @param {ArrayBufferLike} arrayBuffer
     * @param {number} sliceOffset
     * @param {boolean} littleEndian
     * @param {boolean} bigTiff
     */
    constructor(arrayBuffer, sliceOffset, littleEndian, bigTiff) {
        this._dataView = new DataView(arrayBuffer);
        this._sliceOffset = sliceOffset;
        this._littleEndian = littleEndian;
        this._bigTiff = bigTiff;
    }
    get sliceOffset() {
        return this._sliceOffset;
    }
    get sliceTop() {
        return this._sliceOffset + this.buffer.byteLength;
    }
    get littleEndian() {
        return this._littleEndian;
    }
    get bigTiff() {
        return this._bigTiff;
    }
    get buffer() {
        return this._dataView.buffer;
    }
    /**
     * @param {number} offset
     * @param {number} length
     * @returns {boolean}
     */
    covers(offset, length) {
        return this.sliceOffset <= offset && this.sliceTop >= offset + length;
    }
    /**
     * @param {number} offset
     * @returns {number}
     */
    readUint8(offset) {
        return this._dataView.getUint8(offset - this._sliceOffset);
    }
    /**
     * @param {number} offset
     * @returns {number}
     */
    readInt8(offset) {
        return this._dataView.getInt8(offset - this._sliceOffset);
    }
    /**
     * @param {number} offset
     * @returns {number}
     */
    readUint16(offset) {
        return this._dataView.getUint16(offset - this._sliceOffset, this._littleEndian);
    }
    /**
     * @param {number} offset
     * @returns {number}
     */
    readInt16(offset) {
        return this._dataView.getInt16(offset - this._sliceOffset, this._littleEndian);
    }
    /**
     * @param {number} offset
     * @returns {number}
     */
    readUint32(offset) {
        return this._dataView.getUint32(offset - this._sliceOffset, this._littleEndian);
    }
    /**
     * @param {number} offset
     * @returns {number}
     */
    readInt32(offset) {
        return this._dataView.getInt32(offset - this._sliceOffset, this._littleEndian);
    }
    /**
     * @param {number} offset
     * @returns {number}
     */
    readFloat32(offset) {
        return this._dataView.getFloat32(offset - this._sliceOffset, this._littleEndian);
    }
    /**
     * @param {number} offset
     * @returns {number}
     */
    readFloat64(offset) {
        return this._dataView.getFloat64(offset - this._sliceOffset, this._littleEndian);
    }
    /**
     * @param {number} offset
     * @returns {number}
     */
    readUint64(offset) {
        const left = this.readUint32(offset);
        const right = this.readUint32(offset + 4);
        let combined;
        if (this._littleEndian) {
            combined = left + ((2 ** 32) * right);
            if (!Number.isSafeInteger(combined)) {
                throw new Error(`${combined} exceeds MAX_SAFE_INTEGER. `
                    + 'Precision may be lost. Please report if you get this message to https://github.com/geotiffjs/geotiff.js/issues');
            }
            return combined;
        }
        combined = ((2 ** 32) * left) + right;
        if (!Number.isSafeInteger(combined)) {
            throw new Error(`${combined} exceeds MAX_SAFE_INTEGER. `
                + 'Precision may be lost. Please report if you get this message to https://github.com/geotiffjs/geotiff.js/issues');
        }
        return combined;
    }
    /**
     * Adapted from https://stackoverflow.com/a/55338384/8060591
     * @param {number} offset
     * @returns {number}
     */
    readInt64(offset) {
        let value = 0;
        const isNegative = (this._dataView.getUint8(offset + (this._littleEndian ? 7 : 0)) & 0x80)
            > 0;
        let carrying = true;
        for (let i = 0; i < 8; i++) {
            let byte = this._dataView.getUint8(offset + (this._littleEndian ? i : 7 - i));
            if (isNegative) {
                if (carrying) {
                    if (byte !== 0x00) {
                        byte = ~(byte - 1) & 0xff;
                        carrying = false;
                    }
                }
                else {
                    byte = ~byte & 0xff;
                }
            }
            value += byte * (256 ** i);
        }
        if (isNegative) {
            value = -value;
        }
        return value;
    }
    /**
     * @param {number} offset
     * @returns {number}
     */
    readOffset(offset) {
        if (this._bigTiff) {
            return this.readUint64(offset);
        }
        return this.readUint32(offset);
    }
}

const CRLFCRLF = '\r\n\r\n';
/**
 * Shim for 'Object.fromEntries'
 * @template T
 * @param {Array<[string, T]>} items
 * @return {Record<string, T>}
 */
function itemsToObject(items) {
    if (typeof Object.fromEntries !== 'undefined') {
        return Object.fromEntries(items);
    }
    /** @type {Record<string, T>} */
    const obj = {};
    for (const [key, value] of items) {
        obj[key.toLowerCase()] = value;
    }
    return obj;
}
/**
 * Parse HTTP headers from a given string.
 * @param {string} text the text to parse the headers from
 * @returns {Record<string, string>} the parsed headers with lowercase keys
 */
function parseHeaders(text) {
    /** @type {Array<[string, string]>} */
    const items = text
        .split('\r\n')
        .map((line) => {
        const kv = /** @type {[string, string]} */ (line.split(':').map((str) => str.trim()));
        kv[0] = kv[0].toLowerCase();
        return kv;
    });
    return itemsToObject(items);
}
/**
 * Parse a 'Content-Type' header value to the content-type and parameters
 * @param {string|undefined} rawContentType the raw string to parse from
 * @returns {{type: string|null, params: Record<string, string>}}
 *     the parsed content type with the fields: type and params
 */
function parseContentType(rawContentType) {
    if (!rawContentType) {
        return { type: null, params: {} };
    }
    const [type, ...rawParams] = rawContentType.split(';').map((s) => s.trim());
    const paramsItems = /** @type {Array<[string, string]>} */ (rawParams.map((param) => param.split('=')));
    return { type, params: itemsToObject(paramsItems) };
}
/**
 * Parse a 'Content-Range' header value to its start, end, and total parts
 * @param {string|undefined} rawContentRange the raw string to parse from
 * @returns {{start: number, end: number, total: number}} the parsed parts
 */
function parseContentRange(rawContentRange) {
    let start = NaN;
    let end = NaN;
    let total = NaN;
    if (rawContentRange) {
        [, start, end, total] = (rawContentRange.match(/bytes (\d+)-(\d+)\/(\d+)/) || []).map(Number);
    }
    return { start, end, total };
}
/**
 * Parses a list of byteranges from the given 'multipart/byteranges' HTTP response.
 * Each item in the list has the following properties:
 * - headers: the HTTP headers
 * - data: the sliced ArrayBuffer for that specific part
 * - offset: the offset of the byterange within its originating file
 * - length: the length of the byterange
 * @param {ArrayBuffer} responseArrayBuffer the response to be parsed and split
 * @param {string} boundary the boundary string used to split the sections
 * @returns {Array<{headers: Record<string, string>, data: ArrayBuffer, offset: number, length: number, fileSize: number}>}
 *     the parsed byteranges
 */
function parseByteRanges(responseArrayBuffer, boundary) {
    let offset = -1;
    const decoder = new TextDecoder('ascii');
    const out = [];
    const startBoundary = `--${boundary}`;
    const endBoundary = `${startBoundary}--`;
    // search for the initial boundary, may be offset by some bytes
    // TODO: more efficient to check for `--` in bytes directly
    for (let i = 0; i < 10; ++i) {
        const text = decoder.decode(new Uint8Array(responseArrayBuffer, i, startBoundary.length));
        if (text === startBoundary) {
            offset = i;
        }
    }
    if (offset === -1) {
        throw new Error('Could not find initial boundary');
    }
    while (offset < responseArrayBuffer.byteLength) {
        const text = decoder.decode(new Uint8Array(responseArrayBuffer, offset, Math.min(startBoundary.length + 1024, responseArrayBuffer.byteLength - offset)));
        // break if we arrived at the end
        if (text.length === 0 || text.startsWith(endBoundary)) {
            break;
        }
        // assert that we are actually dealing with a byterange and are at the correct offset
        if (!text.startsWith(startBoundary)) {
            throw new Error('Part does not start with boundary');
        }
        // get a substring from where we read the headers
        const innerText = text.substr(startBoundary.length + 2);
        if (innerText.length === 0) {
            break;
        }
        // find the double linebreak that denotes the end of the headers
        const endOfHeaders = innerText.indexOf(CRLFCRLF);
        // parse the headers to get the content range size
        const headers = parseHeaders(innerText.substr(0, endOfHeaders));
        const { start, end, total } = parseContentRange(headers['content-range']);
        // calculate the length of the slice and the next offset
        const startOfData = offset + startBoundary.length + endOfHeaders + CRLFCRLF.length;
        const length = end + 1 - start;
        out.push({
            headers,
            data: responseArrayBuffer.slice(startOfData, startOfData + length),
            offset: start,
            length,
            fileSize: total,
        });
        offset = startOfData + length + 4;
    }
    return out;
}

/**
 * @typedef {Object} Slice
 * @property {number} offset
 * @property {number} length
 */
/** @typedef {Slice & {data: ArrayBufferLike}} SliceWithData */
class BaseSource {
    /**
     * @param {Array<Slice>} slices
     * @param {AbortSignal} [signal]
     * @returns {Promise<ArrayBufferLike[]>}
     */
    async fetch(slices, signal) {
        return Promise.all(slices.map(async (slice) => (await this.fetchSlice(slice, signal)).data));
    }
    /**
     * @param {Slice} slice
     * @param {AbortSignal} [_signal]
     * @returns {Promise<SliceWithData>}
     */
    async fetchSlice(slice, _signal) {
        throw new Error(`fetching of slice ${slice} not possible, not implemented`);
    }
    /**
     * Returns the filesize if already determined and null otherwise
     * @returns {number|null}
     */
    get fileSize() {
        return null;
    }
    async close() {
        // no-op by default
    }
}

class QuickLRU extends Map {
	constructor(options = {}) {
		super();

		if (!(options.maxSize && options.maxSize > 0)) {
			throw new TypeError('`maxSize` must be a number greater than 0');
		}

		if (typeof options.maxAge === 'number' && options.maxAge === 0) {
			throw new TypeError('`maxAge` must be a number greater than 0');
		}

		// TODO: Use private class fields when ESLint supports them.
		this.maxSize = options.maxSize;
		this.maxAge = options.maxAge || Number.POSITIVE_INFINITY;
		this.onEviction = options.onEviction;
		this.cache = new Map();
		this.oldCache = new Map();
		this._size = 0;
	}

	// TODO: Use private class methods when targeting Node.js 16.
	_emitEvictions(cache) {
		if (typeof this.onEviction !== 'function') {
			return;
		}

		for (const [key, item] of cache) {
			this.onEviction(key, item.value);
		}
	}

	_deleteIfExpired(key, item) {
		if (typeof item.expiry === 'number' && item.expiry <= Date.now()) {
			if (typeof this.onEviction === 'function') {
				this.onEviction(key, item.value);
			}

			return this.delete(key);
		}

		return false;
	}

	_getOrDeleteIfExpired(key, item) {
		const deleted = this._deleteIfExpired(key, item);
		if (deleted === false) {
			return item.value;
		}
	}

	_getItemValue(key, item) {
		return item.expiry ? this._getOrDeleteIfExpired(key, item) : item.value;
	}

	_peek(key, cache) {
		const item = cache.get(key);

		return this._getItemValue(key, item);
	}

	_set(key, value) {
		this.cache.set(key, value);
		this._size++;

		if (this._size >= this.maxSize) {
			this._size = 0;
			this._emitEvictions(this.oldCache);
			this.oldCache = this.cache;
			this.cache = new Map();
		}
	}

	_moveToRecent(key, item) {
		this.oldCache.delete(key);
		this._set(key, item);
	}

	* _entriesAscending() {
		for (const item of this.oldCache) {
			const [key, value] = item;
			if (!this.cache.has(key)) {
				const deleted = this._deleteIfExpired(key, value);
				if (deleted === false) {
					yield item;
				}
			}
		}

		for (const item of this.cache) {
			const [key, value] = item;
			const deleted = this._deleteIfExpired(key, value);
			if (deleted === false) {
				yield item;
			}
		}
	}

	get(key) {
		if (this.cache.has(key)) {
			const item = this.cache.get(key);

			return this._getItemValue(key, item);
		}

		if (this.oldCache.has(key)) {
			const item = this.oldCache.get(key);
			if (this._deleteIfExpired(key, item) === false) {
				this._moveToRecent(key, item);
				return item.value;
			}
		}
	}

	set(key, value, {maxAge = this.maxAge} = {}) {
		const expiry =
			typeof maxAge === 'number' && maxAge !== Number.POSITIVE_INFINITY ?
				Date.now() + maxAge :
				undefined;
		if (this.cache.has(key)) {
			this.cache.set(key, {
				value,
				expiry
			});
		} else {
			this._set(key, {value, expiry});
		}

		return this;
	}

	has(key) {
		if (this.cache.has(key)) {
			return !this._deleteIfExpired(key, this.cache.get(key));
		}

		if (this.oldCache.has(key)) {
			return !this._deleteIfExpired(key, this.oldCache.get(key));
		}

		return false;
	}

	peek(key) {
		if (this.cache.has(key)) {
			return this._peek(key, this.cache);
		}

		if (this.oldCache.has(key)) {
			return this._peek(key, this.oldCache);
		}
	}

	delete(key) {
		const deleted = this.cache.delete(key);
		if (deleted) {
			this._size--;
		}

		return this.oldCache.delete(key) || deleted;
	}

	clear() {
		this.cache.clear();
		this.oldCache.clear();
		this._size = 0;
	}

	resize(newSize) {
		if (!(newSize && newSize > 0)) {
			throw new TypeError('`maxSize` must be a number greater than 0');
		}

		const items = [...this._entriesAscending()];
		const removeCount = items.length - newSize;
		if (removeCount < 0) {
			this.cache = new Map(items);
			this.oldCache = new Map();
			this._size = items.length;
		} else {
			if (removeCount > 0) {
				this._emitEvictions(items.slice(0, removeCount));
			}

			this.oldCache = new Map(items.slice(removeCount));
			this.cache = new Map();
			this._size = 0;
		}

		this.maxSize = newSize;
	}

	* keys() {
		for (const [key] of this) {
			yield key;
		}
	}

	* values() {
		for (const [, value] of this) {
			yield value;
		}
	}

	* [Symbol.iterator]() {
		for (const item of this.cache) {
			const [key, value] = item;
			const deleted = this._deleteIfExpired(key, value);
			if (deleted === false) {
				yield [key, value.value];
			}
		}

		for (const item of this.oldCache) {
			const [key, value] = item;
			if (!this.cache.has(key)) {
				const deleted = this._deleteIfExpired(key, value);
				if (deleted === false) {
					yield [key, value.value];
				}
			}
		}
	}

	* entriesDescending() {
		let items = [...this.cache];
		for (let i = items.length - 1; i >= 0; --i) {
			const item = items[i];
			const [key, value] = item;
			const deleted = this._deleteIfExpired(key, value);
			if (deleted === false) {
				yield [key, value.value];
			}
		}

		items = [...this.oldCache];
		for (let i = items.length - 1; i >= 0; --i) {
			const item = items[i];
			const [key, value] = item;
			if (!this.cache.has(key)) {
				const deleted = this._deleteIfExpired(key, value);
				if (deleted === false) {
					yield [key, value.value];
				}
			}
		}
	}

	* entriesAscending() {
		for (const [key, value] of this._entriesAscending()) {
			yield [key, value.value];
		}
	}

	get size() {
		if (!this._size) {
			return this.oldCache.size;
		}

		let oldCacheSize = 0;
		for (const key of this.oldCache.keys()) {
			if (!this.cache.has(key)) {
				oldCacheSize++;
			}
		}

		return Math.min(this._size + oldCacheSize, this.maxSize);
	}

	entries() {
		return this.entriesAscending();
	}

	forEach(callbackFunction, thisArgument = this) {
		for (const [key, value] of this.entriesAscending()) {
			callbackFunction.call(thisArgument, value, key, this);
		}
	}

	get [Symbol.toStringTag]() {
		return JSON.stringify([...this.entriesAscending()]);
	}
}

/**
 * Promisified wrapper around 'setTimeout' to allow 'await'
 * @param {number} [milliseconds]
 * @returns {Promise<void>}
 */
async function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
function zip(a, b) {
    const A = Array.isArray(a) ? a : Array.from(a);
    const B = Array.isArray(b) ? b : Array.from(b);
    return A.map((k, i) => [k, B[i]]);
}
// Based on https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
class AbortError extends Error {
    constructor(...args) {
        // Pass remaining arguments (including vendor specific ones) to parent constructor
        super(...args);
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AbortError);
        }
        this.name = 'AbortError';
        this.signal = undefined;
    }
}
class CustomAggregateError extends Error {
    constructor(errors, message) {
        super(message);
        this.errors = errors;
        this.message = message;
        this.name = 'AggregateError';
    }
}
const AggregateError = CustomAggregateError;

class Block {
    /**
     *
     * @param {number} offset
     * @param {number} length
     * @param {ArrayBuffer} data
     */
    constructor(offset, length, data) {
        this.offset = offset;
        this.length = length;
        this.data = data;
    }
    /**
     * @returns {number} the top byte border
     */
    get top() {
        return this.offset + this.length;
    }
}
class BlockGroup {
    /**
     *
     * @param {number} offset
     * @param {number} length
     * @param {number[]} blockIds
     */
    constructor(offset, length, blockIds) {
        this.offset = offset;
        this.length = length;
        this.blockIds = blockIds;
    }
}
class BlockedSource extends BaseSource {
    /**
     *
     * @param {BaseSource} source The underlying source that shall be blocked and cached
     * @param {object} options
     * @param {number} [options.blockSize]
     * @param {number} [options.cacheSize]
     */
    constructor(source, { blockSize = 65536, cacheSize = 100 } = {}) {
        super();
        this.source = source;
        this.blockSize = blockSize;
        this.blockCache = new QuickLRU({
            maxSize: cacheSize,
            onEviction: (blockId, block) => {
                this.evictedBlocks.set(blockId, block);
            },
        });
        /** @type {Map<number, Block>} */
        this.evictedBlocks = new Map();
        // mapping blockId -> Block instance
        this.blockRequests = new Map();
        // set of blockIds missing for the current requests
        this.blockIdsToFetch = new Set();
        this.abortedBlockIds = new Set();
    }
    get fileSize() {
        return this.source.fileSize;
    }
    /**
     * @param {import("./basesource.js").Slice[]} slices
     * @param {AbortSignal} [signal]
     * @return {Promise<ArrayBuffer[]>}
     */
    async fetch(slices, signal) {
        const blockRequests = [];
        const missingBlockIds = [];
        const allBlockIds = [];
        this.evictedBlocks.clear();
        for (const { offset, length } of slices) {
            let top = offset + length;
            const { fileSize } = this;
            if (fileSize !== null) {
                top = Math.min(top, fileSize);
            }
            const firstBlockOffset = Math.floor(offset / this.blockSize) * this.blockSize;
            for (let current = firstBlockOffset; current < top; current += this.blockSize) {
                const blockId = Math.floor(current / this.blockSize);
                if (!this.blockCache.has(blockId) && !this.blockRequests.has(blockId)) {
                    this.blockIdsToFetch.add(blockId);
                    missingBlockIds.push(blockId);
                }
                if (this.blockRequests.has(blockId)) {
                    blockRequests.push(this.blockRequests.get(blockId));
                }
                allBlockIds.push(blockId);
            }
        }
        // allow additional block requests to accumulate
        await wait();
        this.fetchBlocks(signal);
        // Gather all of the new requests that this fetch call is contributing to `fetch`.
        const missingRequests = [];
        for (const blockId of missingBlockIds) {
            // The requested missing block could already be in the cache
            // instead of having its request still be outstanding.
            if (this.blockRequests.has(blockId)) {
                missingRequests.push(this.blockRequests.get(blockId));
            }
        }
        // Actually await all pending requests that are needed for this `fetch`.
        await Promise.allSettled(blockRequests);
        await Promise.allSettled(missingRequests);
        // Perform retries if a block was interrupted by a previous signal
        const abortedBlockRequests = [];
        const abortedBlockIds = allBlockIds
            .filter((id) => this.abortedBlockIds.has(id) || !this.blockCache.has(id));
        abortedBlockIds.forEach((id) => this.blockIdsToFetch.add(id));
        // start the retry of some blocks if required
        if (abortedBlockIds.length > 0 && signal && !signal.aborted) {
            this.fetchBlocks();
            for (const blockId of abortedBlockIds) {
                const block = this.blockRequests.get(blockId);
                if (!block) {
                    throw new Error(`Block ${blockId} is not in the block requests`);
                }
                abortedBlockRequests.push(block);
            }
            await Promise.allSettled(abortedBlockRequests);
        }
        // throw an  abort error
        if (signal && signal.aborted) {
            throw new AbortError('Request was aborted');
        }
        const blocks = allBlockIds.map((id) => this.blockCache.get(id) || this.evictedBlocks.get(id));
        const failedBlocks = blocks.filter((i) => !i);
        if (failedBlocks.length) {
            throw new AggregateError(failedBlocks, 'Request failed');
        }
        // create a final Map, with all required blocks for this request to satisfy
        const requiredBlocks = new Map(zip(allBlockIds, blocks));
        // TODO: satisfy each slice
        return this.readSliceData(slices, requiredBlocks);
    }
    /**
     * @param {AbortSignal} [signal]
     */
    fetchBlocks(signal) {
        // check if we still need to
        if (this.blockIdsToFetch.size > 0) {
            const groups = this.groupBlocks(this.blockIdsToFetch);
            // start requesting slices of data
            const groupRequests = groups.map(async (group) => ({ ...group, ...(await this.source.fetchSlice(group, signal)) }));
            for (let groupIndex = 0; groupIndex < groups.length; ++groupIndex) {
                const group = groups[groupIndex];
                for (const blockId of group.blockIds) {
                    // make an async IIFE for each block
                    this.blockRequests.set(blockId, (async () => {
                        try {
                            const response = (await Promise.all(groupRequests))[groupIndex];
                            const blockOffset = blockId * this.blockSize;
                            const o = blockOffset - response.offset;
                            const t = Math.min(o + this.blockSize, response.data.byteLength);
                            const data = response.data.slice(o, t);
                            const block = new Block(blockOffset, data.byteLength, 
                            /** @type {ArrayBuffer} */ (data));
                            this.blockCache.set(blockId, block);
                            this.abortedBlockIds.delete(blockId);
                        }
                        catch (err) {
                            if (err instanceof AbortError && err.name === 'AbortError') {
                                // store the signal here, we need it to determine later if an
                                // error was caused by this signal
                                err.signal = signal;
                                this.blockCache.delete(blockId);
                                this.abortedBlockIds.add(blockId);
                            }
                            else {
                                throw err;
                            }
                        }
                        finally {
                            this.blockRequests.delete(blockId);
                        }
                    })());
                }
            }
            this.blockIdsToFetch.clear();
        }
    }
    /**
     *
     * @param {Set<number>} blockIds
     * @returns {BlockGroup[]}
     */
    groupBlocks(blockIds) {
        const sortedBlockIds = Array.from(blockIds).sort((a, b) => a - b);
        if (sortedBlockIds.length === 0) {
            return [];
        }
        /** @type {number[]} */
        let current = [];
        let lastBlockId = null;
        const groups = [];
        for (const blockId of sortedBlockIds) {
            if (lastBlockId === null || lastBlockId + 1 === blockId) {
                current.push(blockId);
                lastBlockId = blockId;
            }
            else {
                groups.push(new BlockGroup(current[0] * this.blockSize, current.length * this.blockSize, current));
                current = [blockId];
                lastBlockId = blockId;
            }
        }
        groups.push(new BlockGroup(current[0] * this.blockSize, current.length * this.blockSize, current));
        return groups;
    }
    /**
     * @param {import("./basesource.js").Slice[]} slices
     * @param {Map<number, Block>} blocks
     * @returns {ArrayBuffer[]}
     */
    readSliceData(slices, blocks) {
        return slices.map((slice) => {
            let top = slice.offset + slice.length;
            if (this.fileSize !== null) {
                top = Math.min(this.fileSize, top);
            }
            const blockIdLow = Math.floor(slice.offset / this.blockSize);
            const blockIdHigh = Math.floor((top - 1) / this.blockSize);
            const sliceData = new ArrayBuffer(slice.length);
            const sliceView = new Uint8Array(sliceData);
            for (let blockId = blockIdLow; blockId <= blockIdHigh; ++blockId) {
                const block = blocks.get(blockId);
                if (!block) {
                    continue;
                }
                const delta = block.offset - slice.offset;
                const topDelta = block.top - top;
                let blockInnerOffset = 0;
                let rangeInnerOffset = 0;
                let usedBlockLength;
                if (delta < 0) {
                    blockInnerOffset = -delta;
                }
                else if (delta > 0) {
                    rangeInnerOffset = delta;
                }
                if (topDelta < 0) {
                    usedBlockLength = block.length - blockInnerOffset;
                }
                else {
                    usedBlockLength = top - block.offset - blockInnerOffset;
                }
                const blockView = new Uint8Array(block.data, blockInnerOffset, usedBlockLength);
                sliceView.set(blockView, rangeInnerOffset);
            }
            return sliceData;
        });
    }
}

class BaseResponse {
    /**
     * Returns whether the response has an ok'ish status code
     */
    get ok() {
        return this.status >= 200 && this.status <= 299;
    }
    /**
     * Returns the status code of the response
     * @returns {number} the status code
     */
    get status() {
        throw new Error('not implemented');
    }
    /**
     * Returns the value of the specified header
     * @param {string} _headerName the header name
     * @returns {string|undefined} the header value
     */
    getHeader(_headerName) {
        throw new Error('not implemented');
    }
    /**
     * @returns {Promise<ArrayBuffer>} the response data of the request
     */
    async getData() {
        throw new Error('not implemented');
    }
}
class BaseClient {
    /** @param {string} url */
    constructor(url) {
        this.url = url;
    }
    /**
     * Send a request with the options
     * @param {RequestInit} [_options={}]
     * @returns {Promise<BaseResponse>}
     */
    async request(_options) {
        throw new Error('request is not implemented');
    }
}

class FetchResponse extends BaseResponse {
    /**
     * BaseResponse facade for fetch API Response
     * @param {Response} response
     */
    constructor(response) {
        super();
        this.response = response;
    }
    get status() {
        return this.response.status;
    }
    /**
     * @param {string} name
     * @returns {string|undefined}
     */
    getHeader(name) {
        return this.response.headers.get(name) || undefined;
    }
    async getData() {
        const data = this.response.arrayBuffer
            ? await this.response.arrayBuffer()
            // FIXME Can this really have a buffer property?
            : (await /** @type {*} */ (this.response).buffer()).buffer;
        return data;
    }
}
class FetchClient extends BaseClient {
    /**
     * @param {string} url
     * @param {RequestCredentials} [credentials]
     */
    constructor(url, credentials) {
        super(url);
        this.credentials = credentials;
    }
    /**
     * @param {RequestInit} [options={}]
     * @returns {Promise<FetchResponse>}
     */
    async request({ headers, signal } = {}) {
        const response = await fetch(this.url, {
            headers, credentials: this.credentials, signal,
        });
        return new FetchResponse(response);
    }
}

class XHRResponse extends BaseResponse {
    /**
     * BaseResponse facade for XMLHttpRequest
     * @param {XMLHttpRequest} xhr
     * @param {ArrayBuffer} data
     */
    constructor(xhr, data) {
        super();
        this.xhr = xhr;
        this.data = data;
    }
    get status() {
        return this.xhr.status;
    }
    /**
     * @param {string} name
     * @returns {string|undefined}
     */
    getHeader(name) {
        return this.xhr.getResponseHeader(name) || undefined;
    }
    async getData() {
        return this.data;
    }
}
class XHRClient extends BaseClient {
    /**
     * @param {Object<string, string>} headers
     * @param {AbortSignal} [signal]
     * @returns {Promise<XHRResponse>}
     */
    constructRequest(headers, signal) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', this.url);
            xhr.responseType = 'arraybuffer';
            for (const [key, value] of Object.entries(headers)) {
                xhr.setRequestHeader(key, value);
            }
            // hook signals
            xhr.onload = () => {
                const data = xhr.response;
                resolve(new XHRResponse(xhr, data));
            };
            xhr.onerror = reject;
            xhr.onabort = () => reject(new AbortError('Request aborted'));
            xhr.send();
            if (signal) {
                if (signal.aborted) {
                    xhr.abort();
                }
                signal.addEventListener('abort', () => xhr.abort());
            }
        });
    }
    async request({ headers = {}, signal = undefined } = {}) {
        const response = await this.constructRequest(headers, signal);
        return response;
    }
}

class HttpResponse extends BaseResponse {
    /**
     * BaseResponse facade for node HTTP/HTTPS API Response
     * @param {import('http').IncomingMessage} response
     * @param {Promise<ArrayBuffer>} dataPromise
     */
    constructor(response, dataPromise) {
        super();
        this.response = response;
        this.dataPromise = dataPromise;
    }
    get status() {
        return /** @type {number} */ (this.response.statusCode);
    }
    /**
     * @param {string} name
     * @returns {string|undefined}
     */
    getHeader(name) {
        const value = this.response.headers[name];
        return Array.isArray(value) ? value.join(', ') : value;
    }
    async getData() {
        const data = await this.dataPromise;
        return data;
    }
}
class HttpClient extends BaseClient {
    /** @param {string} url */
    constructor(url) {
        super(url);
        this.parsedUrl = fs.parse(this.url);
        this.httpApi = (this.parsedUrl.protocol === 'http:' ? fs : fs);
    }
    /**
     * @param {Object<string, string>} headers
     * @param {AbortSignal} [signal]
     * @returns {Promise<HttpResponse>}
     */
    constructRequest(headers, signal) {
        return new Promise((resolve, reject) => {
            const request = this.httpApi.get({
                ...this.parsedUrl,
                headers,
            }, (response) => {
                const dataPromise = new Promise((resolveData) => {
                    /** @type {Uint8Array[]} */
                    const chunks = [];
                    // collect chunks
                    response.on('data', (chunk) => {
                        chunks.push(chunk);
                    });
                    // concatenate all chunks and resolve the promise with the resulting buffer
                    response.on('end', () => {
                        const data = Buffer.concat(chunks).buffer;
                        resolveData(data);
                    });
                    response.on('error', reject);
                });
                resolve(new HttpResponse(response, dataPromise));
            });
            request.on('error', reject);
            if (signal) {
                if (signal.aborted) {
                    request.destroy(new AbortError('Request aborted'));
                }
                signal.addEventListener('abort', () => request.destroy(new AbortError('Request aborted')));
            }
        });
    }
    async request({ headers = {}, signal = undefined } = {}) {
        const response = await this.constructRequest(headers, signal);
        return response;
    }
}

/** @import { RemoteSourceOptions, BlockedSourceOptions } from '../geotiff.js' */
class RemoteSource extends BaseSource {
    /**
     * @param {import("../geotiff.js").BaseClient} client
     * @param {RemoteSourceOptions} options
     */
    constructor(client, { headers, maxRanges = 0, allowFullFile } = {}) {
        super();
        this.client = client;
        this.headers = headers;
        this.maxRanges = maxRanges;
        this.allowFullFile = allowFullFile;
        this._fileSize = null;
    }
    /**
     * @param {import('./basesource.js').Slice[]} slices
     * @param {AbortSignal} [signal]
     * @returns {Promise<ArrayBufferLike[]>}
     */
    async fetch(slices, signal) {
        // if we allow multi-ranges, split the incoming request into that many sub-requests
        // and join them afterwards
        if (this.maxRanges >= slices.length) {
            return this.fetchSlices(slices, signal).then((results) => results.map((r) => r.data));
        }
        // otherwise make a single request for each slice
        return Promise.all(slices.map(async (slice) => (await this.fetchSlice(slice, signal)).data));
    }
    /**
     * @param {Array<import('./basesource.js').Slice>} slices
     * @param {AbortSignal} [signal]
     * @returns {Promise<Array<import('./basesource.js').SliceWithData>>}
     */
    async fetchSlices(slices, signal) {
        const response = await this.client.request({
            headers: {
                ...this.headers,
                Range: `bytes=${slices
                    .map(({ offset, length }) => `${offset}-${offset + length - 1}`)
                    .join(',')}`,
            },
            signal,
        });
        if (!response.ok) {
            throw new Error('Error fetching data.');
        }
        else if (response.status === 206) {
            const { type, params } = parseContentType(response.getHeader('content-type'));
            if (type === 'multipart/byteranges') {
                const byteRanges = parseByteRanges(await response.getData(), params.boundary);
                this._fileSize = byteRanges[0].fileSize || null;
                return byteRanges;
            }
            const data = await response.getData();
            const { start, end, total } = parseContentRange(response.getHeader('content-range'));
            this._fileSize = total || null;
            /** @type {import('./basesource.js').SliceWithData[]} */
            const first = [{
                    data,
                    offset: start,
                    length: end + 1 - start,
                }];
            if (slices.length > 1) {
                // we requested more than one slice, but got only the first
                // unfortunately, some HTTP Servers don't support multi-ranges
                // and return only the first
                // get the rest of the slices and fetch them iteratively
                const others = await Promise.all(slices.slice(1).map((slice) => this.fetchSlice(slice, signal)));
                return first.concat(others);
            }
            return first;
        }
        else {
            if (!this.allowFullFile) {
                throw new Error('Server responded with full file');
            }
            const data = await response.getData();
            this._fileSize = data.byteLength;
            return [{
                    data,
                    offset: 0,
                    length: data.byteLength,
                }];
        }
    }
    /**
     * @param {import('./basesource.js').Slice} slice
     * @param {AbortSignal} [signal]
     * @returns {Promise<import('./basesource.js').SliceWithData>}
     */
    async fetchSlice(slice, signal) {
        const { offset, length } = slice;
        const response = await this.client.request({
            headers: {
                ...this.headers,
                Range: `bytes=${offset}-${offset + length - 1}`,
            },
            signal,
        });
        // check the response was okay and if the server actually understands range requests
        if (!response.ok) {
            throw new Error('Error fetching data.');
        }
        else if (response.status === 206) {
            const data = await response.getData();
            const { total } = parseContentRange(response.getHeader('content-range'));
            this._fileSize = total || null;
            return {
                data,
                offset,
                length,
            };
        }
        else {
            if (!this.allowFullFile) {
                throw new Error('Server responded with full file');
            }
            const data = await response.getData();
            this._fileSize = data.byteLength;
            return {
                data,
                offset: 0,
                length: data.byteLength,
            };
        }
    }
    get fileSize() {
        return this._fileSize;
    }
}
/**
 * @param {BaseSource} source
 * @param {BlockedSourceOptions} blockedSourceOptions
 * @returns {BaseSource}
 */
function maybeWrapInBlockedSource(source, { blockSize, cacheSize }) {
    if (blockSize === undefined) {
        return source;
    }
    return new BlockedSource(source, { blockSize, cacheSize });
}
/**
 * @param {string} url
 * @param {RemoteSourceOptions & BlockedSourceOptions & { credentials?: RequestCredentials}} [param1]
 * @returns {BaseSource}
 */
function makeFetchSource(url, { headers = {}, credentials, maxRanges = 0, allowFullFile = false, ...blockOptions } = {}) {
    const client = new FetchClient(url, credentials);
    const source = new RemoteSource(client, { headers, maxRanges, allowFullFile });
    return maybeWrapInBlockedSource(source, blockOptions);
}
/**
 * @param {string} url
 * @param {RemoteSourceOptions & BlockedSourceOptions} [param1]
 * @returns {BaseSource}
 */
function makeXHRSource(url, { headers = {}, maxRanges = 0, allowFullFile = false, ...blockOptions } = {}) {
    const client = new XHRClient(url);
    const source = new RemoteSource(client, { headers, maxRanges, allowFullFile });
    return maybeWrapInBlockedSource(source, blockOptions);
}
/**
 * @param {string} url
 * @param {RemoteSourceOptions & BlockedSourceOptions} [param1]
 * @returns {BaseSource}
 */
function makeHttpSource(url, { headers = {}, maxRanges = 0, allowFullFile = false, ...blockOptions } = {}) {
    const client = new HttpClient(url);
    const source = new RemoteSource(client, { headers, maxRanges, allowFullFile });
    return maybeWrapInBlockedSource(source, blockOptions);
}
/**
 *
 * @param {string} url
 * @param {RemoteSourceOptions} options
 */
function makeRemoteSource(url, { forceXHR = false, ...clientOptions } = {}) {
    if (typeof fetch === 'function' && !forceXHR) {
        return makeFetchSource(url, clientOptions);
    }
    if (typeof XMLHttpRequest !== 'undefined') {
        return makeXHRSource(url, clientOptions);
    }
    return makeHttpSource(url, clientOptions);
}

class FileReaderSource extends BaseSource {
    /**
     * @param {Blob} file
     */
    constructor(file) {
        super();
        this.file = file;
    }
    /**
     * @param {import('./basesource.js').Slice} slice
     * @param {AbortSignal} signal
     * @returns {Promise<import('./basesource.js').SliceWithData>}
     */
    async fetchSlice(slice, signal) {
        return new Promise((resolve, reject) => {
            const blob = this.file.slice(slice.offset, slice.offset + slice.length);
            const reader = new FileReader();
            reader.onload = () => resolve({
                data: /** @type {ArrayBuffer} */ (reader.result),
                offset: slice.offset,
                length: slice.length,
            });
            reader.onerror = reject;
            reader.onabort = reject;
            reader.readAsArrayBuffer(blob);
            if (signal) {
                signal.addEventListener('abort', () => reader.abort());
            }
        });
    }
}
/**
 * Create a new source from a given file/blob.
 * @param {Blob} file The file or blob to read from.
 * @returns {FileReaderSource} The constructed source
 */
function makeFileReaderSource(file) {
    return new FileReaderSource(file);
}

/**
 * Allocates an appropriate TypedArray based on the TIFF field type.
 * @param {number} fieldType - TIFF field type constant from fieldTypes
 * @param {number} count - Number of elements to allocate
 * @returns {import('./geotiff.js').TypedArray|Array<number>} The allocated typed array for the given field type
 * @throws {RangeError} If the field type is invalid
 */
function getArrayForSamples(fieldType, count) {
    switch (fieldType) {
        case fieldTypes.BYTE:
        case fieldTypes.ASCII:
        case fieldTypes.UNDEFINED:
            return new Uint8Array(count);
        case fieldTypes.SBYTE:
            return new Int8Array(count);
        case fieldTypes.SHORT:
            return new Uint16Array(count);
        case fieldTypes.SSHORT:
            return new Int16Array(count);
        case fieldTypes.LONG:
        case fieldTypes.IFD:
            return new Uint32Array(count);
        case fieldTypes.SLONG:
            return new Int32Array(count);
        case fieldTypes.LONG8:
        case fieldTypes.IFD8:
            return new Array(count);
        case fieldTypes.SLONG8:
            return new Array(count);
        case fieldTypes.RATIONAL:
            return new Uint32Array(count * 2);
        case fieldTypes.SRATIONAL:
            return new Int32Array(count * 2);
        case fieldTypes.FLOAT:
            return new Float32Array(count);
        case fieldTypes.DOUBLE:
            return new Float64Array(count);
        default:
            throw new RangeError(`Invalid field type: ${fieldType}`);
    }
}
/**
 * Returns the appropriate DataSlice read method for a given field type.
 * @param {DataSlice} dataSlice - The DataSlice instance to get the reader from
 * @param {number} fieldType - TIFF field type constant from fieldTypes
 * @returns {Function} The bound read method (e.g., readUint16, readFloat32)
 * @throws {RangeError} If the field type is invalid
 */
function getDataSliceReader(dataSlice, fieldType) {
    switch (fieldType) {
        case fieldTypes.BYTE:
        case fieldTypes.ASCII:
        case fieldTypes.UNDEFINED:
            return dataSlice.readUint8;
        case fieldTypes.SBYTE:
            return dataSlice.readInt8;
        case fieldTypes.SHORT:
            return dataSlice.readUint16;
        case fieldTypes.SSHORT:
            return dataSlice.readInt16;
        case fieldTypes.LONG:
        case fieldTypes.IFD:
            return dataSlice.readUint32;
        case fieldTypes.SLONG:
            return dataSlice.readInt32;
        case fieldTypes.LONG8:
        case fieldTypes.IFD8:
            return dataSlice.readUint64;
        case fieldTypes.SLONG8:
            return dataSlice.readInt64;
        case fieldTypes.RATIONAL:
            return dataSlice.readUint32;
        case fieldTypes.SRATIONAL:
            return dataSlice.readInt32;
        case fieldTypes.FLOAT:
            return dataSlice.readFloat32;
        case fieldTypes.DOUBLE:
            return dataSlice.readFloat64;
        default:
            throw new RangeError(`Invalid field type: ${fieldType}`);
    }
}
/**
 * @overload
 * @param {import('./geotiff.js').TypedArray|Array<number>|null} outValues - Optional pre-allocated output array
 * @param {Function} readMethod - DataView read method (e.g., getUint16)
 * @param {DataSlice} dataSlice - Source data slice
 * @param {number} fieldType - TIFF field type constant
 * @param {number} count - Number of values to read
 * @param {number} offset - Byte offset to start reading
 * @param {true} isArray - Whether to always return an array (vs single value)
 * @returns {import('./geotiff.js').TypedArray|Array<number>} The decoded value(s)
 */
/**
 * @overload
 * @param {import('./geotiff.js').TypedArray|Array<number>|null} outValues - Optional pre-allocated output array
 * @param {Function} readMethod - DataView read method (e.g., getUint16)
 * @param {DataSlice} dataSlice - Source data slice
 * @param {number} fieldType - TIFF field type constant
 * @param {number} count - Number of values to read
 * @param {number} offset - Byte offset to start reading
 * @param {boolean} [isArray] - Whether to always return an array (vs single value)
 * @returns {import('./geotiff.js').TypedArray|Array<number>|string|number} The decoded value(s)
 */
/**
 * Reads field values from a DataSlice.
 * @param {import('./geotiff.js').TypedArray|Array<number>|null} outValues - Optional pre-allocated output array
 * @param {Function} readMethod - DataView read method (e.g., getUint16)
 * @param {DataSlice} dataSlice - Source data slice
 * @param {import('./globals.js').FieldType} fieldType - TIFF field type constant
 * @param {number} count - Number of values to read
 * @param {number} offset - Byte offset to start reading
 * @param {boolean} [isArray] - Whether to always return an array (vs single value)
 * @returns {import('./geotiff.js').TypedArray|Array<number>|string|number} The decoded value(s)
 */
function getValues$1(outValues = null, readMethod, dataSlice, fieldType, count, offset, isArray = false) {
    const fieldTypeLength = getFieldTypeSize(fieldType);
    const values = outValues || getArrayForSamples(fieldType, count);
    // const readMethod = getDataSliceReader(dataSlice, fieldType);
    const isRational = (fieldType === fieldTypes.RATIONAL || fieldType === fieldTypes.SRATIONAL);
    // normal fields
    if (!isRational) {
        for (let i = 0; i < count; ++i) {
            values[i] = readMethod.call(dataSlice, offset + (i * fieldTypeLength));
        }
    }
    else {
        // RATIONAL or SRATIONAL
        for (let i = 0; i < count; i += 2) {
            values[i] = readMethod.call(dataSlice, offset + (i * fieldTypeLength));
            values[i + 1] = readMethod.call(dataSlice, offset + ((i * fieldTypeLength) + 4));
        }
    }
    if (fieldType === fieldTypes.ASCII) {
        return new TextDecoder('utf-8').decode(/** @type {Uint8Array} */ (values));
    }
    if (count === 1 && !isArray && !isRational) {
        return values[0];
    }
    return values;
}
/**
 * Lazily-loaded array for large TIFF field values that are fetched on-demand.
 * Supports loading individual indices or the entire array. Uses a bitmap to track
 * which values have been loaded to avoid redundant fetches.
 */
class DeferredArray {
    /**
     * Creates a DeferredArray for lazy-loading of large TIFF field arrays.
     * @param {import("./source/basesource.js").BaseSource} source - Data source for fetching
     * @param {number} arrayOffset - Byte offset where the array data starts
     * @param {boolean} littleEndian - Endianness of the data
     * @param {import('./globals.js').FieldType} fieldType - TIFF field type constant
     * @param {number} length - Number of elements in the array
     */
    constructor(source, arrayOffset, littleEndian, fieldType, length) {
        this.source = source;
        this.arrayOffset = arrayOffset;
        this.littleEndian = littleEndian;
        this.fieldType = fieldType;
        this.length = length;
        this.data = getArrayForSamples(fieldType, length);
        this.itemSize = getFieldTypeSize(fieldType);
        this.maskBitmap = new Uint8Array(Math.ceil(length / 8));
        this.fetchIndexPromises = new Map();
        this.fullFetchPromise = null;
    }
    /**
     * Loads all values in the deferred array at once.
     * Subsequent calls return the same promise to avoid redundant fetches.
     * @returns {Promise<import('./geotiff.js').TypedArray|Array<number>>} Promise resolving to the fully loaded array
     */
    async loadAll() {
        if (!this.fullFetchPromise) {
            this.fullFetchPromise = this.source.fetch([{
                    offset: this.arrayOffset,
                    length: this.itemSize * this.length,
                }]).then((data) => {
                const dataSlice = new DataSlice(data[0], this.arrayOffset, true, false);
                const result = getValues$1(this.data, getDataSliceReader(dataSlice, this.fieldType), dataSlice, this.fieldType, this.length, this.arrayOffset, true);
                // Mark all items as loaded in the bitmap
                this.maskBitmap.fill(0xFF);
                // Clean up any pending individual fetch promises since all data is now loaded
                this.fetchIndexPromises.clear();
                return result;
            });
        }
        return this.fullFetchPromise;
    }
    /**
     * Loads and returns a single value at the specified index.
     * If the value is already loaded, returns it immediately. Otherwise, fetches it
     * from the source. Multiple calls for the same index reuse the same promise.
     * @param {number} index - Zero-based index of the value to load
     * @returns {Promise<number|bigint>} Promise resolving to the value at the given index
     * @throws {RangeError} If index is out of bounds
     */
    async get(index) {
        if (index < 0 || index >= this.data.length) {
            throw new RangeError(`Index ${index} out of bounds for length ${this.data.length}`);
        }
        const byteIndex = Math.floor(index / 8);
        const bitMask = 1 << index % 8;
        const offset = this.arrayOffset + (index * this.itemSize);
        if ((this.maskBitmap[byteIndex] & bitMask) === 0) {
            if (!this.fetchIndexPromises.has(index)) {
                const fetchPromise = this.source.fetch([{
                        offset,
                        length: this.itemSize,
                    }]).then((data) => {
                    const dataSlice = new DataSlice(data[0], this.arrayOffset + (index * this.itemSize), true, false);
                    const readMethod = getDataSliceReader(dataSlice, this.fieldType);
                    const value = readMethod.call(dataSlice, offset);
                    this.data[index] = value;
                    this.maskBitmap[byteIndex] |= bitMask;
                    this.fetchIndexPromises.delete(index);
                    return value;
                });
                this.fetchIndexPromises.set(index, fetchPromise);
            }
            return this.fetchIndexPromises.get(index);
        }
        return this.data[index];
    }
}
class ImageFileDirectory {
    /**
     * Create an ImageFileDirectory.
     * @param {Map<string|number, number|string|Array<number|string>>} actualizedFields the file directory,
     * mapping tag names to values
     * @param {Map<string|number, Function>} deferredFields the deferred fields, mapping tag names to async functions
     * @param {Map<string|number, DeferredArray>} deferredArrays the deferred arrays, mapping tag names to
     * DeferredArray objects
     * @param {number} nextIFDByteOffset the byte offset to the next IFD
     */
    constructor(actualizedFields, deferredFields, deferredArrays, nextIFDByteOffset) {
        this.actualizedFields = actualizedFields;
        this.deferredFields = deferredFields;
        this.deferredFieldsBeingResolved = new Map();
        this.deferredArrays = deferredArrays;
        this.nextIFDByteOffset = nextIFDByteOffset;
    }
    /**
     * @param {import('./globals.js').TagName|number} tagIdentifier The field tag ID or name
     * @returns {boolean} whether the field exists (actualized or deferred)
     */
    hasTag(tagIdentifier) {
        const tag = resolveTag(tagIdentifier);
        return this.actualizedFields.has(tag) || this.deferredFields.has(tag) || this.deferredArrays.has(tag);
    }
    /**
     * Synchronously retrieves the value for a given tag. If it is deferred, an error is thrown.
     * @template {import('./globals.js').EagerTagName | import('./globals.js').EagerTag} [T=any]
     * @param {T} tagIdentifier The field tag ID or name
     * @returns {T extends import('./globals.js').TagName ? (import('./globals.js').TagValue<T> | undefined) : any}
     * the field value,
     * or undefined if it does not exist
     * @throws {Error} If the tag is deferred and requires asynchronous loading
     */
    getValue(tagIdentifier) {
        const tag = resolveTag(tagIdentifier);
        if (this.deferredFields.has(tag) || this.deferredArrays.has(tag)) {
            const tagDef = tagDefinitions[tag];
            const tagName = tagDef?.name || `Tag${tag}`;
            throw new Error(`Field '${tagName}' (${tag}) is deferred. Use loadValue() to load it asynchronously.`);
        }
        if (!this.actualizedFields.has(tag)) {
            return /** @type {any} */ (undefined);
        }
        return /** @type {any} */ (this.actualizedFields.get(tag));
    }
    /**
     * Retrieves the value for a given tag. If it is deferred, it will be loaded first.
     * @template {import('./globals.js').TagName} [T=any]
     * @param {T|number} tagIdentifier The field tag ID or name
     * @returns {Promise<T extends import('./globals.js').TagName ? (import('./globals.js').TagValue<T> | undefined) : any>}
     *   the field value, or undefined if it does not exist
     */
    async loadValue(tagIdentifier) {
        const tag = resolveTag(tagIdentifier);
        if (this.actualizedFields.has(tag)) {
            return /** @type {any} */ (this.actualizedFields.get(tag));
        }
        if (this.deferredFieldsBeingResolved.has(tag)) {
            return /** @type {any} */ (this.deferredFieldsBeingResolved.get(tag));
        }
        const loaderFn = this.deferredFields.get(tag);
        if (loaderFn) {
            this.deferredFields.delete(tag);
            // Set promise BEFORE starting async work to prevent race conditions
            const valuePromise = (async () => {
                try {
                    const value = await loaderFn();
                    this.actualizedFields.set(tag, value);
                    return value;
                }
                finally {
                    this.deferredFieldsBeingResolved.delete(tag);
                }
            })();
            this.deferredFieldsBeingResolved.set(tag, valuePromise);
            return /** @type {any} */ (valuePromise);
        }
        const deferredArray = this.deferredArrays.get(tag);
        if (deferredArray) {
            return /** @type {any} */ (deferredArray.loadAll());
        }
        return /** @type {any} */ (undefined);
    }
    /**
     * Retrieves the value at a given index for a tag that is an array. If it is deferred, it will be loaded first.
     * @param {number|string} tagIdentifier The field tag ID or name
     * @param {number} index The index within the array
     * @returns {Promise<number|string|bigint|undefined>} the field value at the given index, or undefined if it does not exist
     */
    async loadValueIndexed(tagIdentifier, index) {
        const tag = resolveTag(tagIdentifier);
        if (this.actualizedFields.has(tag)) {
            const value = this.actualizedFields.get(tag);
            return /** @type {any} */ (value)[index];
        }
        else if (this.deferredArrays.has(tag)) {
            const deferredArray = /** @type {DeferredArray} */ (this.deferredArrays.get(tag));
            return deferredArray.get(index);
        }
        else if (this.hasTag(tag)) {
            const value = await this.loadValue(tag);
            if (value && typeof value !== 'number') {
                return value[index];
            }
        }
        return undefined;
    }
    /**
     * Parses the GeoTIFF GeoKeyDirectory tag into a structured object.
     * The GeoKeyDirectory is a special TIFF tag that contains geographic metadata
     * in a key-value format as defined by the GeoTIFF specification.
     * @returns {Partial<Record<import('./globals.js').GeoKeyName, *>>|null} Parsed geo key directory
     *     mapping key names to values, or null if not present
     * @throws {Error} If a referenced geo key value cannot be retrieved
     */
    parseGeoKeyDirectory() {
        const rawGeoKeyDirectory = this.getValue('GeoKeyDirectory');
        if (!rawGeoKeyDirectory) {
            return null;
        }
        /** @type {Partial<Record<import('./globals.js').GeoKeyName, *>>} */
        const geoKeyDirectory = {};
        for (let i = 4; i <= rawGeoKeyDirectory[3] * 4; i += 4) {
            const key = ( /** @type {Record<number, import('./globals.js').GeoKeyName>} */(geoKeyNames))[rawGeoKeyDirectory[i]];
            const location = /** @type {import('./globals.js').EagerTag} */ (rawGeoKeyDirectory[i + 1]) || null;
            const count = rawGeoKeyDirectory[i + 2];
            const offset = rawGeoKeyDirectory[i + 3];
            let value = null;
            if (!location) {
                value = offset;
            }
            else {
                value = this.getValue(location);
                if (typeof value === 'undefined' || value === null) {
                    throw new Error(`Could not get value of geoKey '${key}'.`);
                }
                else if (typeof value === 'string') {
                    value = value.substring(offset, offset + count - 1);
                }
                else if (value.subarray) {
                    value = value.subarray(offset, offset + count);
                    if (count === 1) {
                        value = value[0];
                    }
                }
            }
            geoKeyDirectory[key] = value;
        }
        return geoKeyDirectory;
    }
    toObject() {
        /** @type {Record<string, unknown>} */
        const obj = {};
        for (const [tag, value] of this.actualizedFields.entries()) {
            const tagDefinition = typeof tag === 'number' ? tagDefinitions[tag] : undefined;
            const tagName = tagDefinition ? tagDefinition.name : `Tag${tag}`;
            obj[tagName] = value;
        }
        return obj;
    }
}
/**
 * Parser for Image File Directories (IFDs).
 */
class ImageFileDirectoryParser {
    /**
     * @param {import("./source/basesource.js").BaseSource} source the data source to fetch from
     * @param {boolean} littleEndian the endianness of the file
     * @param {boolean} bigTiff whether the file is a BigTIFF
     * @param {boolean} [eager=false] whether to eagerly fetch deferred fields.
     *                                 When false (default), tags are loaded lazily on-demand.
     *                                 When true, all tags are loaded immediately during parsing.
     */
    constructor(source, littleEndian, bigTiff, eager = false) {
        this.source = source;
        this.littleEndian = littleEndian;
        this.bigTiff = bigTiff;
        this.eager = eager;
    }
    /**
     * Helper function to retrieve a DataSlice from the source.
     * @param {number} offset Byte offset of the slice
     * @param {number} [length] Length of the slice
     * @returns {Promise<DataSlice>}
     */
    async getSlice(offset, length) {
        const fallbackLength = this.bigTiff ? 4048 : 1024;
        return new DataSlice((await this.source.fetch([
            {
                offset,
                length: typeof length !== 'undefined' ? length : fallbackLength,
            },
        ]))[0], offset, this.littleEndian, this.bigTiff);
    }
    /**
     * Instructs to parse an image file directory at the given file offset.
     * As there is no way to ensure that a location is indeed the start of an IFD,
     * this function must be called with caution (e.g only using the IFD offsets from
     * the headers or other IFDs).
     * @param {number} offset the offset to parse the IFD at
     * @returns {Promise<ImageFileDirectory>} the parsed IFD
     */
    async parseFileDirectoryAt(offset) {
        const entrySize = this.bigTiff ? 20 : 12;
        const offsetSize = this.bigTiff ? 8 : 2;
        let dataSlice = await this.getSlice(offset);
        const numDirEntries = this.bigTiff
            ? dataSlice.readUint64(offset)
            : dataSlice.readUint16(offset);
        // if the slice does not cover the whole IFD, request a bigger slice, where the
        // whole IFD fits: num of entries + n x tag length + offset to next IFD
        const byteSize = numDirEntries * (entrySize + (this.bigTiff ? 16 : 6));
        if (!dataSlice.covers(offset, byteSize)) {
            dataSlice = await this.getSlice(offset, byteSize);
        }
        const actualizedFields = new Map();
        const deferredFields = new Map();
        const deferredArrays = new Map();
        // loop over the IFD and create a file directory object
        let i = offset + (this.bigTiff ? 8 : 2);
        for (let entryCount = 0; entryCount < numDirEntries; i += entrySize, ++entryCount) {
            const fieldTag = dataSlice.readUint16(i);
            const fieldType = /** @type {import('./globals.js').FieldType} */ (dataSlice.readUint16(i + 2));
            const typeCount = this.bigTiff
                ? dataSlice.readUint64(i + 4)
                : dataSlice.readUint32(i + 4);
            let fieldValues = null;
            let deferredFieldValues = null;
            let deferredArray = null;
            const fieldTypeLength = getFieldTypeSize(fieldType);
            const valueOffset = i + (this.bigTiff ? 12 : 8);
            const isArray = tagDefinitions[fieldTag]?.isArray;
            const eager = tagDefinitions[fieldTag]?.eager || this.eager;
            // check whether the value is directly encoded in the tag or refers to a
            // different external byte range
            if (fieldTypeLength * typeCount <= (this.bigTiff ? 8 : 4)) {
                fieldValues = getValues$1(getArrayForSamples(fieldType, typeCount), getDataSliceReader(dataSlice, fieldType), dataSlice, fieldType, typeCount, valueOffset, isArray);
            }
            else {
                // resolve the reference to the actual byte range
                const actualOffset = dataSlice.readOffset(valueOffset);
                const length = getFieldTypeSize(fieldType) * typeCount;
                // check, whether we actually cover the referenced byte range
                if (dataSlice.covers(actualOffset, length)) {
                    fieldValues = getValues$1(getArrayForSamples(fieldType, typeCount), getDataSliceReader(dataSlice, fieldType), dataSlice, fieldType, typeCount, actualOffset, isArray);
                }
                else if (eager) {
                    // eager evaluation: fetch the data right now
                    // TODO: instead of fetching the slice right here, collect all slices and fetch them together
                    // to allow conjoined requests
                    const fieldDataSlice = await this.getSlice(actualOffset, length);
                    fieldValues = getValues$1(getArrayForSamples(fieldType, typeCount), getDataSliceReader(fieldDataSlice, fieldType), fieldDataSlice, fieldType, typeCount, actualOffset, isArray);
                }
                else if (isArray) {
                    deferredArray = new DeferredArray(this.source, actualOffset, this.littleEndian, fieldType, typeCount);
                }
                else {
                    deferredFieldValues = async () => {
                        const fieldDataSlice = await this.getSlice(actualOffset, length);
                        return getValues$1(getArrayForSamples(fieldType, typeCount), getDataSliceReader(fieldDataSlice, fieldType), fieldDataSlice, fieldType, typeCount, actualOffset, isArray);
                    };
                }
            }
            if (fieldValues !== null) {
                actualizedFields.set(fieldTag, fieldValues);
            }
            else if (deferredFieldValues !== null) {
                deferredFields.set(fieldTag, deferredFieldValues);
            }
            else if (deferredArray !== null) {
                deferredArrays.set(fieldTag, deferredArray);
            }
        }
        const nextIFDByteOffset = dataSlice.readOffset(offset + offsetSize + (entrySize * numDirEntries));
        return new ImageFileDirectory(actualizedFields, deferredFields, deferredArrays, nextIFDByteOffset);
    }
}

/**
 * @param {Uint8Array|Uint16Array|Uint32Array} row
 * @param {number} stride
 */
function decodeRowAcc(row, stride) {
    let length = row.length - stride;
    let offset = 0;
    do {
        for (let i = stride; i > 0; i--) {
            row[offset + stride] += row[offset];
            offset++;
        }
        length -= stride;
    } while (length > 0);
}
/**
 * @param {Uint8Array} row
 * @param {number} stride
 * @param {number} bytesPerSample
 */
function decodeRowFloatingPoint(row, stride, bytesPerSample) {
    let index = 0;
    let count = row.length;
    const wc = count / bytesPerSample;
    while (count > stride) {
        for (let i = stride; i > 0; --i) {
            row[index + stride] += row[index];
            ++index;
        }
        count -= stride;
    }
    const copy = row.slice();
    for (let i = 0; i < wc; ++i) {
        for (let b = 0; b < bytesPerSample; ++b) {
            row[(bytesPerSample * i) + b] = copy[((bytesPerSample - b - 1) * wc) + i];
        }
    }
}
/**
 * @param {ArrayBufferLike} block
 * @param {number} predictor
 * @param {number} width
 * @param {number} height
 * @param {number[]} bitsPerSample
 * @param {number} planarConfiguration
 * @returns
 */
function applyPredictor(block, predictor, width, height, bitsPerSample, planarConfiguration) {
    if (!predictor || predictor === 1) {
        return block;
    }
    for (let i = 0; i < bitsPerSample.length; ++i) {
        if (bitsPerSample[i] % 8 !== 0) {
            throw new Error('When decoding with predictor, only multiple of 8 bits are supported.');
        }
        if (bitsPerSample[i] !== bitsPerSample[0]) {
            throw new Error('When decoding with predictor, all samples must have the same size.');
        }
    }
    const bytesPerSample = bitsPerSample[0] / 8;
    const stride = planarConfiguration === 2 ? 1 : bitsPerSample.length;
    for (let i = 0; i < height; ++i) {
        // Last strip will be truncated if height % stripHeight != 0
        if (i * stride * width * bytesPerSample >= block.byteLength) {
            break;
        }
        let row;
        if (predictor === 2) { // horizontal prediction
            switch (bitsPerSample[0]) {
                case 8:
                    row = new Uint8Array(block, i * stride * width * bytesPerSample, stride * width * bytesPerSample);
                    break;
                case 16:
                    row = new Uint16Array(block, i * stride * width * bytesPerSample, stride * width * bytesPerSample / 2);
                    break;
                case 32:
                    row = new Uint32Array(block, i * stride * width * bytesPerSample, stride * width * bytesPerSample / 4);
                    break;
                default:
                    throw new Error(`Predictor 2 not allowed with ${bitsPerSample[0]} bits per sample.`);
            }
            decodeRowAcc(row, stride);
        }
        else if (predictor === 3) { // horizontal floating point
            row = new Uint8Array(block, i * stride * width * bytesPerSample, stride * width * bytesPerSample);
            decodeRowFloatingPoint(row, stride, bytesPerSample);
        }
    }
    return block;
}

/**
 * @typedef {Object} BaseDecoderParameters
 * @property {number} tileWidth
 * @property {number} tileHeight
 * @property {number} predictor
 * @property {number|number[]|import('../geotiff.js').TypedArray} bitsPerSample
 * @property {number} planarConfiguration
 * @property {number} [samplesPerPixel]
 */
class BaseDecoder {
    /**
     * @param {BaseDecoderParameters} parameters
     */
    constructor(parameters) {
        this.parameters = parameters;
    }
    /**
     * @abstract
     * @param {ArrayBufferLike} _buffer
     * @returns {Promise<ArrayBufferLike>|ArrayBufferLike}
     */
    decodeBlock(_buffer) {
        throw new Error('decodeBlock not implemented');
    }
    /**
     * @param {ArrayBufferLike} buffer
     * @returns {Promise<ArrayBufferLike>}
     */
    async decode(buffer) {
        const decoded = await this.decodeBlock(buffer);
        const { tileWidth, tileHeight, predictor, bitsPerSample, planarConfiguration, } = this.parameters;
        if (predictor !== 1) {
            const isBitsPerSampleArray = Array.isArray(bitsPerSample) || ArrayBuffer.isView(bitsPerSample);
            const adaptedBitsPerSample = isBitsPerSampleArray ? Array.from(bitsPerSample) : [bitsPerSample];
            return applyPredictor(decoded, predictor, tileWidth, tileHeight, adaptedBitsPerSample, planarConfiguration);
        }
        return decoded;
    }
}

/** @module geotiff */
/**
 * @typedef {Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array | Float64Array}
 * TypedArray
 */
/**
 * @typedef {{ height:number, width: number }} Dimensions
 */
/**
 * The autogenerated docs are a little confusing here. The effective type is:
 *
 * `TypedArray & { height: number; width: number}`
 * @typedef {TypedArray & Dimensions} TypedArrayWithDimensions
 */
/**
 * The autogenerated docs are a little confusing here. The effective type is:
 *
 * `TypedArray[] & { height: number; width: number}`
 * @typedef {TypedArray[] & Dimensions} TypedArrayArrayWithDimensions
 */
/**
 * @typedef {Object} GeotiffWriterMetadata
 * @property {number | number[]} [ImageWidth]
 * @property {number | number[]} [ImageLength]
 * @property {number} [width]
 * @property {number} [height]
 * @property {number | number[]} [BitsPerSample]
 * @property {number | number[]} [Compression]
 * @property {number | number[]} [PlanarConfiguration]
 * @property {number | number[]} [ExtraSamples]
 * @property {number | number[]} [PhotometricInterpretation]
 * @property {number | number[]} [SamplesPerPixel]
 * @property {number | number[]} [StripByteCounts]
 * @property {number[]} [ModelPixelScale]
 * @property {number[]} [ModelTransformation]
 * @property {number[]} [ModelTiepoint]
 * @property {number[]} [GeoKeyDirectory]
 * @property {string} [GeoAsciiParams]
 * @property {number[]} [GeoDoubleParams]
 * @property {number | number[]} [Orientation]
 * @property {number | number[]} [ResolutionUnit]
 * @property {number | number[]} [XPosition]
 * @property {number | number[]} [YPosition]
 * @property {number | number[]} [RowsPerStrip]
 * @property {number[]} [SampleFormat]
 * @property {number | number[]} [TileWidth]
 * @property {number | number[]} [TileLength]
 * @property {number[]} [TileOffsets]
 * @property {number[]} [TileByteCounts]
 * @property {string} [GDAL_NODATA]
 * @property {number | number[]} [GeographicTypeGeoKey]
 * @property {number | number[]} [ProjectedCSTypeGeoKey]
 * @property {string} [GeogCitationGeoKey]
 * @property {string} [GTCitationGeoKey]
 * @property {number | number[]} [GTModelTypeGeoKey]
 * @property {number | number[]} [GTRasterTypeGeoKey]
 */
/**
 *  The autogenerated docs are a little confusing here. The effective type is:
 *
 * `(TypedArray | TypedArray[]) & { height: number; width: number}`
 * @typedef {TypedArrayWithDimensions | TypedArrayArrayWithDimensions} ReadRasterResult
 */
/**
 * @typedef {Object} DecoderWorker
 * Use the {@link Pool.bindParameters} method to get a decoder worker for
 * a specific compression and its parameters.
 *
 * @property {(buffer: ArrayBufferLike) => Promise<ArrayBufferLike>} decode
 *   A function that takes a compressed buffer and returns a promise resolving to the decoded buffer.
 */
/**
 * @typedef {Object} ReadRastersOptions
 * @property {Array<number>} [window] the subset to read data from in pixels. Whole window if not specified.
 * @property {Array<number>} [samples] the selection of samples to read from. Default is all samples.
 *     All samples if not specified.
 * @property {Pool|null} [pool=null] The optional decoder pool to use.
 * @property {number} [width] The desired width of the output. When the width is not the
 *                                 same as the images, resampling will be performed.
 * @property {number} [height] The desired height of the output. When the width is not the
 *                                  same as the images, resampling will be performed.
 * @property {string} [resampleMethod='nearest'] The desired resampling method.
 * @property {AbortSignal} [signal] An AbortSignal that may be signalled if the request is
 *                                       to be aborted
 * @property {number|number[]} [fillValue] The value to use for parts of the image
 *     outside of the images extent. When multiple samples are requested and `interleave` is
 *     `false`, an array of fill values can be passed.
 * @property {boolean|true|false} [interleave] whether the data shall be read
 *     in one single array or separate arrays.
 */
/**
 * @typedef {Object} ReadRGBOptions
 * @property {Array<number>} [window] the subset to read data from in pixels. Whole window if not specified.
 * @property {Pool|null} [pool=null] The optional decoder pool to use.
 * @property {number} [width] The desired width of the output. When the width is no the
 *                                 same as the images, resampling will be performed.
 * @property {number} [height] The desired height of the output. When the width is no the
 *                                  same as the images, resampling will be performed.
 * @property {string} [resampleMethod='nearest'] The desired resampling method.
 * @property {boolean} [enableAlpha=false] Enable reading alpha channel if present.
 * @property {AbortSignal} [signal] An AbortSignal that may be signalled if the request is
 *                                       to be aborted
 * @property {boolean|true|false} [interleave] whether the data shall be read
 *     in one single array or separate arrays.
 */
/**
 * @typedef {Object} BlockedSourceOptions
 * @property {number} [blockSize] Block size for a BlockedSource.
 * @property {number} [cacheSize=100] The number of blocks to cache.
 */
/**
 * @typedef {Object} RemoteSourceOptions
 * @property {Record<string, string>} [headers={}] Additional headers to add to each request
 * @property {number} [maxRanges=0] Maximum number of ranges to request in a single HTTP request. 0 means no multi-range requests.
 * @property {boolean} [allowFullFile=false] Whether to allow full file responses when requesting ranges
 * @property {boolean} [forceXHR=false] When the Fetch API would be used, force using XMLHttpRequest instead.
 */
/**
 * @overload
 * @param {DataSlice} dataSlice
 * @param {0x0002} fieldType
 * @param {number} count
 * @param {number} offset
 * @returns {string}
 */
/**
 * @param {DataSlice} dataSlice
 * @param {import('./globals.js').FieldType} fieldType
 * @param {number} count
 * @param {number} offset
 * @returns {TypedArray|Array<number>|string}
 */
function getValues(dataSlice, fieldType, count, offset) {
    /** @type {TypedArray|Array<number>|null} */
    let values = null;
    let readMethod = null;
    const fieldTypeLength = getFieldTypeSize(fieldType);
    switch (fieldType) {
        case fieldTypes.BYTE:
        case fieldTypes.ASCII:
        case fieldTypes.UNDEFINED:
            values = new Uint8Array(count);
            readMethod = dataSlice.readUint8;
            break;
        case fieldTypes.SBYTE:
            values = new Int8Array(count);
            readMethod = dataSlice.readInt8;
            break;
        case fieldTypes.SHORT:
            values = new Uint16Array(count);
            readMethod = dataSlice.readUint16;
            break;
        case fieldTypes.SSHORT:
            values = new Int16Array(count);
            readMethod = dataSlice.readInt16;
            break;
        case fieldTypes.LONG:
        case fieldTypes.IFD:
            values = new Uint32Array(count);
            readMethod = dataSlice.readUint32;
            break;
        case fieldTypes.SLONG:
            values = new Int32Array(count);
            readMethod = dataSlice.readInt32;
            break;
        case fieldTypes.LONG8:
        case fieldTypes.IFD8:
            values = new Array(count);
            readMethod = dataSlice.readUint64;
            break;
        case fieldTypes.SLONG8:
            values = new Array(count);
            readMethod = dataSlice.readInt64;
            break;
        case fieldTypes.RATIONAL:
            values = new Uint32Array(count * 2);
            readMethod = dataSlice.readUint32;
            break;
        case fieldTypes.SRATIONAL:
            values = new Int32Array(count * 2);
            readMethod = dataSlice.readInt32;
            break;
        case fieldTypes.FLOAT:
            values = new Float32Array(count);
            readMethod = dataSlice.readFloat32;
            break;
        case fieldTypes.DOUBLE:
            values = new Float64Array(count);
            readMethod = dataSlice.readFloat64;
            break;
        // will throw below
    }
    if (values === null || readMethod === null) {
        throw new RangeError(`Invalid field type: ${fieldType}`);
    }
    // normal fields
    {
        for (let i = 0; i < count; ++i) {
            values[i] = readMethod.call(dataSlice, offset + (i * fieldTypeLength));
        }
    }
    {
        return new TextDecoder('utf-8').decode(/** @type {Uint8Array} */ (values));
    }
}
/**
 * Error class for cases when an IFD index was requested, that does not exist
 * in the file.
 */
class GeoTIFFImageIndexError extends Error {
    /**
     * @param {number} index
     */
    constructor(index) {
        super(`No image at index ${index}`);
        this.index = index;
    }
}
class GeoTIFFBase {
    /**
     * @param {number} [_index=0] the index of the image to return.
     * @returns {Promise<GeoTIFFImage>} the image at the given index
     */
    async getImage(_index = 0) {
        throw new Error('Not implemented');
    }
    /**
     * @returns {Promise<number>} the number of internal subfile images
     */
    async getImageCount() {
        throw new Error('Not implemented');
    }
    /**
     * @typedef {Object} ReadRastersWindowOptions
     * @property {number} [resX] desired Y resolution (world units per pixel)
     * @property {number} [resY] desired X resolution (world units per pixel)
     * @property {Array<number>} [bbox] the subset to read data from in
     *     geographical coordinates. Whole image if not specified.
     */
    /**
     * (experimental) Reads raster data from the best fitting image. This function uses
     * the image with the lowest resolution that is still a higher resolution than the
     * requested resolution.
     * When specified, the `bbox` option is translated to the `window` option and the
     * `resX` and `resY` to `width` and `height` respectively.
     * Then, the [readRasters]{@link GeoTIFFImage#readRasters} method of the selected
     * image is called and the result returned.
     * @see GeoTIFFImage.readRasters
     * @param {ReadRastersOptions & ReadRastersWindowOptions} options optional parameters
     * @returns {Promise<ReadRasterResult>} the decoded array(s), with `height` and `width`, as a promise
     */
    async readRasters(options = {}) {
        const { window: imageWindow, width, height } = options;
        let { resX, resY, bbox } = options;
        const firstImage = await this.getImage();
        let usedImage = firstImage;
        const imageCount = await this.getImageCount();
        const imgBBox = firstImage.getBoundingBox();
        if (imageWindow && bbox) {
            throw new Error('Both "bbox" and "window" passed.');
        }
        // if width/height is passed, transform it to resolution
        if (width || height) {
            // if we have an image window (pixel coordinates), transform it to a BBox
            // using the origin/resolution of the first image.
            if (imageWindow) {
                const [oX, oY] = firstImage.getOrigin();
                const [rX, rY] = firstImage.getResolution();
                bbox = [
                    oX + (imageWindow[0] * rX),
                    oY + (imageWindow[1] * rY),
                    oX + (imageWindow[2] * rX),
                    oY + (imageWindow[3] * rY),
                ];
            }
            // if we have a bbox (or calculated one)
            const usedBBox = bbox || imgBBox;
            if (width) {
                if (resX) {
                    throw new Error('Both width and resX passed');
                }
                resX = (usedBBox[2] - usedBBox[0]) / width;
            }
            if (height) {
                if (resY) {
                    throw new Error('Both width and resY passed');
                }
                resY = (usedBBox[3] - usedBBox[1]) / height;
            }
        }
        // if resolution is set or calculated, try to get the image with the worst acceptable resolution
        if (resX || resY) {
            const allImages = [];
            for (let i = 0; i < imageCount; ++i) {
                const image = await this.getImage(i);
                const subfileType = image.fileDirectory.getValue('SubfileType');
                const newSubfileType = image.fileDirectory.getValue('NewSubfileType');
                if (i === 0 || subfileType === 2 || (newSubfileType || 0) & 1) {
                    allImages.push(image);
                }
            }
            allImages.sort((a, b) => a.getWidth() - b.getWidth());
            for (let i = 0; i < allImages.length; ++i) {
                const image = allImages[i];
                const imgResX = (imgBBox[2] - imgBBox[0]) / image.getWidth();
                const imgResY = (imgBBox[3] - imgBBox[1]) / image.getHeight();
                usedImage = image;
                if ((resX && resX > imgResX) || (resY && resY > imgResY)) {
                    break;
                }
            }
        }
        let wnd = imageWindow;
        if (bbox) {
            const [oX, oY] = firstImage.getOrigin();
            const [imageResX, imageResY] = usedImage.getResolution(firstImage);
            wnd = [
                Math.round((bbox[0] - oX) / imageResX),
                Math.round((bbox[1] - oY) / imageResY),
                Math.round((bbox[2] - oX) / imageResX),
                Math.round((bbox[3] - oY) / imageResY),
            ];
            wnd = [
                Math.min(wnd[0], wnd[2]),
                Math.min(wnd[1], wnd[3]),
                Math.max(wnd[0], wnd[2]),
                Math.max(wnd[1], wnd[3]),
            ];
        }
        return usedImage.readRasters({ ...options, window: wnd });
    }
}
/**
 * @typedef {Object} GeoTIFFOptions
 * @property {boolean} [cache=false] whether or not decoded tiles shall be cached.
 */
/**
 * The abstraction for a whole GeoTIFF file.
 */
class GeoTIFF extends GeoTIFFBase {
    /**
     * @constructor
     * @param {BaseSource} source The datasource to read from.
     * @param {boolean} littleEndian Whether the image uses little endian.
     * @param {boolean} bigTiff Whether the image uses bigTIFF conventions.
     * @param {number} firstIFDOffset The numeric byte-offset from the start of the image
     *                                to the first IFD.
     * @param {GeoTIFFOptions} [options] further options.
     */
    constructor(source, littleEndian, bigTiff, firstIFDOffset, options = {}) {
        super();
        this.source = source;
        this.parser = new ImageFileDirectoryParser(source, littleEndian, bigTiff, false);
        this.littleEndian = littleEndian;
        this.bigTiff = bigTiff;
        this.firstIFDOffset = firstIFDOffset;
        this.cache = options.cache || false;
        /** @type {Array<Promise<import('./imagefiledirectory.js').ImageFileDirectory> | undefined>} */
        this.ifdRequests = [];
        /** @type {Record<string, unknown>|null} */
        this.ghostValues = null;
    }
    /**
     * @param {number} offset
     * @param {number} [size]
     * @returns {Promise<DataSlice>}
     */
    async getSlice(offset, size) {
        const fallbackSize = this.bigTiff ? 4048 : 1024;
        return new DataSlice((await this.source.fetch([{
                offset,
                length: typeof size !== 'undefined' ? size : fallbackSize,
            }]))[0], offset, this.littleEndian, this.bigTiff);
    }
    /**
     * @param {number} index
     * @return {Promise<import('./imagefiledirectory.js').ImageFileDirectory>}
     */
    async requestIFD(index) {
        // see if we already have that IFD index requested.
        if (this.ifdRequests[index]) {
            // attach to an already requested IFD
            return this.ifdRequests[index];
        }
        else if (index === 0) {
            // special case for index 0
            this.ifdRequests[index] = this.parser.parseFileDirectoryAt(this.firstIFDOffset);
            return this.ifdRequests[index];
        }
        else if (!this.ifdRequests[index - 1]) {
            // if the previous IFD was not yet loaded, load that one first
            // this is the recursive call.
            try {
                this.ifdRequests[index - 1] = this.requestIFD(index - 1);
            }
            catch (e) {
                // if the previous one already was an index error, rethrow
                // with the current index
                if (e instanceof GeoTIFFImageIndexError) {
                    throw new GeoTIFFImageIndexError(index);
                }
                // rethrow anything else
                throw e;
            }
        }
        // if the previous IFD was loaded, we can finally fetch the one we are interested in.
        // we need to wrap this in an IIFE, otherwise this.ifdRequests[index] would be delayed
        this.ifdRequests[index] = (async () => {
            const previousPromise = this.ifdRequests[index - 1];
            if (!previousPromise) {
                throw new Error('Previous IFD request missing');
            }
            const previousIfd = await previousPromise;
            if (previousIfd.nextIFDByteOffset === 0) {
                throw new GeoTIFFImageIndexError(index);
            }
            return this.parser.parseFileDirectoryAt(previousIfd.nextIFDByteOffset);
        })();
        return this.ifdRequests[index];
    }
    /**
     * Get the n-th internal subfile of an image. By default, the first is returned.
     *
     * @param {number} [index=0] the index of the image to return.
     * @returns {Promise<GeoTIFFImage>} the image at the given index
     */
    async getImage(index = 0) {
        return new GeoTIFFImage(await this.requestIFD(index), this.littleEndian, this.cache, this.source);
    }
    /**
     * Returns the count of the internal subfiles.
     *
     * @returns {Promise<number>} the number of internal subfile images
     */
    async getImageCount() {
        let index = 0;
        // loop until we run out of IFDs
        let hasNext = true;
        while (hasNext) {
            try {
                await this.requestIFD(index);
                ++index;
            }
            catch (e) {
                if (e instanceof GeoTIFFImageIndexError) {
                    hasNext = false;
                }
                else {
                    throw e;
                }
            }
        }
        return index;
    }
    /**
     * Get the values of the COG ghost area as a parsed map.
     * See https://gdal.org/drivers/raster/cog.html#header-ghost-area for reference
     * @returns {Promise<Record<string, unknown>|null>} the parsed ghost area or null, if no such area was found
     */
    async getGhostValues() {
        const offset = this.bigTiff ? 16 : 8;
        if (this.ghostValues !== null) {
            return this.ghostValues;
        }
        const detectionString = 'GDAL_STRUCTURAL_METADATA_SIZE=';
        const heuristicAreaSize = detectionString.length + 100;
        let slice = await this.getSlice(offset, heuristicAreaSize);
        if (detectionString === getValues(slice, fieldTypes.ASCII, detectionString.length, offset)) {
            const valuesString = getValues(slice, fieldTypes.ASCII, heuristicAreaSize, offset);
            const firstLine = valuesString.split('\n')[0];
            const metadataSize = Number(firstLine.split('=')[1].split(' ')[0]) + firstLine.length;
            if (metadataSize > heuristicAreaSize) {
                slice = await this.getSlice(offset, metadataSize);
            }
            const fullString = getValues(slice, fieldTypes.ASCII, metadataSize, offset);
            /** @type {Record<string, unknown>} */
            const ghostValues = {};
            fullString
                .split('\n')
                .filter((line) => line.length > 0)
                .map((line) => line.split('='))
                .forEach(([key, value]) => {
                ghostValues[key] = value;
            });
            this.ghostValues = ghostValues;
        }
        return this.ghostValues;
    }
    /**
     * Parse a (Geo)TIFF file from the given source.
     *
     * @param {BaseSource} source The source of data to parse from.
     * @param {GeoTIFFOptions} [options] Additional options.
     * @param {AbortSignal} [signal] An AbortSignal that may be signalled if the request is
     *                               to be aborted
     */
    static async fromSource(source, options, signal) {
        const headerData = (await source.fetch([{ offset: 0, length: 1024 }], signal))[0];
        const dataView = new DataView64(headerData);
        const BOM = dataView.getUint16(0, false);
        let littleEndian;
        if (BOM === 0x4949) {
            littleEndian = true;
        }
        else if (BOM === 0x4D4D) {
            littleEndian = false;
        }
        else {
            throw new TypeError('Invalid byte order value.');
        }
        const magicNumber = dataView.getUint16(2, littleEndian);
        let bigTiff;
        if (magicNumber === 42) {
            bigTiff = false;
        }
        else if (magicNumber === 43) {
            bigTiff = true;
            const offsetByteSize = dataView.getUint16(4, littleEndian);
            if (offsetByteSize !== 8) {
                throw new Error('Unsupported offset byte-size.');
            }
        }
        else {
            throw new TypeError('Invalid magic number.');
        }
        const firstIFDOffset = bigTiff
            ? dataView.getUint64(8, littleEndian)
            : dataView.getUint32(4, littleEndian);
        return new GeoTIFF(source, littleEndian, bigTiff, firstIFDOffset, options);
    }
    /**
     * Closes the underlying file buffer
     * N.B. After the GeoTIFF has been completely processed it needs
     * to be closed but only if it has been constructed from a file.
     */
    close() {
        if (typeof this.source.close === 'function') {
            return this.source.close();
        }
        return false;
    }
}
/**
 * Creates a new GeoTIFF from a remote URL.
 * @param {string} url The URL to access the image from
 * @param {RemoteSourceOptions} [options] Additional options to pass to the source.
 *                           See {@link makeRemoteSource} for details.
 * @param {AbortSignal} [signal] An AbortSignal that may be signalled if the request is
 *                               to be aborted
 * @returns {Promise<GeoTIFF>} The resulting GeoTIFF file.
 */
async function fromUrl(url, options = {}, signal) {
    return GeoTIFF.fromSource(makeRemoteSource(url, options), undefined, signal);
}
/**
 * Construct a GeoTIFF from an HTML
 * [Blob]{@link https://developer.mozilla.org/en-US/docs/Web/API/Blob} or
 * [File]{@link https://developer.mozilla.org/en-US/docs/Web/API/File}
 * object.
 * @param {Blob|File} blob The Blob or File object to read from.
 * @param {AbortSignal} [signal] An AbortSignal that may be signalled if the request is
 *                               to be aborted
 * @returns {Promise<GeoTIFF>} The resulting GeoTIFF file.
 */
async function fromBlob(blob, signal) {
    return GeoTIFF.fromSource(makeFileReaderSource(blob), undefined, signal);
}

// TIFF LZW (compression 5), as libtiff decodes it - registered by
// tiff-reader.js in place of geotiff.js's own decoder, whose table holds
// 4093 codes instead of 4096: streams whose writer fills the table before
// clearing it (imagecodecs, used by tifffile and many microscope and CT
// exports) run past it and fail with "Invalid array length".
//
// Codes are read most significant bit first, 9 to 12 bits wide, widened
// one code early ("early change"); 256 clears the table, 257 ends.

const CLEAR = 256;
const END = 257;
const FIRST = 258;
const TABLE = 4096;
const MAX_BITS = 12;

function decompressLzw(input, expectedLength = 0) {
  const prefix = new Uint16Array(TABLE);
  const suffix = new Uint8Array(TABLE);
  const length = new Uint16Array(TABLE);
  for (let i = 0; i < 256; i += 1) {
    suffix[i] = i;
    length[i] = 1;
  }
  let output = new Uint8Array(Math.max(expectedLength, input.length * 2, 1024));
  let size = 0;
  let next = FIRST;
  let bits = 9;
  let previous = -1;
  let bitPosition = 0;
  const totalBits = input.length * 8;

  const reserve = (count) => {
    if (size + count <= output.length) return;
    const grown = new Uint8Array(Math.max(output.length * 2, size + count));
    grown.set(output.subarray(0, size));
    output = grown;
  };
  // Writes the string of code, last character first, back to front.
  const emit = (code) => {
    const count = length[code];
    reserve(count);
    for (let at = size + count - 1, c = code; at >= size; at -= 1) {
      output[at] = suffix[c];
      c = prefix[c];
    }
    size += count;
    return output[size - count];
  };
  const add = (code, character) => {
    if (next >= TABLE) return;
    prefix[next] = code;
    suffix[next] = character;
    length[next] = length[code] + 1;
    next += 1;
  };

  while (bitPosition + bits <= totalBits) {
    let code = 0;
    for (let i = 0; i < bits; i += 1, bitPosition += 1) {
      code = (code << 1) | ((input[bitPosition >> 3] >> (7 - (bitPosition & 7))) & 1);
    }
    if (code === END) break;
    if (code === CLEAR) {
      next = FIRST;
      bits = 9;
      previous = -1;
      continue;
    }
    if (previous === -1) {
      if (code > 255) throw new Error(`Corrupt LZW data: code ${code} after a clear`);
      emit(code);
    } else if (code < next) {
      add(previous, emit(code));
    } else if (code === next) {
      // The code being defined: the previous string plus its own first character.
      const first = emit(previous);
      reserve(1);
      output[size] = first;
      size += 1;
      add(previous, first);
    } else {
      throw new Error(`Corrupt LZW data: code ${code} past the table (${next})`);
    }
    previous = code;
    if (next >= (1 << bits) - 1 && bits < MAX_BITS) bits += 1;
  }
  return output.subarray(0, size);
}

class LzwDecoder extends BaseDecoder {
  decodeBlock(buffer) {
    const { tileWidth, tileHeight, bitsPerSample, samplesPerPixel = 1, planarConfiguration } = this.parameters;
    const bits = Array.isArray(bitsPerSample) || ArrayBuffer.isView(bitsPerSample) ? bitsPerSample[0] : bitsPerSample;
    const samples = planarConfiguration === 2 ? 1 : samplesPerPixel;
    const expected = Math.ceil((tileWidth * tileHeight * samples * (bits || 8)) / 8);
    const decoded = decompressLzw(new Uint8Array(buffer), expected);
    return decoded.buffer.slice(decoded.byteOffset, decoded.byteOffset + decoded.byteLength);
  }
}

// geotiff.js's LZW decoder fails on full code tables (tiff-lzw.js).
addDecoder(5, async () => LzwDecoder);

// TIFF image stacks read in the browser, without the worker - the same
// files as worker/tiff_stack.py: multi-page TIFFs, ImageJ hyperstacks,
// OME-TIFF, Zeiss LSM, and slices one file each (a .zip of them, unpacked by
// extract-helper.js). Decoded by geotiff.js (all compressions, BigTIFF,
// tiles), a page at a time: from the File, or by HTTP range requests.
//
// openTiff() reads the first page's description (main thread: OME-XML
// needs DOMParser) and returns a manifest of the same shape as the worker's;
// the pages of a stack are read, averaged down to MAX_SIZE voxels per axis
// and mapped to 8 bits in a Web Worker (tiff-volume-worker.js).
//
// Pixel types: 8/16-bit integers are kept as they are, signed 16-bit (CT
// in Hounsfield units) shifted; 32-bit and float values are scaled between
// the minimum and maximum of a sample of pages, NaN as the lowest.

const MAX_SIZE = 512;
const SAMPLE_PAGES = 16;
const PALETTE = ["#00ff00", "#ff00ff", "#00ffff", "#ffff00", "#ff0000", "#0000ff"];
const UNIT_TO_MICRONS = { m: 1e6, cm: 1e4, mm: 1e3, um: 1, "µm": 1, micron: 1, microns: 1, nm: 1e-3 };
const RESOLUTION_CENTIMETER = 3;
const FORMAT_INT = 2;
const FORMAT_FLOAT = 3;

const micronsPer = (unit) => (unit ? UNIT_TO_MICRONS[String(unit).trim().toLowerCase().replace("μ", "µ").replace("\\u00b5", "µ")] ?? null : null);
const defaultColors = (count) => (count === 1 ? ["#ffffff"] : Array.from({ length: count }, (_v, i) => PALETTE[i % PALETTE.length]));

function openTiffSource(source) {
  return source.file ? fromBlob(source.file) : fromUrl(source.url);
}

function rational(value) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return value[1] ? value[0] / value[1] : 0;
  return Number(value) || 0;
}

// µm per pixel in x and y from the page's resolution, in `unitScale` µm per
// unit (ImageJ), else only for a resolution in centimetres (inches are
// usually a meaningless 72 dpi).
async function resolutionSize(image, unitScale = null) {
  const directory = image.fileDirectory;
  const x = rational(await directory.loadValue("XResolution"));
  const y = rational(await directory.loadValue("YResolution"));
  if (!(x > 0) || !(y > 0)) return null;
  if (unitScale) return [unitScale / x, unitScale / y];
  if (Number(await directory.loadValue("ResolutionUnit")) !== RESOLUTION_CENTIMETER) return null;
  return [1e4 / x, 1e4 / y];
}

function voxel(xy, z) {
  if (xy && xy[0] > 0 && xy[1] > 0) return { voxelSize: [xy[0], xy[1], z > 0 ? z : xy[0]], unit: "µm" };
  return { voxelSize: [1, 1, 1], unit: "px" };
}

function imagejInfo(description) {
  const info = {};
  description.split(/\r?\n/).forEach((line) => {
    const at = line.indexOf("=");
    if (at > 0) info[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  });
  return info;
}

// The images of an OME-XML: sizes, page order, voxel size, channels.
function omeImages(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return [];
  const byLocalName = (root, name) => Array.from(root.getElementsByTagNameNS("*", name));
  const instruments = new Map(byLocalName(doc, "Instrument").map((i) => [i.getAttribute("ID"), i]));
  let firstPage = 0;
  return byLocalName(doc, "Image").map((image) => {
    const pixels = byLocalName(image, "Pixels")[0];
    if (!pixels) return null;
    const size = (axis) => Number(pixels.getAttribute(`Size${axis}`)) || 1;
    const physical = (axis) => {
      const value = Number(pixels.getAttribute(`PhysicalSize${axis}`));
      const scale = micronsPer(pixels.getAttribute(`PhysicalSize${axis}Unit`) || "µm");
      return value > 0 && scale ? value * scale : null;
    };
    const channels = byLocalName(pixels, "Channel").map((channel) => {
      const raw = channel.getAttribute("Color");
      let color = null;
      if (raw !== null) {
        const rgba = Number(raw) >>> 0;
        color = `#${[24, 16, 8].map((shift) => ((rgba >>> shift) & 255).toString(16).padStart(2, "0")).join("")}`;
        if (color === "#000000") color = null;
      }
      return { name: channel.getAttribute("Name") || channel.getAttribute("Fluor") || "", color };
    });
    // The image's first page: its TiffData's IFD, else after the previous image.
    const ifd = byLocalName(pixels, "TiffData")[0]?.getAttribute("IFD");
    const start = ifd != null ? Number(ifd) : firstPage;
    const counts = { Z: size("Z"), C: size("C"), T: size("T") };
    firstPage = start + counts.Z * counts.C * counts.T;
    const acquisition = {};
    const date = byLocalName(image, "AcquisitionDate")[0]?.textContent;
    if (date) acquisition.acquired = date;
    const instrument = instruments.get(byLocalName(image, "InstrumentRef")[0]?.getAttribute("ID"));
    if (instrument) {
      const objective = byLocalName(instrument, "Objective")[0];
      const name = [objective?.getAttribute("Manufacturer"), objective?.getAttribute("Model")].filter(Boolean).join(" ");
      if (name) acquisition.objective = name;
      if (objective?.getAttribute("LensNA")) acquisition.numericalAperture = Number(objective.getAttribute("LensNA"));
      const microscope = byLocalName(instrument, "Microscope")[0];
      const system = [microscope?.getAttribute("Manufacturer"), microscope?.getAttribute("Model")].filter(Boolean).join(" ");
      if (system) acquisition.system = system;
    }
    return {
      name: image.getAttribute("Name") || "",
      counts,
      // "XYZCT" -> Z fastest, then C, then T.
      order: (pixels.getAttribute("DimensionOrder") || "XYZCT").slice(2),
      start,
      xy: [physical("X"), physical("Y")],
      z: physical("Z"),
      channels,
      acquisition,
    };
  }).filter(Boolean);
}

// Zeiss LSM (LSM 510/710/880 confocals): a TIFF whose pages alternate a
// plane - all channels, as samples - and its thumbnail; the CZ_LSMINFO tag
// (34412) holds the sizes and the voxel size in metres.
const LSM_TAG = 34412;
const LSM_MAGIC = [0x00300494c, 0x00400494c];

async function lsmInfo(image) {
  if (!image.fileDirectory.hasTag(LSM_TAG)) return null;
  const raw = await image.fileDirectory.loadValue(LSM_TAG);
  const bytes = raw && typeof raw !== "number" ? Uint8Array.from(raw) : null;
  if (!bytes || bytes.length < 64) return null;
  const view = new DataView(bytes.buffer);
  if (!LSM_MAGIC.includes(view.getUint32(0, true))) return null;
  const int = (at) => view.getInt32(at, true);
  const size = [40, 48, 56].map((at) => view.getFloat64(at, true) * 1e6);
  return {
    nx: int(8), ny: int(12), nz: int(16), channels: int(20), frames: int(24),
    voxel: size.every((s) => s > 0 && Number.isFinite(s)) ? size : null,
  };
}

// Zeiss writes the BitsPerSample of two channels - which fit in the tag -
// as an offset to them all the same; tifffile corrects it the same way.
const BITS_PER_SAMPLE = 258;
async function fixLsmBits(image) {
  const directory = image.fileDirectory;
  const bits = directory.getValue(BITS_PER_SAMPLE);
  if (!bits || bits.length !== 2 || (bits[0] === bits[1] && [8, 16, 32].includes(bits[0]))) return;
  const [buffer] = await image.source.fetch([{ offset: bits[0] + bits[1] * 65536, length: 4 }]);
  const view = new DataView(buffer);
  directory.actualizedFields.set(BITS_PER_SAMPLE, [view.getUint16(0, true), view.getUint16(2, true)]);
}

// Page of (z, c) when the pages run in `order` (e.g. "ZCT") over counts.
function pageLayout(order, counts, start) {
  const steps = {};
  let step = 1;
  for (const axis of order) {
    steps[axis] = step;
    step *= counts[axis] || 1;
  }
  return { start, zStep: steps.Z || 1, cStep: steps.C || 0 };
}

function series({ name, nx, ny, nz, channels, voxelSize, unit, frames = 1, acquisition = {}, layout }) {
  const factors = [nz, ny, nx].map((n) => Math.max(1, Math.ceil(n / MAX_SIZE)));
  const [oz, oy, ox] = [nz, ny, nx].map((n, i) => Math.ceil(n / factors[i]));
  return {
    id: name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "stack",
    name,
    path: name,
    dims: [ox, oy, oz],
    sourceDims: [nx, ny, nz],
    voxelSize: voxelSize.map((v, i) => Number((v * factors[2 - i]).toPrecision(6))),
    unit,
    frames,
    channels,
    acquisition,
    layout: { ...layout, shape: [nz, ny, nx], factors },
  };
}

// The manifest of the TIFF in source ({ file } or { url }); `siblings` are
// the other files unpacked from the same archive, for a stack of slices.
async function describeTiff(source, fileName, siblings = null) {
  const tiff = await openTiffSource(source);
  const image = await tiff.getImage(0);
  const nx = image.getWidth();
  const ny = image.getHeight();
  const samples = image.getSamplesPerPixel();
  const lsm = await lsmInfo(image);
  if (lsm) await fixLsmBits(image);
  const pixel = { format: image.getSampleFormat(), bits: image.getBitsPerSample() };
  if (pixel.format === FORMAT_FLOAT && pixel.bits === 16) throw new Error("16-bit float TIFFs are not supported");
  // Writers end it with a NUL, which DOMParser refuses.
  const description = String((await image.fileDirectory.loadValue("ImageDescription")) || "").replace(/\0+$/, "");
  const base = fileName.replace(/\.ome\.tiff?$|\.tiff?$|\.lsm$/i, "");
  const manifest = { format: "dfg-volume", version: 1, source: fileName, series: [], skipped: [] };
  const channelList = (count, meta = [], fallback = base) => {
    const colors = defaultColors(count);
    return Array.from({ length: count }, (_v, c) => ({
      name: meta[c]?.name || (count > 1 ? `Channel ${c + 1}` : fallback),
      color: meta[c]?.color || colors[c],
      bits: pixel.bits,
    }));
  };

  if (lsm) {
    // A thumbnail after every plane, unless the file was saved without.
    const count = await tiff.getImageCount();
    const step = count >= 2 * lsm.nz * lsm.frames ? 2 : 1;
    if (lsm.nz < 2) {
      manifest.skipped.push({ name: base, path: base, reason: "a single plane, not a stack" });
    } else {
      manifest.series.push(series({
        name: base,
        nx,
        ny,
        nz: lsm.nz,
        channels: channelList(samples),
        ...voxel(lsm.voxel?.slice(0, 2), lsm.voxel?.[2]),
        frames: Math.max(1, lsm.frames),
        layout: { pixel, lsm: true, channels: Array.from({ length: samples }, (_v, c) => ({ start: 0, sample: c })), zStep: step },
      }));
    }
  } else if (description.includes("<OME")) {
    omeImages(description).forEach((ome, index) => {
      const name = ome.name || (index ? `${base} ${index + 1}` : base);
      if (ome.counts.Z < 2) {
        manifest.skipped.push({ name, path: name, reason: "a single plane, not a stack" });
        return;
      }
      const channelCount = samples > 1 ? samples : ome.counts.C;
      const pages = pageLayout(ome.order, ome.counts, ome.start);
      manifest.series.push(series({
        name,
        nx,
        ny,
        nz: ome.counts.Z,
        channels: channelList(channelCount, ome.channels, name),
        ...voxel(ome.xy, ome.z),
        frames: ome.counts.T,
        acquisition: ome.acquisition,
        layout: {
          pixel,
          channels: Array.from({ length: channelCount }, (_v, c) => (
            samples > 1 ? { start: pages.start, sample: c } : { start: pages.start + c * pages.cStep, sample: 0 }
          )),
          zStep: pages.zStep,
        },
      }));
    });
  } else if (description.startsWith("ImageJ=")) {
    const info = imagejInfo(description);
    const channels = Number(info.channels) || 1;
    const frames = Number(info.frames) || 1;
    const slices = Number(info.slices) || Math.floor((Number(info.images) || 1) / (channels * frames));
    const scale = micronsPer(info.unit);
    if (slices < 2) {
      manifest.skipped.push({ name: base, path: base, reason: "a single plane, not a stack" });
    } else {
      const channelCount = samples > 1 ? samples : channels;
      manifest.series.push(series({
        name: base,
        nx,
        ny,
        nz: slices,
        channels: channelList(channelCount),
        ...voxel(scale ? await resolutionSize(image, scale) : null, scale && Number(info.spacing) ? Number(info.spacing) * scale : null),
        frames,
        // Hyperstack pages: channel fastest, then slice, then frame.
        layout: {
          pixel,
          channels: Array.from({ length: channelCount }, (_v, c) => (samples > 1 ? { start: 0, sample: c } : { start: c, sample: 0 })),
          zStep: samples > 1 ? 1 : channels,
        },
      }));
    }
  } else {
    const count = await tiff.getImageCount();
    const slices = count === 1 && siblings ? slicesNextTo(fileName, siblings, (name) => /\.tiff?$/i.test(name)) : null;
    const xy = await resolutionSize(image);
    if (slices && slices.length >= 2) {
      const folder = fileName.split("/").slice(-2, -1)[0] || base;
      // A SkyScan reconstruction log next to them says the voxel size.
      const logged = await skyscanPixelSize(fileName, siblings);
      manifest.series.push(series({
        name: folder,
        nx,
        ny,
        nz: slices.length,
        channels: channelList(samples, [], folder),
        ...(logged ? voxel([logged, logged], logged) : voxel(xy, null)),
        layout: { pixel, slices: true, channels: Array.from({ length: samples }, (_v, c) => ({ start: 0, sample: c })), zStep: 1 },
      }));
      manifest.slices = slices;
    } else if (count < 2) {
      manifest.skipped.push({ name: base, path: base, reason: "a single plane, not a stack" });
    } else {
      manifest.series.push(series({
        name: base,
        nx,
        ny,
        nz: count,
        channels: channelList(samples),
        ...voxel(xy, null),
        layout: { pixel, channels: Array.from({ length: samples }, (_v, c) => ({ start: 0, sample: c })), zStep: 1 },
      }));
    }
  }
  if (!manifest.series.length) {
    const reasons = manifest.skipped.slice(0, 5).map((s) => `${s.name}: ${s.reason}`).join("; ");
    throw new Error(`No image stack (Z series) in ${fileName} to show in 3D${reasons ? ` (${reasons})` : ""}`);
  }
  manifest.series.sort((a, b) => b.sourceDims[2] - a.sourceDims[2]);
  return manifest;
}

// Reading a stack (Web Worker or main thread).

// The value -> level (0..levels-1) mapping of a channel, and back.
async function levelsFor(pixel, readPlane, nz) {
  if (pixel.format !== FORMAT_FLOAT && pixel.bits <= 8) {
    const shift = pixel.format === FORMAT_INT ? 128 : 0;
    return { levels: 256, toLevel: (v) => v + shift, toValue: (l) => l - shift };
  }
  if (pixel.format !== FORMAT_FLOAT && pixel.bits === 16) {
    const shift = pixel.format === FORMAT_INT ? 32768 : 0;
    return { levels: 65536, toLevel: (v) => v + shift, toValue: (l) => l - shift };
  }
  // 32-bit and float: between the extremes of a sample of planes.
  let min = Infinity;
  let max = -Infinity;
  const step = Math.max(1, Math.floor(nz / SAMPLE_PAGES));
  for (let z = 0; z < nz; z += step) {
    const plane = await readPlane(z);
    for (let i = 0; i < plane.length; i += 1) {
      const v = plane[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!(max > min)) max = min + 1;
  const scale = 65535 / (max - min);
  return {
    levels: 65536,
    toLevel: (v) => (Number.isNaN(v) ? 0 : Math.min(65535, Math.max(0, (v - min) * scale))),
    toValue: (l) => Math.round((min + l / scale) * 1000) / 1000,
  };
}

// The 8-bit voxels of one stack (channel by channel, x fastest), with each
// channel's value range (in the file's units) and Otsu threshold.
async function readTiffVolume(source, layout, { onProgress } = {}) {
  const [nz, ny, nx] = layout.shape;
  const [fz, fy, fx] = layout.factors;
  const oz = Math.ceil(nz / fz);
  const oy = Math.ceil(ny / fy);
  const ox = Math.ceil(nx / fx);
  const voxels = ox * oy * oz;
  const out = new Uint8Array(voxels * layout.channels.length);
  const cellCount = cellCounts(ny, nx, fy, fx);
  const tiffs = layout.slices
    ? await Promise.all(source.slices.map((file) => fromBlob(file)))
    : [await openTiffSource(source)];
  const channels = [];
  let planesDone = 0;

  for (let c = 0; c < layout.channels.length; c += 1) {
    const { start, sample } = layout.channels[c];
    const readPlane = async (z) => {
      const image = layout.slices
        ? await tiffs[z].getImage(0)
        : await tiffs[0].getImage(start + z * layout.zStep);
      if (layout.lsm) await fixLsmBits(image);
      return (await image.readRasters({ samples: [sample] }))[0];
    };
    const { levels, toLevel, toValue } = await levelsFor(layout.pixel, readPlane, nz);
    const means = levels === 256 ? new Uint8Array(voxels) : new Uint16Array(voxels);
    const histogram = new Float64Array(levels);
    const sums = new Float32Array(oy * ox);
    for (let k = 0; k < oz; k += 1) {
      sums.fill(0);
      const zEnd = Math.min(nz, (k + 1) * fz);
      for (let z = k * fz; z < zEnd; z += 1) {
        const plane = await readPlane(z);
        for (let y = 0; y < ny; y += 1) {
          const row = y * nx;
          const cellRow = Math.floor(y / fy) * ox;
          for (let x = 0; x < nx; x += 1) sums[cellRow + Math.floor(x / fx)] += toLevel(plane[row + x]);
        }
        planesDone += 1;
        onProgress?.({ loaded: planesDone, total: nz * layout.channels.length });
      }
      const depth = zEnd - k * fz;
      const planeOut = k * oy * ox;
      for (let i = 0; i < oy * ox; i += 1) {
        const value = Math.round(sums[i] / (cellCount[i] * depth));
        means[planeOut + i] = value;
        histogram[value] += 1;
      }
    }
    const { low, high, threshold } = finishChannel(means, histogram, out.subarray(c * voxels, (c + 1) * voxels));
    channels.push({ range: [toValue(low), toValue(high)], threshold });
  }
  return { bytes: out, channels };
}

// A TIFF from a File/Blob ({ file }) or a URL ({ url }), with the other
// files of its archive (siblings, for a stack of slices): its manifest, and
// loadSeries(index) for the voxels of a stack.
async function openTiff(source, fileName, siblings = null) {
  const manifest = await describeTiff(source, fileName, siblings);
  const slices = manifest.slices;
  delete manifest.slices;
  const readSource = slices ? { slices } : source;
  return {
    manifest,
    async loadSeries(index, { onProgress } = {}) {
      const stack = manifest.series[index];
      const result = await runVolumeWorker(
        () => new Worker(new URL(new URL('tiff-volume-worker-Dtsw37bp.js', import.meta.url).href), { type: "module" }),
        { source: readSource, layout: stack.layout },
        () => readTiffVolume(readSource, stack.layout, { onProgress }),
        onProgress,
      );
      result.channels.forEach((channel, c) => Object.assign(stack.channels[c], channel));
      return result.bytes;
    },
  };
}

var tiffReader = /*#__PURE__*/Object.freeze({
  __proto__: null,
  MAX_SIZE: MAX_SIZE,
  describeTiff: describeTiff,
  openTiff: openTiff,
  readTiffVolume: readTiffVolume
});

export { BaseDecoder as B, LercAddCompression as L, LercParameters as a, readTiffVolume as r, tiffReader as t };
//# sourceMappingURL=tiff-reader-P36s-vLk.js.map
