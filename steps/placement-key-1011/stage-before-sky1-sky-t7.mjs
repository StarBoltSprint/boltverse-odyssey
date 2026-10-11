// Zone B sky layers (sky job 2026-10-09). Self-contained: replaces the sky dome material and adds the
// ring arcs, two crescent moons, the low sun halo, sun-gap rays and cloud streaks as children of the
// sky dome (the dome follows the camera, so every layer is at infinity and 360 deg free-roam).
// Colours come from biome.json at runtime (palette / sun / fog); textures are Imagine edits of key-city3 crops.
// All layers draw at the far plane (gl_Position.xyww) with depth test, so towers and dunes hide them.
const V = "t7";   // TEX7 (Grok Bot 10-10): native-resolution Imagine sky textures (tools/sky7/prep7.py), max anisotropy
const deg = Math.PI / 180;

function loadTex(THREE, url, srgb, wrap) {
  return new Promise((res, rej) => new THREE.TextureLoader().load(url, (t) => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.anisotropy = 4;
    res(t);
  }, undefined, () => rej(new Error("sky1 texture " + url))));
}

const FAR_VS = /* glsl */ `
attribute vec4 aTint;      // rgb multiplier, a = layer id
varying vec2 vUv; varying vec4 vTint; varying vec3 vDir;
void main(){ vUv = uv; vTint = aTint; vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;

export async function mountSky({ THREE, R, biome, sky }) {
  const lin = (hex) => new THREE.Vector3(...R.hexToLinear(hex));
  const pal = biome.palette || {}, sunB = biome.sun || {};
  const sunDir = new THREE.Vector3(...R.headingToDir(sunB.azimuthDeg ?? 90, sunB.elevationDeg ?? 8)).normalize();
  const radius = sky.geometry.parameters ? sky.geometry.parameters.radius : 300;
  const RS = radius * 0.9;   // layers inside the dome (all land on the far plane anyway)

  const [cloudTex, atlasTex, ringTex, planetTex, info] = await Promise.all([
    loadTex(THREE, `./sky1/sky7-clouds.png?v=${V}`, false, true),
    loadTex(THREE, `./sky1/sky7-atlas.png?v=${V}`, true, false),
    loadTex(THREE, `./sky1/sky7-ring2.png?v=${V}`, true, false),
    loadTex(THREE, `./sky1/sky-planet2.jpg?v=${V}`, true, false),
    fetch(`./sky1/sky7-info.json?v=${V}`).then((r) => r.json()),
  ]);
  const skyTextures = [cloudTex, atlasTex, ringTex, planetTex];
  // atlas rects from the native pixel sizes (TextureLoader flipY: image row 0 is v = 1)
  const AW = info.atlas.size[0], AH = info.atlas.size[1];
  const rect = (x0, w, h) => [x0 / AW, 1 - h / AH, (x0 + w) / AW, 1];
  const PX = info.atlas.px;
  // big gas giant (SmiR 09:08): upper-left of the avenue, ~40 deg from the sun, so the low sun lights it as a crescent
  const PLANET = { heading: 50, elev: 17, radiusDeg: 13 };

  // ------------------------------------------------------------ dome: gradient + sun glow + cloud streaks
  const U = {
    uZen: { value: lin(pal.zenith) }, uHaze: { value: lin(pal.horizon) }, uFog: { value: lin(biome.fog.color) },
    uKey: { value: lin(sunB.hex || pal.key) }, uFill: { value: lin(pal.fill) },
    uSun: { value: sunDir }, uClouds: { value: cloudTex }, uTime: { value: 0 },
    uPlanet: { value: planetTex }, uPlanetDir: { value: new THREE.Vector3(...R.headingToDir(PLANET.heading, PLANET.elev)).normalize() },
    uPlanetR: { value: PLANET.radiusDeg * deg }, uPlanetUv: { value: 0.47 },
    uS: { value: [null, [182, 146, 153], [154, 122, 143], [135, 109, 138], [118, 94, 130], [88, 64, 118], null] },
  };
  { // stops: key-city3 samples (sRGB 0-255) -> linear; 0 = mix(key horizon sample, bible haze), 6 = bible zenith
    const toLin = (rgb) => new THREE.Vector3(...rgb.map((v) => R.srgbToLinear(v / 255)));
    const haze = R.hexToSrgb(pal.horizon).map((v) => v * 255), zen = R.hexToSrgb(pal.zenith).map((v) => v * 255);
    U.uS.value[0] = [214, 166, 150].map((v, i) => 0.5 * v + 0.5 * haze[i]);
    U.uS.value[6] = zen;
    U.uS.value = U.uS.value.map(toLin);
  }
  const dome = new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: "varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }",
    fragmentShader: /* glsl */ `
