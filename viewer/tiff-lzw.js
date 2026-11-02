import { BaseDecoder } from "geotiff";

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

export function decompressLzw(input, expectedLength = 0) {
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

export default class LzwDecoder extends BaseDecoder {
  decodeBlock(buffer) {
    const { tileWidth, tileHeight, bitsPerSample, samplesPerPixel = 1, planarConfiguration } = this.parameters;
    const bits = Array.isArray(bitsPerSample) || ArrayBuffer.isView(bitsPerSample) ? bitsPerSample[0] : bitsPerSample;
    const samples = planarConfiguration === 2 ? 1 : samplesPerPixel;
    const expected = Math.ceil((tileWidth * tileHeight * samples * (bits || 8)) / 8);
    const decoded = decompressLzw(new Uint8Array(buffer), expected);
    return decoded.buffer.slice(decoded.byteOffset, decoded.byteOffset + decoded.byteLength);
  }
}
