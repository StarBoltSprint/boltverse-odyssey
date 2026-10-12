// Texel policy "visible" (SmiR decision 2026-10-09 20:19). Pure functions: used by gate.mjs and rescore.mjs.
//
// 1. Visible px/m: a plate surface must be at least as sharp as the phone screen when viewed from >= minViewM
//    (8 m). Closer views are exempt (slight blur right against a wall is accepted). There is no camera distance
//    limit, so every surface is scored at its closest non-exempt distance, minViewM, unless the spec gives a
//    per-class `viewMinM` with a reason (a surface the camera can never get that close to).
//      screen px/m at d = renderH / (2 d tan(vfov / 2)),   renderH = phone.h / phone.devicePixelRatio * renderPixelRatio
//    renderPixelRatio and vfov are the game's own (adapter `view`), the phone is 1080 x 2400.
//    Measured = plate SAMPLING px/m (plate px per world metre on that surface), not unique px/m.
// 2. No visible repetition, instead of unique pixels:
//    - one shared plate set per object type is allowed (copies of a type reuse the same plates);
//    - identical plate pixels never within repeatRadiusM (30 m): a plate tiling on a surface with a period < 30 m,
//      or a pool whose ortho facade view correlates at the cell period (> repetition.maxAtTileLag), FAILS;
//    - neighbours never share: two copies of the same plate set closer than neighbourRadiusM (7 m) FAIL.

export function screenPxPerM(t, view, d) {
  const renderH = (t.phone.h / t.phone.devicePixelRatio) * view.renderPixelRatio;
  return renderH / (2 * d * Math.tan((view.fovDeg * Math.PI) / 360));
}

export function resolveView(t, adapterView) {
  const v = adapterView || {};
  return {
    renderPixelRatio: t.renderPixelRatio ?? v.renderPixelRatio ?? 1,
    fovDeg: t.fovDeg ?? v.fovDeg ?? 58,
    source: t.renderPixelRatio != null || t.fovDeg != null ? "profile" : v.source || "default",
  };
}

const f1 = (x) => (x == null || !isFinite(x) ? "?" : (+x).toFixed(1));

