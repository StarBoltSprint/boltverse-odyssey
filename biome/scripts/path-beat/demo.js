#!/usr/bin/env node
/** node biome/scripts/path-beat/demo.js */
import { HOWL, pickHowlLane } from "../howl-live/howlLive.js";
import {
  PATH_BEAT,
  RAIL,
  CHEMIN,
  pickPathLane,
  pathBeatChart,
  pathBeatState,
  pathBeatFrame,
  pathBeatResolve,
} from "./pathBeat.js";

function assert(name, cond) {
  if (!cond) {
    console.error("FAIL", name);
    process.exit(1);
  }
  console.log("ok", name);
}

assert("lookahead default is 3s", PATH_BEAT.lookahead === 3);
assert("densify is a loop, not tiles", RAIL.tileDensify === false && RAIL.coversPlate === false && RAIL.densify === "A");
assert("gap stays wider than the lookahead", PATH_BEAT.gapMin > PATH_BEAT.lookahead);

const chart = pathBeatChart(4, { count: 24 });
assert("chart emits beats", chart.beats.length === 24 && chart.tileDensify === false);
assert(
  "each beat leads by ~3s",
  chart.beats.every((b) => Math.abs(b.tContact - b.tReveal - 3) < 1e-9),
);
const lanes = new Set(chart.beats.map((b) => b.lane));
assert("beats emit L, C, and R", lanes.has("L") && lanes.has("C") && lanes.has("R"));
assert(
  "lane letters match cone index",
  chart.beats.every((b) => (b.lane === "L" && b.laneIndex === -1) || (b.lane === "C" && b.laneIndex === 0) || (b.lane === "R" && b.laneIndex === 1)),
);

const ctx = {
  cw: 768,
  ch: 1168,
  pawY: 980,
  destH0: 180,
  blocked: [],
  plate: [],
  playerLane: "C",
};

const early = pathBeatFrame(pathBeatState(4), 0, { ...ctx, now: 0 });
assert("before reveal the lane is not live", early.beats.length === 0 && early.active === null && early.tileDensify === false);

const first = chart.beats[0];
const revealed = pathBeatFrame(pathBeatState(4), 0, { ...ctx, now: first.tReveal });
assert("reveal matches the chart", revealed.beats.length === 1 && revealed.beats[0].id === first.id && revealed.beats[0].lane === first.lane);
assert("one window, not the whole chart", revealed.beats.length === 1 && chart.beats.length > 1);
const live = revealed.beats[0];
assert("lead at reveal is the lookahead", Math.abs(live.secondsLeft - 3) < 1e-9);
assert("chemin sits ahead of the paws", live.ahead === true && live.pose.ground.y < ctx.pawY);
assert("z matches 3s of Howl travel", Math.abs(live.z - 3 / HOWL.travel) < 1e-9);
assert("quad is one lane, not the plate", live.pose.dest.w < ctx.cw * 0.5 && live.pose.dest.h < ctx.ch * 0.5);
assert("look file is the chemin, not a densify crop", live.look === CHEMIN && !/road-/.test(live.look));

const hit = pathBeatFrame(revealed.state, 0, { ...ctx, now: first.tContact, playerLane: first.lane });
assert("contact on the target lane is a hit", hit.resolved.length === 1 && hit.resolved[0].result === "hit" && hit.resolved[0].id === first.id);
assert("hit does not leave the chemin under the paws", hit.beats.every((b) => b.id !== first.id));
assert("contact does not tile densify", hit.tileDensify === false && hit.coversPlate === false && hit.densify === "A");

const other = first.lane === "L" ? "R" : "L";
const miss = pathBeatFrame(revealed.state, 0, { ...ctx, now: first.tContact, playerLane: other });
assert("contact on another lane is a miss", miss.resolved.length === 1 && miss.resolved[0].result === "miss" && miss.resolved[0].playerLane === other);
assert("resolver agrees", pathBeatResolve(first.lane, first) === "hit" && pathBeatResolve(other, first) === "miss");

const walled = pathBeatChart(2, { count: 6, blocked: [-1, 1], plate: [] });
assert("two closed lanes → path takes the free corridor", walled.beats.length === 6 && walled.beats.every((b) => b.lane === "C"));
assert("Howl still shares a taken lane and leaves that corridor", pickHowlLane([-1, 1], [], 0.2) !== 0 && pickHowlLane([-1, 1], [], 0.8) !== 0);
assert("path pick is that same free corridor", pickPathLane([-1, 1], [], 0.2) === 0 && pickPathLane([-1, 1], [], 0.9) === 0);
assert("a full wall schedules nothing", pickPathLane([-1, 0, 1], [], 0.4) === null);
const shut = pathBeatFrame(pathBeatState(2), 0, { ...ctx, now: 10, blocked: [-1, 0, 1], playerLane: "C" });
assert("full wall emits no forced beat", shut.beats.length === 0 && shut.resolved.length === 0 && shut.tileDensify === false);

let state = pathBeatState(4);
let now = 0;
let saw = null;
for (let i = 0; i < 400 && !saw; i++) {
  now += 0.05;
  const frame = pathBeatFrame(state, 0.05, { ...ctx, now, playerLane: "C" });
  state = frame.state;
  if (frame.active) saw = frame.active;
}
assert("dt clock reveals a beat ahead of the paws", saw && saw.ahead && saw.secondsLeft > 2);

console.log(
  JSON.stringify(
    {
      lookahead: PATH_BEAT.lookahead,
      first: { lane: first.lane, tReveal: +first.tReveal.toFixed(3), tContact: +first.tContact.toFixed(3) },
      lanes: [...lanes].sort(),
      hit: hit.resolved[0].result,
      miss: miss.resolved[0].result,
    },
    null,
    2,
  ),
);
