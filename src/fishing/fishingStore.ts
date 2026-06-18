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
import { DEFAULT_HOLE, rollWaitTime, type FishingHole } from "./fishingHoles";

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
  readonly line: LineSpec;
  readonly input: FightInput = { reel: 0, steer: 0 };

  /** Selected difficulty tier (1–8) and water type — which pool we're fishing. */
  selectedTier = 1;
  selectedWater: Water = "fresh";
  /** The fishing hole — governs the wait-to-bite distribution. */
  currentHole: FishingHole = DEFAULT_HOLE;
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

  /** First land-accessible entry of the selected pool (for the idle display). */
  private displayFish(): FishDef {
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

  /** Switch fishing hole (dev/console for now; the map will drive this later). */
  setHole(hole: FishingHole) {
    this.currentHole = hole;
    this.notify();
  }

  cast() {
    if (!this.idle() || this.tierLocked(this.selectedTier)) return;
    this.beginCast();
  }

  /** Re-throw: bail on a slow bite and roll a fresh fish + wait. */
  recast() {
    if (this.tierLocked(this.selectedTier)) return;
    const p = this.state.phase;
    if (p === "fighting") return; // can't recast mid-fight
    this.beginCast();
  }

  private beginCast() {
    // A random catch from the selected tier/water pool (land-only for now,
    // includes junk in tier 1) — mimics a location's pool. The wait-to-bite is
    // rolled from the current hole's quality curve.
    this._fish = randomFishFromPool(this.selectedTier, this.selectedWater, Math.random, "land");
    this.state = startCast(this._fish, rollWaitTime(this.currentHole));
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
