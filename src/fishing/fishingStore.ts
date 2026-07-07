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
  BAITED_JUNK_WEIGHT,
  getFishByName,
  getTier,
  poolFor,
  randomFishFromPool,
  rollWeight,
  type FishDef,
  type Water,
} from "./fishCatalog";
import { baitTierWeights } from "../game/bait";
import { DEFAULT_HOLE, QUALITY_CURVES, rollWaitTime, type FishingHole } from "./fishingHoles";
import { pickTier, type Spot } from "../world/regions";
import { effectiveHookHold, type HookDef } from "../game/hooks";
import { sfx } from "../audio/sfx";

export interface Catch {
  name: string;
  tier: number;
  water: Water;
  weightKg: number;
  isJunk: boolean;
  bait?: { grade: number; forTiers: number[] };
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
  baitTier: number | null = null;
  baitWaitFactor = 1;
  /** Synthetic lure's soft use count (null = live bait, eaten per bite). */
  baitLureUses: number | null = null;
  hasBait?: () => boolean;
  consumeBait?: () => void;
  /** A synthetic lure is on the hooked fish — resolved when the fight ends. */
  private lurePending = false;

  /** Equipped hook effect (set by App); stock checked via hasHook. */
  hookEffect: HookDef | null = null;
  hasHook?: () => boolean;
  /** Called when the line snaps — destroys the equipped hook. */
  onLineSnap?: () => void;

  /** Called once per landed non-junk fish — triggers the spot's 6h lock. */
  onLanded?: (spot: Spot) => void;

  /** Selected difficulty tier (1–8) and water type — which pool we're fishing. */
  selectedTier = 1;
  selectedWater: Water = "fresh";
  /** The fishing hole — governs the wait-to-bite distribution. */
  currentHole: FishingHole = DEFAULT_HOLE;
  /** The map spot being fished (null = dev tier/water selector mode). */
  currentSpot: Spot | null = null;
  /** The fish currently hooked / about to be cast for. */
  private _fish: FishDef;
  /**
   * A landed catch awaiting the player's decision (drives the catch modal).
   * Fish are banked via keepCatch(); junk is discarded via dismissCatch().
   */
  lastCatch: Catch | null = null;

  private version = 0;
  private listeners = new Set<() => void>();
  private sinceNotify = 0;
  private pendingHook = false;
  // Edge detection for one-shot sounds (nibble tell, run start).
  private wasNibbling = false;
  private wasRunning = false;

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
  setBait(effect: { tier: number; waitFactor: number; lureUses?: number } | null) {
    this.baitTier = effect ? effect.tier : null;
    this.baitWaitFactor = effect ? effect.waitFactor : 1;
    this.baitLureUses = effect?.lureUses ?? null;
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
    // A pending catch must be resolved (kept/trashed) before the next cast.
    if (!this.idle() || this.castBlocked() || this.lastCatch) return;
    this.beginCast();
  }

  /** Bank the pending catch (junk is never banked) and close the reveal. */
  keepCatch() {
    const c = this.lastCatch;
    if (!c) return;
    this.lastCatch = null;
    if (!c.isJunk) {
      this.onCatch?.({ name: c.name, tier: c.tier, water: c.water, weightKg: c.weightKg, bait: c.bait });
      sfx.keep();
    }
    this.notify();
  }

  /** Throw the pending catch away (junk → trash, fish → released). */
  dismissCatch() {
    const c = this.lastCatch;
    if (!c) return;
    this.lastCatch = null;
    if (c.isJunk) sfx.trash();
    this.notify();
  }

  /** Re-throw: bail on a slow bite and roll a fresh fish + wait. */
  recast() {
    if (this.castBlocked() || this.state.phase === "fighting") return;
    this.beginCast();
  }

