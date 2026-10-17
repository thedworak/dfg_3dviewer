import { core } from "./core.js";

// On-screen diagnostics for devices without developer tools at hand (phones):
// ?gldebug=1 shows the GPU, its WebGL limits, the console's errors and
// warnings (three.js shader errors among them) and the camera and point
// cloud state, refreshed every second - for a screenshot. Off by default;
// nothing below runs without the parameter.

const ENABLED = new URLSearchParams(window.location.search).has("gldebug");
const MAX_MESSAGES = 12;
const messages = [];

function remember(level, args) {
  const text = args
    .map((arg) => (arg instanceof Error ? `${arg.message}` : typeof arg === "object" ? safeJson(arg) : String(arg)))
    .join(" ")
    // three's shader errors carry the whole numbered source: the error lines suffice.
    .split("\n")
    .filter((line, index) => index < 2 || /ERROR|error|warning/i.test(line))
    .join("\n")
    .slice(0, 400);
  messages.push(`${level}: ${text}`);
  if (messages.length > MAX_MESSAGES) messages.shift();
}

function safeJson(value) {
  try {
    return JSON.stringify(value).slice(0, 200);
  } catch {
    return String(value);
  }
}

function webglInfo() {
  const gl = core.renderer?.getContext?.();
  if (!gl?.getParameter) return ["WebGL: none"];
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const highp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  const pointRange = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
  return [
    `GPU: ${debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)}`,
    `WebGL2: ${typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext}`
      + ` float RT: ${Boolean(gl.getExtension("EXT_color_buffer_float"))}`
      + ` half RT: ${Boolean(gl.getExtension("EXT_color_buffer_half_float"))}`,
    `point size: ${pointRange ? `${pointRange[0]}-${pointRange[1]}` : "?"}`
      + ` frag highp: ${highp?.precision ?? 0}`
      + ` vert uniforms: ${gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)}`,
    `buffer: ${gl.drawingBufferWidth}x${gl.drawingBufferHeight} dpr ${window.devicePixelRatio}`
      + ` lost: ${gl.isContextLost()}`,
  ];
}

function sceneInfo() {
  const camera = core.camera;
  if (!camera) return ["camera: none"];
  const round = (vector) => vector.toArray().map((value) => Number(value.toFixed(2))).join(", ");
  const lines = [
    `camera: ${round(camera.position)} near ${camera.near.toFixed(3)} far ${camera.far.toFixed(1)}`,
    `target: ${core.controls?.target ? round(core.controls.target) : "?"}`
      + ` hint: ${core.handHint ? !core.handHint.hidden : "-"} gesture: ${Boolean(core.GESTURE?.active)}`,
  ];
  let clouds = 0;
  let drawn = 0;
  const materials = new Set();
  core.scene?.traverse((child) => {
    if (!child.isPoints) return;
    clouds += 1;
    if (child.visible) {
      const count = child.geometry.getAttribute("position")?.count || 0;
      drawn += Math.min(count, child.geometry.drawRange.count);
    }
    const material = child.material;
    materials.add(`${material?.type}${material?.isPointCloudMaterial ? ` size ${Number(material.size).toFixed(3)}`
      + ` min ${material.minPointSize} edl ${material.edlStrength} ${material.pointShape}` : ""}`);
  });
  lines.push(`points: ${clouds} objects, ${drawn} points`);
  materials.forEach((material) => lines.push(`material: ${material}`));
  const info = core.renderer?.info;
  if (info) lines.push(`render: ${info.render.calls} calls, ${info.render.points} points, ${info.programs?.length ?? "?"} programs`);
  return lines;
}

function render(panel) {
  panel.textContent = [...webglInfo(), ...sceneInfo(), "--- console ---", ...messages].join("\n");
}

// Called first thing in main.js (a bare import would be tree-shaken).
export function installDebugOverlay() {
  if (!ENABLED) return;
  ["error", "warn"].forEach((level) => {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      remember(level, args);
      original(...args);
    };
  });
  window.addEventListener("error", (event) => remember("error", [event.error || event.message]));
  window.addEventListener("unhandledrejection", (event) => remember("rejection", [event.reason]));

  const panel = document.createElement("pre");
  panel.id = "glDebugOverlay";
  Object.assign(panel.style, {
    position: "fixed",
    left: "4px",
    right: "4px",
    top: "4px",
    zIndex: "100000",
    maxHeight: "60vh",
    overflow: "auto",
    margin: "0",
    padding: "6px",
    font: "10px/1.3 monospace",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "#e6ffe6",
    background: "rgba(0, 0, 0, 0.75)",
    pointerEvents: "none",
  });
  const attach = () => {
    document.body.appendChild(panel);
    render(panel);
    setInterval(() => render(panel), 1000);
  };
  if (document.body) attach();
  else window.addEventListener("DOMContentLoaded", attach);
}
