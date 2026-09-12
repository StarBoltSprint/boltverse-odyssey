# FILMS — owner prompts (every Grok, every new convo, every player)

**Read this before cooking any walk or breath.**  
`scripts/imagine-hooks.mjs` already sends these. If you paste into Imagine UI First+Last, paste from **here**, then swap décor only.

## Law

1. These prompts are the **base**. Do not rewrite motion, camera, dog count, morph, or duration.
2. **Adapt décor only** — from the player's 3 stills + two lines in `catalog/<slot>.md` (ice / ember / moss / …). Hall materials change. The walk does not.
3. First Frame + Last Frame are **slots / API pins** (`image` + `last_frame`). Not prompt `@image` refs. Not `reference_images`.
4. Chat Imagine without those pins = banned. Imagine Agent = stills only, never video.

| | duration | First | Last |
|---|---|---|---|
| breath-spawn | **6s** | spawn | spawn |
| breath-A | **6s** | at-A | at-A |
| breath-B | **6s** | at-B | at-B |
| walk-spawn-A | **10s** | spawn | at-A |
| walk-spawn-B | **10s** | spawn | at-B |
| walk-A-B | **10s** | at-A | at-B |
| walk-B-A | **10s** | at-B | at-A |

## Lock (every film)

- Camera **locked off**. Never pan / tilt / zoom / dolly.
- **ONE** full-white German Shepherd. Never a second dog. Never anything else on screen.
- **NO morph** (form, fur, body).
- BACK, **standing on four paws the whole film**. NEVER sit. NEVER lie. NEVER crouch. NEVER haunches.
- Cyan-teal LEFT portal, gold-orange RIGHT portal. Oval or RECT energy. Never wood. Never chrome UI.

## Breaths — 6s (same still twice)

He **never walks**. He **never changes place**. **Paws stay planted** (no lift, no step). He **NEVER sits** — standing on four paws. **VISIBLE breath:** chest and belly rise and fall. Tail sways. Head may nod a little. Portals/lights may pulse. Seamless loop.

**Spawn:** already center, BACK, both portals visible. Never a ghost at a sill.

**A:** already at teal LEFT sill, BACK. Never a dog at center. Never a dog at gold.

**B:** already at gold RIGHT sill, BACK. Never a dog at center. Never a dog at teal.

Paste-base (then name the pose + paint from the player's stills):

> 6 seconds. Seamless loop. The dog remains COMPLETELY STATIONARY. NEVER walking, NEVER stepping, NEVER shifting position. PAWS stay planted. STANDING on FOUR PAWS the whole clip. NEVER sit. NEVER lie. NEVER crouch. VISIBLE breath: chest and BELLY rise and fall clearly. Tail sways and flicks. Head may nod a little. NO morph. Portals may pulse. Distant lights may shimmer. Camera COMPLETELY LOCKED. ONE dog only. NEVER a second dog. NEVER any other animal.

## Walks — 10s (distinct stills)

He **starts walking on frame 1**. Steady four-paw pace **all the way** to last_frame (~9s). No linger. No leftover hold (round trip). **NEVER recede / reverse / walk back.** NEVER sit — four standing paws the whole walk.

| edge | First → Last | the one line that changes |
|---|---|---|
| **A** | spawn → at-A | center → **cyan LEFT** sill |
| **B** | spawn → at-B | center → **gold RIGHT** sill |
| **A→B** | at-A → at-B | teal sill → **gold** sill |
| **B→A** | at-B → at-A | gold sill → **teal** sill |

Paste-base (then swap the door line + décor from the player's stills):

> The dog STARTS WALKING on the very first frame. STEADY even pace on four standing paws from first frame to last frame (~9 seconds). NEVER sit. NEVER lie. NEVER crouch. STANDING four paws the whole walk. NO morph. Camera LOCKED OFF, never moves. ONE dog only. NEVER two dogs. NEVER face / 3/4. He ONLY walks FORWARD toward the arrive door. NEVER recede. NEVER reverse. NEVER walk back toward spawn. Distance to the door ONLY decreases. Last frame is the arrive still.

**Do not** copy the ice walk onto ember. Same motion. New hall paint from the stills the player gave.

## Cook

```
node scripts/cook-room.mjs <slot>
```

That file already injects `catalog/<slot>.md` + these prompts + First/Last pins. A new Grok does not invent a temple. Off-list paint → ask nearest catalog word.
