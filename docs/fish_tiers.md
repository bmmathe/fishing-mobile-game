# Fish Tier System

**Status:** Implemented (prototype). Source of truth: [`src/fishing/fishCatalog.ts`](../src/fishing/fishCatalog.ts).
This document is a human-readable roster; if it ever disagrees with the catalog, the catalog wins.

---

## 1. The model: three orthogonal axes

A catch is described by three independent properties:

- **Tier (1–8)** — a pure **difficulty band**. Higher tiers pull harder, run more often, are
  more agile, and fight longer. Each tier has a target *skilled* catch-rate on the **starter line**.
- **Water (`fresh` | `salt`)** — every tier exists in **both** water types, with **different
  species**. A tier-1 baitfish on an ocean beach is a different fish than a tier-1 lake minnow,
  but the same difficulty.
- **Location (region tags)** — *forward-looking data* for the future travel/map system. Not all
  freshwater species live in every lake (e.g. west-coast vs east-coast). Tags today:
  `lake-generic`, `lake-westcoast`, `lake-eastcoast`, `river`, `south-us`,
  `ocean-beach`, `ocean-pier`, `ocean-inshore`, `ocean-bluewater`.

**Access** gates the high end: tiers **6–8 are boat-only** and can't be reached from land — you
reach them by buying a boat and driving out to the deep-water spots (see the boat view). Tiers 1–5
are land/foot.

## 2. Two failure modes (why the curve is smooth)

The fight has two distinct ways to lose, which dominate at opposite ends of the ladder:

- **Snap** — line tension over the limit for too long → the line breaks. Scales with the fish's
  `strength`. **Dominant at high tiers.**
- **Shake-off** — a lightly-hooked fish wriggles free during a run. Scales with `hookHold`
  (0–1; lower = easier to lose). Good tension control reduces but never eliminates it.
  **Dominant at low tiers.**

This is why a bluegill doesn't need to "fight like a walleye" to have a meaningful fail rate —
small fish are lost by shaking off, big fish by snapping the line.

## 3. Catch-rate curve (skilled player, starter line)

Validated by `npm run sim` (a near-optimal bot ≈ a skilled player). Real players sit a bit below.

| Tier | Name | Target | Sim (skilled) | Access | Dominant loss |
|---|---|---|---|---|---|
| 1 | Forage & Junk | 80% | ~75% | land | shake-off |
| 2 | Panfish & Schoolers | 60% | ~63% | land | shake-off |
| 3 | Gamefish & Rare Bait | 33% | ~40% | land | mixed |
| 4 | Predators | 18% | ~11% | land | snap |
| 5 | Apex | <5% | ~0% | land | snap |
| 6 | Deepwater | ~0%¹ | 0% | **boat** | snap |
| 7 | Big Game | ~0%¹ | 0% | **boat** | snap |
| 8 | Legendary | ~0%¹ | 0% | **boat** | snap |

¹ Tiers 6–8 are **impossible on the starter line** — they require **line upgrades** (a stronger line
raises the snap limit) *and* a **boat** to reach the deep-water spots. See §6.

## 4. Difficulty parameters per tier

Base values shared by every species in the band (individual fish tweak a few via overrides).

| Tier | strength | runStrength | runChance | agility | startDistance | hookHold |
|---|---|---|---|---|---|---|
| 1 | 0.30 | 1.20 | 0.45 | 2.2 | 11 | 0.26 |
| 2 | 0.42 | 1.35 | 0.52 | 2.7 | 15 | 0.16 |
| 3 | 0.70 | 1.55 | 0.62 | 3.1 | 19 | 0.35 |
| 4 | 0.76 | 1.70 | 0.70 | 3.6 | 23 | 0.82 |
| 5 | 0.90 | 1.85 | 0.76 | 4.1 | 27 | 0.95 |
| 6 | 1.05 | 2.00 | 0.80 | 4.5 | 32 | 0.98 |
| 7 | 1.25 | 2.20 | 0.84 | 5.0 | 38 | 0.99 |
| 8 | 1.50 | 2.40 | 0.88 | 5.5 | 45 | 0.99 |

