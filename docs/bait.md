# Bait System

**Status:** Implemented (prototype). Source of truth: [`src/game/bait.ts`](../src/game/bait.ts) and
forage-fish metadata in [`src/fishing/fishCatalog.ts`](../src/fishing/fishCatalog.ts).
Species roster and tier difficulty: **[fish_tiers.md](fish_tiers.md)**.

---

## 1. How bait works

Each bait has a **bait tier** (2–8) that drives a **hook table** — the weighted roll for which
difficulty tier bites. Equipping bait **replaces the spot's natural tier pool** with that table
(when the bait can target tiers the spot offers). Bait does **not** make reeling easier; line/pole
gear and skill handle the fight — see **[gear.md](gear.md)**.

**Other effects:**

- **`waitFactor`** — values below 1 shorten the wait-to-bite (independent per bait).
- **Junk** — only T1 rolls while baited can include junk (~10% of that T1 bite). Bait tables
  without a T1 slot mean **no junk** on that bait.
- **Spot limits** — weight aimed at tiers the spot doesn't have **falls through** to the lowest
  tier the table and spot share (e.g. T2 bait at a T1–2 stream: the “above tier” slot becomes T1).
- **No overlap** — if the bait's hook table shares **no tiers** with the spot, bait is ignored and
  the spot's natural pool is used.
- **Water** — bait is **sourced** from fresh- or saltwater forage fish (see tables below). Once in
  your bait box, you can equip it at any spot; the species rolled still comes from the spot's water
  type at the chosen tier.

Validate tuning: `npm run sim:bait`

---

## 2. Hook tables by bait tier

When the spot offers all tiers in the table, the bite distribution is:

| Bait tier | Same tier | 1 below | 2 below | 1 above |
|-----------|-----------|---------|---------|---------|
| **T2** | 60% | 30% | — | 10% |
| **T3** | 70% | 30% | — | — |
| **T4** | 60% | 30% | 10% | — |
| **T5** | 50% | 30% | 20% | — |
| **T6** | 40% | 30% | 30% | — |
| **T7** | 30% | 30% | 40% | — |
| **T8** | 20% | 30% | 50% | — |

From T3 upward, the same-tier share drops 10 points per bait tier (big fish are harder to fool).
T2 bait is the only grade that can tempt **one tier above** its bait tier.

---

## 3. Buyable bait & synthetic lures

| Bait | Water | Bait tier | Price | Uses | Typical hook mix (when spot has those tiers) |
|------|-------|-----------|-------|------|-----------------------------------------------|
| **Worms** | Both (NPC shop) | **T2** | $5 | 1 bite | **60% T2**, 10% T3, 30% T1 (T1 can include junk) |
| **Spinner Lure** | Both (NPC shop) | **T5** | $90 | ~8 (soft) | **50% T5**, 30% T4, 20% T3 |
| **Deep Diver Lure** | Both (NPC shop) | **T6** | $140 | ~6 (soft) | **40% T6**, 30% T5, 30% T4 — at a T6-8 boat spot this becomes **100% T6** (lower tiers fall through) |

**Synthetic lures** fill the bait tiers no forage fish covers (T5/T6) and are not eaten per bite
like live bait. Instead:

- Each **landed** fight wears the lure out with probability **1/uses** (a soft use count —
  a Spinner Lure survives ~8 landings on average).
- A **lost fish takes the lure with it** (snap, thrown hook, or shake-off) — this loss risk is the
  real cost, so don't fish lures on gear that can't win the fight.
- A **missed bite** never costs the lure (the fish spat it).

Pricing is tuned against that loss rule (`npm run sim:bait` prints the break-even): around a 70%
land rate a lure pays for itself; below that it's a learning tax, small relative to that era's
income. All other bait is **catch-only** (keep a forage fish from the cooler → **→ Bait**).

---

## 4. Freshwater bait (catch-only)

