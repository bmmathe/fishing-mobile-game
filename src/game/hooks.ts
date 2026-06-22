/**
 * Specialty hook tackle. Hooks raise effective `hookHold` for fish in matching
 * tiers (`forTiers`), reducing shake-off losses. Equip one at a time (like bait).
 * Hooks are bought in packs of one; a line snap destroys the equipped hook.
 *
 * Numbers tuned via `npm run sim:hook`.
 */

export interface HookDef {
  id: string;
  name: string;
  forTiers: number[];
  /** Additive bonus to catalog hookHold, clamped to 1.0. */
  holdBonus: number;
  price: number;
  blurb?: string;
}

export const HOOKS: HookDef[] = [
  {
    id: "standard-j",
    name: "Standard J-Hook",
    forTiers: [1, 2, 3],
    holdBonus: 0,
    price: 0,
    blurb: "Basic hook — comes free with every rig.",
  },
  {
    id: "baitholder",
    name: "Baitholder Hook",
    forTiers: [1, 2, 3],
    holdBonus: 0.12,
    price: 80,
    blurb: "Extra barbs keep worms and minnows pinned.",
  },
  {
    id: "panfish",
    name: "Panfish Hook",
    forTiers: [1, 2],
    holdBonus: 0.2,
    price: 200,
    blurb: "Small, sharp — built for bluegill and perch.",
  },
  {
    id: "wide-gap",
    name: "Wide Gap Hook",
    forTiers: [3, 4],
    holdBonus: 0.1,
    price: 450,
    blurb: "Gap room for bass and walleye to turn without throwing it.",
  },
  {
    id: "circle",
    name: "Circle Hook",
    forTiers: [4, 5, 6],
    holdBonus: 0.06,
    price: 900,
    blurb: "Self-sets in the corner of the jaw — insurance on big fighters.",
  },
  {
    id: "offshore",
    name: "Offshore Hook",
    forTiers: [6, 7, 8],
    holdBonus: 0.01,
    price: 2200,
    blurb: "Forged steel for tuna and marlin — snap is still the real threat.",
  },
];

const BY_ID = new Map(HOOKS.map((h) => [h.id, h]));

export function getHook(id: string): HookDef | undefined {
  return BY_ID.get(id);
}

export function effectiveHookHold(
  baseHold: number,
  fishTier: number,
  hook: HookDef | null,
): number {
  if (!hook?.forTiers.includes(fishTier)) return baseHold;
  return Math.min(1, baseHold + hook.holdBonus);
}

/** Starter hook every player begins with. */
export const STARTER_HOOK_ID = "standard-j";
/** Hooks given on a fresh save. */
export const STARTER_HOOK_COUNT = 10;
