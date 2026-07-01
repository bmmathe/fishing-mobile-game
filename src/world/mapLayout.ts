/** Vertical space below the safe-area top for the wallet / trophy / shop row (App mapOverlay). */
export const MAP_PLAYER_CONTROLS_OFFSET = 44;

export function mapBelowControlsTop(baseInset = 14): string {
  return `calc(max(${baseInset}px, env(safe-area-inset-top)) + ${MAP_PLAYER_CONTROLS_OFFSET}px)`;
}
