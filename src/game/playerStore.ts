import { BOAT_TIERS, fishValue, LINE_TIERS, POLE_TIERS } from "./gear";
import { baitFromFish, WORMS, type BaitDef } from "./bait";
import { getHook, HOOKS, STARTER_HOOK_COUNT, STARTER_HOOK_ID, type HookDef } from "./hooks";
import { coolerCooldownMs, spotLockMs } from "./spotRest";
import type { Spot } from "../world/regions";

export interface FishBait {
  grade: number;
  forTiers: number[];
}

export interface CaughtFish {
  name: string;
  tier: number;
  water: "fresh" | "salt";
  weightKg: number;
  value: number;
  /** Present if this species can be kept as bait. */
  bait?: FishBait;
}

export interface BaitStack {
  def: BaitDef;
  count: number;
}

export interface HookStack {
  def: HookDef;
  count: number;
}

/** A mounted catch on the Trophy Wall. */
export interface Trophy {
  name: string;
  tier: number;
  water: "fresh" | "salt";
  weightKg: number;
  value: number;
}

/** A Fishdex entry: per-species collection record (auto-tracked on catch). */
export interface DexEntry {
  name: string;
  tier: number;
  water: "fresh" | "salt";
  count: number;
  maxWeightKg: number;
}

interface Persisted {
  currency: number;
  inventory: CaughtFish[];
  baitBox: Record<string, BaitStack>;
  equippedBaitId: string | null;
  hookBox: Record<string, HookStack>;
  equippedHookId: string | null;
  trophies: Trophy[];
  fishdex: Record<string, DexEntry>;
  lineTier: number;
  poleTier: number;
  boatTier: number;
  currentRegionId: string | null;
  tutorialDone: boolean;
  /** Spot-lock reopen times by spot id (epoch ms). */
  spotLocks: Record<string, number>;
  /** When the cooler finishes re-icing (epoch ms; 0 = keeps allowed). */
  coolerLockedUntil: number;
}

const STORAGE_KEY = "tidalties.player";
/** Cooler capacity — the catch inventory is bounded (upgradeable later). */
export const COOLER_CAP = 24;
/** Trophy Wall capacity. */
export const TROPHY_CAP = 12;

/**
 * Player progression: currency, the catch inventory, and owned gear. An
 * external store (subscribe/getVersion for useSyncExternalStore), app-level and
 * decoupled from the fishing store — the App pushes catches in via addCatch and
 * reads gear out via lineMaxTension/reelMult to configure the fight. Persists
 * to localStorage.
 */
export class PlayerStore {
  currency = 0;
  /** The cooler: caught fish, bounded by COOLER_CAP. */
  inventory: CaughtFish[] = [];
  /** Kept bait by id. */
  baitBox: Record<string, BaitStack> = {};
  equippedBaitId: string | null = null;
  /** Hook tackle in stock (consumed when the line snaps). */
  hookBox: Record<string, HookStack> = {};
  equippedHookId: string | null = null;
  /** Mounted catches (Trophy Wall) + the species collection log (Fishdex). */
  trophies: Trophy[] = [];
  fishdex: Record<string, DexEntry> = {};
  /** Index into LINE_TIERS / POLE_TIERS of the currently owned (top) gear. */
  lineTier = 0;
  poleTier = 0;
  /** Index into BOAT_TIERS of the owned boat, or -1 if none. */
  boatTier = -1;
  /** The region the player is currently located in (null = pick a start). */
  currentRegionId: string | null = null;
  /** First-time-user tutorial: false until the first fish is banked. */
  tutorialDone = false;
  /** Spot-lock reopen times by spot id (see spotRest.ts for the durations). */
  spotLocks: Record<string, number> = {};
  /** Cooler re-icing: keeps blocked until this time (0 = open). */
  coolerLockedUntil = 0;

  private version = 0;
  private listeners = new Set<() => void>();

  constructor() {
    this.seedStarterHooks();
    this.load();
  }

