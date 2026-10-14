# Grok Build CLI kit — take step rules (style-agnostic)

These rules apply to every headless step started by `run-step.sh`.

1. Before your FIRST edit in this session, and again after any context compaction:
   - read `GROK.md` at the repo root (all of it, page through it if it is long), and
   - read the take's spec file, whose path is in `.grok/kit-spec-path` (normally `spec.md`).
   Edits are blocked by a hook until both have been read with `read_file` in this session.
2. The spec decides style, assets and acceptance. Do not invent a style; follow the spec and GROK.md.
3. Work only inside this worktree. Do not push, merge, force-push, `git reset --hard`, or merge PRs.
   A guard hook blocks those; do not try to get around it. Local commits are fine when the spec asks.
4. Imagine tools available here: `image_gen`, `image_edit` (max 3 source images), `image_to_video`
   (6 or 10 s only), `reference_to_video` (1–15 s, 480p/720p, first/last frame, ≤4 keyframes,
   reference images as <IMAGE_n>). No video extend, no video edit, no 1080p, no 2K image option.
   See IMAGINE.md in the kit for the exact syntax.
5. End your step with a short summary: files changed, checks run, what is left.
