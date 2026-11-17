// Distance darkens the ice. The no-fog gate must FAIL this text.
let reach = smoothstep(90.0, 360.0, dist);
col = col * mix(1.0, 0.36, reach);