---

## 5. Species roster

Legend: **🪱 bait** (→ tiers it lures) · **🗑 junk** (trivial reel-in) · weight ranges are flavor (kg).

### Tier 1 — Forage & Junk · _land · 80%_
> Minnows, baitfish, and the odd boot. Easy pickings.

| Freshwater | Notes | Saltwater | Notes |
|---|---|---|---|
| Fathead Minnow | 🪱 → T2–3 · 0.01–0.05 | Bay Anchovy | 🪱 → T2–3 · 0.01–0.04 |
| Golden Shiner | 🪱 → T2–3 · 0.02–0.1 | Sand Eel | 🪱 → T2–3 · 0.02–0.08 |
| Mosquitofish | 0.01–0.03 | Killifish | 0.01–0.05 |
| Worn Boot | 🗑 | Old Boot | 🗑 |
| Rusty Can | 🗑 | Crab-trap Debris | 🗑 |
| Tangled Line | 🗑 | Driftwood | 🗑 |
| Soggy Log | 🗑 | Seaweed Clump | 🗑 |

### Tier 2 — Panfish & Schoolers · _land · 60%_
> Quick darters and prime cut bait.

| Freshwater | Notes | Saltwater | Notes |
|---|---|---|---|
| Bluegill | 0.2–0.6 | Pinfish | 0.1–0.4 |
| Yellow Perch | 0.3–1.0 | Atlantic Croaker | 0.3–1.2 |
| Pumpkinseed | 0.2–0.5 | Menhaden | 🪱 → T3–5 · 0.2–0.7 |
| Gizzard Shad | 🪱 → T3–4 · 0.2–0.8 | Sardine | 🪱 → T3–5 · 0.05–0.2 |

### Tier 3 — Gamefish & Rare Bait · _land · 33%_
> Strong fighters — and the rare bait that lures monsters.

| Freshwater | Notes | Saltwater | Notes |
|---|---|---|---|
| Largemouth Bass | 1–4 | Striped Bass | 2–6 |
| Smallmouth Bass | scrappier · 1–3.5 | Bluefish | 1–5 |
| Brown Trout | 1–5 | Spanish Mackerel | 1–4 |
| **Cisco** | 🪱 → **T6–8** · west-coast lakes · 0.3–1.2 | **Goggle-eye** | 🪱 → **T7–8** · 0.3–1 |
| **Alewife** | 🪱 → **T6–8** · east-coast lakes · 0.1–0.4 | **Threadfin Herring** | 🪱 → **T7–8** · 0.1–0.4 |

### Tier 4 — Predators · _land · 18%_
> Powerful and long-winded. Clean tension control only.

| Freshwater | Notes | Saltwater | Notes |
|---|---|---|---|
| Walleye | 2–8 | Red Drum | 4–14 |
| Northern Pike | 3–12 | Snook | 3–11 |
| Channel Catfish | river · 2–10 | Cobia | 5–18 |
| Rainbow Trout | 2–7 | False Albacore | 3–9 |

### Tier 5 — Apex · _land · <5%_
> The biggest you'll land from shore — barely.

| Freshwater | Notes | Saltwater | Notes |
|---|---|---|---|
| Muskellunge | 8–25 | Juvenile Tarpon | 10–30 |
| Lake Trout | 6–20 | Big Striped Bass | 12–25 |
| Flathead Catfish | river · 8–30 | King Mackerel | 8–22 |

### Tier 6 — Deepwater · _🔒 boat · ~0% without gear_
> Boat only. Upgraded gear required to survive a run.

| Freshwater | Notes | Saltwater | Notes |
|---|---|---|---|
| Lake Sturgeon | 15–50 | Mahi-Mahi | 8–25 |
| Alligator Gar | river / south · 20–60 | Wahoo | 12–35 |
| Bull Catfish | river · 18–45 | Yellowfin Tuna | 20–50 |
| | | Amberjack | 15–40 |

