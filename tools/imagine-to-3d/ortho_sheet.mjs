// Four orthographic MeshBasic views of an installed glb, plus a 720×1600 phone sheet.
// Headless three.js. toneMapped false, flipY false. No staging HTML is left behind.
//
//   node tools/imagine-to-3d/ortho_sheet.mjs \
//     --glb /workspace/kc-staging/zb-tower3/objects1/vision/tower.glb \
//     --albedo /workspace/kc-staging/zb-tower3/objects1/vision/albedo.png \
//     --key /workspace/i23d-auto/zoneb-tower-vision/vision/key-crop.jpg \
//     --out steps/tower-fix3-1012
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => {
  if (x.startsWith("--")) a.push([x.slice(2), arr[i + 1]]);
  return a;
}, []));
const glb = resolve(args.glb);
const albedo = resolve(args.albedo);
const key = resolve(args.key);
const out = resolve(args.out);
const base = "http://127.0.0.1:8996/tower3-1010";
mkdirSync(out, { recursive: true });
const stagingHtml = "/workspace/kc-staging/zb-tower3/.ortho-sheet.html";
const html = `<!doctype html><meta charset="utf-8"><canvas id="c"></canvas><script type="module">
import * as THREE from ${JSON.stringify(base + "/three.module.js")};
import { GLTFLoader } from ${JSON.stringify(base + "/objects1/jsm/loaders/GLTFLoader.js")};
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("c"), antialias: true, alpha: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
const tex = await new Promise((res, rej) => new THREE.TextureLoader().load(${JSON.stringify(base + "/objects1/vision/albedo.png?v=fusion14")}, res, undefined, rej));
tex.flipY = false;
tex.colorSpace = THREE.SRGBColorSpace;
tex.wrapS = THREE.ClampToEdgeWrapping;
tex.wrapT = THREE.ClampToEdgeWrapping;
tex.needsUpdate = true;
const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide });
const gltf = await new GLTFLoader().loadAsync(${JSON.stringify(base + "/objects1/vision/tower.glb?v=fusion14")});
const root = gltf.scene;
root.traverse((o) => { if (o.isMesh) o.material = mat; });
scene.add(root);
const box = new THREE.Box3().setFromObject(root);
const center = box.getCenter(new THREE.Vector3());
const size = box.getSize(new THREE.Vector3());
const span = Math.max(size.x, size.y, size.z);
function frame(dir) {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, span * 8);
  const eye = center.clone().add(new THREE.Vector3(dir[0], dir[1], dir[2]).multiplyScalar(span * 2));
  cam.position.copy(eye);
  cam.up.set(0, 1, 0);
  cam.lookAt(center);
  cam.updateMatrixWorld(true);
  const inv = cam.matrixWorldInverse;
  const v = new THREE.Vector3();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const xs = [box.min.x, box.max.x], ys = [box.min.y, box.max.y], zs = [box.min.z, box.max.z];
  for (const x of xs) for (const y of ys) for (const z of zs) {
    v.set(x, y, z).applyMatrix4(inv);
    x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
    y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
  }
  const pad = 0.04 * Math.max(x1 - x0, y1 - y0);
  cam.left = x0 - pad; cam.right = x1 + pad; cam.bottom = y0 - pad; cam.top = y1 + pad;
  cam.updateProjectionMatrix();
  return cam;
}
const views = {
  front: [0, 0, 1],
  right: [1, 0, 0],
  back: [0, 0, -1],
  left: [-1, 0, 0],
};
window.__shots = {};
for (const [name, dir] of Object.entries(views)) {
  const w = name === "front" ? 720 : 480;
  const h = name === "front" ? 1066 : 640;
  renderer.setSize(w, h, false);
  renderer.render(scene, frame(dir));
  window.__shots[name] = renderer.domElement.toDataURL("image/jpeg", 0.92);
}
window.__done = true;
</script>`;
writeFileSync(stagingHtml, html);

const pwPaths = [process.env.OG_PLAYWRIGHT, "/workspace/playtest/node_modules/playwright/index.mjs"].filter(Boolean);
let chromium;
for (const p of pwPaths) {
  try { ({ chromium } = await import(p)); break; } catch (e) {}
}
if (!chromium) throw new Error("playwright not found");
const browser = await chromium.launch({ args: ["--use-gl=swiftshader"] });
let shots;
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 1100 } });
  page.on("pageerror", (err) => process.stderr.write("pageerror " + err.message + "\n"));
  page.on("console", (msg) => { if (msg.type() === "error") process.stderr.write("console " + msg.text() + "\n"); });
  await page.goto(base + "/.ortho-sheet.html", { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForFunction(() => window.__done === true, null, { timeout: 120000 });
  shots = await page.evaluate(() => window.__shots);
} finally {
  await browser.close();
  rmSync(stagingHtml, { force: true });
}
for (const [name, url] of Object.entries(shots)) {
  const buf = Buffer.from(url.split(",")[1], "base64");
  writeFileSync(resolve(out, `.ortho-${name}.jpg`), buf);
}
const py = `
import sys
sys.path.insert(0, ${JSON.stringify(resolve("tools/grok-native"))})
from PIL import Image
import numpy as np, sheet
out = ${JSON.stringify(out)}
names = ["front", "right", "back", "left"]
tiles = [np.asarray(Image.open(out + "/.ortho-" + n + ".jpg").convert("RGB")) for n in names]
h = max(t.shape[0] for t in tiles)
w = sum(t.shape[1] for t in tiles)
canvas = np.full((h, w, 3), 18, np.uint8)
x = 0
for t in tiles:
    canvas[:t.shape[0], x:x+t.shape[1]] = t
    x += t.shape[1]
Image.fromarray(canvas).save(out + "/turnaround.jpg", quality=92)
import cv2
front_bgr = cv2.imread(out + "/.ortho-front.jpg")
key_bgr = cv2.imread(${JSON.stringify(key)})
phone = sheet.sheet_phone(front_bgr, front_bgr, key_bgr)
cv2.imwrite(out + "/sheet-phone.jpg", phone)
print("turnaround", canvas.shape, "phone", phone.shape)
`;
const r = spawnSync("python3", ["-c", py], { encoding: "utf8" });
if (r.status !== 0) {
  process.stderr.write(r.stderr || r.stdout || "sheet failed");
  process.exit(r.status || 1);
}
process.stdout.write(r.stdout || "");
for (const name of ["front", "right", "back", "left"]) rmSync(resolve(out, `.ortho-${name}.jpg`), { force: true });
