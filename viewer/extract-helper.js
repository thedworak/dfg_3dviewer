import { unzipSync } from 'fflate';
import { loadDroppedModel } from "./sandbox.js";
import { core } from "./core.js";
import { toastHelper } from './viewer-utils.js';
import { isDicomFile, modelExtension } from "./model-extension.js";

let archiveFileMap = {};

async function extractZip (archiveFile) {
  const buffer = await archiveFile.arrayBuffer();

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

function findMainModelFile (files) {
  const priority = core.SUPPORTED_EXTENSIONS;

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