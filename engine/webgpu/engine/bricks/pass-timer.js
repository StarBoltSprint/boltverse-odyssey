// Per-pass GPU timestamps plus the CPU clocks around one meadow frame.
// Wall, CPU and GPU are separate. This module does not add or subtract them.
// Timestamp reads use mapAsync and never await it on the frame that submitted the pass.
// Spec: https://www.w3.org/TR/webgpu/#timestamp-query (nanoseconds, coarsened, counter may reset).

export const PASS_LIMIT = 8;
export const READ_SLOTS = 3;
export const SAMPLE_LIMIT = 64;

export function decodeDelta(begin, end) {
  const delta = BigInt(end) - BigInt(begin);
  if (delta < 0n) return { status: 'invalid', ns: null };
  if (delta > BigInt(Number.MAX_SAFE_INTEGER)) return { status: 'invalid', ns: null };
  const ns = Number(delta);
  if (ns === 0) return { status: 'zero', ns: 0 };
  return { status: 'ok', ns };
}

export function decodePasses(times, names) {
  const passes = {};
  let invalid = 0;
  let zero = 0;
  let ok = 0;
  for (let i = 0; i < names.length; i++) {
    const row = decodeDelta(times[i * 2], times[i * 2 + 1]);
    passes[names[i]] = row;
    if (row.status === 'invalid') invalid += 1;
    else if (row.status === 'zero') zero += 1;
    else ok += 1;
  }
  const status = invalid ? 'invalid' : (ok ? 'ok' : 'zero');
  return { status, passes };
}

function summarize(values) {
  if (!values.length) return { n: 0 };
  const s = values.slice().sort((a, b) => a - b);
  const at = (p) => s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))];
  return { n: s.length, median: at(0.5), p95: at(0.95), max: s[s.length - 1] };
}