uniform vec3 uZen, uHaze, uFog, uKey, uFill, uSun; uniform vec3 uS[7]; uniform sampler2D uClouds; uniform float uTime;
uniform sampler2D uPlanet; uniform vec3 uPlanetDir; uniform float uPlanetR; uniform float uPlanetUv;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float e = d.y;                                   // sin(elevation)
  float up = max(e, 0.0);
  float cs = dot(d, uSun);
  float sunSide = 0.5 + 0.5 * dot(normalize(vec2(d.x, d.z) + 1e-5), normalize(uSun.xz));
  // gradient sampled from key-city3 (open-sky columns, hero camera): stops at 0,7,14,21,28,50,90 deg elevation;
  // the horizon stop leans toward the bible haze, the zenith is the bible zenith
  float el = asin(clamp(e, 0.0, 1.0)) * 57.29578;
  vec3 c = uS[0];
  c = mix(c, uS[1], smoothstep(0.0, 7.0, el));
  c = mix(c, uS[2], smoothstep(7.0, 14.0, el) );
  c = mix(c, uS[3], smoothstep(14.0, 21.0, el));
  c = mix(c, uS[4], smoothstep(21.0, 28.0, el));
  c = mix(c, uS[5], smoothstep(28.0, 50.0, el));
  c = mix(c, uS[6], smoothstep(50.0, 90.0, el));
  float t = smoothstep(0.0, 40.0, el);
  // anti-sun side darker and cooler near the horizon (bible qc horizonAntiSunDL)
  c = mix(c, c * vec3(0.72, 0.70, 0.84), (1.0 - sunSide) * (1.0 - t));
  // warm sun glow: wide horizon band + tighter halo
  float ang = acos(clamp(cs, -1.0, 1.0));
  float band = exp(-up * 14.0) * pow(sunSide, 4.0);
  c += uKey * (0.10 * band + 0.55 * exp(-ang / 0.09) + 0.22 * exp(-ang / 0.32) * (1.0 - t));
  // gas giant v2 (SmiR 12:34): native-resolution Imagine disc (878 px, no resampling, anisotropic mips, explicit
  // gradients computed outside the branch). Lit by the scene sun: limb-darkened day side, a realistic terminator that
  // reddens as the light grazes, a thin bright atmospheric limb on the lit side, a subtle night side darker than the sky
  // (faint band detail only), light haze toward the lower limb.
  float pMask = 0.0;
  float cp = dot(d, uPlanetDir);
  vec3 pr = normalize(cross(uPlanetDir, vec3(0.0, 1.0, 0.0)));
  vec3 pu = cross(pr, uPlanetDir);
  vec3 dp = d / max(cp, 1e-3);
  vec2 q = vec2(dot(dp, pr), dot(dp, pu)) / tan(uPlanetR);
  // axial rotation (SmiR 15:06): the visible sphere point (lat, lon) is rotated in longitude, then mapped back into the
  // Imagine disc with the orthographic projection (native texels, no pole stretch). The disc holds one hemisphere, so
  // 360 deg of planet = two copies of its central +-56 deg (lon compressed 0.62) crossfaded over 40 deg on the far side,
  // never at the visible centre. Lighting uses the fixed sphere normal, so terminator/crescent/night stay put.
  float qx = clamp(q.x, -1.0, 1.0), qy = clamp(q.y, -1.0, 1.0);
  float pz = sqrt(max(1.0 - qx * qx - qy * qy, 0.0));
  float plat = asin(clamp(qy, -1.0, 1.0));
  float plon = atan(qx, max(pz, 1e-4));
  float spin = mod(uTime, 480.0) / 480.0 * 6.2831853;              // one turn in 8 min (~22 deg in 30 s)
  float drift = 0.10 * sin(plat * 7.0 + 1.3) * sin(uTime * 0.035); // bounded differential band drift
  float lr = mod(plon - spin - drift + 3.14159265, 6.2831853) - 3.14159265;
  float lb = lr - 3.14159265 * sign(lr);
  float wA = smoothstep(1.5708 + 0.35, 1.5708 - 0.35, abs(lr));
  float cl0 = cos(plat);
  vec2 puvA = vec2(cl0 * sin(lr * 0.62), sin(plat)) * uPlanetUv + 0.5;
  vec2 puvB = vec2(cl0 * sin(lb * 0.62), sin(plat)) * uPlanetUv + 0.5;
  vec2 puv = q * uPlanetUv + 0.5;
  vec2 gx = dFdx(puv), gy = dFdy(puv);                              // screen-space footprint (smooth, no wrap spikes)
  float rr = length(q);
  float aa = max(fwidth(rr), 1e-4);
  if (cp > cos(uPlanetR * 1.35)) {
    float mu = sqrt(max(1.0 - rr * rr, 0.0));
    vec3 N = normalize(pr * q.x + pu * q.y - uPlanetDir * mu);
    vec3 Lp = normalize(uSun - uPlanetDir * 0.75);                 // art-directed: a fuller crescent than the true phase
    float lamb = dot(N, Lp);
    vec3 alb = mix(textureGrad(uPlanet, puvB, gx * vec2(0.62, 1.0), gy * vec2(0.62, 1.0)).rgb, textureGrad(uPlanet, puvA, gx * vec2(0.62, 1.0), gy * vec2(0.62, 1.0)).rgb, wA);
    vec3 sky0 = c;
    // day side: Lambert with a narrow penumbra, warm/red where the light grazes, limb darkening
    float lit = smoothstep(-0.03, 0.22, lamb);
    vec3 graze = mix(vec3(1.0, 0.72, 0.6), vec3(1.0), smoothstep(0.0, 0.3, lamb));
    float limbDark = 0.6 + 0.4 * pow(mu, 0.5);
    vec3 day = alb * (uKey * 0.7 + vec3(0.85)) * graze * limbDark * (0.15 + 1.35 * max(lamb, 0.0) / (0.25 + max(lamb, 0.0)));
    // night side: darker than the sky, only a ghost of the bands
    vec3 night = sky0 * 0.3 + alb * 0.035;
    vec3 disc = mix(night, day, lit);
    float haze = 0.04 + 0.28 * smoothstep(0.1, -1.0, q.y) + 0.08 * smoothstep(0.85, 1.0, rr);
    disc = mix(disc, sky0, clamp(haze, 0.0, 0.45));
    // limb: lit where the limb normal faces the light
    vec2 qn = q / max(rr, 1e-4);
    float limbLit = smoothstep(-0.25, 0.5, dot(normalize(pr * qn.x + pu * qn.y), Lp));
    float thin = exp(-abs(rr - 1.0) * 140.0);                       // thin bright atmospheric line
    float glow = exp(-max(rr - 1.0, 0.0) * 28.0) * step(1.0, rr);   // soft scattering just outside the limb
    float soft = mix(0.012, aa, limbLit);
    pMask = 1.0 - smoothstep(1.0 - soft, 1.0 + aa, rr);
    c = mix(c, disc, pMask);
    vec3 atm = mix(uHaze, vec3(1.0, 0.92, 0.85), 0.5) * 0.6 + uKey * 0.5;
    c += atm * limbLit * (thin * 0.9 + glow * 0.22);
  }
  // cloud streaks on a high flat layer (planar projection: seamless in every direction)
  if (e > 0.02) {
    vec2 p = d.xz / (e + 0.08) * 0.11 + vec2(uTime * 0.0012, 0.0);
    float m = texture2D(uClouds, p).r;
    float m2 = texture2D(uClouds, mat2(0.8, -0.6, 0.6, 0.8) * p * 0.63 + 0.37).r;
    float cl = max(m, m2 * 0.7);
    cl *= smoothstep(0.03, 0.2, e) * (1.0 - smoothstep(0.75, 0.98, e));
    vec3 lit = mix(c * 1.3 + uHaze * 0.06, uKey * 0.8 + uHaze * 0.35, smoothstep(0.2, 0.95, cs));   // pale, warm only toward the sun
    c = mix(c, lit, cl * 0.32 * (1.0 - 0.75 * pMask));   // only a thin veil of cloud over the planet
  }
  // below the horizon: blend into the scene fog colour (ground mesh covers it)
  c = mix(c, uFog, smoothstep(0.02, -0.06, e));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
  });
  sky.material = dome;
  let anisoSet = false;
  sky.onBeforeRender = (renderer) => {
    U.uTime.value = window.__skyT ?? performance.now() / 1000;   // __skyT: frozen time for verification clips
    if (!anisoSet && renderer && renderer.capabilities) {   // planet at the GPU's max anisotropy (native-res Imagine)
      anisoSet = true; const mx = renderer.capabilities.getMaxAnisotropy();
      for (const t of skyTextures) { t.anisotropy = mx; t.needsUpdate = true; }
      window.__sky1.textures = skyTextures.map((t) => ({ w: t.image.width, h: t.image.height, aniso: t.anisotropy, mips: t.generateMipmaps, min: t.minFilter }));
    }
  };

  // ------------------------------------------------------------ helpers: quads on the sphere
  const dirH = (h, e) => new THREE.Vector3(...R.headingToDir(h, e)).normalize();
  function frame(dir) {
    const r = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const u = new THREE.Vector3().crossVectors(r, dir).normalize();
    return { r, u };
  }
  function quadBuilder() {
    const P = [], UV = [], T = [], I = [];
    return {
      // center dir, right/up vectors already scaled (tangent units), uv rect [u0,v0,u1,v1], tint [r,g,b,layer]
      add(c, rv, uv, uvr, tint) {
        const base = P.length / 3;
        for (const [sx, sy, su, sv] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) {
          const p = c.clone().addScaledVector(rv, sx).addScaledVector(uv, sy).normalize().multiplyScalar(RS);
          P.push(p.x, p.y, p.z);
          UV.push(uvr[0] + (uvr[2] - uvr[0]) * su, uvr[1] + (uvr[3] - uvr[1]) * sv);
          T.push(...tint);
        }
        I.push(base, base + 1, base + 2, base, base + 2, base + 3);
      },
      geo() {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
        g.setAttribute("aTint", new THREE.Float32BufferAttribute(T, 4));
        g.setIndex(I); return g;
      },
    };
  }
  const addMat = (map, frag) => new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, uSun: { value: sunDir }, uTime: { value: 0 } },
    vertexShader: FAR_VS, fragmentShader: frag, transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, fog: false,
  });

  // ------------------------------------------------------------ sprites: sun halo, 2 moons, sun-gap rays (one draw call)
  // atlas (1024x512): sun [0,0.5]x[0,1] · moon [0.5,0.75]x[0.5,1] · ray [0.75,1]x[0,1]
  const UV_SUN = rect(0, PX.sun, PX.sun), UV_MOON = rect(PX.sun + 1, PX.moon, PX.moon), UV_RAY = rect(PX.sun + 2 + PX.moon, PX.ray[0], PX.ray[1]);
  const sb = quadBuilder();
  { // sun disc + halo (Imagine), 18 deg wide quad; the disc is ~1/6 of it
    const { r, u } = frame(sunDir); const s = Math.tan(9 * deg);
    sb.add(sunDir, r.clone().multiplyScalar(s), u.clone().multiplyScalar(s), UV_SUN, [1.0, 1.0, 1.0, 0]);
  }
  // crescent moons (key-city3: pale crescents above-right of the sun, lit limb toward the sun)
  for (const [h, e, size, b] of [[101, 21, 2.2, 0.85], [104.5, 15.5, 1.2, 0.6]]) {
    const c = dirH(h, e); const { r, u } = frame(c);
    // rotate so the lit limb (bottom of the Imagine crescent) points at the sun
    const toSun = sunDir.clone().sub(c); const ax = toSun.dot(r), ay = toSun.dot(u);
    const a = Math.atan2(ay, ax) - Math.atan2(-1, 0);    // texture lit limb = bottom (0,-1)
    const s = Math.tan(size * deg);
    const rr = r.clone().multiplyScalar(Math.cos(a)).addScaledVector(u, Math.sin(a)).multiplyScalar(s);
    const uu = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(r, -Math.sin(a)).multiplyScalar(s);
    sb.add(c, rr, uu, UV_MOON, [b, b, b, 1]);
  }
  // sun-gap rays: shafts fanning out from the sun; they sit at the far plane, so they only show
  // between the towers (where the sky is visible), like the light leaking through the gaps in key-city3
  {
    const { r, u } = frame(sunDir);
    // more shafts toward the sides (phi ~ +-90): those cross the gaps between the towers that frame the low sun
    const rays = [[-118, 40, 2.6, 0.9], [-100, 52, 3.4, 1.1], [-86, 46, 2.4, 1.0], [-72, 54, 3.6, 0.9], [-55, 40, 2.6, 0.8],
      [-34, 34, 2.4, 0.6], [-12, 40, 3.0, 0.55], [10, 34, 2.4, 0.55], [32, 40, 3.0, 0.6], [54, 44, 2.6, 0.8],
      [70, 54, 3.6, 0.9], [86, 46, 2.4, 1.0], [100, 52, 3.4, 1.1], [118, 40, 2.6, 0.9]];
    for (const [phi, len, wid, b] of rays) {
      // phi: angle from screen-up around the sun (deg), len/wid in deg
      const ang = phi * deg;
      const axis = u.clone().multiplyScalar(Math.cos(ang)).addScaledVector(r, Math.sin(ang)).normalize();
      const perp = new THREE.Vector3().crossVectors(axis, sunDir).normalize();
      const L = Math.tan(len * deg) * 0.5, W = Math.tan(wid * deg);
      const c = sunDir.clone().addScaledVector(axis, L * 1.05);
      // texture: bright at the bottom (v=0) -> the sun end
      sb.add(c, perp.multiplyScalar(W), axis.multiplyScalar(L), UV_RAY, [b, b * 0.92, b * 0.85, 2]);
    }
  }
  const sprites = new THREE.Mesh(sb.geo(), addMat(atlasTex, /* glsl */ `
uniform sampler2D map; uniform vec3 uSun; uniform float uTime; uniform vec2 uRayV;
varying vec2 vUv; varying vec4 vTint; varying vec3 vDir;
void main(){
  vec3 c = texture2D(map, vUv).rgb;
  float layer = vTint.a;
  if (layer > 1.5) {
    float rv = (vUv.y - uRayV.x) / (uRayV.y - uRayV.x);   // rays: shaft coordinate 0 (sun) .. 1 inside the native rect
    vec3 d = normalize(vDir);
    float ang = acos(clamp(dot(d, uSun), -1.0, 1.0));
    c *= (0.85 + 0.15 * sin(uTime * 0.35 + vUv.x * 7.0 + ang * 4.0)) * smoothstep(-0.04, 0.03, d.y);
    c *= 3.2 * pow(1.0 - rv, 1.3) * smoothstep(0.0, 0.05, rv);   // fade out along the shaft, soft at the sun
  } else if (layer > 0.5) {     // moons fade toward the horizon haze
    c *= smoothstep(0.02, 0.2, normalize(vDir).y);
  }
  gl_FragColor = vec4(c * vTint.rgb, 1.0);
}`));
  sprites.material.uniforms.uRayV = { value: new THREE.Vector2(UV_RAY[1], UV_RAY[3]) };
  sprites.frustumCulled = false; sprites.renderOrder = -0.5; sprites.name = "sky1-sprites";

  // ------------------------------------------------------------ the gas giant's ring system (v28: replaces the
  // straight great-circle arcs that read as contrails). A real annulus around the planet in a plane opened 16 deg
  // toward the viewer, major axis tilted 28 deg up to the right, so it projects as a wide curved ellipse whose right
  // arm sweeps up over the avenue toward the spire like key-city3. Radial profile = 3 bands of varied brightness
  // from the Imagine band (sky-ring2.jpg). The far half is hidden behind the planet disc; warmer toward the sun.
  const ring = (() => {
    const pc = new THREE.Vector3(...R.headingToDir(PLANET.heading, PLANET.elev)).normalize();
    const { r: pr, u: pu } = frame(pc);
    const rp = Math.tan(PLANET.radiusDeg * deg);                 // planet radius at unit distance
    const tilt = 22 * deg, open = 14 * deg;
    const U = pr.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(pu, Math.sin(tilt));      // major axis (sky)
    const Vs = pu.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(pr, -Math.sin(tilt));    // minor axis (sky)
    const r0 = 3.1 * rp, r1 = 4.3 * rp, N = 480, P = [], UV = [], T = [], I = [];
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * Math.PI * 2, ct = Math.cos(th), st = Math.sin(th);
      const front = -st;                                          // lower half of the ellipse passes in front of the planet
      for (const [k, rad] of [[0, r0], [1, r1]]) {
        const p = pc.clone().addScaledVector(U, ct * rad).addScaledVector(Vs, st * rad * Math.sin(open)).normalize().multiplyScalar(RS);   // sky-projected ellipse (planet far away: no near-side blow-up)
        P.push(p.x, p.y, p.z); UV.push(0.5, k); T.push(1, 1, front > 0 ? 1 : 0, 3);
      }
      if (i < N) { const q = i * 2; I.push(q, q + 1, q + 3, q, q + 3, q + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
    g.setAttribute("aTint", new THREE.Float32BufferAttribute(T, 4));
    g.setIndex(I);
    const mat = addMat(ringTex, /* glsl */ `
uniform sampler2D map; uniform vec3 uSun; uniform vec3 uPc; uniform float uPr; uniform vec3 uKeyC; uniform float uTime;
varying vec2 vUv; varying vec4 vTint; varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float inDisc = step(cos(uPr), dot(d, uPc));
  if (vTint.b < 0.5 && inDisc > 0.5) discard;                     // far half: behind the planet
  vec3 c = texture2D(map, vec2(0.5, vUv.y)).rgb;
  float fade = smoothstep(0.0, 0.12, d.y);
  float warm = pow(max(dot(d, uSun), 0.0), 2.0);
  vec3 tint = mix(vec3(0.95, 0.9, 1.0), uKeyC * 1.6, 0.25 + 0.6 * warm);
  float shade = vTint.b < 0.5 ? 0.8 : 1.0;
  float shimmer = 0.95 + 0.05 * sin(uTime * 0.7 + dot(d, vec3(9.0, 4.0, 7.0)));   // very subtle, slow
  gl_FragColor = vec4(c * tint * fade * shade * shimmer * 0.42, 1.0);
}`);
    mat.uniforms.uPc = { value: pc }; mat.uniforms.uPr = { value: PLANET.radiusDeg * deg };
    const kc = lin(sunB.hex || pal.key); mat.uniforms.uKeyC = { value: kc.clone().multiplyScalar(1 / Math.max(kc.x, kc.y, kc.z)) };
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false; m.renderOrder = -0.6; m.name = "sky1-ring";
    return m;
  })();

  // god-rays in the air: long axial light shafts parallel to the sun ray, running down the avenue (heading 78,
  // through the origin) between the tower rows and sinking 8 deg toward the ground like the sunlight itself.
  // Depth-tested in the world (towers in front hide them), additive, Imagine shaft texture across the beam,
  // strongest when looking toward the sun (forward scattering), faded near the camera. One draw call.
  const shafts = (() => {
    const av = new THREE.Vector3(...R.headingToDir(78, 0)), lat = new THREE.Vector3(-av.z, 0, av.x);
    const back = sunDir.clone().negate();               // light travels from the sun toward -sunDir
    const P = [], UV = [], T = [], I = [];
    // 16 thin shafts, seeded spread between the tower rows (lateral -32..32 m) and heights 40-110 m at the far end
    const list = [];
    let seed = 1009; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 16; i++) list.push([-32 + 64 * (i + 0.5) / 16 + (rnd() - 0.5) * 3, 420 + rnd() * 200, 40 + rnd() * 70, 3.5 + rnd() * 4.0, 0.5 + rnd() * 0.5]);
    for (const [l, s0, y0, w, b] of list) {
      const start = av.clone().multiplyScalar(s0).addScaledVector(lat, l).setY(y0);
      const len = y0 / Math.max(-back.y, 1e-3);             // until the ray reaches the ground plane
      const end = start.clone().addScaledVector(back, len);
      const base = P.length / 3;
      for (const [p, v] of [[start, 0], [end, 1]]) for (const side of [-1, 1]) {
        P.push(p.x, p.y, p.z); UV.push(side < 0 ? UV_RAY[0] : UV_RAY[2], UV_RAY[1] + (UV_RAY[3] - UV_RAY[1]) * (0.15 + 0.7 * v)); T.push(side * w, b, v, 0);
      }
      I.push(base, base + 1, base + 3, base, base + 3, base + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
    g.setAttribute("aTint", new THREE.Float32BufferAttribute(T, 4));
    g.setIndex(I);
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: atlasTex }, uSun: { value: sunDir }, uAxis: { value: back } },
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: `attribute vec4 aTint; uniform vec3 uAxis; varying vec2 vUv; varying float vB; varying float vV; varying vec3 vView; varying float vDist;
void main(){ vec3 P = position; vec3 view = normalize(P - cameraPosition);
  vec3 side = normalize(cross(uAxis, view)); P += side * aTint.x;
  vUv = uv; vB = aTint.y; vV = aTint.z; vView = P - cameraPosition; vDist = length(vView);
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0); }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 uSun; varying vec2 vUv; varying float vB; varying float vV; varying vec3 vView; varying float vDist;
void main(){ vec3 c = texture2D(map, vUv).rgb;
  float fw = 0.25 + 1.4 * pow(max(dot(normalize(vView), uSun), 0.0), 3.0);
  float near = smoothstep(30.0, 110.0, vDist) * (1.0 - smoothstep(380.0, 600.0, vDist));
  float ends = smoothstep(0.0, 0.12, vV) * smoothstep(1.0, 0.75, vV);
  gl_FragColor = vec4(c * vB * fw * near * ends * 0.62, 1.0); }`,
    });
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.name = "sky1-godrays";
    return m;
  })();
  (sky.parent || sky).add(shafts);
  sky.add(ring); sky.add(sprites);
  const t0 = performance.now();
  sprites.onBeforeRender = () => { sprites.material.uniforms.uTime.value = (performance.now() - t0) / 1000; };
  ring.onBeforeRender = () => { ring.material.uniforms.uTime.value = window.__skyT ?? (performance.now() - t0) / 1000; };
  window.__sky1 = { version: V, sunDir: sunDir.toArray(), layers: ["dome+planet+clouds", "ring", "sprites(sun,moons,sky rays)", "godrays"], drawCalls: 4 };
  return window.__sky1;
}
