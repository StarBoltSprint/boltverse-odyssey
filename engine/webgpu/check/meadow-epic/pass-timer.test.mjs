// Mocked timestamp-query present and absent. No browser, no phone, no GPU.
import assert from 'node:assert/strict';
import { decodeDelta, decodePasses, makePassTimer, READ_SLOTS } from '../../engine/bricks/pass-timer.js';

globalThis.GPUBufferUsage = globalThis.GPUBufferUsage || {
  QUERY_RESOLVE: 1, COPY_SRC: 2, COPY_DST: 4, MAP_READ: 8,
};
globalThis.GPUMapMode = globalThis.GPUMapMode || { READ: 1 };

function fakeDevice(feature) {
  const buffers = [];
  const sets = [];
  const features = new Set(feature ? ['timestamp-query'] : []);
  return {
    features,
    buffers,
    sets,
    createQuerySet(desc) {
      const qs = { ...desc, destroyed: false, destroy() { this.destroyed = true; } };
      sets.push(qs);
      return qs;
    },
    createBuffer(desc) {
      const buf = {
        size: desc.size,
        usage: desc.usage,
        destroyed: false,
        mapped: false,
        maps: 0,
        pending: null,
        bytes: new BigInt64Array(desc.size / 8),
        mapAsync() {
          if (this.destroyed) return Promise.reject(new Error('destroyed'));
          if (this.mapped || this.pending) return Promise.reject(new Error('already mapped'));
          this.maps += 1;
          return new Promise((resolve, reject) => { this.pending = { resolve, reject }; });
        },
        flush() {
          if (!this.pending) throw new Error('no map waiting');
          this.mapped = true;
          const { resolve } = this.pending;
          this.pending = null;
          resolve();
        },
        fail() {
          if (!this.pending) return;
          const { reject } = this.pending;
          this.pending = null;
          reject(new Error('map failed'));
        },
        getMappedRange() { return this.bytes; },
        unmap() { this.mapped = false; },
        destroy() {
          this.destroyed = true;
          if (this.pending) this.fail();
        },
      };
      buffers.push(buf);
      return buf;
    },
  };
}

function encoder() {
  const calls = [];
  return {
    calls,
    resolveQuerySet(...args) { calls.push(['resolve', ...args]); },
    copyBufferToBuffer(...args) { calls.push(['copy', ...args]); },
  };
}

function frame(timer, enc, names, wall) {
  const began = timer.begin();
  const stamps = names.map((name) => timer.stamp(name));
  timer.resolve(enc);
  const sample = timer.record({ wallMs: wall, cpuPrepMs: 0.05, cpuEncodeMs: 0.2 });
  const kicked = timer.kick();
  return { began, stamps, sample, kicked };
}

assert.deepEqual(decodeDelta(0n, 110000n), { status: 'ok', ns: 110000 });
assert.deepEqual(decodeDelta(50n, 50n), { status: 'zero', ns: 0 });
assert.deepEqual(decodeDelta(80n, 10n), { status: 'invalid', ns: null });
assert.equal(decodePasses([0n, 1000n, 90n, 10n], ['main', 'shadow']).status, 'invalid');

const absent = fakeDevice(false);
const off = makePassTimer(absent);
assert.equal(off.supported, false);
assert.equal(absent.sets.length, 0);
assert.equal(absent.buffers.length, 0);
const offEnc = encoder();
const offFrame = frame(off, offEnc, ['main', 'shadow'], 84.7);
assert.equal(offFrame.stamps[0], undefined);
assert.equal(offFrame.kicked, undefined);
assert.equal(offEnc.calls.length, 0);
assert.equal(offFrame.sample.gpuStatus, 'unavailable');
assert.equal(absent.buffers.reduce((n, b) => n + b.maps, 0), 0);
const offReport = off.export({ adapter: { architecture: 'none' } });
assert.equal(offReport.timestampQuery, false);
assert.equal(offReport.gpu, null);
assert.equal(offReport.samples[0].wallMs, 84.7);
assert.equal(offReport.clocks.includes('not added'), true);
off.destroy();

