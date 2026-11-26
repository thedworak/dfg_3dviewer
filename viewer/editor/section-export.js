import THREE from "../init.js";

// A section as a drawing: where a plane cuts the model's faces, as lines on
// the plane, kept where every other cutting plane keeps the model, drawn in
// an SVG with a scale bar in metres and a title - a section to print or to
// take into a drawing program.

const VIEW_WIDTH = 1200;
const MARGIN = 48;

// 1, 2 or 5 times a power of ten, not above `value`.
function niceBelow(value) {
  const power = 10 ** Math.floor(Math.log10(value));
  const unit = value / power;
  return (unit >= 5 ? 5 : unit >= 2 ? 2 : 1) * power;
}

function formatMeters(meters) {
  if (meters >= 1000) return `${meters / 1000} km`;
  if (meters >= 1) return `${meters} m`;
  if (meters >= 0.01) return `${Math.round(meters * 1000) / 10} cm`;
  return `${Math.round(meters * 1e6) / 1000} mm`;
}

function escapeXml(text) {
  return String(text).replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]);
}

// Two directions along the plane: for a world axis, the drawing's right and
// up as one would look at that section; else any pair.
export function sectionBasis(normal) {
  const n = normal.clone().normalize();
  const up = Math.abs(n.y) > 0.9 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(up, n).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  return { u, v };
}

// Clips the segment a-b to the kept side (distance >= 0) of each plane;
// null when nothing is left.
function clipSegment(a, b, planes) {
  let start = a;
  let end = b;
  for (const plane of planes) {
    const da = plane.distanceToPoint(start);
    const db = plane.distanceToPoint(end);
    if (da < 0 && db < 0) return null;
    if (da >= 0 && db >= 0) continue;
    const t = da / (da - db);
    const cut = start.clone().lerp(end, t);
    if (da < 0) start = cut;
    else end = cut;
  }
  return [start, end];
}

// The segments where `plane` cuts the meshes under `roots` (world
// coordinates), each clipped by `others`.
export function computeSectionSegments(roots, plane, others = []) {
  const segments = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const instanceMatrix = new THREE.Matrix4();
  const matrix = new THREE.Matrix4();
  const cutTriangle = (p0, p1, p2) => {
    const d0 = plane.distanceToPoint(p0);
    const d1 = plane.distanceToPoint(p1);
    const d2 = plane.distanceToPoint(p2);
    const points = [];
    [[p0, d0, p1, d1], [p1, d1, p2, d2], [p2, d2, p0, d0]].forEach(([pa, da, pb, db]) => {
      if ((da > 0 && db < 0) || (da < 0 && db > 0)) points.push(pa.clone().lerp(pb, da / (da - db)));
      else if (da === 0) points.push(pa.clone());
    });
    if (points.length < 2) return;
    const segment = clipSegment(points[0], points[1], others);
    if (segment) segments.push(segment);
  };
  roots.forEach((root) => root?.traverse?.((object) => {
    if (!object.isMesh || !object.visible || object.userData?.noClipping || object.userData?.isVolume) return;
    const position = object.geometry?.getAttribute?.("position");
    if (!position) return;
    const index = object.geometry.getIndex();
    const count = index ? index.count : position.count;
    const instances = object.isInstancedMesh ? object.count : 1;
    for (let instance = 0; instance < instances; instance += 1) {
      matrix.copy(object.matrixWorld);
      if (object.isInstancedMesh) {
        object.getMatrixAt(instance, instanceMatrix);
        matrix.multiply(instanceMatrix);
      }
      for (let i = 0; i + 2 < count; i += 3) {
        const i0 = index ? index.getX(i) : i;
        const i1 = index ? index.getX(i + 1) : i + 1;
        const i2 = index ? index.getX(i + 2) : i + 2;
        a.fromBufferAttribute(position, i0).applyMatrix4(matrix);
        b.fromBufferAttribute(position, i1).applyMatrix4(matrix);
        c.fromBufferAttribute(position, i2).applyMatrix4(matrix);
        cutTriangle(a, b, c);
      }
    }
  }));
  return segments;
}

// The SVG text of a section: `segments` from computeSectionSegments,
// `basis` ({ u, v }) the drawing's right and up, `metersPerUnit` for the
// scale bar, `title` and `subtitle` under it.
export function buildSectionSvg(segments, { basis, metersPerUnit = 1, title = "", subtitle = "" }) {
  const flat = segments.map(([p, q]) => [p.dot(basis.u), p.dot(basis.v), q.dot(basis.u), q.dot(basis.v)]);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  flat.forEach(([x1, y1, x2, y2]) => {
    minX = Math.min(minX, x1, x2);
    maxX = Math.max(maxX, x1, x2);
    minY = Math.min(minY, y1, y2);
    maxY = Math.max(maxY, y1, y2);
  });
  if (!flat.length) {
    minX = minY = 0;
    maxX = maxY = 1;
  }
  const width = Math.max(maxX - minX, 1e-9);
  const height = Math.max(maxY - minY, 1e-9);
  const scale = (VIEW_WIDTH - MARGIN * 2) / width;
  const drawingHeight = height * scale;
  const footer = 70;
  const viewHeight = Math.round(drawingHeight + MARGIN * 2 + footer);
  const x = (value) => (MARGIN + (value - minX) * scale).toFixed(2);
  // Up in the drawing is up on the page.
  const y = (value) => (MARGIN + (maxY - value) * scale).toFixed(2);
  const path = flat.map(([x1, y1, x2, y2]) => `M${x(x1)} ${y(y1)}L${x(x2)} ${y(y2)}`).join("");

  // The scale bar: a round length about a fifth of the drawing, in five parts.
  const widthMeters = width * metersPerUnit;
  const barMeters = niceBelow(widthMeters / 5);
  const barLength = (barMeters / metersPerUnit) * scale;
  const barY = viewHeight - footer + 22;
  const parts = Array.from({ length: 5 }, (_, i) => `<rect x="${(MARGIN + (barLength / 5) * i).toFixed(2)}" y="${barY}" width="${(barLength / 5).toFixed(2)}" height="6" fill="${i % 2 ? "#fff" : "#111"}" stroke="#111" stroke-width="1"/>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${VIEW_WIDTH}" height="${viewHeight}" viewBox="0 0 ${VIEW_WIDTH} ${viewHeight}" font-family="system-ui, sans-serif">
  <rect width="100%" height="100%" fill="#fff"/>
  <path d="${path}" fill="none" stroke="#111" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <g>
    ${parts}
    <text x="${MARGIN}" y="${barY - 6}" font-size="12" fill="#111">0</text>
    <text x="${(MARGIN + barLength).toFixed(2)}" y="${barY - 6}" font-size="12" fill="#111" text-anchor="middle">${escapeXml(formatMeters(barMeters))}</text>
    <text x="${VIEW_WIDTH - MARGIN}" y="${barY + 2}" font-size="15" font-weight="600" fill="#111" text-anchor="end">${escapeXml(title)}</text>
    <text x="${VIEW_WIDTH - MARGIN}" y="${barY + 20}" font-size="12" fill="#555" text-anchor="end">${escapeXml(subtitle)}</text>
  </g>
</svg>
`;
}

export function downloadSvg(svg, fileName) {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
