// Unreal-look features 2-6. Colours arrive from look.json, sampled from Imagine images.
function assetUrl(image) {
  if (!image) return null;
  if (image.startsWith("./") || image.startsWith("../") || image.startsWith("/")) return image;
  if (image.startsWith("bake/") || image.startsWith("env")) return "./look/" + image;
  return "./" + image;
}

function bitmap(url) {
  return fetch(url).then((r) => {
    if (!r.ok) throw new Error(url + " " + r.status);
    return r.blob();
  }).then((b) => createImageBitmap(b));
}

export async function installBake(ctx, feat) {
  const ground = ctx.ground;
  const slot = ground && ground.material && ground.material.uniforms && ground.material.uniforms.uGroundTex;
  if (!slot || !feat.plates || !feat.plates.length || !feat.size) return { ok: false, reason: "no bake" };
  const size = feat.size;
  const depth = feat.plates.length;
  const data = new Uint8Array(size * size * 4 * depth);
  for (let i = 0; i < depth; i++) {
    const bmp = await bitmap(assetUrl(feat.plates[i]));
    if (bmp.width !== size || bmp.height !== size) return { ok: false, reason: "bake size" };
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(bmp, 0, 0);
    data.set(g.getImageData(0, 0, size, size).data, i * size * size * 4);
  }
  const tex = new ctx.THREE.DataArrayTexture(data, size, size, depth);
  tex.format = ctx.THREE.RGBAFormat;
  tex.type = ctx.THREE.UnsignedByteType;
  tex.colorSpace = ctx.THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = ctx.THREE.RepeatWrapping;
  tex.magFilter = ctx.THREE.LinearFilter;
  tex.minFilter = ctx.THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  slot.value = tex;
  return { ok: true, layers: depth, size };
}

export async function installEnv(ctx, feat) {
  const url = assetUrl(feat.image);
  if (!url) return { ok: false, reason: feat.reason || "no pano" };
  const { THREE, renderer, world } = ctx;
  const tex = await new THREE.TextureLoader().loadAsync(url);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  world.environment = env;
  const metal = /glass|chrome/i;
  let used = 0;
  let dimmed = 0;
  world.traverse((o) => {
    const list = !o.material ? [] : (Array.isArray(o.material) ? o.material : [o.material]);
    const name = (o.name || "") + " " + list.map((m) => m.name || "").join(" ");
    for (const mat of list) {
      if (!("envMapIntensity" in mat) && !mat.envMap) continue;
      const metalness = mat.metalness || 0;
      const transmission = mat.transmission || 0;
      const on = metalness >= 0.5 || transmission > 0 || metal.test(name);
      if (on) {
        mat.envMap = env;
        mat.envMapIntensity = feat.intensity;
        used++;
      } else {
        mat.envMapIntensity = 0;
        dimmed++;
      }
      mat.needsUpdate = true;
    }
  });
  return { ok: true, metal: used, dimmed, seam: feat.seam };
}

function paintFog(uniforms, cols, fall) {
  if (!uniforms || !uniforms.uFogC0) return false;
  uniforms.uFogC0.value.copy(cols[0]);
  uniforms.uFogC1.value.copy(cols[1]);
  uniforms.uFogC2.value.copy(cols[2]);
  if (uniforms.uFogHeight) uniforms.uFogHeight.value = fall;
  return true;
}

export function installFog(ctx, feat) {
  const { THREE, world } = ctx;
  const cols = feat.bands.map((b) => new THREE.Vector3(...b.linear));
  const fall = feat.heightFalloff;
  let n = 0;
  world.traverse((o) => {
    const m = o.material;
    if (!m || Array.isArray(m)) return;
    if (paintFog(m.uniforms, cols, fall)) n++;
    if (m.onBeforeCompile && !m.userData.lookFog) {
      const prev = m.onBeforeCompile;
      m.userData.lookFog = true;
      m.onBeforeCompile = (shader, renderer) => {
        prev(shader, renderer);
        paintFog(shader.uniforms, cols, fall);
      };
      m.needsUpdate = true;
    }
  });
  return { ok: n > 0, materials: n, heightFalloff: fall };
}

export function installShadows(ctx, feat) {
  const { THREE, renderer, world } = ctx;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const light = world.getObjectByName("zb-shadow");
  const size = Math.min(1024, feat.mapSize || 1024);
  if (light && light.shadow) {
    light.shadow.mapSize.set(size, size);
    if (light.shadow.map) {
      light.shadow.map.dispose();
      light.shadow.map = null;
    }
    // neutral white. Not a tint.
    light.color.setRGB(1, 1, 1);
  }
  const movers = new RegExp(feat.movers.join("|"), "i");
  const contact = feat.staticContact !== false;
  let moving = 0;
  let frozen = 0;
  world.traverse((o) => {
    if (!o.isMesh) return;
    if (movers.test(o.name || "")) {
      o.castShadow = true;
      moving++;
    } else if (o.castShadow) {
      // One-shot contact. The map does not follow the mesh. Static casters stay in this bake.
      if (!contact) o.castShadow = false;
      frozen++;
    }
  });
  const on = moving > 0 || (contact && frozen > 0);
  renderer.shadowMap.enabled = on;
  renderer.shadowMap.autoUpdate = false;
  if (light) light.castShadow = on;
  if (on) renderer.shadowMap.needsUpdate = true;
  return { ok: true, movers: moving, staticOff: frozen, staticContact: contact && frozen > 0, map: on, size };
}

export function installSprites(ctx, feat) {
  const { THREE, world } = ctx;
  const mesh = world.getObjectByName("sky1-godrays");
  if (!mesh || !feat.sunDir) return { ok: false, reason: "no godray mesh" };
  const dir = new THREE.Vector3(...feat.sunDir).normalize();
  const u = mesh.material && mesh.material.uniforms;
  if (u && u.uSun) u.uSun.value.copy(dir);
  if (u && u.uAxis) u.uAxis.value.copy(dir).negate();
  const attr = mesh.geometry && mesh.geometry.getAttribute("aTint");
  const keep = feat.keep;
  if (attr && keep < feat.count) {
    for (let i = keep; i < feat.count; i++) {
      for (let v = 0; v < 4; v++) attr.setX(i * 4 + v, 0);
    }
    attr.needsUpdate = true;
  }
  return { ok: true, keep, overdraw: feat.overdraw, cap: feat.overdrawCap };
}
