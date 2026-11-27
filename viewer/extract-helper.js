import { loadDroppedModel } from "./sandbox.js";
import { core } from "./core.js";
import { toastHelper } from './viewer-utils.js';
import { isDicomFile, modelExtension } from "./model-extension.js";
import { naturalKey, skyscanPixelSize } from "./slice-stack.js";
import { isImageSlice } from "./image-slices-reader.js";
import { isImageFileName } from "./image-metadata.js";

let archiveFileMap = {};

async function extractZip (archiveFile) {
  const buffer = await archiveFile.arrayBuffer();

  // Downloaded the first time a .zip is opened.
  const { unzipSync } = await import("fflate");
  const unzipped = unzipSync(new Uint8Array(buffer));

  const files = [];

  Object.entries(unzipped).forEach(([path, data]) => {
    // Skip folders
    if (path.endsWith('/')) {
      return;
    }

    files.push(
      new File(
        [data],
        path,
        {
          type: 'application/octet-stream'
        }
      )
    );
  });

  return files;
};

function cleanupArchiveUrls() {
  Object.values(archiveFileMap).forEach(url => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {}
  });

  archiveFileMap = {};
};

function buildArchiveFileMap (files) {
  cleanupArchiveUrls();

  files.forEach(file => {
    const normalized = file.name.replace(/^\/+/, '');
    archiveFileMap[normalized] = URL.createObjectURL(file);
  });
};

export async function loadDroppedArchive (archiveFile) {
  try {
    const extension = archiveFile.name.split('.').pop().toLowerCase();

    let extractedFiles = [];

    switch (extension) {
      case 'zip':
        extractedFiles = await extractZip(archiveFile);
        break;

      default:
        throw new Error(`Unsupported archive type: ${extension}`);
    }

    if (!extractedFiles.length) {
      throw new Error('Archive is empty');
    }

    let modelFile = findMainModelFile(extractedFiles);
    // Else a DICOM series, its files often without an extension (IM0001...).
    let modelFormat;
    if (!modelFile) {
      for (const file of extractedFiles) {
        if (await isDicomFile(file)) {
          modelFile = file;
          modelFormat = 'dcm';
          break;
        }
      }
    }

    // Else images: slices one image each (PNG, JPEG, BMP - micro-CT
    // exports), the folder with the most of one kind - or a set of photos
    // (image2d.js). Images next to a model are its textures, found above.
    core.archiveImageMode = null;
    if (!modelFile) {
      const slice = findImageSlices(extractedFiles);
      if (slice && await isSliceStack(slice, extractedFiles)) {
        modelFile = slice;
        core.archiveImageMode = "slices";
      } else {
        modelFile = imageSet(extractedFiles)[0] || null;
        if (modelFile) core.archiveImageMode = "set";
      }
      if (modelFile) modelFormat = modelExtension(modelFile.name);
    }

    if (!modelFile) {
      throw new Error('No supported model file found in archive');
    }

    buildArchiveFileMap(extractedFiles);
    core.archiveFiles = extractedFiles;

    await loadDroppedModel(modelFile, modelFormat);
    return true;

  } catch (err) {
    console.error(err);

    toastHelper("unsupportedFormat", "error");
    return false;
  }
};

function findImageSlices (files) {
  const groups = new Map();
  files.filter((file) => isImageSlice(file.name)).forEach((file) => {
    const key = file.name.replace(/[^/]*$/, '') + '|' + modelExtension(file.name).replace('jpeg', 'jpg');
    groups.set(key, [...(groups.get(key) || []), file]);
  });
  const largest = [...groups.values()].sort((a, b) => b.length - a.length)[0];
  if (!largest || largest.length < 2) return null;
  return largest.sort((a, b) => naturalKey(a.name).localeCompare(naturalKey(b.name)))[0];
}

// The images of an archive (or of files dropped together), in natural name
// order, hidden files (__MACOSX/, .DS_Store...) left out.
export function imageSet (files) {
  return files
    .filter((file) => isImageFileName(file.name) && !/(^|\/)(__MACOSX\/|\.)/.test(file.name))
    .sort((a, b) => naturalKey(a.name).localeCompare(naturalKey(b.name)));
}

// Whether images of one kind in one folder are the slices of a scan, not a
// set of photos: a SkyScan reconstruction log next to them, or at least
// SLICE_STACK_MIN of them, grey and of one size (the first, the middle and
// the last one looked at).
const SLICE_STACK_MIN = 8;
async function isSliceStack (first, files) {
  if (await skyscanPixelSize(first.name, files).catch(() => null)) return true;
  const kind = modelExtension(first.name).replace('jpeg', 'jpg');
  const folder = first.name.replace(/[^/]*$/, '');
  const group = files
    .filter((file) => isImageSlice(file.name) && file.name.replace(/[^/]*$/, '') === folder && modelExtension(file.name).replace('jpeg', 'jpg') === kind)
    .sort((a, b) => naturalKey(a.name).localeCompare(naturalKey(b.name)));
  if (group.length < SLICE_STACK_MIN) return false;
  try {
    const looks = await Promise.all([group[0], group[group.length >> 1], group[group.length - 1]].map(async (file) => {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 24;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(bitmap, 0, 0, 24, 24);
      const pixels = context.getImageData(0, 0, 24, 24).data;
      let grey = true;
      for (let i = 0; i < pixels.length && grey; i += 4) {
        grey = Math.abs(pixels[i] - pixels[i + 1]) <= 3 && Math.abs(pixels[i + 1] - pixels[i + 2]) <= 3;
      }
      const look = { size: `${bitmap.width}x${bitmap.height}`, grey };
      bitmap.close();
      return look;
    }));
    return looks.every((look) => look.grey && look.size === looks[0].size);
  } catch {
    return false;
  }
}

function findMainModelFile (files) {
  // Images are the textures of a model, or a set (above), not the model.
  const priority = core.SUPPORTED_EXTENSIONS.filter((extension) => !isImageFileName(`x.${extension}`));

  for (const ext of priority) {
    const found = files.find(file => {
      const fileExt = modelExtension(file.name);
      return fileExt === ext;
    });

    if (found) {
      return found;
    }
  }

  return null;
};

function resolveArchiveUrl (url) {
  if (!url) {
    return url;
  }

  const clean = url
    .replace(/^(\.\/)+/, '')
    .replace(/^\/+/, '');

  return archiveFileMap[clean] || url;
};