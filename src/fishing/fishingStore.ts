import {
  isDanger,
  isNibbling,
  makeFight,
  startCast,
  stepFight,
  type FightInput,
  type FightState,
  type LineSpec,
} from "./fishingModel";
import {
  getTier,
  poolFor,
  randomFishFromPool,
  rollWeight,
  type FishDef,
  type Water,
} from "./fishCatalog";
import { DEFAULT_HOLE, QUALITY_CURVES, rollWaitTime, type FishingHole } from "./fishingHoles";
import { pickTier, type Spot } from "../world/regions";
import { effectiveHookHold, type HookDef } from "../game/hooks";

export interface Catch {
  name: string;
  tier: number;
  weightKg: number;
  isJunk: boolean;
}

/**
 * A tiny external store holding the live fight. The R3F scene steps it inside
 * its render loop (single source of truth, no duplicate timers) and updates
 * meshes imperatively; the DOM HUD subscribes via useSyncExternalStore for
 * throttled re-renders. Input is mutated directly by the touch/keyboard
 * controls so the per-frame step stays allocation-free.
 */
export class FishingStore {
  state: FightState;
  /** Equipped gear summary: maxTension (line) + reelMult (pole). Set via applyGear. */
  line: LineSpec;
  readonly input: FightInput = { reel: 0, steer: 0 };
  /** Called once per landed (non-junk) fish, so the app can bank the catch. */
  onCatch?: (c: {
    name: string;
    tier: number;
    water: "fresh" | "salt";
    weightKg: number;
    bait?: { grade: number; forTiers: number[] };
  }) => void;

  /** Equipped-bait effect (set by App), and stock hooks into the player store. */
  baitForTiers: number[] | null = null;
  baitTierBoost = 1;
  baitWaitFactor = 1;
  hasBait?: () => boolean;
  consumeBait?: () => void;

  /** Equipped hook effect (set by App); stock checked via hasHook. */
  hookEffect: HookDef | null = null;
  hasHook?: () => boolean;
  /** Called when the line snaps — destroys the equipped hook. */
  onLineSnap?: () => void;

  /** Selected difficulty tier (1–8) and water type — which pool we're fishing. */
  selectedTier = 1;
  selectedWater: Water = "fresh";
  /** The fishing hole — governs the wait-to-bite distribution. */
  currentHole: FishingHole = DEFAULT_HOLE;
  /** The map spot being fished (null = dev tier/water selector mode). */
  currentSpot: Spot | null = null;
  /** The fish currently hooked / about to be cast for. */
  private _fish: FishDef;
  /** Most recent landed catch, for the reveal. */
  lastCatch: Catch | null = null;

  private version = 0;
  private listeners = new Set<() => void>();
  private sinceNotify = 0;
  private pendingHook = false;

  constructor(line: LineSpec, tier = 1, water: Water = "fresh") {
    this.line = line;
    this.selectedTier = tier;
    this.selectedWater = water;
    this._fish = this.displayFish();
    this.state = makeFight(this._fish);
  }

  get fish(): FishDef {
    return this._fish;
  }

  /** A representative fish for the idle display (spot pool, else dev selection). */
  private displayFish(): FishDef {
    const spot = this.currentSpot;
    if (spot) {
      return poolFor(spot.tiers[0].tier, spot.water, spot.access)[0] ?? this._fish;
    }
    return poolFor(this.selectedTier, this.selectedWater, "land")[0] ?? this._fish;
  }

  // --- useSyncExternalStore glue ---
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getVersion = (): number => this.version;

  private notify() {
    this.version++;
    for (const l of this.listeners) l();
  }

  private idle(): boolean {
    const p = this.state.phase;
    return p === "idle" || p === "landed" || p === "lost";
  }

  // --- input ---
  setReel(v: number) {
    this.input.reel = Math.max(0, Math.min(1, v));
  }
  setSteer(v: number) {
    this.input.steer = Math.max(-1, Math.min(1, v));
  }
  releaseInput() {
    this.input.reel = 0;
    this.input.steer = 0;
  }
  /** Edge-triggered hook set, consumed on the next advance. */
  tapHook() {
    this.pendingHook = true;
  }

  // --- flow control (called from UI) ---
  /** Whether a tier can be fished right now (boat tiers are locked for now). */
  tierLocked(tier: number): boolean {
    return getTier(tier).access === "boat";
  }

  /** Choose which tier's pool to fish. Boat tiers are locked until boats exist. */
  selectTier(tier: number) {
    if (!this.idle() || tier === this.selectedTier || this.tierLocked(tier)) return;
    this.selectedTier = tier;
    this._fish = this.displayFish();
    this.state = makeFight(this._fish);
    this.notify();
  }

  setWater(water: Water) {
    if (!this.idle() || water === this.selectedWater) return;
    this.selectedWater = water;
    this._fish = this.displayFish();
    this.state = makeFight(this._fish);
    this.notify();
  }

  /** Switch fishing hole (dev/console). */
  setHole(hole: FishingHole) {
    this.currentHole = hole;
    this.notify();
  }

  /** Apply equipped gear: line snap-limit + pole reel multiplier. */
  applyGear(maxTension: number, reelMult: number) {
    this.line = { maxTension, reelMult };
    this.notify();
  }

  /** Set the equipped bait's effect (null = no bait). Stock is checked via hasBait. */
  setBait(effect: { forTiers: number[]; tierBoost: number; waitFactor: number } | null) {
    this.baitForTiers = effect ? effect.forTiers : null;
    this.baitTierBoost = effect ? effect.tierBoost : 1;
    this.baitWaitFactor = effect ? effect.waitFactor : 1;
    this.notify();
  }

