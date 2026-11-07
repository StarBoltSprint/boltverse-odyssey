// Breath page = the current meadow page plus the gen4b crossfade.
import { breathMixWgsl } from '../bricks/bolt-breath.js';

export function breathFromMeadow(src) {
  const banner = '// m448aaa3-breath1 — current meadow. Released run brakes, then the gen4b breath loop. Gallop resumes on input.\n';
  let out = banner + src;
  const mix = breathMixWgsl().trim();
  const swaps = [
    [
      "import { boltIdle, measureAtlasFeet, pickPlantedFrame } from './bricks/bolt-idle.js?v=9';",
      "import { boltIdle, measureAtlasFeet, pickPlantedFrame } from './bricks/bolt-idle.js?v=9';\nimport { stepBreath, BREATH_MEADOW, makeBreathClip, BREATH_BUILD } from './bricks/bolt-breath.js?v=breath1';",
    ],
    [
      'const IDLE = boltIdle({ ...MEADOW.boltIdle });',
      "const IDLE = boltIdle({ ...MEADOW.boltIdle });\nwindow.__meadowBuild = BREATH_BUILD;",
    ],
    [
      'IDLE.stepMotion(live, dt, runWanted());   // bricks/bolt-idle: accel/brake/phase/breath/tail',
      'IDLE.stepMotion(live, dt, runWanted());   // bricks/bolt-idle: accel/brake/phase\n  stepBreath(live, dt, runWanted(), { ...BREATH_MEADOW, speed: IDLE.cfg.speed, blendV: IDLE.cfg.blendV });',
    ],
    [
      'fn cell(f: u32, uv: vec2f) -> vec4f { let g = vec2f(f32(f % 8u), f32(f / 8u)); return textureSampleLevel(atex, samp, (g + clamp(uv, vec2f(0.003), vec2f(0.997))) / vec2f(8.0, 4.0), 0.0); }',
      'fn cell(f: u32, uv: vec2f) -> vec4f { let g = vec2f(f32(f % 8u), f32(f / 8u)); return textureSampleLevel(atex, samp, (g + clamp(uv, vec2f(0.003), vec2f(0.997))) / vec2f(8.0, 4.0), 0.0); }\n' + mix,
    ],
    [
      `  let s = mix(cell(a, uvs), cell(bb, uvs), k);
  if (s.a < 0.10) { discard; }
  var c = s.rgb;`,
      `  let s = mix(cell(a, uvs), cell(bb, uvs), k);
  let mixed = breathMix(s.rgb, s.a, uvs);
  if (mixed.a < select(0.10, 0.04, u.misc.y > 0.001)) { discard; }
  var c = mixed.rgb;`,
    ],
    [
      'return vec4f(pow(clamp(c, vec3f(0), vec3f(1)), vec3f(1.0 / 2.2)), s.a);',
      'return vec4f(pow(clamp(c, vec3f(0), vec3f(1)), vec3f(1.0 / 2.2)), mixed.a);',
    ],
    [
      'o.col = vec4f(0.0, 0.0, 0.0, u.misc.x * 0.42); return o; }',
      'o.col = vec4f(0.0, 0.0, 0.0, u.misc.y * 0.42); return o; }',
    ],
    [
      "{ binding: 17, visibility: 3, buffer: { type: 'read-only-storage' } } ] });",
      "{ binding: 17, visibility: 3, buffer: { type: 'read-only-storage' } }, { binding: 18, visibility: 2, texture: {} } ] });",
    ],
    [
      '{ binding: 17, resource: { buffer: prb } } ] });',
      '{ binding: 17, resource: { buffer: prb } }, { binding: 18, resource: breathClip.texture.createView() } ] });',
    ],
    [
      '{ binding: 17, resource: { buffer: prb } } ] }));',
      '{ binding: 17, resource: { buffer: prb } }, { binding: 18, resource: breathClip.texture.createView() } ] }));',
    ],
    [
      'const samp = dev.createSampler({ magFilter: \'linear\', minFilter: \'linear\', mipmapFilter: \'linear\', addressModeU: \'repeat\', addressModeV: \'repeat\', maxAnisotropy: 8 });',
      'const breathClip = await makeBreathClip(dev, A);\n  const samp = dev.createSampler({ magFilter: \'linear\', minFilter: \'linear\', mipmapFilter: \'linear\', addressModeU: \'repeat\', addressModeV: \'repeat\', maxAnisotropy: 8 });',
    ],
    [
      "{ const life = IDLE.sample(); IDLE.writeUniforms(U, life); if (qs.get('dbg') === '1') U[54] = 1; window.__idleLife = life; }",
      "{ const life = IDLE.sample(); IDLE.writeUniforms(U, life); U[52] = 0.0; U[53] = live.idleMix || 0; if (qs.get('dbg') === '1') U[54] = 1; window.__idleLife = life; window.__breath = { state: live.breathState || 'run', frame: live.breathFrame || 0, mix: live.idleMix || 0 }; }",
    ],
    [
      'function render(t) {',
      'function render(t) {\n    breathClip.sync(live.idleT || 0);',
    ],
    [
      'hud.textContent = `v448aaa3${DEMO ? \' · demo\' : \'\'}',
      'hud.textContent = `v448aaa3-breath1${DEMO ? \' · demo\' : \'\'} · ${live.breathState || \'run\'}',
    ],
  ];
  for (const [oldText, newText] of swaps) {
    const n = out.split(oldText).length - 1;
    if (n < 1) throw new Error('meadow pattern missing: ' + oldText.slice(0, 90));
    out = out.replaceAll(oldText, newText);
  }
  if (!out.includes('paceFrame') && out.includes('stepBreath') && out.includes('tIdle')) return out;
  if (!out.includes('stepBreath')) throw new Error('breath step missing');
  return out;
}
