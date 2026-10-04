# [tool-feedback] session video tool rejects the ratios and 1080p that the docs name

- Tool: session Imagine video (`reference_to_video`, `image_to_video`) and `biome/docs/64-imagine-build-limits.md`
- Tool version / commit: recipe checkout parent `89574ee` on branch `archives-shards` (cook commit adds this file)
- Take / branch + commit: Archives futuristic hall, `archives-shards`, parent `89574ee`
- Defect seen on screen: the menu film is 640×1424. A 720×1600 phone therefore cannot be covered at magnification ≤ 1. The gap is a matte band.
- Tool metric vs measured: the session `reference_to_video` schema lists aspects `9:20` and `9:19.5`. The call returned no file: `aspect_ratio must be one of: 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3. Got 9:20.` Doc 64 says 1080p is legal for one-image image-to-video with no last frame. The session `image_to_video` schema lists only `480p` and `720p`, and the 1080p call returned no file: `resolution_name must be one of: 480p, 720p. Got 1080p.` The accepted 720p file measures 640×1424, 24 fps, 145 frames, 6.041667 s. Two image edits that asked for a taller plate measured 576×1280.
- Reproduce: request `reference_to_video` with `aspect_ratio` `9:20` and `resolution_name` `720p`, then `image_to_video` with `resolution_name` `1080p` on one still. Both exit before a media file. Doc 64, resolution table, row “1080p”.
- Still / screenshot: `packs/common/archives/art/hall.jpg` (640×1424). Phone shot `/workspace/grokcli/out/archives/futurist/pause.png`.
- Short video: `packs/common/archives/art/hall-loop.mp4` (ping-pong of the one accepted file).
- Proposed fix: make the session tool schema match the API allow-list, and change doc 64 so a cook does not request 1080p from a tool that only accepts 480p and 720p. A 720×1600 menu plate needs another legal size, or the phone law has to accept the matte.
- No secrets, API keys, tokens, or private style prompts: yes
