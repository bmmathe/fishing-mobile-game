# Tidal Ties

Social fishing game — low-poly 3D, mobile-first. See [docs/social_fishing_game_prd.md](docs/social_fishing_game_prd.md) for the product spec.

## Stack
- **Three.js + React Three Fiber** (`@react-three/fiber`, `@react-three/drei`) — 3D rendering
- **Vite + React + TypeScript** — app shell & dev server
- **Ionic Capacitor** — wraps the web build into native iOS/Android apps
- _Planned:_ Colyseus for authoritative real-time rooms (spot occupancy, trading, auctions)

## Develop
```bash
npm install
npm run dev        # http://localhost:5173 — fastest iteration loop
npm run build      # type-check + production build into dist/
npm run typecheck  # types only
```

## Mobile (Capacitor)
```bash
npm run cap:sync       # build web + copy into native projects
npm run cap:android    # build, sync, and open Android Studio
```
- **Android** is added (`android/`). Building/running needs Android Studio + JDK.
- **iOS** must be added on a Mac: `npm install @capacitor/ios && npx cap add ios` (requires Xcode + CocoaPods).

## Project layout
```
src/
  main.tsx            app entry
  App.tsx             view manager: region-map · travel · boat · fishing · shop
  world/              the overworld
    regions.ts        Region/Spot data (8 US regions), travelCost, pickTier
    RegionSelect.tsx  3D US (start | travel modes), per-region costs/locks
    RegionMap.tsx     3D region diorama; land POI pins (foot-or-boat menu)
    SpotCard.tsx      foot-or-boat menu (fish on foot / take the boat out)
    BoatScene.tsx     top-down boat: drive (stick) to buoys → Fish here
  ui/Stick.tsx        shared virtual thumb-stick (fishing reel + boat steer)
  fishing/            the fishing scene
    fishingModel.ts   pure fight simulation (tension/run/stamina/shake-off) + tuning
    fishCatalog.ts    8-tier fish taxonomy (fresh/salt species, bait, junk)
    fishingHoles.ts   hole quality (S–D) → wait-time curve
    fishingStore.ts   external store driving scene + HUD; setSpot, cast, input
    FishingScene.tsx  3D scene: angler, bending rod, line, fish, water
    FishingHud.tsx    DOM HUD: tension gauge, progress/stamina, control stick
    FishingGame.tsx   composes Canvas + HUD
  game/               progression (economy + gear)
    gear.ts           line/pole tiers + fishValue() pricing
    playerStore.ts    currency, inventory, owned gear; localStorage persistence
    TackleShop.tsx    Sell + Gear tabs (reached from the map)
  scene/              low-poly props + shared palette.ts (reused by world/)
scripts/sim.ts        headless tuning harness (also sim:wait, sim:regions, sim:gear)
```

## The fishing minigame (drag-to-reel + steer)
The catch loop is a skill-based tension fight — **not** a QTE or simple bar:
- **Pull down** on the control stick to reel in; **steer left/right** to counter
  the fish's runs.
- Keep **line tension** in the safe band. Two failure modes:
  - **Snap** — tension over the line's limit too long → the line breaks. The
    dominant way you lose *big* fish (high tiers).
  - **Shake-off** — a lightly-hooked fish (low `hookHold`) wriggles free during a
    run; good tension control reduces but can't eliminate it. The dominant way
    you lose *small* fish (low tiers).
- Sustained pressure **tires the fish** (it yields line faster), but flirts with
  the snap threshold. That risk/reward is the skill ceiling.

Desktop testing: `Enter` casts, `↓`/`Space` reels, `←`/`→` steer.

## Fish tiers (8) — `src/fishing/fishCatalog.ts`
Full roster, params, and bait/gear gating: **[docs/fish_tiers.md](docs/fish_tiers.md)**.

Tiers are **difficulty bands**, orthogonal to **water** (fresh/salt) and
**location**. Each tier targets a skilled catch-rate on the *starter* line:

| Tier | Target | Theme | Access |
|---|---|---|---|
| 1 | 80% | Forage & junk (minnows, boot, trash) | land |
| 2 | 60% | Panfish & schoolers (incl. cut bait) | land |
| 3 | 33% | Gamefish & **rare bait** for T6-8 | land |
| 4 | 18% | Predators | land |
| 5 | <5% | Apex (shore max) | land |
| 6–8 | ~0% | Deepwater → Big game → Legendary | **boat only** |

Every tier exists in both fresh and salt water with **different species**
(e.g. fresh T3 = Largemouth Bass / Cisco; salt T3 = Striped Bass / Goggle-eye).
Forward-looking data only (not yet active systems): `bait` (which tiers a forage
fish lures), `locations` (region tags for the future travel/map), and
`recommendedLine`/`baseLine` (gear gating — better lines raise the snap limit,
turning the ~0% boat tiers into catchable fish). Boat tiers (6–8) are **locked
🔒** in the UI until boats exist.

Validate the catch-rate curve headlessly (no UI):
```bash
npm run sim   # per-tier skilled win-rate vs target, PASS/FAIL; reckless guard
```

