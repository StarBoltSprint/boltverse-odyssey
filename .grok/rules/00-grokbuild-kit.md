# Grok Build CLI kit — zone A step 4 rules (style-agnostic)

1. Before your FIRST edit in this session, and again after any context compaction:
   - read `GROK.md` at the repo root (all of it, page through it if it is long), and
   - read the step spec, whose absolute path is in `.grok/kit-spec-path`
     (/workspace/grokcli/next/step-04-gate-wreck.md).
   Edits are blocked by a hook until both have been read with `read_file` in this session.
2. The spec decides style, assets and acceptance. Do not invent a style; follow the spec, docs/METHOD.md and GROK.md.
3. Work only inside this worktree (plus the out/ and local prompt paths the spec names). Never touch /workspace/grokcli/zoneA.
   Local commits are fine. At the end, push ONLY branch zone-a-step4-gate-wreck and open ONE PR to main, as the spec says.
   Never merge, force-push, push to main, or `git reset --hard`. A guard hook blocks those; do not try to get around it.
4. Imagine tools available here: `image_gen`, `image_edit` (max 3 source images), `image_to_video`, `reference_to_video`.
   This step: at most 30 image calls total, 0 videos, each logged in the cooklog. See IMAGINE.md in the kit for syntax.
5. End your step with a short summary: PR URL, files changed, checks run, what is left.
