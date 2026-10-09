// STAGING (not live): Zone B sandstone mesas v2 (2026-10-09, steering 16:59). Imagine -> 3D tool (zb-preview-1008-tools/imagine-to-3d).
// Mesh: blocky stratified cliffs (strata.py): strata from the Imagine front plate's bedding lines, each layer an angular
// prism on the Imagine visual-hull outline, straight faces <= 16 m, vertical fracture steps, caprock overhangs + undercuts,
// chamfered ledges, fallen blocks + scree. 3 silhouette-preserving LODs + dithered distance crossfade (no pop).
// Colour: sectioned Imagine plates (key-city3 crops -> Imagine), sampled 1:1 at native 80 px/m (walls),
// 64 px/m (caps), 320 px/m (block faces): per-vertex plate id + plate pixel coords, no stretch, no repetition.
// Light: sun * N.L * static world-fixed shadow + neutral ambient (slight cool), no violet fill. Code never paints rock.
import { FOG_GLSL, fogUniforms, headingToDir } from "../runtime/biome-runtime.js?v=7";
import { HAZE_GLSL } from "../air.mjs?v=48";

const MV = "9";
