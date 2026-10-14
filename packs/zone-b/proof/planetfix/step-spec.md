# Ember Mesa planet fix

One photoreal ringed planet as its own Imagine video, with two small moons, keyed soft and shown large in the sky.

1. One looping Imagine video of the whole planet and its ring. The ring is one thin ellipse: behind the planet at the top, in front at the bottom. Cloud bands turn. The ring stays. Golden-hour light, ring shadow on the planet. Pure key colour behind the whole object.
2. Two small moons, farther from the ring, with soft edges. The group sits higher and farther than the old card, and the haze loop crosses it.
3. The video plays on the phone: muted, playsinline, and play() on the first touch. The still does not stay on top of a ready video.
4. Uniform scale at most 1. Native aspect. The card is not stretched. The planet is large because the frame is tight and the video is 720p.
5. Active videos stay at most 4, and the planet video is one of them.

Done when: root npm test passes, playcheck's own test passes, two phone captures 3 s apart show the bands moved, the capture records native size against displayed size, and the shots are in /workspace/grokcli/out/zoneB/planetfix/.