/** -> { rows: [{check, pass, detail, hints}], perSurface } */
export function scoreVisible(t, R, view, texelRows, repRows, footprints, spec = {}, render = null) {
  const rows = [], perSurface = [];
  const viewMin = (cls) => Math.max(t.minViewM, (spec.viewMinM && spec.viewMinM[cls] && spec.viewMinM[cls].m) || 0);
  const ignore = new Set(t.ignoreClasses || []);
  for (const r of texelRows) {
    if (ignore.has(r.cls)) continue;   // e.g. -y: downward / buried faces are never seen from a standing phone
    const d = viewMin(r.cls);
    const need = screenPxPerM(t, view, d);
    perSurface.push({ inst: r.inst, cls: r.cls, viewM: d, needPxPerM: +need.toFixed(1), visiblePxPerM: r.samplingPxPerM, ok: r.samplingPxPerM >= need });
  }
  const fails = perSurface.filter((s) => !s.ok);
  const worst = perSurface.slice().sort((a, b) => a.visiblePxPerM / a.needPxPerM - b.visiblePxPerM / b.needPxPerM)[0];
  const need8 = screenPxPerM(t, view, t.minViewM);
  const [pw, ph] = t.plateNative || [1024, 1024];
  const sampling = perSurface.length
    ? `plate sampling worst ${worst.cls} ${f1(worst.visiblePxPerM)} px/m on ${worst.inst}, ${fails.length}/${perSurface.length} surfaces under`
    : "no plate surface sampled";
  if (render) {
    // final-render measurement (default since 1.3): the pixels the phone shows, whatever the material method
    const ok = !!render.ok && render.visiblePxPerM >= need8;
    // SmiR 2026-10-12: when the spec says the native plate is the density limit and the
    // render is coarser than the estimator, the row is WARN. The number stays in the detail.
    // A measured render under the need, without that flag, stays FAIL. Never upscale.
    const nativeLimit = !!(spec && spec.nativePlateLimit);
    const status = !ok && nativeLimit && render.ok && render.coarserThanEstimator ? "WARN" : undefined;
    rows.push({
      check: "visible px/m (phone sharpness from >= " + t.minViewM + " m, final render)",
      pass: ok,
      status,
      detail: render.ok
        ? `${render.flat ? (render.coarserThanEstimator ? `detail is coarser than the estimator (upper bound, ${render.insideTiles} tiles flatter than the coarsest k): ` : `the surface shows no detail at all (${render.insideTiles} tiles flat, e.g. black or unlit): `) : ""}${f1(render.visiblePxPerM)} px/m of real detail on screen vs ${f1(need8)} needed (capture at ${render.distM} m, zoomed to ${f1(render.screenPxPerM)} screen px/m${render.capped ? ", at the capture limit" : ""}; median of ${render.tiles} tiles, p25 ${f1(render.p25PxPerM)}; phone ${t.phone.w}x${t.phone.h}, render pixel ratio ${view.renderPixelRatio}, vfov ${view.fovDeg}\u00b0). Info: ${sampling}`
        : `${render.why}. Info: ${sampling}`,
      hints: [`Needs >= ${f1(need8)} px/m of visible detail at ${t.minViewM} m. Unique plates: one native ${pw}x${ph} Imagine plate covers at most ${(pw / need8).toFixed(1)} x ${(ph / need8).toFixed(1)} m. Layered materials: raise the detail layer's density or keep its distance fade beyond ${t.minViewM} m. Never upscale.`],
    });
  } else rows.push({
    check: "visible px/m (phone sharpness from >= " + t.minViewM + " m, plates only)",
    pass: perSurface.length > 0 && fails.length === 0,
    detail: perSurface.length
      ? `worst ${worst.cls} ${f1(worst.visiblePxPerM)} plate px/m vs ${f1(worst.needPxPerM)} screen px/m at ${worst.viewM} m on ${worst.inst}; ${fails.length}/${perSurface.length} surfaces under (phone ${t.phone.w}x${t.phone.h}, render pixel ratio ${view.renderPixelRatio}, vfov ${view.fovDeg}°, ${view.source})`
      : "no plate-textured surface measured",
    hints: [`Needs >= ${f1(need8)} plate px/m: one native ${pw}x${ph} Imagine plate may cover at most ${(pw / need8).toFixed(1)} x ${(ph / need8).toFixed(1)} m of surface. Cut the surface into more plate sections (one shared plate set per object type is fine), never upscale, never count a tiled detail texture.`],
  });
  // identical pixels within repeatRadiusM
  const clash = [];
  for (const r of texelRows) {
    if (t.maxRepeats === null) break;   // profile declares tiling by design (terrain: anti-carpet rules apply instead)
    if (!(r.repeats > (t.maxRepeats ?? 1.05))) continue;
    const tileM = r.texW / r.samplingPxPerM;
    if (r.cls === "pool") {
      const ev = repRows.filter((x) => x.atExpectedLag != null && x.atExpectedLag > R.maxAtTileLag && x.tileM != null && x.tileM < t.repeatRadiusM);
      if (ev.length) clash.push(`${r.inst} pool: ${r.layers} layers reused x${r.repeats}; ortho ${ev.map((x) => `${x.name} ${x.atExpectedLag} at ${x.tileM} m`).join(", ")}`);
    } else if (tileM < t.repeatRadiusM) clash.push(`${r.inst} ${r.cls}: plate tiles every ${f1(tileM)} m (x${r.repeats})`);
  }
  rows.push({
    check: `repetition (visible): identical plate pixels never within ${t.repeatRadiusM} m`,
    pass: clash.length === 0,
    detail: clash.length ? `${clash.length} surfaces: ${[...new Set(clash)].slice(0, 4).join("; ")}` : "no plate repeats inside the radius (one shared plate set per type allowed)",
    hints: ["Give each wall section its own plate window inside the radius: more layers in the pool, a section LUT with a minimum same-layer distance >= 30 m, or flips/offsets that never put the same pixels within 30 m."],
  });
  // neighbours sharing the plate set
  const near = [];
  for (let i = 0; i < footprints.length; i++) for (let j = i + 1; j < footprints.length; j++) {
    const a = footprints[i], b = footprints[j];
    // LOD levels of the SAME copy share a centre. A decimated LOD can differ in size and still is not a neighbour.
    const stem = (id) => String(id).replace(/-lod\d+.*/, "").replace(/#\d+$/, "");
    if (Math.hypot(a.x - b.x, a.z - b.z) < 1 && stem(a.inst) === stem(b.inst)) continue;
    const gap = Math.max(Math.abs(a.x - b.x) - a.hw - b.hw, Math.abs(a.z - b.z) - a.hd - b.hd);
    if (gap < t.neighbourRadiusM) near.push(`${a.inst} / ${b.inst} ${f1(Math.max(0, gap))} m`);
  }
  rows.push({
    check: `repetition (visible): neighbours never share plates (< ${t.neighbourRadiusM} m)`,
    pass: near.length === 0,
    detail: near.length ? `${near.length} pairs: ${near.slice(0, 4).join("; ")}` : `${footprints.length} copies, none within ${t.neighbourRadiusM} m of another`,
    hints: ["Move the copies apart, or give neighbours different plate windows / a mirrored set so no two neighbours share pixels."],
  });
  return { rows, perSurface };
}

/** Footprints from instanceBoxes. Use the oriented size (halfW/halfD), not the yawed world AABB:
 *  a rotated mesa's axis-aligned box overlaps neighbours that the rock itself does not touch.
 *  An unloaded LOD (empty geometry) has no size and is not a copy. */
export const footprintsFromBoxes = (boxes) => (boxes || []).filter((b) => b && b.center && ((b.halfW || 0) > 0.05 || (b.halfD || 0) > 0.05)).map((b) => ({ inst: b.id, x: b.center[0], z: b.center[2], hw: b.halfW, hd: b.halfD }));