  private seedStarterHooks() {
    const def = getHook(STARTER_HOOK_ID);
    if (def) {
      this.hookBox[STARTER_HOOK_ID] = { def, count: STARTER_HOOK_COUNT };
      this.equippedHookId = STARTER_HOOK_ID;
    }
  }

  // --- useSyncExternalStore glue ---
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getVersion = (): number => this.version;

  private changed() {
    this.version++;
    this.save();
    for (const l of this.listeners) l();
  }

  // --- gear getters (feed the fight) ---
  get lineMaxTension(): number {
    return LINE_TIERS[this.lineTier].maxTension;
  }
  get reelMult(): number {
    return POLE_TIERS[this.poleTier].reelMult;
  }
  get line() {
    return LINE_TIERS[this.lineTier];
  }
  get pole() {
    return POLE_TIERS[this.poleTier];
  }

  // --- boat ---
  get ownsBoat(): boolean {
    return this.boatTier >= 0;
  }
  get boat() {
    return this.boatTier >= 0 ? BOAT_TIERS[this.boatTier] : null;
  }
  get boatSpeed(): number {
    return this.boat?.speed ?? 1;
  }
  /** Can the player take a boat out on this water with their current boat? */
  canBoat(water: "fresh" | "salt"): boolean {
    if (!this.boat) return false;
    return water === "fresh" ? true : this.boat.ocean; // ocean needs an ocean boat
  }

  // --- catches (cooler) ---
  get coolerFull(): boolean {
    return this.inventory.length >= COOLER_CAP;
  }

  /**
   * Keep a catch in the cooler. Returns false (released) if the cooler is full
   * or re-icing. Filling the last slot starts the re-icing cooldown — the
   * account-level catch budget (24 keeps per cooldown, wherever you fish).
   */
  addCatch(c: { name: string; tier: number; water: "fresh" | "salt"; weightKg: number; bait?: FishBait }): boolean {
    // Fishdex records the species even if the cooler is full (you still saw it).
    this.recordDex(c);
    if (!this.canKeep) {
      this.changed();
      return false;
    }
    this.inventory.push({
      name: c.name,
      tier: c.tier,
      water: c.water,
      weightKg: c.weightKg,
      value: fishValue(c.tier, c.weightKg),
      bait: c.bait,
    });
    // The tutorial's first fish shouldn't start a cooldown mid-funnel.
    if (this.inventory.length >= COOLER_CAP && this.tutorialDone) {
      this.coolerLockedUntil = Date.now() + coolerCooldownMs();
    }
    this.changed();
    return true;
  }

  private recordDex(c: { name: string; tier: number; water: "fresh" | "salt"; weightKg: number }) {
    const e = this.fishdex[c.name];
    if (e) {
      e.count += 1;
      if (c.weightKg > e.maxWeightKg) e.maxWeightKg = c.weightKg;
    } else {
      this.fishdex[c.name] = { name: c.name, tier: c.tier, water: c.water, count: 1, maxWeightKg: c.weightKg };
    }
  }

  // --- trophy wall ---
  get trophyWallFull(): boolean {
    return this.trophies.length >= TROPHY_CAP;
  }

  /** Mount a cooler fish on the wall (kept, not sold). False if wall is full. */
  mountTrophy(coolerIndex: number): boolean {
    const f = this.inventory[coolerIndex];
    if (!f || this.trophyWallFull) return false;
    this.trophies.push({ name: f.name, tier: f.tier, water: f.water, weightKg: f.weightKg, value: f.value });
    this.inventory.splice(coolerIndex, 1);
    this.changed();
    return true;
  }

  /** Take a trophy down and sell it for its value. */
  removeTrophy(index: number) {
    const t = this.trophies[index];
    if (!t) return;
    this.currency += t.value;
    this.trophies.splice(index, 1);
    this.changed();
  }

  get inventoryValue(): number {
    return this.inventory.reduce((sum, f) => sum + f.value, 0);
  }

