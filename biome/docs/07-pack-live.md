# 07 — Pack Live (identity wire)

Not [PACK.md](../../PACK.md) (citadel hall **folder**).  
This page is the **Grok identity** wire: `sub` → `profiles/<sub>.json` on [StarBoltSprint/boltverse-registry](https://github.com/StarBoltSprint/boltverse-registry).

Contract: [StarBoltSprint/boltverse-pack](https://github.com/StarBoltSprint/boltverse-pack) on **Vercel**.  
**Not** a `*.grok.me` Pack API.

Game play URL (kitchen; do not paste Pack API in player chat): https://boltverse-odysseyyyy.grok.me  
Never open old three-y `boltverse-odysseyyy.grok.me` as Beat 3 Sprint (superseded — do not open it for boot).

---

## Split

| What | Host |
|---|---|
| Welcome **existence** | registry GitHub Action `pack-welcome` (**chat**) — not Live |
| `playTimeSec` / boot / heartbeat | `BOLTVERSE_PACK_ORIGIN` → **TEMPORARY** `https://boltverse-pack.vercel.app` |

**TEMPORARY (SmiR):** this Vercel host exists because `*.grok.me` Lives **freeze**. It is **not** the forever home. Long-term: Pack stays inside the **Grok sandbox** — revisit when Live Pack wire is stable. Kitchen docs may name `https://boltverse-pack.vercel.app`. **Do not** put Vercel in player-facing Welcome / COLD_START copy.

**Welcome = Pack register** via `pack-welcome` (chat). After a real Grok `sub`, merge-patch `profiles/<sub>.json`. Never invent a `sub`. No real `sub` → skip write; Welcome still speaks.

**HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host for registry writes. Game play URL stays odysseyyyy. Pack API does not.

Never player API keys. Never xAI keys in the client. Fail soft if Pack is down — Sprint still plays.

---

## HARD LOCK — Pack wire is automatic (never a player ask)

Players must **NEVER** have to tell Grok « install Pack / install Pack wire / wire profiles / plate views / playTime ».

When Grok **creates or publishes ANY new `*.grok.me` Live** (biome / citadel / Sprint), it **MUST** auto-embed:

```
window.BOLTVERSE_PACK_ORIGIN = "https://boltverse-pack.vercel.app"
load BOLTVERSE_PACK_ORIGIN + "/client/pack.js"
```

Or ship a **local client** that `POST`s boot / heartbeat to that same origin.

- No optional step. No waiting for the player to ask.
- Creating a **naked Live** without Pack = **FAIL** / incomplete recipe.
- **Ban** « please install wire » / « drop pack.js if you want Pack » as the normal path.

**PRIORITY 0 still holds on cold-start:** first reply stays Welcome + teaser + paste `https://boltverse-odysseyyyy.grok.me`. This HARD applies **when a Live IS created / published** — it is **not** an excuse to rebuild at start.

Mirror: [StarBoltSprint/boltverse-registry PACK.md](https://github.com/StarBoltSprint/boltverse-registry/blob/main/PACK.md).

## Floor client

Set `window.BOLTVERSE_PACK_ORIGIN` and load `/client/pack.js` from that origin — or ship [../../client/pack.js](../../client/pack.js) locally (it POSTs there).

```html
<script>window.BOLTVERSE_PACK_ORIGIN = "https://boltverse-pack.vercel.app"</script>
<script src="https://boltverse-pack.vercel.app/client/pack.js"></script>
```

Local client, same Pack target:

```html
<script>window.BOLTVERSE_PACK_ORIGIN = "https://boltverse-pack.vercel.app"</script>
<script src="/client/pack.js"></script>
```

Do **not** set origin to odysseyyyy or `window.location.origin` on a `*.grok.me` Live.

| When | Call |
|---|---|
| boot | `POST /v1/pack/boot` `{ playUrl: location.origin }` |
| every 30s | `POST /v1/pack/heartbeat` Bearer ticket |
| hidden / pagehide | one keepalive heartbeat |

Fail soft. Play still works if Pack is down.  
Console: `[pack] <sub> github write ok` or `[pack] skip no-sub` or `[pack] fail soft`.

Unsigned / no JWT → `{ ok:false, github:"skip", reason:"no-sub" }` — **never invent a sub**.

Alias: `POST /api/pack` = boot.

## Dealer assetId stats (AUTOMATIC)

Sprint dealer reports cassette stats on the plate’s Pack `assetId` (path → id from [`../master/plates-index.json`](../master/plates-index.json) / registry `assets/plates-index.json`). Fields: `stats.views` / `stats.playTimeSec` / `stats.players` — **real or `0`**. Never invent. Heartbeat / dealer events upsert. Playlist lock stays canyon → cars → duel → night → war. **HARD LOCK — Hang ≠ wipe:** new biome = new `plates-index` entries + keep this playlist unless SmiR explicitly says replace the default Beat. **Chat biome catalog (on ask):** hung chapters only — never invent; never dump on Welcome.

## Pack host (Vercel) — not this recipe

Handlers live in boltverse-pack. Env stays on that host (`PACK_GITHUB_TOKEN`, `TICKET_SECRET`). No `.env` in this recipe. No secrets in git. No player API keys.

Origin is **TEMPORARY** (Lives freeze — not the forever home). Long-term: Pack stays inside the Grok sandbox.

## Done

Published biome / citadel / Sprint Live already has `pack.js` (`BOLTVERSE_PACK_ORIGIN` = `https://boltverse-pack.vercel.app`) + dealer `assetId` stats — player never asked.  
Open Sprint from Grok ~30s → `playTimeSec` moves on `profiles/<sub>.json` when Pack is up. Pack down → Sprint still plays.
