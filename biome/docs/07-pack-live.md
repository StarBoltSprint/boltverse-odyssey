# 07 — Pack Live (gate sub → registry)

Not [PACK.md](../../PACK.md) (citadel hall **folder**).  
This page is the **Grok identity** wire: `sub` → `profiles/<sub>.json` on [StarBoltSprint/boltverse-registry](https://github.com/StarBoltSprint/boltverse-registry).

Contract: [StarBoltSprint/boltverse-pack](https://github.com/StarBoltSprint/boltverse-pack).  
**This recipe’s Live is the central API** other `*.grok.me` Lives call.

Kitchen Live (do not paste in player chat): https://boltverse-odysseyyy.grok.me

---

## Hard bans

- No Connect Wallet
- No player API keys
- No xAI keys in the client
- Unsigned / no JWT → `{ ok:false, github:"skip", reason:"no-sub" }` — **never invent a sub**

## Floor client (every Live)

Drop [../../client/pack.js](../../client/pack.js). On **this** Live, same-origin:

```html
<script>window.BOLTVERSE_PACK_ORIGIN = window.location.origin</script>
<script src="/client/pack.js"></script>
```

Other Lives may set `BOLTVERSE_PACK_ORIGIN` to this host, or load the script from this host.

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
| `TICKET_SECRET` | optional; falls back to project id |

No `.env` in this recipe. No secrets in git.

## Done

Open Live from Grok ~30s → `profiles/<sub>.json` with `gateSub` + `playUrl` = that origin.  
Second Live, same `sub` → same file, `playUrl` updated.
