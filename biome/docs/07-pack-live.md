# 07 — Pack Live (gate sub → registry)

Not [PACK.md](../../PACK.md) (citadel hall **folder**).  
This page is the **Grok identity** wire: `sub` → `profiles/<sub>.json` on [StarBoltSprint/boltverse-registry](https://github.com/StarBoltSprint/boltverse-registry).

Contract: [StarBoltSprint/boltverse-pack](https://github.com/StarBoltSprint/boltverse-pack).

**TEMPORARY external host.** Pack API = `https://boltverse-pack.vercel.app` (`BOLTVERSE_PACK_ORIGIN`). Long-term: back to the Grok sandbox when Live wire is stable. Do not treat this Vercel host as the forever Pack API.

**Play URL** (game only, not Pack API): https://boltverse-odysseyyyy.grok.me  
Kitchen Live / Beat 3 (do not paste in player chat): https://boltverse-odysseyyyy.grok.me  
Never open old three-y `boltverse-odysseyyy.grok.me` as Beat 3 Sprint (superseded — do not open it for boot).

First gated Live open **auto-registers** via this Pack origin (`POST /v1/pack/boot` → merge-patch `profiles/<sub>.json`). `playUrl` = the game Live (`https://boltverse-odysseyyyy.grok.me`), not the Pack API host.

---

## HARD LOCK — auto-embed Pack on every new Live (TEMPORARY vercel)

Any Grok reading this GitHub that creates/publishes a new biome/citadel/Sprint Live **MUST auto-embed Pack**: `BOLTVERSE_PACK_ORIGIN=https://boltverse-pack.vercel.app` + [`client/pack.js`](../../client/pack.js). Never ask the player. **Naked Live without Pack = FAIL.**

First gated open auto-registers on central [boltverse-registry](https://github.com/StarBoltSprint/boltverse-registry).

Cold-start still prefers paste `https://boltverse-odysseyyyy.grok.me` (no Build at start). This lock is for when a Live is actually created/published — not a cold-start job. **PRIORITY 0** first reply stays Welcome + teaser + paste. **Welcome = Pack register** stays (real `sub` → merge-patch `profiles/<sub>.json`; never invent a `sub`; `playTimeSec` still Live-only).

Pack wire + plate stats are **in the game recipe** — AUTOMATIC. **Ban** « please install wire » / « drop pack.js if you want Pack » as the normal path. A Live that ships without the wire is **incomplete** = FAIL. **TEMPORARY vercel.** Long-term: back to Grok sandbox when Live wire is stable.

## Hard bans

- No Connect Wallet
- No player API keys
- No xAI keys in the client
- Unsigned / no JWT → `{ ok:false, github:"skip", reason:"no-sub" }` — **never invent a sub**
- Old three-y `boltverse-odysseyyy.grok.me` as Beat 3 Sprint (superseded — do not open it for boot)
- « please install wire » as the normal path
- Shipping a biome / citadel / Sprint Live without `pack.js` + dealer `assetId` stats
- Inventing `assetId` or cassette stats (real or `0` only)
- Pointing `BOLTVERSE_PACK_ORIGIN` at the Play URL while this TEMPORARY split is in force
- Treating `https://boltverse-pack.vercel.app` as the Play / Beat 3 URL

## Floor client (every Live — AUTOMATIC)

Drop [../../client/pack.js](../../client/pack.js). Pack origin is **TEMPORARY** `https://boltverse-pack.vercel.app` — not the Play URL.

**Every Live** (biome / citadel / Sprint publish), including the odysseyyyy game host:

```html
<script>window.BOLTVERSE_PACK_ORIGIN = "https://boltverse-pack.vercel.app"</script>
<script src="https://boltverse-pack.vercel.app/client/pack.js"></script>
```

Same-origin on the Play host is **not** OK while this TEMPORARY split is in force — odysseyyyy is the game, not the Pack API. `client/pack.js` defaults to the Vercel Pack origin when `BOLTVERSE_PACK_ORIGIN` is unset, so the first gated Live open still auto-registers.

Prefer **SSR inject** on the HTML document GET when `x-grok-identity` is present: upsert once, then set `window.__PACK_TICKET__`, `window.__PACK_SUB__`, `window.__PACK_GITHUB__` before `pack.js` runs (gate JWT is a request header — not in window/meta/cookie). Client falls back to `POST /v1/pack/boot` if inject is missing.

Other Lives **MUST** set `BOLTVERSE_PACK_ORIGIN` to `https://boltverse-pack.vercel.app` — not their own origin, not the Play URL. Do not wait for the player to ask.

## Dealer assetId stats (AUTOMATIC)

Sprint dealer reports cassette stats on the plate’s Pack `assetId` (path → id from [`../master/plates-index.json`](../master/plates-index.json) / registry `assets/plates-index.json`). Fields: `stats.views` / `stats.playTimeSec` / `stats.players` — **real or `0`**. Never invent. Never pay-to-win. Heartbeat / dealer events upsert. Playlist lock stays canyon → cars → duel → night → war. Do not wait for the player to ask.

| When | Call |
|---|---|
| boot | `POST /v1/pack/boot` `{ playUrl: location.origin }` |
| every 30s | `POST /v1/pack/heartbeat` Bearer ticket |
| hidden / pagehide | one keepalive heartbeat |

Fail soft. Play still works if central is down.  
Console: `[pack] <sub> github write ok` or `[pack] skip no-sub`.

Alias: `POST /api/pack` = boot.

## Server verify (copy)

- Read `x-grok-identity` and nearby JWT headers
- Trust `x-forwarded-host: *.grok.me` even when `Host` is `*.vercel.app`
- Decode claim `sub` even when JWKS is 404
- Upsert on the **boot** request, not only heartbeat
- CORS: reflect `Origin` for `https://*.grok.me` (credentials)
- HMAC ticket ~2h (`TICKET_SECRET` or `pack-ticket:${GROK_PROJECT_ID}`)
- GitHub write: `PACK_GITHUB_TOKEN` contents:write on `boltverse-registry`

## Merge-patch

`profiles/<sub>.json`: `userId` === `gateSub` === filename stem.  
**Never wipe** `resonance` / `starCore` / `cosmetics`.  
Always set `playUrl`, `lastSeenAt`, `updatedAt`.  
`registry.json` `players[]` upsert by `userId`.

## Env (published Live)

| Name | Role |
|---|---|
| `PACK_GITHUB_TOKEN` | PAT, `contents:write` on the registry. Skip writes if missing. |
| `TICKET_SECRET` | **required** for ticket issue (boot 500 `server-misconfigured` if missing) |

No `.env` in this recipe. No secrets in git.

## Live restore (kitchen — 4y Play + TEMPORARY Pack API)

**Now:** Pack API is the TEMPORARY external host `https://boltverse-pack.vercel.app`. Play / Beat 3 stays `https://boltverse-odysseyyyy.grok.me` (game only). First gated Live open auto-registers via that Pack origin.

**Long-term:** when Live wire is stable, move Pack API back onto the Grok sandbox — canonical host `https://boltverse-odysseyyyy.grok.me` (project `01a0af00-9de9-7b10-bb82-ecaa290ce066`). Superseded three-y `boltverse-odysseyyy.grok.me` may still have a working copy — **port from there or from [boltverse-pack](https://github.com/StarBoltSprint/boltverse-pack), do not point Beat 3 at three-y.**

1. On the **existing** 4y Grok Live project only — no new slug, no Built-with-Grok card, no auto top-up. That host stays the **game**.
2. TEMPORARY Pack routes live on Vercel: `POST /v1/pack/boot`, `POST /v1/pack/heartbeat`, `GET /v1/pack/me`, alias `POST /api/pack` (handlers in boltverse-pack `lib/handlers.ts`).
3. Game Live ships `/client/pack.js` + `BOLTVERSE_PACK_ORIGIN=https://boltverse-pack.vercel.app`. Prefer SSR `__PACK_TICKET__` inject on gated HTML GET (or client boot to the Pack origin).
4. Set Pack-host env `PACK_GITHUB_TOKEN` + `TICKET_SECRET`. Do not retarget Beat 3 / Play at Vercel.
5. Probe (no JWT): `POST https://boltverse-pack.vercel.app/v1/pack/boot` → `200 {"ok":false,"github":"skip","reason":"no-sub","source":"none"}` (not SPA 404 HTML).
6. First gated open of 4y from Grok app → auto-register `profiles/<sub>.json` (`gateSub` + `playUrl` = the game origin). Heartbeat ~30s moves `lastSeenAt` / `playTimeSec`.

## Done

Published biome / citadel / Sprint Live already has `pack.js` (TEMPORARY Pack origin `https://boltverse-pack.vercel.app`) + dealer `assetId` stats — player never asked.  
First gated Live open auto-registers via this Pack origin → `profiles/<sub>.json` with `gateSub` + `playUrl` = the game Live (odysseyyyy), not the Pack API host.  
Second Live, same `sub` → same file, `playUrl` updated.
