/**
 * Progression time-gates (v2):
 *  - SPOT LOCK: landing a fish at a spot locks it for a flat 6h (re-entry
 *    blocked; the session itself continues). Applies to every spot uniformly.
 *  - COOLER COOLDOWN: filling the 24-slot cooler locks *keeping* fish for 6h
 *    ("re-icing"). Selling and catch-and-release stay unrestricted, so the
 *    Fishdex/mythic grind is never gated.
 * The cooler cooldown follows the player (account-level), so region rotation
 * can't dodge it. Tuned via `npm run sim:pacing`.
 */

/** Real-world hours a spot stays locked after you fish it. */
export const SPOT_LOCK_HOURS = 6;
/** Real-world hours the cooler takes to re-ice once filled. */
export const COOLER_COOLDOWN_HOURS = 6;

/**
 * Global multiplier on both lock durations. Premium boosters can lower it (or
 * bypass a single lock via PlayerStore.replenishSpot / reiceCooler) without
 * touching the tuning constants.
 */
export const REST_TIME_MULT = 1;

export function spotLockMs(): number {
  return SPOT_LOCK_HOURS * 3_600_000 * REST_TIME_MULT;
}

export function coolerCooldownMs(): number {
  return COOLER_COOLDOWN_HOURS * 3_600_000 * REST_TIME_MULT;
}

/** "2h 13m" / "14m" / "<1m" — for lock countdowns in the UI. */
export function fmtRestLeft(ms: number): string {
  const totalMin = Math.ceil(ms / 60_000);
  if (totalMin < 1) return "<1m";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
}
