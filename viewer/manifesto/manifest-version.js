// The version of the AIM3D manifest format (AIM3DViewer.version), and what a
// viewer makes of a manifest written for another one. No DOM here: this also
// runs in Node (the tests, scripts/).
//
// "MAJOR.MINOR":
// - MINOR grows with additions an older viewer can skip (a new block, a new
//   key): it still opens the manifest, without what it does not know, and
//   says that a newer viewer shows all of it;
// - MAJOR grows when an older viewer would read the manifest wrongly: it
//   does not open it, and asks for the viewer to be updated.
// A manifest is written with the version of the viewer that writes it.
// Without a version (or with one that is no "MAJOR.MINOR") it is read as
// one of this viewer's own.
//
// Keep in sync with AIM3D_MANIFEST_VERSION in blender/aim3d_iiif/manifest.py
// and the "Versions" section of AIM3DViewer-schema.md.
export const AIM3D_MANIFEST_VERSION = "1.2";

const VERSION_PATTERN = /^\s*v?(\d+)(?:\.(\d+))?(?:\.\d+)*\s*$/i;

// "1.2" / "1" / 1.2 -> { major, minor }; anything else -> null.
export function parseManifestVersion(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) value = String(value);
  if (typeof value !== "string") return null;
  const match = VERSION_PATTERN.exec(value);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2] ?? 0) };
}

export function compareManifestVersions(a, b) {
  const left = typeof a === "object" && a ? a : parseManifestVersion(a);
  const right = typeof b === "object" && b ? b : parseManifestVersion(b);
  if (!left || !right) return 0;
  return left.major - right.major || left.minor - right.minor;
}

// What this viewer makes of the manifest's version:
//   { version, supported, state, newer, blocking }
// state: "current" | "older" | "newer" (MINOR ahead: opens, with less) |
// "incompatible" (MAJOR ahead: does not open) | "unversioned" (none, or not
// "MAJOR.MINOR"). `newer`: a newer viewer is wanted (newer or incompatible);
// `blocking`: this one cannot open it.
export function manifestVersionStatus(manifestOrVersion, supported = AIM3D_MANIFEST_VERSION) {
  const raw = manifestOrVersion != null && typeof manifestOrVersion === "object"
    ? manifestOrVersion.AIM3DViewer?.version
    : manifestOrVersion;
  const version = raw == null ? null : String(raw);
  const own = parseManifestVersion(supported);
  const parsed = parseManifestVersion(raw);
  let state = "unversioned";
  if (parsed && own) {
    if (parsed.major > own.major) state = "incompatible";
    else if (parsed.major === own.major && parsed.minor > own.minor) state = "newer";
    else if (parsed.major === own.major && parsed.minor === own.minor) state = "current";
    else state = "older";
  }
  return {
    version,
    supported,
    state,
    newer: state === "newer" || state === "incompatible",
    blocking: state === "incompatible",
  };
}

// Thrown by the manifest loader (manifesto-api.js) when this viewer cannot
// open a manifest of a newer format: `status` is manifestVersionStatus(),
// `detail` the validator's errors, if those were the reason.
export class ManifestVersionError extends Error {
  constructor(status, detail = "") {
    super(
      `This AIM3D manifest is of format version ${status.version}; this viewer reads up to ${status.supported}. Update the viewer to open it.`
      + (detail ? `\n${detail}` : ""),
    );
    this.name = "ManifestVersionError";
    this.status = status;
    this.detail = detail;
  }
}
