# Ember Mesa phone fixes — 2026-10-05

Goal: the ringed planet video plays on a phone, and the Anchor is a reachable hard loft.

Rails: Imagine pixels only. No stretching. No invisible wall. At most 4 active videos including Bolt. drawCalls at most 12. Texture bytes at most 260 MiB. No new Imagine still. No new Imagine video.

Done when:

1. Planet bands differ on two mobile-emulated canvas captures 3 s apart, and the console logs that the video is playing.
2. Bolt walks on continuous ground up to the Anchor, through the arch opening, with colliders on the stone.
3. The frontier outpost, the survey drone, and the ribcage stay reachable the same way.
4. Phone-size captures sit in the proof folder. Root tests and playcheck unit tests pass.