  sellOne(index: number) {
    const f = this.inventory[index];
    if (!f) return;
    this.currency += f.value;
    this.inventory.splice(index, 1);
    this.changed();
  }

  sellAll() {
    if (this.inventory.length === 0) return;
    this.currency += this.inventoryValue;
    this.inventory = [];
    this.changed();
  }

  // --- bait box ---
  /** Move a baitfish from the cooler into the bait box. */
  stockBait(coolerIndex: number) {
    const f = this.inventory[coolerIndex];
    if (!f || !f.bait) return;
    const def = baitFromFish(f.name, f.bait.grade, f.bait.forTiers);
    const stack = this.baitBox[def.id];
    if (stack) stack.count += 1;
    else this.baitBox[def.id] = { def, count: 1 };
    this.inventory.splice(coolerIndex, 1);
    this.changed();
  }

  buyWorms(qty = 1): boolean {
    const cost = (WORMS.price ?? 0) * qty;
    if (this.currency < cost) return false;
    this.currency -= cost;
    const stack = this.baitBox[WORMS.id];
    if (stack) stack.count += qty;
    else this.baitBox[WORMS.id] = { def: WORMS, count: qty };
    this.changed();
    return true;
  }

  /** Sell value of a bait unit (forage sells modestly; worms by their price). */
  private baitUnitValue(def: BaitDef): number {
    return def.grade === 0 ? Math.round((def.price ?? 0) * 0.5) : fishValue(def.grade + 1, 1);
  }

  sellBait(id: string, qty = 1) {
    const stack = this.baitBox[id];
    if (!stack) return;
    const n = Math.min(qty, stack.count);
    this.currency += this.baitUnitValue(stack.def) * n;
    stack.count -= n;
    if (stack.count <= 0) {
      delete this.baitBox[id];
      if (this.equippedBaitId === id) this.equippedBaitId = null;
    }
    this.changed();
  }

  equipBait(id: string | null) {
    this.equippedBaitId = id && this.baitBox[id] ? id : null;
    this.changed();
  }

  get equippedBait(): BaitStack | null {
    return this.equippedBaitId ? this.baitBox[this.equippedBaitId] ?? null : null;
  }

  /** Effect of the equipped bait for the fight (null if none). */
  get baitEffect(): { forTiers: number[]; tierBoost: number; waitFactor: number } | null {
    const s = this.equippedBait;
    return s ? { forTiers: s.def.forTiers, tierBoost: s.def.tierBoost, waitFactor: s.def.waitFactor } : null;
  }

  /** True if the equipped bait has stock (peek; doesn't consume). */
  hasBait(): boolean {
    return (this.equippedBait?.count ?? 0) > 0;
  }

  /** Consume one of the equipped bait. Returns false if none. */
  consumeBait(): boolean {
    const stack = this.equippedBait;
    if (!stack || stack.count <= 0) return false;
    stack.count -= 1;
    if (stack.count <= 0) {
      delete this.baitBox[stack.def.id];
      this.equippedBaitId = null;
    }
    this.changed();
    return true;
  }

  // --- hook tackle ---
  buyHook(id: string, qty = 1): boolean {
    const def = getHook(id);
    if (!def || qty < 1) return false;
    const cost = def.price * qty;
    if (this.currency < cost) return false;
    this.currency -= cost;
    const stack = this.hookBox[id];
    if (stack) stack.count += qty;
    else this.hookBox[id] = { def, count: qty };
    this.changed();
    return true;
  }

  equipHook(id: string | null) {
    this.equippedHookId = id && this.hookBox[id]?.count ? id : null;
    this.changed();
  }

  get equippedHook(): HookStack | null {
    return this.equippedHookId ? this.hookBox[this.equippedHookId] ?? null : null;
  }

  /** Equipped hook for the fight (null if none in stock). */
  get hookEffect(): HookDef | null {
    const s = this.equippedHook;
    return s && s.count > 0 ? s.def : null;
  }

  hasHook(): boolean {
    return (this.equippedHook?.count ?? 0) > 0;
  }

