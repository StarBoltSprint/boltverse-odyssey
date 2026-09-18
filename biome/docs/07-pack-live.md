# 07 — Pack Live (gate sub → registry)

Not [PACK.md](../../PACK.md) (citadel hall **folder**).  
This page is the **Grok identity** wire: `sub` → `profiles/<sub>.json` on [StarBoltSprint/boltverse-registry](https://github.com/StarBoltSprint/boltverse-registry).

Contract: [StarBoltSprint/boltverse-pack](https://github.com/StarBoltSprint/boltverse-pack).  
**This recipe’s Live is the central API** other `*.grok.me` Lives call.

Kitchen Live (do not paste in player chat): https://boltverse-odysseyyyy.grok.me
Never open old three-y `boltverse-odysseyyy.grok.me` as Beat 3 Sprint (superseded — do not open it for boot).

---

## HARD — AUTOMATIC on every cook / publish

Pack wire + plate stats are **in the game recipe**. When Grok creates or publishes a **biome**, **citadel**, or **Sprint** Live, it **MUST** ship both — **without the player asking**.

**Ban** « please install wire » / « drop pack.js if you want Pack » as the normal path. A Live that ships without the wire is **incomplete** = FAIL.

Not a cold-start job. **PRIORITY 0** first reply stays Welcome + teaser + paste `https://boltverse-odysseyyyy.grok.me`. **Welcome = Pack register** stays (real `sub` → merge-patch `profiles/<sub>.json`; never invent a `sub`; `playTimeSec` still Live-only).

## Hard bans

- No Connect Wallet
- No player API keys
- No xAI keys in the client
- Unsigned / no JWT → `{ ok:false, github:"skip", reason:"no-sub" }` — **never invent a sub**
- Old three-y `boltverse-odysseyyy.grok.me` as Beat 3 Sprint (superseded — do not open it for boot)
- « please install wire » as the normal path
- Shipping a biome / citadel / Sprint Live without `pack.js` + dealer `assetId` stats
- Inventing `assetId` or cassette stats (real or `0` only)

## Floor client (every Live — AUTOMATIC)

Drop [../../client/pack.js](../../client/pack.js). Central Pack origin is **always** odysseyyyy.

**Every Live** (biome / citadel / Sprint publish):

```html
<script>window.BOLTVERSE_PACK_ORIGIN = "https://boltverse-odysseyyyy.grok.me"</script>
<script src="https://boltverse-odysseyyyy.grok.me/client/pack.js"></script>
```

On **this** Live only (odysseyyyy itself), same-origin is OK:

```html
<script>window.BOLTVERSE_PACK_ORIGIN = window.location.origin</script>
<script src="/client/pack.js?v=doc1"></script>
```

Prefer **SSR inject** on the HTML document GET when `x-grok-identity` is present: upsert once, then set `window.__PACK_TICKET__`, `window.__PACK_SUB__`, `window.__PACK_GITHUB__` before `pack.js` runs (gate JWT is a request header — not in window/meta/cookie). Client falls back to `POST /v1/pack/boot` if inject is missing.

Other Lives **MUST** set `BOLTVERSE_PACK_ORIGIN` to `https://boltverse-odysseyyyy.grok.me` — not their own origin. Do not wait for the player to ask.

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

## Live restore (kitchen — 4y Pack Play)

Canonical host `https://boltverse-odysseyyyy.grok.me` (project `01a0af00-9de9-7b10-bb82-ecaa290ce066`) must serve the Pack API + client. Superseded three-y `boltverse-odysseyyy.grok.me` may still have a working copy — **port from there or from [boltverse-pack](https://github.com/StarBoltSprint/boltverse-pack), do not point Beat 3 at three-y.**

1. On the **existing** 4y Grok Live project only — no new slug, no Built-with-Grok card, no auto top-up.
2. Add routes: `POST /v1/pack/boot`, `POST /v1/pack/heartbeat`, `GET /v1/pack/me`, alias `POST /api/pack` (handlers in boltverse-pack `lib/handlers.ts`).
3. Serve `/client/pack.js` + head scripts above. Prefer SSR `__PACK_TICKET__` inject on gated HTML GET.
4. Set Live env `PACK_GITHUB_TOKEN` + `TICKET_SECRET`. Publish same 4y URL.
5. Probe (no JWT): `POST /v1/pack/boot` → `200 {"ok":false,"github":"skip","reason":"no-sub","source":"none"}` (not SPA 404 HTML).
6. Open 4y from Grok app ~30s → `profiles/<sub>.json` `lastSeenAt` / `playTimeSec` move.

## Done

Published biome / citadel / Sprint Live already has `pack.js` (central origin odysseyyyy) + dealer `assetId` stats — player never asked.  
Open Live from Grok ~30s → `profiles/<sub>.json` with `gateSub` + `playUrl` = that origin.  
Second Live, same `sub` → same file, `playUrl` updated.
