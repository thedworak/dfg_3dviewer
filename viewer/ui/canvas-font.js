// Text drawn on a canvas (badges, the ground's compass and scale bar) in the
// interface's typeface (css/fonts.css). A canvas draws with whatever font is
// loaded at that moment, so a texture painted before Inter arrives is painted
// again once it has.

export const CANVAS_FONT_FAMILY = 'Inter, system-ui, Arial, sans-serif';

// A canvas `font` value: canvasFont(600, 48) -> "600 48px Inter, ...".
export function canvasFont(weight, sizePx) {
  return `${weight} ${sizePx}px ${CANVAS_FONT_FAMILY}`;
}

// Weights the canvases use; loaded together so one wait covers them all.
const WEIGHTS = [400, 600, 700];
let fontReady = null;

// Both of Inter's files (Latin and Latin Extended: Polish letters).
const SAMPLE = 'Aa1 ąęłńóśźż';

function interFaces() {
  const fonts = typeof document !== 'undefined' ? document.fonts : null;
  if (!fonts?.forEach) return [];
  const faces = [];
  fonts.forEach((face) => {
    if (face.family.replace(/["']/g, '') === 'Inter') faces.push(face);
  });
  return faces;
}

function uiFontReady() {
  if (fontReady) return fontReady;
  const fonts = typeof document !== 'undefined' ? document.fonts : null;
  if (!fonts?.load) {
    fontReady = Promise.resolve(false);
    return fontReady;
  }
  fontReady = Promise.all(WEIGHTS.map((weight) => fonts.load(canvasFont(weight, 16), SAMPLE)))
    .then((faces) => faces.some((list) => list.length > 0))
    .catch(() => false);
  return fontReady;
}

// Not document.fonts.check(): Chromium answers true for a face that has not
// been loaded yet. No Inter declared (a page without css/fonts.css) counts as
// loaded: there is nothing to wait for.
function uiFontLoaded() {
  const faces = interFaces();
  return faces.length === 0 || faces.every((face) => face.status === 'loaded');
}

// Paints `paint(ctx, width, height)` on the texture's canvas now and, if
// Inter was not loaded yet, once more when it is (unless the texture has
// been disposed by then).
export function paintCanvasText(texture, paint) {
  const canvas = texture.image;
  const ctx = canvas.getContext('2d');
  const draw = () => {
    ctx.save();
    paint(ctx, canvas.width, canvas.height);
    ctx.restore();
    texture.needsUpdate = true;
  };
  draw();
  if (uiFontLoaded()) return texture;

  let disposed = false;
  texture.addEventListener?.('dispose', () => { disposed = true; });
  uiFontReady().then((loaded) => {
    if (!loaded || disposed) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    draw();
  });
  return texture;
}