  private beginCast() {
    // A random catch from the spot's pool (or the dev tier/water selection),
    // with the wait-to-bite rolled from the hole's quality curve. Equipped bait
    // (if in stock) replaces the tier roll with its bait-tier hook table and
    // slashes the junk share of any T1 roll.
    const baited = this.baitTier !== null && (this.hasBait?.() ?? false);
    const spot = this.currentSpot;
    if (spot) {
      // Mythic roll first: the spot's storied one can steal the hook outright.
      const myth = spot.mythic ? getFishByName(spot.mythic.fish) : undefined;
      if (myth && Math.random() < spot.mythic!.chance) {
        this._fish = this.withHookHold(myth);
      } else {
        const tiers = (baited ? baitTierWeights(this.baitTier!, spot.tiers) : null) ?? spot.tiers;
        this._fish = this.withHookHold(
          randomFishFromPool(
            pickTier(tiers),
            spot.water,
            Math.random,
            spot.access,
            baited ? BAITED_JUNK_WEIGHT : undefined,
          ),
        );
      }
    } else {
      this._fish = this.withHookHold(randomFishFromPool(this.selectedTier, this.selectedWater, Math.random, "land"));
    }
    const wait = rollWaitTime(this.currentHole) * (baited ? this.baitWaitFactor : 1);
    this.state = startCast(this._fish, wait);
    sfx.cast();
    // Live bait is eaten by the bite — only a real fish (not junk) consumes it.
    // Synthetic lures aren't eaten; they resolve when a hooked fight ends
    // (soft wear on a landing, gone outright with a lost fish).
    this.lurePending = false;
    if (baited && this._fish.kind !== "junk" && this.baitLureUses === null) this.consumeBait?.();
    this.releaseInput();
    this.notify();
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

    // --- sound: phase / event edges ---
    const s = this.state;
    if (s.phase === "bite" && prevPhase === "waiting") sfx.bite();
    if (s.phase === "fighting" && prevPhase !== "fighting") {
      sfx.hookset();
      // Arm the synthetic lure: it's now on a hooked fish. (A missed bite
      // never arms it — the fish spat the lure, no loss.)
      this.lurePending =
        this.baitLureUses !== null &&
        this.baitTier !== null &&
        (this.hasBait?.() ?? false) &&
        this._fish.kind !== "junk";
    }
    // Blown cast (pulled too soon / missed the bite window) → gentle fail cue.
    if (s.phase === "idle" && (prevPhase === "waiting" || prevPhase === "bite")) sfx.lost();
    const nib = this.nibbling;
    if (nib && !this.wasNibbling) sfx.nibble();
    this.wasNibbling = nib;
    if (s.running && !this.wasRunning) sfx.run();
    this.wasRunning = s.running;
    if (s.phase === "fighting") {
      sfx.reelStep(this.input.reel, dt);
      sfx.dangerStep(this.danger, dt);
    }

    // Line snap destroys the equipped hook (consumable tackle).
    if (this.state.phase === "lost" && prevPhase !== "lost" && this.state.message.startsWith("SNAP!")) {
      this.onLineSnap?.();
    }
    if (this.state.phase === "lost" && prevPhase !== "lost") {
      if (this.state.message.startsWith("SNAP!")) sfx.snap();
      else sfx.lost();
      // A lost fish takes the synthetic lure with it.
      if (this.lurePending) {
        this.consumeBait?.();
        this.lurePending = false;
      }
    }

    // On a fresh landing, stage the catch for the reveal modal. Banking waits
    // for the player's "Add to Cooler" (keepCatch); junk is trashed instead.
    if (this.state.phase === "landed" && prevPhase !== "landed") {
      const f = this._fish;
      if (f.kind === "junk") {
        this.lastCatch = { name: f.name, tier: f.tier, water: f.water, weightKg: 0, isJunk: true };
        this.state.message = `You hauled in… ${f.name}.`;
        sfx.landedJunk();
      } else {
        const weightKg = rollWeight(f);
        this.lastCatch = {
          name: f.name,
          tier: f.tier,
          water: f.water,
          weightKg,
          isJunk: false,
          bait: f.bait ? { grade: f.bait.grade, forTiers: f.bait.forTiers } : undefined,
        };
        this.state.message = `Landed a ${weightKg} kg ${f.name}!`;
        sfx.landedFish(f.tier);
        // The first landing (not keep) locks the spot for re-entry — the
        // session continues, but you can't come back until the lock expires.
        if (this.currentSpot) this.onLanded?.(this.currentSpot);
        // Soft wear on the synthetic lure: ~1-in-uses landings retires it.
        if (this.lurePending) {
          if (Math.random() < 1 / (this.baitLureUses ?? 1)) this.consumeBait?.();
          this.lurePending = false;
        }
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
