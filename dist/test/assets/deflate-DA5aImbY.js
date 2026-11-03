import { i as inflate_1 } from './pako.esm-haeRBHLP.js';
import { B as BaseDecoder } from './tiff-reader-DKascw0f.js';
import './_node-resolve_empty-BPaRBzhC.js';
import './volume-voxels-CI6ldnye.js';
import './slice-stack-HPsHxT3J.js';

class DeflateDecoder extends BaseDecoder {
    /** @param {ArrayBuffer} buffer */
    decodeBlock(buffer) {
        return inflate_1(new Uint8Array(buffer)).buffer;
    }
}

export { DeflateDecoder as default };
//# sourceMappingURL=deflate-Do8xgEzy.js.map
