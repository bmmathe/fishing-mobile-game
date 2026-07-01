# Product Requirements Document (PRD)

**Project Name:** _World of Fishing_ (Working Title) - Social Fishing Game
**Document Date:** June 17, 2026
**Status:** Draft / Concept phase

---

## 1. Executive Summary

_World of Fishing_ is a real-time, highly social multiplayer fishing simulation game. It combines skill-based fishing mechanics with a robust player-driven economy and real-estate management system. Players compete for highly sought-after, limited-occupancy fishing spots, trade catches, and progress from simple shorefishers to captains of their own customized fishing boats. The game emphasizes social interaction, dynamic markets, and strategic progression.

## 2. Core Gameplay Loop

1. **Acquire a Spot:** Secure a fishing spot (either by finding an open slot, paying dynamic entry fees, or buying out another player's spot).
2. **Fish:** Utilize skill-based fishing mechanics, leveraging current gear and bait.
3. **Harvest & Manage:** Catch fish (standard or seasonal) and decide whether to sell them to the standard merchant, auction them to other players, or display them on a personal Trophy Wall.
4. **Upgrade & Expand:** Reinvest earnings into better poles, exclusive bait, or personal boats (paying maintenance/storage) to access higher-tier fish pools and exclusive deep-water locations.

---

## 3. Key Features & Mechanics

### 3.1. Locations & Real-Time Occupancy

- **Diverse Biomes:** Multiple lakes, ocean piers, and beachside locations, each featuring distinct "pools" of fish species.
- **Real-Time Occupancy Limits:** Every location has a strict maximum occupancy (e.g., the Ocean Dock holds a maximum of 10 players).
- **Session Management:** When a player's session ends (app closed, timeout, manual departure), their spot immediately becomes available in real-time.
- **Dynamic Pricing (Foot-Only Spots):** Entry costs for terrestrial spots (beachside, lakeside, pier) fluctuate dynamically based on current popularity and server demand.
- **Player-to-Player Spot Trading:** Players currently occupying a highly contested spot can field real-time offers and sell their spot to waiting players for in-game currency.

### 3.2. Fishing Mechanics & Gear Progression

- **Skill-Based Minigames:** Catching fish requires mechanical skill, ensuring gameplay remains engaging.
- **Gear Dependencies:** Upgrading gear (poles, lines, reels) makes the fishing mechanics easier and is heavily gatekept by tier. High-tier fish will snap low-tier lines or escape low-tier gear.
- **The Bait Economy:** \* Standard bait can be bought from NPC merchants.
  - _Premium/Best Bait_ is entirely player-driven: it cannot be purchased from NPCs. It must be caught manually or purchased from other players via the Auction House.

### 3.3. Boats & Advanced Fishing Holes

- **Boat Ownership:** Players can eventually purchase their own vessels to bypass foot-only occupancy limits and reach deep-water fishing holes.
- **Operating Costs:** Owning a boat introduces recurring economic sinks, specifically maintenance fees and marina storage/docking costs.
- **Boat Upgrades:** Players can outfit their boats with advanced tech.
  - _Example:_ **Fishing Radar** – scans the current location and reveals the specific fish pools available in the immediate area.

### 4. Economy & Marketplace

- **Standard Merchant (NPC):** Buys standard fish at fixed, predictable baseline prices. Serves as the economic floor for the game.
- **Auction House (Player-to-Player):** A live market where players can auction rare fish, premium bait, or craftable materials. The system takes a small percentage-based transaction fee as an economic sink.
- **Trophy Wall:** Players can opt out of selling their rarest catches, instead mounting them on a personal, customizable Trophy Wall visible to visiting friends and competitors.

### 5. Live Operations & Events

- **Seasonal Fish:** Limited-time fish species rotate into the game based on real-world seasons or specific in-game events, driving short-term engagement and Auction House activity.
- **Tournaments (Future Roadmap):** Competitive fishing events based on weight, rarity, or quantity within a specific time limit.

---

## 6. Technical Requirements

- **Real-Time WebSockets:** Required for live spot occupancy, spot trading, and Auction House bids.
- **Database Management:** High-frequency transaction databases needed to handle dynamic pricing, inventory, and player-to-player spot handoffs.
- **Idle/Timeout Logic:** Strict session management to automatically free up occupancy slots if a player goes AFK or disconnects.

## 7. Next Steps

1. Finalize the core fishing mechanic prototype (tension/reel minigame).
2. Model the basic economy (Standard merchant payouts vs. Gear upgrade costs).
3. Develop the real-time server architecture for the 10-player dock occupancy test.

---

## 8. Implementation Status — single-player prototype (updated 2026-06-20)

The original "Next Steps" 1 & 2 are done; the full single-player loop is built. Tech stack:
**React + TypeScript + Three.js (React Three Fiber)**, mobile-wrapped via **Ionic Capacitor**;
state in small external stores with **localStorage** persistence; tuning validated by headless
`npm run sim*` scripts. Detail lives in [README.md](../README.md) and
[fish_tiers.md](fish_tiers.md).

**Built**

- **Fishing minigame** (§3.2) — skill-based drag-to-reel + steer with tension management; two
  failure modes (line **snap** at high tiers, **shake-off** at low tiers). Not a QTE/simple bar.
- **Cast → wait → bite → fight** — per-spot wait-to-bite distribution (hole quality S–D) with a
  nibble tell and recast.
- **8 fish tiers** × fresh/salt, with **bait fish** and **junk** — see [fish_tiers.md](fish_tiers.md).
- **Overworld map** (§3.1, partial) — stylized low-poly 3D US, 8 regions; pick a free coastal start,
  **pay to travel** between regions (central regions cost more).
- **Locations** (§3.1) — per-region spots: **free** foot spots (stream/river/lake/beach) and **paid
  premium** foot spots (docks/piers); a per-session **fishing fee** on premium/boat spots; a
  **limited cooler** is the natural session limiter.
- **Gear progression** (§3.2) — line tiers (raise the snap limit → unlock higher tiers), pole
  tiers (reel speed), and **hook tackle** (tier-specific shake-off reduction), gated by currency.
- **Bait economy** (§3.2) — keep forage as bait; equip it to bias toward higher tiers / shorten wait.
  Standard bait (Worms) is NPC-buyable; premium bait is catch-only.
- **Boats & deep water** (§3.3) — 4 boat tiers (lake-only → ocean); a top-down boat-navigation view
  to reach the boat-only deep-water spots.
- **Economy** (§4, partial) — Standard NPC **Merchant** (sell catches & bait); currency sinks =
  travel, gear, boats, fishing fees.
- **Trophy Wall** (§4) — mount prized catches instead of selling. Plus a **Fishdex** (species
  collection log with records).

**Not built yet**

- **Real-time multiplayer & occupancy** (§1, §3.1, §6) — single-player only; no server/WebSockets,
  no live spot occupancy/timeout, no player-to-player spot trading.
- **Auction House** (§4) — player-to-player trading; catches/bait sell to the NPC merchant only.
- **Dynamic spot pricing** (§3.1), **boat operating costs / radar** (§3.3), **seasonal fish &
  tournaments** (§5).
- **Monetization** — designed to be fully free-playable; stamina/energy + premium currency are a
  planned later "pay-to-win" layer (casual players still progress for free).
- **Production**: never run on a physical device yet; JS bundle is &gt;1 MB (no code-splitting).