### Tier 7 — Big Game · _🔒 boat · ~0% without gear_
> Boat only. Bluewater brutes.

| Freshwater | Notes | Saltwater | Notes |
|---|---|---|---|
| Giant Sturgeon | 50–150 | Bluefin Tuna | 80–200 |
| Wels Catfish | river · 40–120 | Sailfish | 25–60 |
| Arapaima | exotic / south · 40–100 | Goliath Grouper | 60–180 |

### Tier 8 — Legendary · _🔒 boat · ~0% without gear_
> Boat only. Mythical. The catch of a lifetime.

| Freshwater | Notes | Saltwater | Notes |
|---|---|---|---|
| White Sturgeon | west-coast lakes · 120–360 | Blue Marlin | 120–450 |
| The Lake Warden | mythic musky · 40–90 | Swordfish | 80–300 |
| | | Giant Bluefin | 150–400 |
| | | Old Hooktooth | legendary · 200–500 |

---

## 6. Bait & gear gating (implemented)

These systems are **built** and consume the catalog data. (Details in the README; data/logic in
[`src/game/`](../src/game/).)

- **Bait chains** ([bait.ts](../src/game/bait.ts), `bait.forTiers`): keep a caught forage fish as
  bait, then equip it to **raise the odds of hooking the higher tiers it lures** (`tierBoost` weights
  those tiers in the spot's roll) and/or **shorten the wait** (`waitFactor`). Independent per bait.
  - Freshwater: T1 minnows/shiners → T2–3 · T2 shad → T3–4 · **T3 cisco/alewife → T6–8**
  - Saltwater: T1 anchovy/sand-eel → T2–3 · T2 menhaden/sardine → T3–5 · **T3 goggle-eye/threadfin → T7–8**
  - Bait does **not** make reeling easier (gear does). Validate: `npm run sim:bait`.
- **Hooks** ([hooks.ts](../src/game/hooks.ts), `hook.forTiers`): buy specialty hooks in the shop,
  equip one at a time. Each hook adds **`holdBonus`** to `hookHold` for matching tiers only,
  reducing shake-offs during runs. Hooks are **consumed when the line snaps** (restock at the shop).
  - Panfish (T1–2), Wide Gap (T3–4), Circle (T4–6), Offshore (T6–8) — validate: `npm run sim:hook`.
- **Gear: line + pole** ([gear.ts](../src/game/gear.ts) `LINE_TIERS`/`POLE_TIERS`): the starter line
  is deliberately weak (`maxTension 0.78`); buying **line tiers** raises `maxTension`, the lever that
  unlocks the ~0% tier 6–8 fish (line steps 0.78 → 10). **Pole tiers** raise reel speed. Validate:
  `npm run sim:gear`.
- **Boats** ([gear.ts](../src/game/gear.ts) `BOAT_TIERS`): 4 tiers (lake-only → ocean-capable) reach
  the boat-only deep-water spots via the top-down boat view. Validate: `npm run sim:boat`.
- **Map / travel / locations** ([regions.ts](../src/world/regions.ts)): the US is 8 regions; you
  spawn in a coastal one and pay to travel. The `locations` tags are still forward-looking (per-lake
  species gating isn't wired yet — spots draw from the tier/water pool).

## 7. Tuning workflow

```bash
npm run sim    # plays each species with a skilled + reckless bot,
               # prints per-tier win-rate vs target with PASS/FAIL
               # optional: --hook <id> (e.g. panfish, wide-gap)
npm run sim:hook  # hook catalog + win-rate matrix vs targets
```

Adjust the per-tier `BAND` values (and per-species overrides) in
[`src/fishing/fishCatalog.ts`](../src/fishing/fishCatalog.ts), or the global `TUNING` constants in
[`src/fishing/fishingModel.ts`](../src/fishing/fishingModel.ts), then re-run the sim until the curve
matches §3.