export function makePassTimer(device, opts = {}) {
  const passLimit = opts.passLimit || PASS_LIMIT;
  const slotCount = opts.slots || READ_SLOTS;
  const sampleLimit = opts.sampleLimit || SAMPLE_LIMIT;
  const supported = !!(device && device.features && device.features.has('timestamp-query'));
  const ring = [];
  let dropped = 0;
  let evicted = 0;
  let pending = 0;
  let dead = false;
  let frameGpu = 'unavailable';
  let active = null;
  let names = [];
  const slots = [];

  if (supported) {
    const bytes = passLimit * 2 * 8;
    for (let i = 0; i < slotCount; i++) {
      slots.push({
        i,
        phase: 'free',
        generation: 0,
        names: [],
        sample: null,
        querySet: device.createQuerySet({ type: 'timestamp', count: passLimit * 2 }),
        resolve: device.createBuffer({
          size: bytes,
          usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
        }),
        map: device.createBuffer({
          size: bytes,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        }),
      });
    }
  }

  function pushSample(sample) {
    ring.push(sample);
    while (ring.length > sampleLimit) {
      const old = ring.shift();
      if (old && old.gpuStatus === 'pending') {
        old.evicted = true;
        evicted += 1;
      }
    }
  }

  function begin() {
    names = [];
    active = null;
    if (!supported) {
      frameGpu = 'unavailable';
      return { gpu: false };
    }
    const free = slots.find((s) => s.phase === 'free');
    if (!free) {
      dropped += 1;
      frameGpu = 'dropped';
      return { gpu: false, reason: 'dropped' };
    }
    free.phase = 'claimed';
    free.names = [];
    free.sample = null;
    active = free;
    frameGpu = 'pending';
    return { gpu: true, slot: free.i };
  }

  function stamp(name) {
    if (!active || names.length >= passLimit) return undefined;
    const index = names.length;
    names.push(name);
    return {
      querySet: active.querySet,
      beginningOfPassWriteIndex: index * 2,
      endOfPassWriteIndex: index * 2 + 1,
    };
  }

  function resolve(encoder) {
    if (!active) return;
    if (!names.length) {
      active.phase = 'free';
      active = null;
      frameGpu = 'unavailable';
      return;
    }
    const slot = active;
    slot.names = names.slice();
    slot.generation += 1;
    encoder.resolveQuerySet(slot.querySet, 0, slot.names.length * 2, slot.resolve, 0);
    encoder.copyBufferToBuffer(slot.resolve, 0, slot.map, 0, slot.names.length * 16);
    slot.phase = 'submitted';
    active = null;
  }

  function record(row) {
    const sample = {
      wallMs: row.wallMs,
      cpuPrepMs: row.cpuPrepMs,
      cpuEncodeMs: row.cpuEncodeMs,
      gpuStatus: frameGpu,
      gpu: null,
    };
    if (frameGpu === 'pending') {
      const slot = slots.find((s) => s.phase === 'submitted' && !s.sample);
      if (slot) {
        slot.sample = sample;
        pending += 1;
      } else {
        sample.gpuStatus = 'dropped';
      }
    }
    pushSample(sample);
    return sample;
  }

  function release(sample) {
    if (!sample || sample.released || sample.gpuStatus !== 'pending') return;
    sample.released = true;
    pending = Math.max(0, pending - 1);
  }

  function finishMap(slot, gen) {
    if (dead || slot.generation !== gen) return;
    slot.phase = 'free';
    slot.sample = null;
  }

  function kick() {
    if (!supported || dead) return;
    for (const slot of slots) {
      if (slot.phase !== 'submitted') continue;
      const gen = slot.generation;
      const sample = slot.sample;
      slot.phase = 'mapping';
      slot.map.mapAsync(GPUMapMode.READ).then(() => {
        if (dead || slot.generation !== gen) {
          try { slot.map.unmap(); } catch (e) { /* already unmapped */ }
          return;
        }
        try {
          const range = slot.map.getMappedRange();
          const times = range instanceof BigInt64Array ? range : new BigInt64Array(range);
          const decoded = decodePasses(times, slot.names);
          release(sample);
          if (sample && !sample.evicted) {
            sample.gpuStatus = decoded.status;
            sample.gpu = decoded.passes;
          }
        } catch (e) {
          release(sample);
          if (sample && !sample.evicted) {
            sample.gpuStatus = 'invalid';
            sample.gpuError = String(e).slice(0, 180);
          }
        } finally {
          try { slot.map.unmap(); } catch (err) { /* unmap is once */ }
        }
        finishMap(slot, gen);
      }, (err) => {
        release(sample);
        if (sample && !sample.evicted) {
          sample.gpuStatus = 'invalid';
          sample.gpuError = String(err).slice(0, 180);
        }
        finishMap(slot, gen);
      });
    }
  }

  function gpuSummary() {
    if (!supported) return null;
    const byPass = {};
    for (const sample of ring) {
      if (!sample.gpu) continue;
      for (const [name, row] of Object.entries(sample.gpu)) {
        if (!byPass[name]) byPass[name] = { ok: [], zero: 0, invalid: 0 };
        if (row.status === 'ok') byPass[name].ok.push(row.ns);
        else if (row.status === 'zero') byPass[name].zero += 1;
        else byPass[name].invalid += 1;
      }
    }
    const out = {};
    for (const [name, row] of Object.entries(byPass)) {
      out[name] = { ...summarize(row.ok), zero: row.zero, invalid: row.invalid, unit: 'ns' };
    }
    return out;
  }

  function exportReport(extra = {}) {
    const pendingNow = ring.filter((s) => s.gpuStatus === 'pending').length;
    return {
      kind: 'pass-profile',
      timestampQuery: supported,
      units: { wallMs: 'ms', cpuPrepMs: 'ms', cpuEncodeMs: 'ms', gpuNs: 'ns' },
      clocks: 'wallMs, cpuPrepMs, cpuEncodeMs and gpuNs overlap. They are not added or subtracted.',
      quantization: 'Timestamp values are nanoseconds coarsened by the browser. Chrome uses 100 µs. A negative delta is a counter reset and is invalid. A 0 ns delta is at or below that quantum, or an unresolved query.',
      n: ring.length,
      dropped,
      evicted,
      pending: pendingNow,
      wall: summarize(ring.map((s) => s.wallMs)),
      cpuPrep: summarize(ring.map((s) => s.cpuPrepMs)),
      cpuEncode: summarize(ring.map((s) => s.cpuEncodeMs)),
      gpu: gpuSummary(),
      samples: ring.map((s) => ({
        wallMs: s.wallMs,
        cpuPrepMs: s.cpuPrepMs,
        cpuEncodeMs: s.cpuEncodeMs,
        gpuStatus: s.gpuStatus,
        gpu: s.gpu,
        ...(s.gpuError ? { gpuError: s.gpuError } : {}),
      })),
      ...extra,
    };
  }

  function overlay() {
    const report = exportReport();
    const wall = report.wall.n ? `wall med ${report.wall.median} p95 ${report.wall.p95} ms` : 'wall —';
    const prep = report.cpuPrep.n ? `cpuPrep med ${report.cpuPrep.median} ms` : 'cpuPrep —';
    const enc = report.cpuEncode.n ? `cpuEncode med ${report.cpuEncode.median} ms` : 'cpuEncode —';
    const gpu = supported ? 'gpu timestamp-query' : 'gpu unavailable';
    return `pass-profile n=${report.n}\n${wall}\n${prep}\n${enc}\n${gpu} pending ${report.pending} dropped ${report.dropped}`;
  }

  function destroy() {
    dead = true;
    for (const slot of slots) {
      for (const key of ['map', 'resolve', 'querySet']) {
        try { slot[key].destroy(); } catch (e) { /* already destroyed */ }
      }
    }
  }

  return { supported, begin, stamp, resolve, record, kick, export: exportReport, overlay, destroy, slots };
}
