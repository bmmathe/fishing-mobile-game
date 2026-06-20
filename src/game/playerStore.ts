import { BOAT_TIERS, fishValue, LINE_TIERS, POLE_TIERS } from "./gear";

export interface CaughtFish {
  name: string;
  tier: number;
  water: "fresh" | "salt";
  weightKg: number;
  value: number;
}

interface Persisted {
  currency: number;
  inventory: CaughtFish[];
  lineTier: number;
  poleTier: number;
  boatTier: number;
  currentRegionId: string | null;
}

const STORAGE_KEY = "tidalties.player";

/**
 * Player progression: currency, the catch inventory, and owned gear. An
 * external store (subscribe/getVersion for useSyncExternalStore), app-level and
 * decoupled from the fishing store — the App pushes catches in via addCatch and
 * reads gear out via lineMaxTension/reelMult to configure the fight. Persists
 * to localStorage.
 */
export class PlayerStore {
  currency = 0;
  inventory: CaughtFish[] = [];
  /** Index into LINE_TIERS / POLE_TIERS of the currently owned (top) gear. */
  lineTier = 0;
  poleTier = 0;
  /** Index into BOAT_TIERS of the owned boat, or -1 if none. */
  boatTier = -1;
  /** The region the player is currently located in (null = pick a start). */
  currentRegionId: string | null = null;

  private version = 0;
  private listeners = new Set<() => void>();

  constructor() {
    this.load();
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

  // --- catches ---
  addCatch(c: { name: string; tier: number; water: "fresh" | "salt"; weightKg: number }) {
    this.inventory.push({ ...c, value: fishValue(c.tier, c.weightKg) });
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

  // --- travel ---
  canAfford(cost: number): boolean {
    return this.currency >= cost;
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
        lineTier: this.lineTier,
        poleTier: this.poleTier,
        boatTier: this.boatTier,
        currentRegionId: this.currentRegionId,
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
      this.inventory = d.inventory ?? [];
      this.lineTier = clampTier(d.lineTier, LINE_TIERS.length);
      this.poleTier = clampTier(d.poleTier, POLE_TIERS.length);
      this.boatTier = typeof d.boatTier === "number" ? Math.max(-1, Math.min(BOAT_TIERS.length - 1, Math.floor(d.boatTier))) : -1;
      this.currentRegionId = d.currentRegionId ?? null;
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