  /** Remove one equipped hook after a line snap. */
  consumeHookOnSnap(): boolean {
    const stack = this.equippedHook;
    if (!stack || stack.count <= 0) return false;
    stack.count -= 1;
    if (stack.count <= 0) {
      delete this.hookBox[stack.def.id];
      this.equippedHookId = null;
    }
    this.changed();
    return true;
  }

  get ownedHooks(): HookDef[] {
    return HOOKS.filter((h) => (this.hookBox[h.id]?.count ?? 0) > 0);
  }

  // --- gear purchases (buy the next tier up if affordable) ---
  buyLine(): boolean {
    return this.buy(LINE_TIERS, "lineTier");
  }
  buyPole(): boolean {
    return this.buy(POLE_TIERS, "poleTier");
  }
  buyBoat(): boolean {
    return this.buy(BOAT_TIERS, "boatTier");
  }
  private buy(tiers: { price: number }[], key: "lineTier" | "poleTier" | "boatTier"): boolean {
    const next = this[key] + 1; // boatTier starts at -1 → next 0 = first boat
    if (next >= tiers.length) return false; // maxed
    const price = tiers[next].price;
    if (this.currency < price) return false; // can't afford
    this.currency -= price;
    this[key] = next;
    this.changed();
    return true;
  }

  // --- fishing fee (per-session sink, charged on entering a spot) ---
  payFishFee(amount: number): boolean {
    if (this.currency < amount) return false;
    this.currency -= amount;
    this.changed();
    return true;
  }

  // --- spot locks + cooler cooldown (progression time-gates; see spotRest.ts) ---
  /**
   * Lock a spot for the flat rest period — fired on the first landed (non-junk)
   * fish of a session. Re-entry is blocked until it expires; the session itself
   * continues. No-ops during the tutorial. Wall-clock timestamps so locks
   * survive reloads (device-clock tampering accepted: single-player, no server
   * authority).
   */
  lockSpot(spot: Spot) {
    if (!this.tutorialDone) return;
    if (this.spotLocks[spot.id] && Date.now() < this.spotLocks[spot.id]) return; // already locked
    this.spotLocks[spot.id] = Date.now() + spotLockMs();
    this.changed();
  }

  /** Epoch ms when the spot reopens, or 0 if fishable now (lazily expires). */
  restUntil(spot: Spot): number {
    const until = this.spotLocks[spot.id];
    if (!until) return 0;
    if (Date.now() >= until) {
      delete this.spotLocks[spot.id];
      return 0;
    }
    return until;
  }

  isResting(spot: Spot): boolean {
    return this.restUntil(spot) > 0;
  }

  /**
   * Instantly clear a spot's lock. Monetization hook — a future premium
   * "chum" purchase calls this after charging premium currency.
   */
  replenishSpot(spotId: string) {
    if (!this.spotLocks[spotId]) return;
    delete this.spotLocks[spotId];
    this.changed();
  }

  /** Ms of cooler re-icing left (0 = keeps allowed; lazily clears). */
  coolerLockMs(): number {
    if (this.coolerLockedUntil === 0) return 0;
    const left = this.coolerLockedUntil - Date.now();
    if (left <= 0) {
      this.coolerLockedUntil = 0;
      return 0;
    }
    return left;
  }

  /** Can a catch be kept right now? (slots free + cooler not re-icing) */
  get canKeep(): boolean {
    return !this.coolerFull && this.coolerLockMs() === 0;
  }

  /**
   * Instantly finish the cooler's re-icing. Monetization hook — the premium
   * "fresh ice" purchase calls this after charging premium currency.
   */
  reiceCooler() {
    if (this.coolerLockedUntil === 0) return;
    this.coolerLockedUntil = 0;
    this.changed();
  }

  // --- travel ---
  canAfford(cost: number): boolean {
    return this.currency >= cost;
  }

  /** Mark the how-to-fish tutorial as finished (first fish banked). */
  completeTutorial() {
    if (this.tutorialDone) return;
    this.tutorialDone = true;
    this.changed();
  }

