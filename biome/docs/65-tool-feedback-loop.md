# 65 — Tool feedback loop (any session)

Kitchen. Dated **2026-10-02**. This page names no biome paint. Each player chooses the style. The tools and the laws stay shared.

When a Grok session finds that a repo tool let a defect through, gave a wrong number, or was hard to use, it must:

1. **Finish its own take** normally. File the report after the take, not instead of it.
2. **Write the issue body** into a file on its branch: `feedback/<date>-<tool>.md` (example: `feedback/2026-10-02-layout.md`). Use the fields below. Same fields as [`.github/ISSUE_TEMPLATE/tool-feedback.yml`](../../.github/ISSUE_TEMPLATE/tool-feedback.yml).
3. **Tell the human** to open that file as an issue upstream: https://github.com/StarBoltSprint/boltverse-odyssey/issues/new?template=tool-feedback.yml

Grok Build cannot open issues itself unless that session has GitHub access. If it does, it opens the issue directly and still keeps the file on the branch.

Upstream maintainers review and turn accepted issues into tool PRs. Nothing auto-merges.

## Tools

`tools/walkaround` (hull / volume) · `tools/objsheet` · `tools/assetcheck` · `tools/layout` · `tools/playcheck` · `tools/reportview` · `tools/perf` (perf / render lint) · a law in `biome/docs/`.

## Fields

| Field | Required |
|---|---|
| Which tool | yes |
| Tool version / commit (`git rev-parse --short HEAD` on the recipe checkout) | yes |
| Take / branch and commit of the game being tested | yes |
| Defect seen on screen | yes |
| Metric the tool reported vs what was actually measured (both numbers) | yes |
| How to reproduce (the command) | yes |
| Still / screenshot | yes |
| Short video | no |
| Proposed fix | no |
| Confirmation: no secrets, API keys, tokens, or private style prompts | yes |

## File

```markdown
# [tool-feedback] <short title>

- Tool:
- Tool version / commit:
- Take / branch + commit:
- Defect seen on screen:
- Tool metric vs measured:
- Reproduce:
- Still / screenshot:
- Short video:
- Proposed fix:
- No secrets, API keys, tokens, or private style prompts: yes
```

Put the still next to the file (or a path in the take). The upstream form has no separate file input: drag the image into the still box.

## Label

The form requests the label `tool-feedback` and the title prefix `[tool-feedback]`. Blank issues stay allowed (`.github/ISSUE_TEMPLATE/config.yml`).

This change does not create the label. Create it once on `StarBoltSprint/boltverse-odyssey` if it is missing:

```bash
gh label create tool-feedback \
  --description "A repo tool missed a defect, reported a wrong number, or was hard to use." \
  --color 0E8A16
```

If the label is missing, GitHub ignores it on the form. The title prefix still marks the issue.

## Do not

- Put API keys, tokens, or the player's private style prompt in the file or the issue.
- Stop the take to wait on upstream.
- Auto-merge a tool change from the report. Maintainers open the tool PR.
- Open a second channel (a chat paste, a fork-only note with no file). The file plus the upstream issue is the loop.