const present = fakeDevice(true);
const on = makePassTimer(present);
assert.equal(on.supported, true);
assert.equal(present.sets.length, READ_SLOTS);
assert.equal(present.buffers.length, READ_SLOTS * 2);
const enc = encoder();
const first = frame(on, enc, ['shadow', 'main'], 84.7);
assert.equal(first.kicked, undefined);
assert.equal(first.sample.gpuStatus, 'pending');
assert.equal(first.stamps[0].beginningOfPassWriteIndex, 0);
assert.equal(first.stamps[1].endOfPassWriteIndex, 3);
assert.equal(first.stamps[0].querySet, present.sets[0]);
assert.equal(enc.calls[0][0], 'resolve');
assert.equal(enc.calls[1][0], 'copy');
assert.equal(present.buffers[1].maps, 1);
assert.equal(present.buffers[1].mapped, false);
const overlap = frame(on, encoder(), ['post-final'], 90);
assert.notEqual(overlap.stamps[0].querySet, first.stamps[0].querySet);
const mapBuf = present.buffers.filter((b) => b.usage & GPUBufferUsage.MAP_READ);
mapBuf[0].bytes.set([1000n, 1000n + 2500000n, 10n, 10n]);
mapBuf[0].flush();
await Promise.resolve();
assert.equal(first.sample.gpuStatus, 'ok');
assert.equal(first.sample.gpu.shadow.ns, 2500000);
assert.equal(first.sample.gpu.main.status, 'zero');
assert.equal(on.slots[0].phase, 'free');
mapBuf[1].bytes.set([1n, 100001n]);
mapBuf[1].flush();
await Promise.resolve();
assert.equal(overlap.sample.gpuStatus, 'ok');
assert.equal(overlap.sample.gpu['post-final'].ns, 100000);
assert.equal(on.export().pending, 0);

const secondEnc = encoder();
const second = frame(on, secondEnc, ['shadow'], 205.1);
assert.equal(second.stamps[0].querySet, first.stamps[0].querySet);
const resetBuf = on.slots[0].map;
resetBuf.bytes.set([500n, 100n]);
await Promise.resolve();
resetBuf.flush();
await Promise.resolve();
assert.equal(second.sample.gpuStatus, 'invalid');
assert.equal(second.sample.gpu.shadow.status, 'invalid');
assert.equal(second.sample.gpu.shadow.ns, null);

const held = [];
for (let i = 0; i < READ_SLOTS; i++) {
  held.push(frame(on, encoder(), ['main'], 10 + i));
}
assert.equal(held.every((f) => f.sample.gpuStatus === 'pending'), true);
const overflow = frame(on, encoder(), ['main'], 99);
assert.equal(overflow.began.gpu, false);
assert.equal(overflow.sample.gpuStatus, 'dropped');
assert.equal(present.sets.length, READ_SLOTS);
assert.equal(on.export().dropped, 1);
for (const slot of on.slots) {
  if (slot.map.pending) {
    slot.map.bytes.set([1n, 2n]);
    slot.map.flush();
  }
}
await Promise.resolve();
await Promise.resolve();
assert.equal(on.slots.every((s) => s.phase === 'free'), true);
const again = frame(on, encoder(), ['main'], 11);
assert.equal(again.began.gpu, true);

const failing = frame(on, encoder(), ['main'], 12);
const failSlot = on.slots.find((s) => s.sample === failing.sample);
failSlot.map.fail();
await Promise.resolve();
assert.equal(failing.sample.gpuStatus, 'invalid');
assert.match(failing.sample.gpuError, /map failed/);
assert.equal(failSlot.phase, 'free');

for (let i = 0; i < 70; i++) frame(on, encoder(), ['main'], i);
assert.equal(on.export().n, 64);
assert.ok(on.export().evicted >= 1);
on.destroy();
assert.equal(present.sets.every((s) => s.destroyed), true);

console.log('PASS pass-timer', { absent: offReport.timestampQuery, slots: READ_SLOTS, kept: on.export().n });