## Fishing holes & wait time — `src/fishing/fishingHoles.ts`
A **fishing hole** has a *quality* grade (S→D) — a separate axis from fish tiers —
that shapes the wait-to-bite after a cast. Higher quality = **lower ceiling +
more variance** (often near-instant, occasionally up to its short max); lower
quality = **long but predictable**. The distribution averages `smoothing`
uniforms (more = tighter) then applies a `skew` exponent (more = front-loaded).

| Quality | max wait | feel |
|---|---|---|
| S | 5s | fast, erratic (high relative variance) |
| A | 7s | quick, swingy |
| B | 10s | moderate (default: *Town Lake*) |
| C | 14s | longish, steadier |
| D | 20s | long & predictable (~10s) |

A subtle **nibble** tells just before the bite (bobber dip + "Something's
nibbling…"); the player can **recast** anytime to bail on a slow bite. Holes are
hardcoded samples for now (no UI picker) — switch via the `window.fishStore`
dev handle (`setHole`); the map/travel system will own hole selection later.

```bash
npm run sim:wait   # wait-time stats per quality: mean / stdev / CoV / percentiles
```

## World map — `src/world/`
The overworld is a 3D, two-level flow (App switches views):
**Region select** (stylized low-poly 3D US, tap a region) → **Region map** (3D
diorama of that region with a POI pin per spot) → tap a spot → **fishing scene**.

The US map ([RegionSelect.tsx](src/world/RegionSelect.tsx)) has recognizable
coastlines (Florida peninsula, Texas/Gulf, Maine) and low-poly decorations from
[MapDecor.tsx](src/world/MapDecor.tsx) — mountains, pines, palms, an oil derrick,
the Great Lakes, and drifting ocean fish — to give each region character.

A **`Spot`** ([regions.ts](src/world/regions.ts)) is the bridge: it carries
`water`, `access`, waterbody `body`, hole `quality` (S–D wait), and a **weighted
tier pool**. Tapping a spot calls `store.setSpot()`, which configures the fishing
store's water, wait curve, and pool. Boat spots (deep-lake, offshore) render
**locked 🔒** until boats exist.

Starter territory is the **US**, a stylized low-poly silhouette of **8 pastel
regions**. The **4 coastal regions** (Pacific NW, California, Gulf, Florida/SE)
are valid **free starting spawns** and cover tiers 1–8 in both fresh & salt. The
**4 central regions** (Mountain West, Great Plains, Midwest/Great Lakes,
Northeast) are **higher-tier** (T3–5 land, freshwater except Northeast's Atlantic
coast) and reached only by **traveling**.

**Travel** (`playerStore.currentRegionId`): you spawn in one coastal region and
are locked to it until you **pay to move**. Zoom out from a region (🗺 Travel) to
the full US, where each region shows its **travel cost** — coastal moves are
cheap, central moves expensive. Any region change costs (including returning to
your start); re-entering the region you're in is free; regions you can't afford
show the price and are locked. `RegionSelect` has two modes (`start` / `travel`).
Verified by:
```bash
npm run sim:regions   # coastal regions must cover tiers 1–8 fresh & salt; central = higher-tier
```

> The dev tier/water/hole selectors are gated behind `import.meta.env.DEV`;
> normal play is spot-driven from the map.

## Progression: economy + gear — `src/game/`
The core loop: **catch → sell → upgrade → land harder fish.** Landed fish go into
an inventory ([playerStore.ts](src/game/playerStore.ts)); at the **Tackle Shop**
(reached from the map) you sell them for currency and buy gear:
- **Line tiers** raise the fight's snap limit (`maxTension`) — this is what
  **unlocks higher fish tiers** (a tier-6 fish overwhelms the starter line).
- **Pole tiers** raise reel speed (`reelMult`).

Gear feeds the fight via `store.applyGear(maxTension, reelMult)`; the App banks
catches through a `fishingStore.onCatch` hook. Progress persists to
`localStorage`. Tuned so each line opens the next tier band and T8 stays a
brutal end-game chase even with the best line — verified by:
```bash
npm run sim:gear   # gear-unlock curve per line tier + economy affordability
```

## Boats — `src/game/gear.ts` (BOAT_TIERS) + `src/world/BoatScene.tsx`
Buy a boat in the shop (**4 tiers**: Jon Boat = lake-only/slow → Offshore Cruiser
= fast/ocean) to reach the deep-water spots. Tapping a **lake/beach/pier** POI
opens a **foot-or-boat menu**: *fish on foot* (a single shore spot, cheaper) or
*take the boat out* — a **top-down driving view** ([BoatScene](src/world/BoatScene.tsx))
where you steer with the virtual stick to buoys and tap **Fish here**. Rivers &
streams are foot-only. The boat option is gated by `player.canBoat(water)` (lake
needs any boat; ocean needs an ocean-capable boat).

Each fishing session charges a **fishing fee** (`fishFee(quality, byBoat)`, boat
≈ foot×3) — a sink on top of region travel; one average catch covers it so a
session stays net-positive. Boat ownership persists. Verified by:
```bash
npm run sim:boat   # boat tiers, fee table, fee-vs-catch-value sanity
```

> Next up: bait economy, boat upgrades (radar/maintenance, PRD), then Colyseus
> multiplayer for the PRD's real-time dock occupancy.