  /** Free first spawn — only valid before a region is chosen. */
  startIn(regionId: string) {
    if (this.currentRegionId !== null) return;
    this.currentRegionId = regionId;
    this.changed();
  }

  /**
   * Move to a region. Re-entering the current region is free; any other region
   * costs `cost` (and is refused if unaffordable). Returns whether we moved.
   */
  travelTo(regionId: string, cost: number): boolean {
    if (regionId === this.currentRegionId) return true; // already here, free
    if (this.currency < cost) return false;
    this.currency -= cost;
    this.currentRegionId = regionId;
    this.changed();
    return true;
  }

  // --- persistence ---
  private save() {
    try {
      const data: Persisted = {
        currency: this.currency,
        inventory: this.inventory,
        baitBox: this.baitBox,
        equippedBaitId: this.equippedBaitId,
        hookBox: this.hookBox,
        equippedHookId: this.equippedHookId,
        trophies: this.trophies,
        fishdex: this.fishdex,
        lineTier: this.lineTier,
        poleTier: this.poleTier,
        boatTier: this.boatTier,
        currentRegionId: this.currentRegionId,
        tutorialDone: this.tutorialDone,
        spotLocks: this.spotLocks,
        coolerLockedUntil: this.coolerLockedUntil,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore (private mode / quota)
    }
  }
  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Partial<Persisted>;
      this.currency = d.currency ?? 0;
      this.inventory = (d.inventory ?? []).slice(0, COOLER_CAP);
      this.baitBox = d.baitBox ?? {};
      this.equippedBaitId = d.equippedBaitId && this.baitBox[d.equippedBaitId] ? d.equippedBaitId : null;
      if (d.hookBox && Object.keys(d.hookBox).length > 0) {
        this.hookBox = d.hookBox;
      } else {
        this.seedStarterHooks();
      }
      this.equippedHookId =
        d.equippedHookId && this.hookBox[d.equippedHookId] ? d.equippedHookId : STARTER_HOOK_ID;
      if (!this.hookBox[this.equippedHookId ?? ""]) this.equippedHookId = null;
      this.trophies = (d.trophies ?? []).slice(0, TROPHY_CAP);
      this.fishdex = d.fishdex ?? {};
      this.lineTier = clampTier(d.lineTier, LINE_TIERS.length);
      this.poleTier = clampTier(d.poleTier, POLE_TIERS.length);
      this.boatTier = typeof d.boatTier === "number" ? Math.max(-1, Math.min(BOAT_TIERS.length - 1, Math.floor(d.boatTier))) : -1;
      this.currentRegionId = d.currentRegionId ?? null;
      // Older saves predate the flag: anyone with Fishdex entries has clearly
      // fished before, so don't force the tutorial on them.
      this.tutorialDone = d.tutorialDone ?? Object.keys(this.fishdex).length > 0;
      // Drop locks that expired while the game was closed (keeps the map small).
      // Migration: v1 saves stored spotRest {count, until} — keep the until.
      const legacy = (d as { spotRest?: Record<string, { until?: number }> }).spotRest;
      const rawLocks: Record<string, number> =
        d.spotLocks ??
        Object.fromEntries(Object.entries(legacy ?? {}).map(([id, e]) => [id, e.until ?? 0]));
      this.spotLocks = {};
      const now = Date.now();
      for (const [id, until] of Object.entries(rawLocks)) {
        if (until > now) this.spotLocks[id] = until;
      }
      this.coolerLockedUntil =
        typeof d.coolerLockedUntil === "number" && d.coolerLockedUntil > now ? d.coolerLockedUntil : 0;
    } catch {
      // ignore corrupt save
    }
  }
}

function clampTier(v: number | undefined, len: number): number {
  if (typeof v !== "number" || Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(len - 1, Math.floor(v)));
}

export function createPlayerStore(): PlayerStore {
  return new PlayerStore();
}