  /** Set the equipped hook (null = none). Bonus applies only when hasHook is true. */
  setHook(hook: HookDef | null) {
    this.hookEffect = hook;
    this.notify();
  }

  /** Apply equipped hook bonus to a rolled fish spec. */
  private withHookHold(fish: FishDef): FishDef {
    if (!this.hookEffect || !(this.hasHook?.() ?? false)) return fish;
    return {
      ...fish,
      hookHold: effectiveHookHold(fish.hookHold ?? 1, fish.tier, this.hookEffect),
    };
  }

  /** Configure the store from a tapped map spot: water, hole (wait), fish pool. */
  setSpot(spot: Spot) {
    this.currentSpot = spot;
    this.selectedWater = spot.water;
    this.currentHole = {
      id: spot.id,
      name: spot.name,
      quality: spot.quality,
      water: spot.water,
      ...QUALITY_CURVES[spot.quality],
    };
    this._fish = this.displayFish();
    this.state = makeFight(this._fish);
    this.notify();
  }

  /** Can we cast right now? (boat-locked only matters in dev tier mode.) */
  private castBlocked(): boolean {
    return !this.currentSpot && this.tierLocked(this.selectedTier);
  }

  cast() {
    if (!this.idle() || this.castBlocked()) return;
    this.beginCast();
  }

  /** Re-throw: bail on a slow bite and roll a fresh fish + wait. */
  recast() {
    if (this.castBlocked() || this.state.phase === "fighting") return;
    this.beginCast();
  }

  private beginCast() {
    // A random catch from the spot's pool (or the dev tier/water selection),
    // with the wait-to-bite rolled from the hole's quality curve. Equipped bait
    // (if in stock) biases the tier roll up and shortens the wait.
    const baited = !!this.baitForTiers && (this.hasBait?.() ?? false);
    const spot = this.currentSpot;
    if (spot) {
      const tiers = baited ? this.boostTiers(spot.tiers) : spot.tiers;
      this._fish = this.withHookHold(randomFishFromPool(pickTier(tiers), spot.water, Math.random, spot.access));
    } else {
      this._fish = this.withHookHold(randomFishFromPool(this.selectedTier, this.selectedWater, Math.random, "land"));
    }
    const wait = rollWaitTime(this.currentHole) * (baited ? this.baitWaitFactor : 1);
    this.state = startCast(this._fish, wait);
    // One bait per bite — only a real fish (not junk) consumes it.
    if (baited && this._fish.kind !== "junk") this.consumeBait?.();
    this.releaseInput();
    this.notify();
  }

  /** Scale the weights of the bait's target tiers within a spot's pool. */
  private boostTiers(tiers: { tier: number; weight: number }[]) {
    const set = new Set(this.baitForTiers);
    return tiers.map((t) => (set.has(t.tier) ? { tier: t.tier, weight: t.weight * this.baitTierBoost } : t));
  }

  reset() {
    this.state = makeFight(this._fish);
    this.releaseInput();
    this.notify();
  }

  /** Step the simulation. Called once per render frame from the scene. */
  advance(dt: number) {
    const prevPhase = this.state.phase;
    const input: FightInput = {
      reel: this.input.reel,
      steer: this.input.steer,
      setHook: this.pendingHook,
    };
    this.pendingHook = false;

    // Clamp dt so a tab-out / long frame can't teleport the fight.
    stepFight(this.state, input, this._fish, this.line, Math.min(dt, 1 / 20));

    // Line snap destroys the equipped hook (consumable tackle).
    if (this.state.phase === "lost" && prevPhase !== "lost" && this.state.message.startsWith("SNAP!")) {
      this.onLineSnap?.();
    }

    // On a fresh landing, record the catch (junk vs fish differ).
    if (this.state.phase === "landed" && prevPhase !== "landed") {
      const f = this._fish;
      if (f.kind === "junk") {
        this.lastCatch = { name: f.name, tier: f.tier, weightKg: 0, isJunk: true };
        this.state.message = `You hauled in… ${f.name}.`;
      } else {
        const weightKg = rollWeight(f);
        this.lastCatch = { name: f.name, tier: f.tier, weightKg, isJunk: false };
        this.state.message = `Landed a ${weightKg} kg ${f.name}!`;
        this.onCatch?.({
          name: f.name,
          tier: f.tier,
          water: f.water,
          weightKg,
          bait: f.bait ? { grade: f.bait.grade, forTiers: f.bait.forTiers } : undefined,
        });
      }
    }

    this.sinceNotify += dt;
    if (this.state.phase !== prevPhase || this.sinceNotify >= 0.04) {
      this.sinceNotify = 0;
      this.notify();
    }
  }

  get danger(): boolean {
    return isDanger(this.state, this.line);
  }

  get nibbling(): boolean {
    return isNibbling(this.state);
  }
}

/** Build a store on the starter line, starting at Tier 1 freshwater. */
export function createDefaultStore(): FishingStore {
  // Deliberately weak starter line: easy to snap, so the difficulty curve has
  // room. Future pole/line upgrades raise maxTension (eases reeling), which is
  // what turns the ~0% tier 6-8 fish into catchable ones.
  const line: LineSpec = { maxTension: 0.78 };
  return new FishingStore(line, 1, "fresh");
}
