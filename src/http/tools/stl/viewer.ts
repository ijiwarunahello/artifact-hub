export interface StlViewerOptions {
  artifactId: string;
  src: string;
}

export function renderStlViewerHtml(opts: StlViewerOptions): string {
  const initial = JSON.stringify({
    artifactId: opts.artifactId,
    src: opts.src,
  }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>STL Preview</title>
<style>${STYLE}</style>
</head>
<body>
<header class="bar">
  <div class="brand">stl preview</div>
  <div class="info" id="info"></div>
</header>
<main class="stage">
  <div class="empty" id="empty">
    <div>
      <span class="glyph">&gt;</span>
      drop an .stl file here, or pass ?artifact=&lt;id&gt; / ?src=&lt;url&gt;
    </div>
  </div>
  <div class="error" id="error" hidden></div>
  <canvas id="canvas" hidden></canvas>
</main>
<script>window.__STL_INITIAL = ${initial};</script>
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
  }
}
</script>
<script type="module">${CLIENT_JS}</script>
</body>
</html>`;
}

const STYLE = `
:root {
  color-scheme: light dark;
  --bg: #fff;
  --fg: #111;
  --muted: #777;
  --line: #e5e5e5;
  --accent: #1450ff;
  --row: #fafafa;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Inter", sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f0f10;
    --fg: #e6e6e6;
    --muted: #888;
    --line: #2a2a2c;
    --accent: #6e88ff;
    --row: #141416;
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; background: var(--bg); color: var(--fg); overflow: hidden; }
.bar {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--line);
}
.brand { font-weight: 600; letter-spacing: 0.02em; }
.info { font-size: 12px; color: var(--muted); }
.stage {
  position: relative;
  height: calc(100% - 44px);
  background: var(--row);
}
.empty, .error {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--muted);
  font-size: 13px;
  text-align: center;
  padding: 24px;
}
.empty .glyph {
  display: block;
  font-size: 28px;
  color: var(--line);
  margin-bottom: 12px;
  font-weight: 300;
}
.error { color: #b00; }
canvas { display: block; width: 100%; height: 100%; }
.dragover .stage::after {
  content: "";
  position: absolute;
  inset: 8px;
  border: 1px dashed var(--accent);
  pointer-events: none;
}
`;

const CLIENT_JS = `
import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const initial = window.__STL_INITIAL || { artifactId: "", src: "" };
const canvas = document.getElementById("canvas");
const empty = document.getElementById("empty");
const errorEl = document.getElementById("error");
const infoEl = document.getElementById("info");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
const scene = new THREE.Scene();
const isDark = matchMedia("(prefers-color-scheme: dark)").matches;
scene.background = new THREE.Color(isDark ? 0x141416 : 0xfafafa);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

const ambient = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambient);
const key = new THREE.DirectionalLight(0xffffff, 0.7);
key.position.set(1, 1, 1);
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.25);
fill.position.set(-1, -0.5, -0.6);
scene.add(fill);

let mesh = null;
const loader = new STLLoader();

function resize() {
  const w = canvas.clientWidth || canvas.parentElement.clientWidth;
  const h = canvas.clientHeight || canvas.parentElement.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

function tick() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function showError(msg) {
  empty.hidden = true;
  canvas.hidden = true;
  errorEl.hidden = false;
  errorEl.textContent = msg;
}

function showCanvas() {
  empty.hidden = true;
  errorEl.hidden = true;
  canvas.hidden = false;
  resize();
}

function fitCamera(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const fov = camera.fov * (Math.PI / 180);
  const distance = (maxDim / 2) / Math.tan(fov / 2) * 1.8;
  camera.near = Math.max(0.01, distance / 1000);
  camera.far = distance * 100;
  camera.position.set(center.x + distance, center.y + distance * 0.6, center.z + distance);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
  return { size, center, maxDim };
}

function setMesh(geometry, label, sizeBytes) {
  if (mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  geometry.computeBoundingBox();
  geometry.center();
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    color: 0x9aa0a6,
    metalness: 0.1,
    roughness: 0.7,
    flatShading: false,
  });
  mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  fitCamera(mesh);
  showCanvas();
  const verts = geometry.attributes.position
    ? geometry.attributes.position.count
    : 0;
  const sizeText = sizeBytes != null ? formatBytes(sizeBytes) : "";
  infoEl.textContent = [label, verts ? verts.toLocaleString() + " verts" : "", sizeText]
    .filter(Boolean)
    .join(" · ");
}

function formatBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 / 1024).toFixed(2) + " MB";
}

async function loadFromUrl(url, label) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed: " + res.status);
    const buf = await res.arrayBuffer();
    const geometry = loader.parse(buf);
    setMesh(geometry, label, buf.byteLength);
  } catch (err) {
    showError("failed to load: " + err.message);
  }
}

function loadFromFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const buf = e.target.result;
      const geometry = loader.parse(buf);
      setMesh(geometry, file.name, file.size);
    } catch (err) {
      showError("failed to parse: " + err.message);
    }
  };
  reader.onerror = () => showError("failed to read file");
  reader.readAsArrayBuffer(file);
}

window.addEventListener("dragenter", (e) => {
  e.preventDefault();
  document.body.classList.add("dragover");
});
window.addEventListener("dragover", (e) => {
  e.preventDefault();
});
window.addEventListener("dragleave", (e) => {
  if (e.target === document || e.target === document.body) {
    document.body.classList.remove("dragover");
  }
});
window.addEventListener("drop", (e) => {
  e.preventDefault();
  document.body.classList.remove("dragover");
  const file = e.dataTransfer && e.dataTransfer.files[0];
  if (file) loadFromFile(file);
});

resize();
tick();

if (initial.artifactId) {
  loadFromUrl("/api/artifacts/" + encodeURIComponent(initial.artifactId) + "/content", initial.artifactId);
} else if (initial.src) {
  loadFromUrl(initial.src, initial.src);
}
`;
