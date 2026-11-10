// Capture / demo route for the meadow page.
// The old stunt list turned 360° from t=12 and drove Bolt through the mill.
// Collision then slid him around the house while the follow camera whipped,
// so the mill entered and left the narrow view in about a second.
// This route crosses the upstream ford, holds the mill ahead, peels before
// the house (safe clearance), then holds that heading. No full spins.
const TAU = Math.PI * 2;

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function aimPsi(x, z, tx, tz) {
  return Math.atan2(-(tx - x), -(tz - z));
}

export function makeMeadowRoute(opts = {}) {
  const ford = opts.ford || [-3.6, -40.5];
  const house = opts.house;
  const peelAt = opts.peelAt ?? 26;
  const peel = opts.peel ?? -0.9;
  const maxW = opts.maxW ?? 0.45;
  const tau = opts.tau ?? 0.28;
  let phase = 'toFord';
  let exitPsi = 0;
  return {
    reset() { phase = 'toFord'; exitPsi = 0; },
    phase: () => phase,
    omega(x, z, psi) {
      if (!house) return 0;
      const dM = Math.hypot(house[0] - x, house[1] - z);
      let des;
      if (phase === 'toFord') {
        des = aimPsi(x, z, ford[0], ford[1]);
        if (Math.hypot(x - ford[0], z - ford[1]) < 4) phase = 'aim';
      } else if (phase === 'aim') {
        des = aimPsi(x, z, house[0], house[1]);
        if (dM < peelAt) { phase = 'peel'; exitPsi = psi + peel; }
      } else des = exitPsi;
      const err = angDiff(des, psi);
      return Math.max(-maxW, Math.min(maxW, err / tau));
    },
  };
}
