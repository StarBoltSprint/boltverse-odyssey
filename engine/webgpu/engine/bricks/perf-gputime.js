// perf-gputime: per-pass GPU timings via timestamp-query when the adapter offers it; CPU fallback otherwise (any biome).
export function makeGpuTimer(dev, maxPass = 16) {
  const ok = dev.features.has('timestamp-query'); const names = []; const avg = {};
  if (!ok) return { ok, pass: () => undefined, resolve() {}, read: async () => avg, begin() { names.length = 0; } };
  const qs = dev.createQuerySet({ type: 'timestamp', count: maxPass * 2 });
  const rb = dev.createBuffer({ size: maxPass * 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
  const mb = dev.createBuffer({ size: maxPass * 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); let busy = false;
  return { ok, begin() { names.length = 0; },
    pass(name) { const i = names.length; if (i >= maxPass) return undefined; names.push(name); return { querySet: qs, beginningOfPassWriteIndex: i * 2, endOfPassWriteIndex: i * 2 + 1 }; },
    resolve(enc) { if (busy || !names.length) return; enc.resolveQuerySet(qs, 0, names.length * 2, rb, 0); enc.copyBufferToBuffer(rb, 0, mb, 0, names.length * 16); },
    async read() { if (busy) return avg; busy = true; const nm = names.slice(); await mb.mapAsync(GPUMapMode.READ); const t = new BigInt64Array(mb.getMappedRange());
      nm.forEach((n, i) => { const ms = Number(t[i * 2 + 1] - t[i * 2]) / 1e6; avg[n] = avg[n] === undefined ? ms : avg[n] * 0.9 + ms * 0.1; }); mb.unmap(); busy = false; return avg; } };
}
