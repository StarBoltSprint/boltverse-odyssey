# Step — corridor ground covers the pass start

Goal: the pass clip no longer shows black ground near Bolt. The existing carpet quad reaches past the camera at the pass start, so the floor is the m3 still from frame 0 at every pace. The three nit fixes stay. No new Imagine file.

## Rails

- One ground quad, native m3, the same fog sample, the same draws. Extending the quad does not add a texture or a draw.
- The west edge stays behind the near ground of the pass shot (Bolt about 118 m before the gate, camera 6.1 m behind him).
- Horizon seats, rock sink, and the 16 m gate offset stay.

## Done when

1. The carpet west edge is at least 40 m behind the pass-shot Bolt.
2. Frame 0 of the new pass clip has no pure-black pixels in the bottom 60% of the frame.
3. Every 6th frame of that clip is the same.
4. Walk and sprint titles stay at 7 draws and 184.5 MB.
5. The play tests, `hang_selftest.py`, and `renderlint` exit 0.
6. A frame-0 still is saved next to the recooked `monolith-pass.mp4`.
7. No new Imagine file.
8. The horizon seats, the rock sink, and the gate offset are unchanged.
