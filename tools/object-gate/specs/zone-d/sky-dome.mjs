// Zone D sky dome — ONE dome from the sky12 pack `ktx2-final5-mip1-star` (12 plates x 30 deg, 35 deg wide incl. 2.5 deg
// overlap per side, horizon at the bottom edge, 1280x720 ASTC 4x4 sRGB, 2 levels). The pack's mip 0 + mip 1 are uploaded
// AS-IS (KTX2 level data -> CompressedArrayTexture, no mip regeneration, no re-encode). No aurora, no Milky Way layer.
// Blue-noise dither (64x64 void-and-cluster rank texture) in the fragment shader, +-0.5 LSB of the 8-bit sRGB output.
// Azimuth 0 = page heading 0 (-z), clockwise (+x is 90). Above the plate top (~19.7 deg) the plate's own top row is
// band colour (median of the top 12 % of each source plate, sky-band-colours.json) continues upward (4 deg blend from the plate edge), darkened towards the zenith; below the horizon the bottom row is continued.
const VK_ASTC_4x4_SRGB = 158, VK_ASTC_4x4_UNORM = 157;
export function parseKtx2(buf) {
  const dv = new DataView(buf); const id = new Uint8Array(buf, 0, 12);
  if (id[1] !== 0x4b || id[2] !== 0x54 || id[3] !== 0x58) throw new Error('not KTX2');
  const vk = dv.getUint32(12, true), w = dv.getUint32(20, true), h = dv.getUint32(24, true), levels = Math.max(1, dv.getUint32(40, true)), sc = dv.getUint32(44, true);
  if (sc !== 0) throw new Error('KTX2 supercompression ' + sc + ' not supported');
  if (vk !== VK_ASTC_4x4_SRGB && vk !== VK_ASTC_4x4_UNORM) throw new Error('KTX2 vkFormat ' + vk + ' (want ASTC 4x4)');
  const out = [];
  for (let l = 0; l < levels; l++) { const o = 80 + l * 24; const off = Number(dv.getBigUint64(o, true)), len = Number(dv.getBigUint64(o + 8, true));
    out.push({ data: new Uint8Array(buf, off, len), width: Math.max(1, w >> l), height: Math.max(1, h >> l) }); }
  return { vk, srgb: vk === VK_ASTC_4x4_SRGB, width: w, height: h, levels: out };
}
export const SKY_PLATES = Array.from({ length: 12 }, (_, i) => `zd-sky12-S${String(i).padStart(2, '0')}.ktx2`);
export function createSkyDome(THREE, renderer, ktxBuffers, blueNoiseTex, bandColours, { radius = 500 } = {}) {
  if (!bandColours || bandColours.length !== 12) throw new Error('need 12 band colours');
  const gl = renderer.getContext();
  if (!renderer.extensions.has('WEBGL_compressed_texture_astc')) throw new Error('no WEBGL_compressed_texture_astc');
  const parsed = ktxBuffers.map(parseKtx2); const p0 = parsed[0];
  for (const p of parsed) if (p.width !== p0.width || p.height !== p0.height || p.levels.length !== p0.levels.length || p.vk !== p0.vk) throw new Error('sky plates differ in size/levels');
  const mipmaps = p0.levels.map((lv, l) => { const per = lv.data.byteLength, data = new Uint8Array(per * parsed.length);
    parsed.forEach((p, i) => data.set(p.levels[l].data, i * per)); return { data, width: lv.width, height: lv.height }; });
  const tex = new THREE.CompressedArrayTexture(mipmaps, p0.width, p0.height, parsed.length, THREE.RGBA_ASTC_4x4_Format);
  tex.colorSpace = p0.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); tex.needsUpdate = true;
  const plateW = 35, step = 30, vExt = plateW * p0.height / p0.width;   // equirect slice: 35 deg wide -> 19.69 deg tall
  const mat = new THREE.ShaderMaterial({
    uniforms: { band: { value: (bandColours || []).map((c) => new THREE.Vector3(...c)) }, sky: { value: tex }, bn: { value: blueNoiseTex }, vExt: { value: vExt } },
    depthWrite: false, depthTest: true, side: THREE.BackSide,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `precision highp float; precision highp sampler2DArray;
      uniform sampler2DArray sky; uniform sampler2D bn; uniform vec3 band[12]; uniform float vExt; varying vec3 vDir;
      const float W = ${plateW.toFixed(1)}, STEP = ${step.toFixed(1)}, OV = 2.5;
      vec3 plate(float k, float az, float v, bool edgeOnly){ float u = (az - (k * STEP - OV)) / W; vec3 tc = vec3(clamp(u, 0.0, 1.0), 1.0 - v, mod(k, 12.0));
        return edgeOnly ? textureLod(sky, tc, 1.0).rgb : texture(sky, tc).rgb; }
      vec3 sampleAz(float az, float v, bool edgeOnly){ float k = floor(az / STEP); float local = az - k * STEP;   // 0..30 inside slice k
        vec3 c = plate(k, az, v, edgeOnly);
        if (local < OV) { float w = 0.5 + 0.5 * (local / OV); vec3 o = plate(mod(k + 11.0, 12.0), az + (k == 0.0 ? 360.0 : 0.0), v, edgeOnly); c = mix(o, c, w); }
        else if (local > STEP - OV) { float w = 0.5 + 0.5 * ((STEP - local) / OV); vec3 o = plate(mod(k + 1.0, 12.0), az - (k == 11.0 ? 360.0 : 0.0), v, edgeOnly); c = mix(o, c, w); }
        return c; }
      void main(){ vec3 d = normalize(vDir); float az = degrees(atan(d.x, -d.z)); if (az < 0.0) az += 360.0; float el = degrees(asin(clamp(d.y, -1.0, 1.0)));
        float v = el / vExt; vec3 c;
        if (v <= 1.0) c = sampleAz(az, max(v, 0.0) * (1.0 - 1.0 / 720.0), false);
        else { float fa = az / STEP - 0.5; float ka = floor(fa); vec3 top = mix(band[int(mod(ka + 12.0, 12.0))], band[int(mod(ka + 13.0, 12.0))], smoothstep(0.0, 1.0, fa - ka));
          vec3 edge = sampleAz(az, 1.0 - 1.0 / 360.0, false); top = mix(edge, top, smoothstep(0.0, 4.0, el - vExt));   // 4 deg blend out of the plate's own top edge
          float t = clamp((el - vExt) / (90.0 - vExt), 0.0, 1.0); c = top * mix(1.0, 0.72, smoothstep(0.0, 1.0, t)); }
        // blue-noise dither, +-0.5 LSB in 8-bit sRGB space
        float n = texture(bn, gl_FragCoord.xy / 64.0).r - 0.5;
        vec3 s = pow(max(c, 0.0), vec3(1.0 / 2.2)); s += n / 255.0; c = pow(max(s, 0.0), vec3(2.2));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }` });
  const geo = new THREE.SphereGeometry(radius, 96, 48);
  const dome = new THREE.Mesh(geo, mat); dome.frustumCulled = false; dome.renderOrder = -10; dome.name = 'sky-dome';
  dome.onBeforeRender = (r, s, cam) => { dome.position.copy(cam.position); dome.updateMatrixWorld(); };
  return { dome, texture: tex, vExt, bytes: mipmaps.reduce((s, m) => s + m.data.byteLength, 0), levels: mipmaps.length, plates: parsed.length };
}
