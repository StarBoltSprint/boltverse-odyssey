/**
 * Unit box for a cheap LOD solid. 36 vertices, each vec4:
 * x (-0.5..0.5), y (0..1), z (-0.5..0.5), face kind.
 * Kind 0 is front or back, 1 is a side, 2 is top or bottom.
 * The shader crops the side and cap UVs so a thin face is not a stretched card.
 */
function quad(out, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, kind) {
  out.push(
    ax, ay, az, kind, bx, by, bz, kind, cx, cy, cz, kind,
    ax, ay, az, kind, cx, cy, cz, kind, dx, dy, dz, kind,
  );
}

const verts = [];
quad(verts, -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0.5, -0.5, 1, 0.5, 0);
quad(verts, 0.5, 0, -0.5, -0.5, 0, -0.5, -0.5, 1, -0.5, 0.5, 1, -0.5, 0);
quad(verts, 0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 1, 0.5, 0.5, 1, -0.5, 1);
quad(verts, -0.5, 0, 0.5, -0.5, 0, -0.5, -0.5, 1, -0.5, -0.5, 1, 0.5, 1);
quad(verts, -0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 1, -0.5, -0.5, 1, -0.5, 2);
quad(verts, -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, 2);

export const LOD_BOX = new Float32Array(verts);
export const LOD_BOX_VERTS = 36;
export const LOD_DEPTH_FRAC = 0.42;
