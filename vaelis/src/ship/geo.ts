import * as THREE from "three";

export type Station = { z: number; rx: number; ry: number };

export const HULL: Station[] = [
  { z: -11.15, rx: 0.02, ry: 0.016 },
  { z: -10.35, rx: 0.14, ry: 0.11 },
  { z: -9.1, rx: 0.3, ry: 0.23 },
  { z: -7.5, rx: 0.48, ry: 0.36 },
  { z: -5.5, rx: 0.64, ry: 0.48 },
  { z: -3.5, rx: 0.76, ry: 0.56 },
  { z: -1.3, rx: 0.84, ry: 0.62 },
  { z: 1.1, rx: 0.86, ry: 0.64 },
  { z: 3.5, rx: 0.78, ry: 0.57 },
  { z: 5.7, rx: 0.66, ry: 0.48 },
  { z: 7.5, rx: 0.5, ry: 0.36 },
  { z: 8.9, rx: 0.34, ry: 0.24 },
  { z: 9.75, rx: 0.16, ry: 0.11 },
];

export function hullRadiusAt(z: number): { rx: number; ry: number } {
  const s = HULL;
  if (z <= s[0].z) return { rx: s[0].rx, ry: s[0].ry };
  const last = s[s.length - 1];
  if (z >= last.z) return { rx: last.rx, ry: last.ry };
  let i = 0;
  while (s[i + 1].z < z) i += 1;
  const a = s[i];
  const b = s[i + 1];
  const t = (z - a.z) / (b.z - a.z);
  return { rx: a.rx + (b.rx - a.rx) * t, ry: a.ry + (b.ry - a.ry) * t };
}

export function loftHull(stations: Station[], radial: number, dorsal = 0.2): THREE.BufferGeometry {
  const cols = radial + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  stations.forEach((s, i) => {
    const v = i / (stations.length - 1);
    for (let j = 0; j < cols; j += 1) {
      const theta = (j / radial) * Math.PI * 2;
      const c = Math.cos(theta);
      const sn = Math.sin(theta);
      const x = s.rx * c;
      let y = s.ry * sn;
      if (sn > 0) y += dorsal * s.ry * sn * sn;
      if (sn < 0) y *= 0.9;
      positions.push(x, y, s.z);
      uvs.push(j / radial, v);
    }
  });

  for (let i = 0; i < stations.length - 1; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * cols + j;
      const b = i * cols + j + 1;
      const c = (i + 1) * cols + j;
      const d = (i + 1) * cols + j + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export type WingStation = { x: number; lead: number; trail: number; thick: number; y: number };

export const WING: WingStation[] = [
  { x: 0.46, lead: -2.6, trail: 7.6, thick: 0.2, y: 0.02 },
  { x: 1.7, lead: -0.5, trail: 6.85, thick: 0.15, y: -0.05 },
  { x: 3.4, lead: 1.45, trail: 6.0, thick: 0.09, y: -0.18 },
  { x: 5.15, lead: 3.05, trail: 5.25, thick: 0.05, y: -0.34 },
  { x: 6.55, lead: 4.05, trail: 4.9, thick: 0.028, y: -0.5 },
];

export function wingGeometry(stations: WingStation[], samples = 12): THREE.BufferGeometry {
  const per = samples * 2;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  stations.forEach((s, i) => {
    const chord = s.trail - s.lead;
    const ring: Array<[number, number, number]> = [];
    for (let k = 0; k <= samples; k += 1) {
      const u = k / samples;
      const z = s.lead + chord * u;
      const camber = Math.sin(Math.PI * u);
      ring.push([s.x, s.y + s.thick * 0.5 * camber, z]);
    }
    for (let k = samples - 1; k >= 1; k -= 1) {
      const u = k / samples;
      const z = s.lead + chord * u;
      const camber = Math.sin(Math.PI * u);
      ring.push([s.x, s.y - s.thick * 0.5 * camber, z]);
    }
    ring.forEach((p, k) => {
      positions.push(p[0], p[1], p[2]);
      uvs.push(i / (stations.length - 1), k / per);
    });
  });

  for (let i = 0; i < stations.length - 1; i += 1) {
    for (let k = 0; k < per; k += 1) {
      const k2 = (k + 1) % per;
      const a = i * per + k;
      const b = i * per + k2;
      const c = (i + 1) * per + k;
      const d = (i + 1) * per + k2;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function nozzleGeometry(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.16, 0),
    new THREE.Vector2(0.22, 0.18),
    new THREE.Vector2(0.15, 0.42),
    new THREE.Vector2(0.28, 0.72),
    new THREE.Vector2(0.44, 0.96),
    new THREE.Vector2(0.47, 1.04),
  ];
  const g = new THREE.LatheGeometry(pts, 36);
  g.rotateX(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

export function plumeGeometry(): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(0.26, 1.5, 24, 1, true);
  g.translate(0, 0.75, 0);
  g.rotateX(Math.PI / 2);
  return g;
}
