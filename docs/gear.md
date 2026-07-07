# Line & Pole Gear

**Status:** Implemented (prototype). Source of truth: [`src/game/gear.ts`](../src/game/gear.ts).
Fight wiring: [`src/fishing/fishingModel.ts`](../src/fishing/fishingModel.ts) (`LineSpec`),
[`src/fishing/fishingStore.ts`](../src/fishing/fishingStore.ts) (`applyGear`), and
[`src/App.tsx`](../src/App.tsx) (syncs player gear each render).

Species difficulty and tier bands: **[fish_tiers.md](fish_tiers.md)**. Bait and hooks are separate:
**[bait.md](bait.md)**. Boats (spot access, not fight stats) are summarized in §6 below.

---

## 1. Two levers, two jobs

Line and pole are the only fight upgrades bought in the Tackle Shop **Gear** tab. They answer
different questions:

| Gear | Stat | Question it answers |
|------|------|---------------------|
| **Line** | `maxTension` | *Can I survive this fish's pull without snapping?* |
| **Pole** | `reelMult` | *How long must I survive before I land it?* |

**Line is the access gate** — without enough `maxTension`, high-tier fish snap the line regardless
of skill. **Pole is the efficiency upgrade** — it shortens fights you can already win; it does not
raise the snap limit or unlock new tier pools.

Both stats are passed into every fight as a single `LineSpec`:

```ts
store.applyGear(player.lineMaxTension, player.reelMult);
```

---

## 2. Line tiers

### Roster

| Tier | Name | `maxTension` | Price | Design intent |
|------|------|--------------|-------|---------------|
| 0 | Starter Line | 0.78 | $0 | T1–2 comfortable; T3–4 hard; T5+ mostly snap losses |
| 1 | Braided Line | 1.8 | $150 | Eases T3–4; T5 becomes viable |
| 2 | Fluorocarbon | 3.4 | $650 | Unlocks T5; T6 becomes possible |
| 3 | Steel Leader | 6.0 | $5,600 | Unlocks T6; T7 edge cases |
| 4 | Deep-Sea Cable | 10.0 | $20,000 | T7 comfortable; T8 brutal-but-possible |

Steps are aligned with `TIERS[].baseLine` in [`fishCatalog.ts`](../src/fishing/fishCatalog.ts) so
each purchase opens the next fish band.

### How `maxTension` works in the fight

During the active fight (`phase === "fighting"`), normalized tension builds from reeling and from
countering the fish's pull. When tension stays **at or above** `line.maxTension` for longer than
`snapGrace` (0.55 s), the line snaps and the fish is lost.

```ts
// fishingModel.ts — snap check (after lossGrace)
if (s.tension >= line.maxTension) {
  s.overTime += dt;
  if (s.overTime >= TUNING.snapGrace) { /* SNAP */ }
}
```

**What line does *not* change:**

- Reel-in speed (`reelMult` is pole-only)
- Fish pull strength, run frequency, agility, or `startDistance`
- Shake-off hazard (`hookHold` — hooks handle that)
- Bite odds or hook-set window

The skilled bot in `npm run sim` and `npm run sim:gear` holds `reelMult` at 1.0 when testing line
unlock curves — tier difficulty targets are balanced on starter pole speed.

### Unlock curve (skilled bot, `npm run sim:gear`)

Approximate win-rate per fish tier at each **line** tier (pole at default):

| Line | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 |
|------|----|----|----|----|----|----|----|-----|
| Starter | 70% | 67% | 50% | 81% | 24% | 12% | 0% | 0% |
| Braided | 77% | 67% | 51% | 76% | 64% | 24% | 0% | 0% |
| Fluorocarbon | 73% | 63% | 69% | 83% | 76% | 42% | 3% | 0% |
| Steel Leader | 70% | 60% | 68% | 88% | 94% | 80% | 15% | 0% |
| Deep-Sea Cable | 70% | 57% | 61% | 88% | 94% | 97% | 57% | 16% |

T6–8 also require a **boat** to reach their spots (see §6). Re-run `npm run sim:gear` after tuning.

### Per-line gameplay notes

**Starter Line (0.78)** — Deliberately weak. T1–2 are learnable; T3 is a mixed bag; T4+ snap
dominates. This is the reference gear for `TIERS[].targetCatchRate` in `npm run sim`.

**Braided Line (1.8)** — First meaningful upgrade. T5 jumps from ~24% → ~64% skilled win-rate.
Still not enough for reliable T6+.

**Fluorocarbon (3.4)** — Shore endgame line. T5 is comfortable; T6 becomes a real target once
you have boat access.

**Steel Leader (6.0)** — Deep-water workhorse. T6 is reliable; T7 opens up; T8 still ~0%.

**Deep-Sea Cable (10.0)** — Endgame line. T7 is viable; T8 is a low double-digit % chase even for
a skilled player. Mythic T9 is tuned against this loadout.

### Economy (approximate catches to afford)

From `npm run sim:gear` affordability table (average sell value at reference tier):

| Upgrade | Price | ≈ catches |
|---------|-------|-----------|
| Braided Line | $150 | 11 × T3 |
| Fluorocarbon | $650 | 20 × T4 |
| Steel Leader | $5,600 | 70 × T5 |
| Deep-Sea Cable | $20,000 | 156 × T6 |

---

## 3. Pole tiers