| Bait | Source fish | Advertised lure range | Bait tier | Typical hook mix |
|------|-------------|----------------------|-----------|------------------|
| **Fathead Minnow** | T1 forage | T2–T3 | **T3** | **70% T3**, 30% T2 |
| **Golden Shiner** | T1 forage | T2–T3 | **T3** | **70% T3**, 30% T2 |
| **Gizzard Shad** | T2 panfish/schooler | T3–T4 | **T4** | **60% T4**, 30% T3, 10% T2 |
| **Cisco** | T3 gamefish (west-coast lakes) | T6–T8 | **T7** | **30% T7**, 30% T6, 40% T5 |
| **Alewife** | T3 gamefish (east-coast lakes) | T6–T8 | **T7** | **30% T7**, 30% T6, 40% T5 |

---

## 5. Saltwater bait (catch-only)

| Bait | Source fish | Advertised lure range | Bait tier | Typical hook mix |
|------|-------------|----------------------|-----------|------------------|
| **Bay Anchovy** | T1 forage | T2–T3 | **T3** | **70% T3**, 30% T2 |
| **Sand Eel** | T1 forage | T2–T3 | **T3** | **70% T3**, 30% T2 |
| **Menhaden** | T2 pier fish | T3–T5 | **T4** | **60% T4**, 30% T3, 10% T2 |
| **Sardine** | T2 pier fish | T3–T5 | **T4** | **60% T4**, 30% T3, 10% T2 |
| **Goggle-eye** | T3 inshore fish | T7–T8 | **T8** | **20% T8**, 30% T7, 50% T6 |
| **Threadfin Herring** | T3 inshore fish | T7–T8 | **T8** | **20% T8**, 30% T7, 50% T6 |

---

## 6. Quick reference by water

**Freshwater chain:** Minnow/Shiner (T3) · Shad (T4) · Cisco/Alewife (T7, deep boat spots)

**Saltwater chain:** Anchovy/Sand Eel (T3) · Menhaden/Sardine (T4) · Goggle-eye/Threadfin (T8, offshore)

**Shop, any water:** Worms (T2) · Spinner Lure (T5) · Deep Diver Lure (T6)

Every bait tier T2–T8 is covered: T2 shop · T3/T4 forage · T5/T6 synthetic lures · T7/T8 premium
catch-only forage.

---

## 7. Notes

1. **UI labels** — the shop/HUD show each bait as “T{n} bait — hooks mostly T{n}” (the old
   lure-range labels are gone; `forTiers` only feeds the tier derivation).
2. **Spot limits** — At a T1–2 stream, T2 bait’s “10% above tier” slot falls to T1, so you see
   more low-tier fish than the full table suggests. Likewise the T7/T8 hook-mix rows above show
   the FULL tables — at real T6-8 boat spots the T5 slot falls to T6 (cisco: 30/70 T7/T6;
   goggle-eye: 20/30/50 unchanged).
3. **No bait at spot** — If the bait's hook table shares **no tiers** with the spot, bait is
   ignored and the spot's natural pool is used.
4. **Junk** — Only T1 rolls while baited can hook junk (~10% of that T1 bite). Higher-tier bait
   tables skip T1 entirely, so no junk on those baits.
5. **Wait time** — Small forage (grade 1) bites fastest; Golden Shiner and Sand Eel are especially
   flashy (`waitFactor` 0.55). Grade 2 cut bait is tier-focused; grade 3 rare live bait is tuned for
   monsters with modest wait help.

---

## 8. Bait chains (progression)

```
Freshwater:
  T1 minnows/shiners (T3 bait)  →  shad (T4)  →  cisco / alewife (T7)

Saltwater:
  T1 anchovy/sand eel (T3 bait)  →  menhaden / sardine (T4)  →  goggle-eye / threadfin (T8)

Shop (any water):
  Worms (T2) — always available
  Spinner Lure (T5, $90, ~8 soft uses) · Deep Diver Lure (T6, $140, ~6 soft uses)
```

Premium bait (Cisco, Alewife, Goggle-eye, Threadfin Herring) cannot be bought from the NPC; catch
it or trade with players (auction house — future). Synthetic lures deliberately stop at T6 so the
top-tier bait market stays player-driven.
