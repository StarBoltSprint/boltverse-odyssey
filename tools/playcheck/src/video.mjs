import { spawn } from "node:child_process";
import { statSync } from "node:fs";

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * CDP screencast → H.264 mp4.
 * Frames are timestamped in sim time (30 fps) by duplicating the latest paint,
 * so a slow software GL frame does not stretch the file.
 */
export async function openVideo(page, outPath) {
  const cdp = await page.context().newCDPSession(page);
  let latest = null;
  let seq = 0;
  cdp.on("Page.screencastFrame", (ev) => {
    latest = { seq: ++seq, jpeg: Buffer.from(ev.data, "base64") };
    cdp.send("Page.screencastFrameAck", { sessionId: ev.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 72,
    maxWidth: 720,
    maxHeight: 1600,
    everyNthFrame: 1,
  });
  const ff = spawnFfmpeg(outPath, ["-crf", "28"]);
  let written = 0;
  return {
    async grab(hold = 1) {
      const seen = seq;
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))).catch(() => {});
      const deadline = Date.now() + 700;
      while (seq === seen && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 15));
      }
      if (!latest) return;
      for (let i = 0; i < hold; i++) {
        await writeBuf(ff, latest.jpeg);
        written++;
      }
    },
    async close() {
      try {
        await cdp.send("Page.stopScreencast");
      } catch {
        /* page may already be closing */
      }
      await closeFfmpeg(ff);
      let bytes = statSync(outPath).size;
      let width = 720;
      let height = 1600;
      if (bytes > MAX_BYTES) {
        const kbps = Math.max(350, Math.floor((14 * 8 * 1024) / Math.max(1, written / 30)));
        const smaller = outPath.replace(/\.mp4$/, ".small.mp4");
        await transcode(outPath, smaller, kbps, false);
        let smallBytes = statSync(smaller).size;
        if (smallBytes > MAX_BYTES) {
          await transcode(outPath, smaller, Math.max(280, Math.floor(kbps * 0.7)), true);
          smallBytes = statSync(smaller).size;
          width = 360;
          height = 800;
        }
        const { renameSync } = await import("node:fs");
        renameSync(smaller, outPath);
        bytes = smallBytes;
      }
      const probe = await probeSize(outPath);
      if (probe) {
        width = probe.width;
        height = probe.height;
      }
      return {
        file: outPath,
        width,
        height,
        fps: 30,
        frames: written,
        seconds: Math.round((written / 30) * 10) / 10,
        bytes,
        codec: "h264",
      };
    },
  };
}

function spawnFfmpeg(outPath, extra) {
  return spawn(
    "ffmpeg",
    [
      "-y",
      "-f",
      "image2pipe",
      "-vcodec",
      "mjpeg",
      "-framerate",
      "30",
      "-i",
      "pipe:0",
      "-an",
      "-vf",
      "scale=720:1600:force_original_aspect_ratio=decrease,pad=720:1600:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      ...extra,
      outPath,
    ],
    { stdio: ["pipe", "ignore", "pipe"] },
  );
}

function writeBuf(ff, buf) {
  if (ff.stdin.write(buf)) return Promise.resolve();
  return new Promise((resolve) => ff.stdin.once("drain", resolve));
}

function closeFfmpeg(ff) {
  return new Promise((resolve, reject) => {
    const err = [];
    ff.stderr.on("data", (d) => err.push(d));
    ff.on("error", reject);
    ff.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(err).toString().slice(-500)}`));
    });
    ff.stdin.end();
  });
}

function transcode(input, output, kbps, shrink) {
  const vf = shrink
    ? "scale=360:800:force_original_aspect_ratio=decrease,pad=360:800:(ow-iw)/2:(oh-ih)/2,format=yuv420p"
    : "scale=720:1600:force_original_aspect_ratio=decrease,pad=720:1600:(ow-iw)/2:(oh-ih)/2,format=yuv420p";
  return new Promise((resolve, reject) => {
    const ff = spawn(
      "ffmpeg",
      [
        "-y",
        "-i",
        input,
        "-an",
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-b:v",
        `${kbps}k`,
        "-maxrate",
        `${kbps}k`,
        "-bufsize",
        `${kbps * 2}k`,
        "-movflags",
        "+faststart",
        output,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    const err = [];
    ff.stderr.on("data", (d) => err.push(d));
    ff.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(Buffer.concat(err).toString().slice(-400)));
    });
  });
}

function probeSize(file) {
  return new Promise((resolve) => {
    const ff = spawn("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    let out = "";
    ff.stdout.on("data", (d) => {
      out += d;
    });
    ff.on("close", () => {
      const [w, h] = out.trim().split(",").map(Number);
      if (w && h) resolve({ width: w, height: h });
      else resolve(null);
    });
    ff.on("error", () => resolve(null));
  });
}