### Roster

| Tier | Name | `reelMult` | Price | vs starter |
|------|------|------------|-------|------------|
| 0 | Cane Pole | 1.00× | $0 | baseline |
| 1 | Spinning Rod | 1.20× | $250 | +20% reel speed |
| 2 | Baitcaster | 1.45× | $1,000 | +45% |
| 3 | Offshore Rod | 1.75× | $8,000 | +75% |
| 4 | Game Reel | 2.10× | $20,000 | +110% |

### How `reelMult` works in the fight

Pole speed affects **one formula** — distance gained per second while the player reels:

```ts
const tiredBonus = 1 + (1 - s.stamina) * 0.8;          // 1.0 → 1.8 as fish tires
const gain = reel * TUNING.reelSpeed * tiredBonus * (line.reelMult ?? 1);
const lineOut = s.running ? pull * ramp * (1 - counter) * TUNING.runPull : 0;
s.distance = clamp(s.distance + (lineOut - gain) * dt, 0, s.startDistance);
```

With `TUNING.reelSpeed = 2.6` and full reel input (`reel = 1`):

| Pole | Fresh fish gain | Exhausted fish gain (stamina = 0) |
|------|-----------------|-----------------------------------|
| Cane Pole | 2.6 u/s | 4.7 u/s |
| Spinning Rod | 3.1 u/s | 5.6 u/s |
| Baitcaster | 3.8 u/s | 6.8 u/s |
| Offshore Rod | 4.6 u/s | 8.2 u/s |
| Game Reel | 5.5 u/s | 9.8 u/s |

Fish `startDistance` scales with tier (11 for T1 → 45 for T8, 62 for mythic T9). Pole upgrades
compress the reel-out phase of fights that are already winnable.

**Critical detail:** `reelMult` does **not** reduce tension from reeling. The same reel input
loads the rod equally on every pole:

```ts
const reelLoad = reel * TUNING.reelTension;  // unchanged by reelMult
```

A better pole makes you **faster**, not **safer** per second of aggressive reeling.

### What pole does *not* change

| System | Pole impact |
|--------|-------------|
| Snap limit (`maxTension`) | None |
| Tier 6–8 spot access | None (boat) |
| Bite / hook-set | None |
| Fish strength, runs, agility | None |
| Shake-off (`hookHold`) | None |
| Tension per reel input | None |

### Indirect benefits

Because poles only speed distance gain, their value shows up indirectly:

1. **Shorter fights** — fewer runs → fewer throw-the-hook and shake-off rolls, less cumulative
   snap exposure.
2. **Stamina race** — exhausted fish are reeled in faster before they recover during slack.
3. **Deep-water practicality** — T6–8 have long `startDistance` and heavy runs; pole tier matters
   once line tier makes those fish *possible*.

Pole does **not** help during uncountered runs (`lineOut` is unchanged). It helps in the windows
when you are actually gaining line.

### Per-pole gameplay notes

**Cane Pole** — All fight difficulty is tuned against this speed (`npm run sim` default).

**Spinning Rod** — Early QoL on T1–3. Cheap first shop upgrade; noticeable on short fights.

**Baitcaster** — Mid-game shore pick. Meaningful on T4–5 where `startDistance` is 23–27 and
fights drag even when winnable.

**Offshore Rod** — Pairs with Steel Leader / boat fishing. Makes T6–7 sessions less of a grind.

**Game Reel** — Endgame pole. Pairs with Deep-Sea Cable for T8 and mythic T9 — every second of
run exposure counts at those tiers.

### Economy (approximate catches to afford)

| Upgrade | Price | ≈ catches |
|---------|-------|-----------|
| Spinning Rod | $250 | 18 × T3 |
| Baitcaster | $1,000 | 31 × T4 |
| Offshore Rod | $8,000 | 100 × T5 |
| Game Reel | $20,000 | 156 × T6 |

---

## 4. Line + pole pairing

Recommended mental model:

1. **Buy line first** when a tier band is snapping you out — that is the hard gate.
2. **Buy pole** when fights are winnable but slow — QoL and indirect survivability.
3. **Boat** when you need T6–8 *spots* (orthogonal to line/pole stats).

Example endgame loadout (`scripts/mythicsim.ts`): Deep-Sea Cable + Game Reel.

---

## 5. Tuning & validation

```bash
npm run sim:gear   # line unlock curve per tier + upgrade affordability
npm run sim        # per-tier fight targets on starter line (reelMult = 1)
```

**Edit line/pole numbers:** [`src/game/gear.ts`](../src/game/gear.ts) (`LINE_TIERS`, `POLE_TIERS`).

**Edit fight feel globally:** [`src/fishing/fishingModel.ts`](../src/fishing/fishingModel.ts)
(`TUNING` — `reelSpeed`, `snapGrace`, `reelTension`, etc.).

**Edit per-tier fish difficulty:** [`src/fishing/fishCatalog.ts`](../src/fishing/fishCatalog.ts)
(`BAND`, `TIERS[].baseLine`).

---

## 6. Boats (spot access only)

Boats are defined in the same `gear.ts` file but are **not** fight stats. They gate **where** you
fish (lake-only vs ocean, drive speed to deep-water markers). See README § Boats and
`npm run sim:boat`. Full boat roster: `BOAT_TIERS` in [`gear.ts`](../src/game/gear.ts).
